import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 768;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { ticker, supabase_url, supabase_key } = await req.json();

    if (!supabase_url || !supabase_key) {
      return new Response(
        JSON.stringify({ error: "Missing supabase_url or supabase_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key for write access to filings table
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabase_url, serviceRoleKey || supabase_key);

    // Fetch filings without embeddings (or all filings for a specific ticker)
    let query = supabase
      .from("filings")
      .select("id, ticker, filing_type, filing_date, excerpt");

    if (ticker) {
      query = query.eq("ticker", ticker);
    }

    const { data: filings, error: fetchErr } = await query;

    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
    if (!filings || filings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No filings found to embed", embedded: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process SEQUENTIALLY with 2-second delay between each call
    let embedded = 0;
    let errors: string[] = [];

    for (let i = 0; i < filings.length; i++) {
      const filing = filings[i];

      try {
        const embedding = await geminiEmbed(filing.excerpt);

        const { error: updateErr } = await supabase
          .from("filings")
          .update({ embedding })
          .eq("id", filing.id);

        if (updateErr) {
          errors.push(`Failed to update filing ${filing.id}: ${updateErr.message}`);
        } else {
          embedded++;
        }
      } catch (e) {
        errors.push(`Failed to embed filing ${filing.id} (${filing.ticker}): ${e.message}`);
      }

      // 2-second delay between each embedding call (rate limit safety)
      // Skip delay after the last item
      if (i < filings.length - 1) {
        await sleep(2000);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Embedded ${embedded} of ${filings.length} filings`,
        embedded,
        total: filings.length,
        errors: errors.length > 0 ? errors : undefined,
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
