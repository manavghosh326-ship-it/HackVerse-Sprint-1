import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODEL = "gemini-3.5-flash-lite";;
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 768;

// ─── Types ─────────────────────────────────────────

interface AgentResult {
  agent_name: string;
  signal: string;
  confidence: number;
  reasoning: string;
  sources: any;
  latency_ms: number;
}

interface PriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  avg_volume_20d: number | null;
}

interface NewsRow {
  headline: string;
  source: string;
  published_at: string;
}

interface FilingRow {
  id: string;
  filing_type: string;
  filing_date: string;
  excerpt: string;
}

// ─── Gemini helpers ─────────────────────────────────

async function geminiGenerate(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

async function geminiEmbed(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIM,
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini Embed API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const embedding = data?.embedding?.values;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Gemini Embed returned no embedding values");
  }
  return embedding;
}

// ─── Agent implementations ─────────────────────────────────────────

async function runTechnicalAgent(
  supabase: any,
  ticker: string
): Promise<AgentResult> {
  const start = Date.now();

  const { data: prices, error } = await supabase
    .from("price_data")
    .select("date, open, high, low, close, volume, avg_volume_20d")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(20);

  if (error) throw new Error(`Price query error: ${error.message}`);
  if (!prices || prices.length < 2) {
    return {
      agent_name: "Technical Agent",
      signal: "unavailable",
      confidence: 0,
      reasoning: "Insufficient price data available for technical analysis.",
      sources: { prices: [] },
      latency_ms: Date.now() - start,
    };
  }

  const priceRows: PriceRow[] = prices;
  const latest = priceRows[0];
  const fiveDaysAgo = priceRows[4] || priceRows[priceRows.length - 1];
  const momentum = ((latest.close - fiveDaysAgo.close) / fiveDaysAgo.close) * 100;

  const avgVol = latest.avg_volume_20d || priceRows.slice(0, 20).reduce((s, p) => s + p.volume, 0) / Math.min(20, priceRows.length);
  const volumeAnomaly = latest.volume / avgVol;

  const prompt = `You are a Technical Analysis Agent for retail investors. Analyze the following price and volume data for ${ticker}:

Latest close: $${latest.close}
5-day momentum: ${momentum.toFixed(2)}%
Latest volume: ${latest.volume.toLocaleString()}
20-day avg volume: ${avgVol.toLocaleString()}
Volume anomaly ratio: ${volumeAnomaly.toFixed(2)}x

Recent price data (most recent first):
${priceRows.slice(0, 10).map(p => `  ${p.date}: O=${p.open} H=${p.high} L=${p.low} C=${p.close} V=${p.volume}`).join("\n")}

Classify the technical signal as bullish, bearish, or neutral. Provide:
1. Signal: bullish | bearish | neutral
2. Confidence: 0-100 (integer)
3. Reasoning: 2-4 sentences explaining momentum, volume anomaly, and price action.

Respond in this exact JSON format:
{"signal":"bullish|bearish|neutral","confidence":0,"reasoning":"..."}`;

  const text = await geminiGenerate(prompt, "You are a precise technical analysis agent. Respond only with valid JSON.");
  const parsed = parseAgentJson(text);

  return {
    agent_name: "Technical Agent",
    signal: parsed.signal || "neutral",
    confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
    reasoning: parsed.reasoning || text.slice(0, 500),
    sources: { momentum_pct: momentum, volume_anomaly: volumeAnomaly, latest_close: latest.close },
    latency_ms: Date.now() - start,
  };
}

async function runSentimentAgent(
  supabase: any,
  ticker: string,
  feedOutage: boolean
): Promise<AgentResult> {
  const start = Date.now();

  if (feedOutage) {
    return {
      agent_name: "Sentiment Agent",
      signal: "unavailable",
      confidence: 0,
      reasoning: "Feed outage simulated — no news data available. Sentiment signal is unavailable. Synthesis should treat sentiment as unknown and reduce overall confidence accordingly.",
      sources: { headlines: [], outage: true },
      latency_ms: Date.now() - start,
    };
  }

  const { data: news, error } = await supabase
    .from("news")
    .select("headline, source, published_at")
    .eq("ticker", ticker)
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(`News query error: ${error.message}`);
  if (!news || news.length === 0) {
    return {
      agent_name: "Sentiment Agent",
      signal: "unavailable",
      confidence: 0,
      reasoning: "No recent news headlines found for this ticker. Sentiment signal is unavailable.",
      sources: { headlines: [] },
      latency_ms: Date.now() - start,
    };
  }

  const newsRows: NewsRow[] = news;
  const headlinesText = newsRows.map((n, i) => `${i + 1}. "${n.headline}" — ${n.source} (${new Date(n.published_at).toLocaleDateString()})`).join("\n");

  const prompt = `You are a Sentiment Analysis Agent for retail investors. Analyze the following recent news headlines for ${ticker}:

${headlinesText}

Classify overall sentiment as positive, negative, or neutral. Provide:
1. Signal: positive | negative | neutral
2. Confidence: 0-100 (integer)
3. Reasoning: 2-4 sentences referencing specific headlines by number.

Respond in this exact JSON format:
{"signal":"positive|negative|neutral","confidence":0,"reasoning":"..."}`;

  const text = await geminiGenerate(prompt, "You are a sentiment analysis agent. Respond only with valid JSON.");
  const parsed = parseAgentJson(text);

  return {
    agent_name: "Sentiment Agent",
    signal: parsed.signal || "neutral",
    confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
    reasoning: parsed.reasoning || text.slice(0, 500),
    sources: { headlines: newsRows.map(n => n.headline), sources: newsRows.map(n => n.source) },
    latency_ms: Date.now() - start,
  };
}

async function runFundamentalsAgent(
  supabase: any,
  ticker: string
): Promise<AgentResult> {
  const start = Date.now();

  // Embed the query
  const queryText = `Recent fundamentals and risk factors for ${ticker}`;
  let queryEmbedding: number[];
  try {
    queryEmbedding = await geminiEmbed(queryText);
  } catch (e) {
    // Fallback: retrieve filings without semantic search
    const { data: fallbackFilings } = await supabase
      .from("filings")
      .select("id, filing_type, filing_date, excerpt")
      .eq("ticker", ticker)
      .order("filing_date", { ascending: false })
      .limit(3);

    if (!fallbackFilings || fallbackFilings.length === 0) {
      return {
        agent_name: "Fundamentals Agent",
        signal: "unavailable",
        confidence: 0,
        reasoning: "No filing data available and embedding generation failed.",
        sources: { excerpts: [] },
        latency_ms: Date.now() - start,
      };
    }

    return summarizeFilings(supabase, ticker, fallbackFilings, start);
  }

  // Retrieve filings with embeddings and do cosine similarity in-app
  const { data: filings, error } = await supabase
    .from("filings")
    .select("id, filing_type, filing_date, excerpt, embedding")
    .eq("ticker", ticker);

  if (error) throw new Error(`Filings query error: ${error.message}`);
  if (!filings || filings.length === 0) {
    return {
      agent_name: "Fundamentals Agent",
      signal: "unavailable",
      confidence: 0,
      reasoning: "No filing data available for this ticker.",
      sources: { excerpts: [] },
      latency_ms: Date.now() - start,
    };
  }

  // Compute cosine similarity in-app
  const scored = filings
    .filter((f: any) => f.embedding && Array.isArray(f.embedding))
    .map((f: any) => ({
      ...f,
      score: cosineSimilarity(queryEmbedding, f.embedding as number[]),
    }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3);

  const topFilings = scored.length > 0 ? scored : filings.slice(0, 3);

  return summarizeFilings(supabase, ticker, topFilings.map((f: any) => ({
    id: f.id,
    filing_type: f.filing_type,
    filing_date: f.filing_date,
    excerpt: f.excerpt,
  })), start);
}

async function summarizeFilings(
  supabase: any,
  ticker: string,
  filings: FilingRow[],
  start: number
): Promise<AgentResult> {
  const excerptsText = filings.map((f, i) =>
    `Excerpt ${i + 1} (${f.filing_type}, ${f.filing_date}):\n${f.excerpt}`
  ).join("\n\n---\n\n");

  const prompt = `You are a Fundamentals Analysis Agent for retail investors. You must analyze ONLY the following SEC filing excerpts for ${ticker}. Do not use any external knowledge — ground every claim in the provided text.

${excerptsText}

Based ONLY on the excerpts above, provide:
1. Signal: bullish | bearish | neutral
2. Confidence: 0-100 (integer)
3. Reasoning: 3-5 sentences summarizing key fundamentals and risk factors. For each claim, cite which excerpt it came from (e.g., "Per Excerpt 1...").

Respond in this exact JSON format:
{"signal":"bullish|bearish|neutral","confidence":0,"reasoning":"..."}`;

  const text = await geminiGenerate(prompt, "You are a fundamentals analysis agent using RAG. Ground all claims in provided excerpts. Respond only with valid JSON.");
  const parsed = parseAgentJson(text);

  return {
    agent_name: "Fundamentals Agent",
    signal: parsed.signal || "neutral",
    confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
    reasoning: parsed.reasoning || text.slice(0, 500),
    sources: { excerpts: filings.map(f => ({ filing_type: f.filing_type, filing_date: f.filing_date, excerpt_preview: f.excerpt.slice(0, 200) })) },
    latency_ms: Date.now() - start,
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function parseAgentJson(text: string): any {
  // Try to extract JSON from the response
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

// ─── Synthesis ─────────────────────────────────────────

async function runSynthesis(
  ticker: string,
  riskProfile: string,
  agents: AgentResult[],
  watchlist: string[]
): Promise<{ recommendation: string; confidence: number; reasoning: string }> {
  const agentsSummary = agents.map(a =>
    `### ${a.agent_name}\n- Signal: ${a.signal}\n- Confidence: ${a.confidence}/100\n- Reasoning: ${a.reasoning}\n- Sources: ${JSON.stringify(a.sources)}`
  ).join("\n\n");

  const prompt = `You are a senior investment synthesis analyst. Synthesize these 3 independent analyst views for a ${riskProfile} investor evaluating ${ticker}.

## Agent Analyses

${agentsSummary}

## Investor Context
- Risk Profile: ${riskProfile}
- Current Watchlist: ${watchlist.join(", ") || "None"}

## Instructions
Synthesize the 3 independent analyst views for a ${riskProfile} investor. Weigh disagreement between agents explicitly. If any agent's signal is "unavailable", acknowledge the reduced confidence and do NOT fabricate a signal for that dimension.

Return:
1. Recommendation: Buy | Hold | Sell | Wait
2. Confidence: 0-100 (integer) — reduce if any agent was unavailable
3. Reasoning: 4-8 sentences referencing each agent by name, noting agreements and disagreements, and tailoring to the ${riskProfile} risk profile.

Respond in this exact JSON format:
{"recommendation":"Buy|Hold|Sell|Wait","confidence":0,"reasoning":"..."}`;

  const text = await geminiGenerate(prompt, "You are a senior investment synthesis analyst. Be balanced and reference each agent by name. Respond only with valid JSON.");
  const parsed = parseAgentJson(text);

  return {
    recommendation: parsed.recommendation || "Hold",
    confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
    reasoning: parsed.reasoning || text.slice(0, 1000),
  };
}

// ─── Main handler ─────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { ticker, risk_profile, feed_outage, user_id, supabase_url, supabase_key } = await req.json();

    if (!ticker || !risk_profile || !user_id || !supabase_url || !supabase_key) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: ticker, risk_profile, user_id, supabase_url, supabase_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a supabase client authenticated as the calling user, so RLS (auth.uid()) works
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabase_url, supabase_key, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Create session
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        ticker,
        risk_profile,
        feed_outage: feed_outage || false,
        user_id,
      })
      .select()
      .single();

    if (sessionErr || !session) {
      throw new Error(`Failed to create session: ${sessionErr?.message}`);
    }

    const sessionId = session.id;

    // 2. Fetch watchlist for synthesis context
    const { data: watchlistRows } = await supabase
      .from("watchlist")
      .select("ticker")
      .eq("user_id", user_id);

    const watchlist = (watchlistRows || []).map((w: any) => w.ticker);

    // 3. Run 3 agents in PARALLEL
    const [technical, sentiment, fundamentals] = await Promise.all([
      runTechnicalAgent(supabase, ticker).catch(e => ({
        agent_name: "Technical Agent",
        signal: "unavailable",
        confidence: 0,
        reasoning: `Agent error: ${e.message}`,
        sources: {},
        latency_ms: 0,
      }) as AgentResult),
      runSentimentAgent(supabase, ticker, feed_outage || false).catch(e => ({
        agent_name: "Sentiment Agent",
        signal: "unavailable",
        confidence: 0,
        reasoning: `Agent error: ${e.message}`,
        sources: {},
        latency_ms: 0,
      }) as AgentResult),
      runFundamentalsAgent(supabase, ticker).catch(e => ({
        agent_name: "Fundamentals Agent",
        signal: "unavailable",
        confidence: 0,
        reasoning: `Agent error: ${e.message}`,
        sources: {},
        latency_ms: 0,
      }) as AgentResult),
    ]);

    const agents = [technical, sentiment, fundamentals];

    // 4. Log agent_runs
    for (const agent of agents) {
      await supabase.from("agent_runs").insert({
        session_id: sessionId,
        user_id,
        agent_name: agent.agent_name,
        signal: agent.signal,
        confidence: agent.confidence,
        reasoning: agent.reasoning,
        sources: agent.sources,
        latency_ms: agent.latency_ms,
      });
    }

    // 5. Synthesis
    const synthesis = await runSynthesis(ticker, risk_profile, agents, watchlist);

    const finalRecommendation = {
      recommendation: synthesis.recommendation,
      confidence: synthesis.confidence,
      reasoning: synthesis.reasoning,
      agents: agents.map(a => ({
        agent_name: a.agent_name,
        signal: a.signal,
        confidence: a.confidence,
      })),
    };

    await supabase
      .from("sessions")
      .update({ final_recommendation: finalRecommendation })
      .eq("id", sessionId);

    // 6. Compute and insert session_metrics
    const avgLatency = agents.reduce((s, a) => s + a.latency_ms, 0) / agents.length;
    const signalConfidenceAvg = agents.reduce((s, a) => s + a.confidence, 0) / agents.length;

    // Portfolio concentration: what fraction of watchlist is this single ticker
    const concentrationScore = watchlist.length > 0 ? (1 / watchlist.length) * 100 : 100;

    const metrics = [
      { session_id: sessionId, user_id, metric_name: "avg_agent_latency_ms", metric_value: Math.round(avgLatency) },
      { session_id: sessionId, user_id, metric_name: "portfolio_concentration_score", metric_value: Math.round(concentrationScore * 100) / 100 },
      { session_id: sessionId, user_id, metric_name: "signal_confidence_avg", metric_value: Math.round(signalConfidenceAvg * 100) / 100 },
    ];

    for (const m of metrics) {
      await supabase.from("session_metrics").insert(m);
    }

    // 7. Return full result
    return new Response(
      JSON.stringify({
        session_id: sessionId,
        ticker,
        risk_profile,
        feed_outage: feed_outage || false,
        agents,
        synthesis: finalRecommendation,
        metrics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});