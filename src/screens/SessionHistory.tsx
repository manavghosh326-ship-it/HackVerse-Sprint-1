import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AnalysisSession, AgentRun } from '@/lib/types';
import { Card, SignalChip, ConfidenceBar, LoadingSpinner, ShimmerRow } from '@/components/ui';
import { formatDateTime } from '@/lib/api';
import { History as HistoryIcon, ChevronDown, ChevronUp, Clock, WifiOff, BarChart3, Newspaper, FileText } from 'lucide-react';

const agentIcons: Record<string, typeof BarChart3> = {
  'Technical Agent': BarChart3,
  'Sentiment Agent': Newspaper,
  'Fundamentals Agent': FileText,
};

export function SessionHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agentRuns, setAgentRuns] = useState<Record<string, AgentRun[]>>({});
  const [loadingRuns, setLoadingRuns] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('sessions')
      .select('id, ticker, risk_profile, final_recommendation, feed_outage, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setLoading(false);
      return;
    }
    setSessions(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const toggleSession = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);

    if (!agentRuns[sessionId] && user) {
      setLoadingRuns(true);
      const { data: runs } = await supabase
        .from('agent_runs')
        .select('id, session_id, agent_name, signal, confidence, reasoning, sources, latency_ms, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      setAgentRuns((prev) => ({ ...prev, [sessionId]: runs || [] }));
      setLoadingRuns(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-teal-400" />
            Session History
          </h2>
          <p className="text-sm text-charcoal-400 mt-1">Past analysis sessions with full agent traces</p>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-5">
            <ShimmerRow className="h-5 w-32 mb-3" />
            <ShimmerRow className="h-4 w-full mb-2" />
            <ShimmerRow className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-teal-400" />
            Session History
          </h2>
          <p className="text-sm text-charcoal-400 mt-1">Past analysis sessions with full agent traces</p>
        </div>
        <span className="text-xs text-charcoal-500">{sessions.length} sessions</span>
      </div>

      {sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-charcoal-800/60 border border-charcoal-700 mb-4">
            <HistoryIcon className="w-6 h-6 text-charcoal-500" />
          </div>
          <h3 className="text-sm font-medium text-charcoal-200 mb-1">No sessions yet</h3>
          <p className="text-xs text-charcoal-500">Run an analysis to see it here</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isExpanded = expandedId === session.id;
            const rec = session.final_recommendation;
            const runs = agentRuns[session.id] || [];

            return (
              <Card key={session.id} className="overflow-hidden">
                {/* Session header */}
                <button
                  onClick={() => toggleSession(session.id)}
                  className="flex items-center justify-between w-full p-4 hover:bg-charcoal-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-charcoal-800/60 border border-charcoal-700">
                      <span className="text-xs font-mono font-medium text-teal-400">
                        {session.ticker.slice(0, 2)}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-white">{session.ticker}</span>
                        {rec && (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            rec.recommendation === 'Buy'
                              ? 'bg-mint-500/15 text-mint-400'
                              : rec.recommendation === 'Sell'
                              ? 'bg-error-500/15 text-error-400'
                              : rec.recommendation === 'Wait'
                              ? 'bg-warning-500/15 text-warning-400'
                              : 'bg-charcoal-700 text-charcoal-300'
                          }`}>
                            {rec.recommendation}
                          </span>
                        )}
                        {session.feed_outage && (
                          <span className="inline-flex items-center gap-1 text-xs text-warning-400">
                            <WifiOff className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-charcoal-500 mt-0.5">
                        {formatDateTime(session.created_at)} · {session.risk_profile}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {rec && (
                      <span className="text-xs font-mono text-charcoal-400">{rec.confidence}%</span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-charcoal-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-charcoal-500" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 animate-slide-down">
                    {/* Synthesis */}
                    {rec && (
                      <div className="rounded-lg bg-teal-500/5 border border-teal-500/20 p-3">
                        <p className="text-xs font-medium text-teal-300 mb-1.5">Synthesis</p>
                        <div className="mb-2">
                          <ConfidenceBar confidence={rec.confidence} />
                        </div>
                        <p className="text-xs text-charcoal-300 leading-relaxed whitespace-pre-wrap">
                          {rec.reasoning}
                        </p>
                      </div>
                    )}

                    {/* Agent runs */}
                    {loadingRuns ? (
                      <div className="flex items-center justify-center py-4">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : runs.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-charcoal-500">Agent Trace</p>
                        {runs.map((run) => {
                          const Icon = agentIcons[run.agent_name] || BarChart3;
                          return (
                            <div
                              key={run.id}
                              className="rounded-lg bg-charcoal-800/40 border border-charcoal-700/60 p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-3.5 h-3.5 text-teal-400" />
                                  <span className="text-xs font-medium text-charcoal-200">{run.agent_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <SignalChip signal={run.signal} />
                                  <span className="text-xs font-mono text-charcoal-500">{run.confidence}%</span>
                                  {run.latency_ms != null && run.latency_ms > 0 && (
                                    <span className="flex items-center gap-1 text-xs text-charcoal-600">
                                      <Clock className="w-3 h-3" />
                                      {(run.latency_ms / 1000).toFixed(1)}s
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mb-2">
                                <ConfidenceBar confidence={run.confidence} />
                              </div>
                              <p className="text-xs text-charcoal-400 leading-relaxed">
                                {run.reasoning}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-charcoal-500 text-center py-2">No agent data available</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
