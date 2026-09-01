import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { runAnalysis, formatPrice, formatDate } from '@/lib/api';
import type { Stock, AnalysisResponse, AgentResult } from '@/lib/types';
import { Card, SignalChip, ConfidenceBar, LoadingSpinner } from '@/components/ui';
import {
  Microscope, Play, ChevronDown, ChevronUp, BarChart3, Newspaper, FileText,
  Zap, AlertTriangle, Clock, Sparkles, Activity, WifiOff
} from 'lucide-react';

const agentIcons: Record<string, typeof BarChart3> = {
  'Technical Agent': BarChart3,
  'Sentiment Agent': Newspaper,
  'Fundamentals Agent': FileText,
};

export function Analyze() {
  const { user, riskProfile } = useAuth();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [feedOutage, setFeedOutage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [synthesisExpanded, setSynthesisExpanded] = useState(true);

  useEffect(() => {
    supabase
      .from('stocks')
      .select('ticker, company_name, sector, market_cap, description')
      .order('ticker')
      .then(({ data }) => {
        setStocks(data || []);
        if (data && data.length > 0 && !selectedTicker) {
          setSelectedTicker(data[0].ticker);
        }
      });
  }, []);

  const handleRunAnalysis = async () => {
    if (!selectedTicker || !user) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedAgent(null);
    setSynthesisExpanded(true);

    try {
      const res = await runAnalysis(selectedTicker, riskProfile, feedOutage, user.id);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed. Make sure the Gemini API key is configured.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = (name: string) => {
    setExpandedAgent(expandedAgent === name ? null : name);
  };

  const selectedStock = stocks.find((s) => s.ticker === selectedTicker);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Microscope className="w-5 h-5 text-teal-400" />
          Analyze
        </h2>
        <p className="text-sm text-charcoal-400 mt-1">
          Run multi-agent AI analysis on any ticker
        </p>
      </div>

      {/* Controls */}
      <Card className="p-5 space-y-4">
        {/* Ticker selector */}
        <div>
          <label className="block text-xs font-medium text-charcoal-400 mb-2">Select Ticker</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {stocks.map((stock) => (
              <button
                key={stock.ticker}
                onClick={() => setSelectedTicker(stock.ticker)}
                disabled={loading}
                className={`px-3 py-2.5 rounded-lg text-sm font-mono font-medium transition-all border ${
                  selectedTicker === stock.ticker
                    ? 'bg-teal-500/15 text-teal-300 border-teal-500/40'
                    : 'bg-charcoal-800/40 text-charcoal-300 border-charcoal-700 hover:border-charcoal-600'
                } disabled:opacity-50`}
              >
                {stock.ticker}
              </button>
            ))}
          </div>
          {selectedStock && (
            <div className="mt-3 flex items-center gap-3 text-xs text-charcoal-500">
              <span className="font-medium text-charcoal-300">{selectedStock.company_name}</span>
              <span>·</span>
              <span>{selectedStock.sector}</span>
            </div>
          )}
        </div>

        {/* Outage toggle */}
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-charcoal-800/40 border border-charcoal-700/60">
          <div className="flex items-center gap-2.5">
            <WifiOff className={`w-4 h-4 ${feedOutage ? 'text-warning-400' : 'text-charcoal-500'}`} />
            <div>
              <span className="text-sm font-medium text-charcoal-200">Simulate Feed Outage</span>
              <p className="text-xs text-charcoal-500">Disables sentiment agent's news feed</p>
            </div>
          </div>
          <button
            onClick={() => setFeedOutage(!feedOutage)}
            disabled={loading}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              feedOutage ? 'bg-warning-500/40' : 'bg-charcoal-700'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                feedOutage ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {/* Run button */}
        <button
          onClick={handleRunAnalysis}
          disabled={loading || !selectedTicker}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-charcoal-950 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" />
              Running Analysis...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Analysis
            </>
          )}
        </button>
      </Card>

      {/* Error */}
      {error && (
        <Card className="p-4 border-error-500/30 bg-error-500/5 animate-slide-down">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-error-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-error-400">Analysis Failed</p>
              <p className="text-xs text-charcoal-400 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4 animate-fade-in">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Synthesizing agent outputs...</p>
                <p className="text-xs text-charcoal-500">3 agents running in parallel via Gemini</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['Technical Agent', 'Sentiment Agent', 'Fundamentals Agent'].map((name) => {
                const Icon = agentIcons[name] || BarChart3;
                return (
                  <div key={name} className="rounded-lg border border-charcoal-700/60 bg-charcoal-800/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-4 h-4 text-teal-400" />
                      <span className="text-xs font-medium text-charcoal-300">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span className="text-xs text-charcoal-500">Analyzing...</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Synthesis Card */}
          <Card className="overflow-hidden">
            <button
              onClick={() => setSynthesisExpanded(!synthesisExpanded)}
              className="flex items-center justify-between w-full p-5 hover:bg-charcoal-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Synthesis</p>
                  <p className="text-xs text-charcoal-500">
                    {result.ticker} · {riskProfile} investor
                    {result.feed_outage && ' · feed outage simulated'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-md text-sm font-semibold ${
                    result.synthesis.recommendation === 'Buy'
                      ? 'bg-mint-500/15 text-mint-400'
                      : result.synthesis.recommendation === 'Sell'
                      ? 'bg-error-500/15 text-error-400'
                      : result.synthesis.recommendation === 'Wait'
                      ? 'bg-warning-500/15 text-warning-400'
                      : 'bg-charcoal-700 text-charcoal-300'
                  }`}>
                    {result.synthesis.recommendation}
                  </span>
                </div>
                {synthesisExpanded ? (
                  <ChevronUp className="w-4 h-4 text-charcoal-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-charcoal-500" />
                )}
              </div>
            </button>

            {synthesisExpanded && (
              <div className="px-5 pb-5 animate-slide-down">
                {/* Confidence bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-charcoal-500">Confidence</span>
                    <span className="text-xs font-mono text-teal-300">{result.synthesis.confidence}/100</span>
                  </div>
                  <ConfidenceBar confidence={result.synthesis.confidence} />
                </div>

                {/* Reasoning */}
                <div className="rounded-lg bg-charcoal-800/40 border border-charcoal-700/60 p-4">
                  <p className="text-sm text-charcoal-200 leading-relaxed whitespace-pre-wrap">
                    {result.synthesis.reasoning}
                  </p>
                </div>

                {/* Agent signals summary */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {result.synthesis.agents.map((a) => (
                    <div key={a.agent_name} className="rounded-lg bg-charcoal-800/30 border border-charcoal-700/40 p-2.5 text-center">
                      <p className="text-[10px] text-charcoal-500 mb-1 truncate">{a.agent_name.replace(' Agent', '')}</p>
                      <SignalChip signal={a.signal} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Agent Cards */}
          {result.agents.map((agent) => (
            <AgentCard
              key={agent.agent_name}
              agent={agent}
              expanded={expandedAgent === agent.agent_name}
              onToggle={() => toggleAgent(agent.agent_name)}
            />
          ))}

          {/* Session info */}
          <div className="flex items-center justify-center gap-4 text-xs text-charcoal-600">
            <span>Session: {result.session_id.slice(0, 8)}</span>
            <span>·</span>
            <span>{formatDate(new Date().toISOString())}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agent Card Component ─────────────────────────────────

function AgentCard({
  agent,
  expanded,
  onToggle,
}: {
  agent: AgentResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = agentIcons[agent.agent_name] || Activity;
  const sources = agent.sources as any;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full p-4 hover:bg-charcoal-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-charcoal-800/60 border border-charcoal-700">
            <Icon className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{agent.agent_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <SignalChip signal={agent.signal} />
              <span className="text-xs text-charcoal-500 font-mono">{agent.confidence}%</span>
              {agent.latency_ms > 0 && (
                <span className="flex items-center gap-1 text-xs text-charcoal-600">
                  <Clock className="w-3 h-3" />
                  {(agent.latency_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-charcoal-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-charcoal-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 animate-slide-down">
          <div className="mb-3">
            <ConfidenceBar confidence={agent.confidence} />
          </div>

          {/* Reasoning */}
          <div className="rounded-lg bg-charcoal-800/40 border border-charcoal-700/60 p-3 mb-3">
            <p className="text-xs text-charcoal-400 leading-relaxed whitespace-pre-wrap">
              {agent.reasoning}
            </p>
          </div>

          {/* Sources */}
          {sources && Object.keys(sources).length > 0 && (
            <div className="text-xs">
              <p className="text-charcoal-500 mb-1.5 font-medium">Sources</p>
              <div className="space-y-1">
                {sources.headlines && Array.isArray(sources.headlines) && sources.headlines.length > 0 && (
                  <div className="rounded-md bg-charcoal-800/30 p-2 border border-charcoal-700/40">
                    {sources.headlines.map((h: string, i: number) => (
                      <p key={i} className="text-charcoal-400 text-xs py-0.5">
                        · {h}
                      </p>
                    ))}
                  </div>
                )}
                {sources.excerpts && Array.isArray(sources.excerpts) && sources.excerpts.length > 0 && (
                  <div className="rounded-md bg-charcoal-800/30 p-2 border border-charcoal-700/40">
                    {sources.excerpts.map((e: any, i: number) => (
                      <p key={i} className="text-charcoal-400 text-xs py-0.5">
                        · {e.filing_type} ({formatDate(e.filing_date)}): {e.excerpt_preview}...
                      </p>
                    ))}
                  </div>
                )}
                {sources.momentum_pct !== undefined && (
                  <div className="rounded-md bg-charcoal-800/30 p-2 border border-charcoal-700/40 space-y-0.5">
                    <p className="text-charcoal-400">Momentum: <span className="text-teal-300 font-mono">{sources.momentum_pct.toFixed(2)}%</span></p>
                    <p className="text-charcoal-400">Volume anomaly: <span className="text-teal-300 font-mono">{sources.volume_anomaly?.toFixed(2)}x</span></p>
                    <p className="text-charcoal-400">Latest close: <span className="text-teal-300 font-mono">{formatPrice(sources.latest_close)}</span></p>
                  </div>
                )}
                {sources.outage && (
                  <div className="rounded-md bg-warning-500/10 p-2 border border-warning-500/30">
                    <p className="text-warning-400 flex items-center gap-1.5">
                      <WifiOff className="w-3 h-3" />
                      Feed outage simulated — no news data
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
