import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { SessionMetric, AnalysisSession } from '@/lib/types';
import { Card, LoadingSpinner, ShimmerRow } from '@/components/ui';
import { formatDateTime } from '@/lib/api';
import { BarChart2, Clock, Target, Layers, TrendingUp } from 'lucide-react';

interface SessionWithMetrics {
  session: AnalysisSession;
  metrics: SessionMetric[];
}

const metricMeta: Record<string, { label: string; icon: typeof Clock; format: (v: number) => string; color: string }> = {
  avg_agent_latency_ms: {
    label: 'Avg Agent Latency',
    icon: Clock,
    format: (v) => `${(v / 1000).toFixed(2)}s`,
    color: 'text-teal-400',
  },
  portfolio_concentration_score: {
    label: 'Portfolio Concentration',
    icon: Layers,
    format: (v) => `${v.toFixed(1)}%`,
    color: 'text-navy-300',
  },
  signal_confidence_avg: {
    label: 'Signal Confidence Avg',
    icon: Target,
    format: (v) => `${v.toFixed(1)}/100`,
    color: 'text-mint-400',
  },
};

export function Metrics() {
  const { user } = useAuth();
  const [sessionsWithMetrics, setSessionsWithMetrics] = useState<SessionWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('id, ticker, risk_profile, final_recommendation, feed_outage, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !sessions || sessions.length === 0) {
      setLoading(false);
      return;
    }

    const sessionIds = sessions.map((s) => s.id);
    const { data: metrics } = await supabase
      .from('session_metrics')
      .select('id, session_id, metric_name, metric_value, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true });

    const metricsBySession = new Map<string, SessionMetric[]>();
    for (const m of metrics || []) {
      const arr = metricsBySession.get(m.session_id) || [];
      arr.push(m as SessionMetric);
      metricsBySession.set(m.session_id, arr);
    }

    const combined: SessionWithMetrics[] = sessions.map((s) => ({
      session: s as AnalysisSession,
      metrics: metricsBySession.get(s.id) || [],
    }));

    setSessionsWithMetrics(combined);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Latest session metrics cards
  const latest = sessionsWithMetrics[0];

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-teal-400" />
            Metrics
          </h2>
          <p className="text-sm text-charcoal-400 mt-1">Performance metrics from your latest sessions</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <ShimmerRow className="h-4 w-24 mb-3" />
              <ShimmerRow className="h-8 w-20 mb-2" />
              <ShimmerRow className="h-3 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-teal-400" />
          Metrics
        </h2>
        <p className="text-sm text-charcoal-400 mt-1">Performance metrics from your analysis sessions</p>
      </div>

      {sessionsWithMetrics.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-charcoal-800/60 border border-charcoal-700 mb-4">
            <BarChart2 className="w-6 h-6 text-charcoal-500" />
          </div>
          <h3 className="text-sm font-medium text-charcoal-200 mb-1">No metrics yet</h3>
          <p className="text-xs text-charcoal-500">Run an analysis to generate metrics</p>
        </Card>
      ) : (
        <>
          {/* Latest session metric cards */}
          {latest && latest.metrics.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-medium text-white">
                  Latest Session: {latest.session.ticker}
                </h3>
                <span className="text-xs text-charcoal-500">
                  {formatDateTime(latest.session.created_at)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {latest.metrics.map((m) => {
                  const meta = metricMeta[m.metric_name];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <Card key={m.id} className="p-5 animate-slide-up">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-charcoal-800/60 border border-charcoal-700">
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <span className="text-xs text-charcoal-400">{meta.label}</span>
                      </div>
                      <p className={`text-2xl font-semibold tabular-nums ${meta.color}`}>
                        {meta.format(m.metric_value)}
                      </p>
                      <p className="text-xs text-charcoal-600 mt-1">
                        {m.metric_name}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* All sessions table */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-charcoal-800/60">
              <h3 className="text-sm font-medium text-white">All Session Metrics</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal-800/60">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-charcoal-500">Ticker</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-charcoal-500">Date</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-charcoal-500">Avg Latency</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-charcoal-500">Concentration</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-charcoal-500">Confidence Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsWithMetrics.map(({ session, metrics }) => {
                    const latency = metrics.find((m) => m.metric_name === 'avg_agent_latency_ms');
                    const concentration = metrics.find((m) => m.metric_name === 'portfolio_concentration_score');
                    const confidence = metrics.find((m) => m.metric_name === 'signal_confidence_avg');

                    return (
                      <tr
                        key={session.id}
                        className="border-b border-charcoal-800/40 hover:bg-charcoal-800/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-teal-400">{session.ticker}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-charcoal-400">
                          {formatDateTime(session.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-charcoal-300 font-mono tabular-nums">
                          {latency ? `${(latency.metric_value / 1000).toFixed(2)}s` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-charcoal-300 font-mono tabular-nums">
                          {concentration ? `${concentration.metric_value.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-charcoal-300 font-mono tabular-nums">
                          {confidence ? `${confidence.metric_value.toFixed(1)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
