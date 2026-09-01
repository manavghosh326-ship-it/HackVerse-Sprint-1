import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import type { AnalysisResponse, RiskProfile } from './types';

export async function runAnalysis(
  ticker: string,
  riskProfile: RiskProfile,
  feedOutage: boolean,
  userId: string
): Promise<AnalysisResponse> {
  const endpoint = `${SUPABASE_URL}/functions/v1/analyze`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      ticker,
      risk_profile: riskProfile,
      feed_outage: feedOutage,
      user_id: userId,
      supabase_url: SUPABASE_URL,
      supabase_key: SUPABASE_ANON_KEY,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg: string;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error || errJson.message || `Analysis failed (${response.status})`;
    } catch {
      errMsg = `Analysis failed (${response.status})`;
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data as AnalysisResponse;
}

export function formatMarketCap(cap: number | null | undefined): string {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

export function formatVolume(vol: number | null | undefined): string {
  if (!vol) return 'N/A';
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`;
  return vol.toLocaleString();
}

export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return 'N/A';
  return `$${price.toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function getMomentumColor(momentum: number): string {
  if (momentum > 0) return 'text-mint-400';
  if (momentum < 0) return 'text-error-400';
  return 'text-charcoal-300';
}

export function getSignalColor(signal: string): { bg: string; text: string; border: string; label: string } {
  const s = signal.toLowerCase();
  if (s === 'bullish' || s === 'positive') return { bg: 'bg-mint-500/10', text: 'text-mint-400', border: 'border-mint-500/30', label: 'text-mint-400' };
  if (s === 'bearish' || s === 'negative') return { bg: 'bg-error-500/10', text: 'text-error-400', border: 'border-error-500/30', label: 'text-error-400' };
  if (s === 'unavailable') return { bg: 'bg-warning-500/10', text: 'text-warning-400', border: 'border-warning-500/30', label: 'text-warning-400' };
  return { bg: 'bg-charcoal-500/10', text: 'text-charcoal-300', border: 'border-charcoal-500/30', label: 'text-charcoal-300' };
}

export function getRecommendationColor(rec: string): { bg: string; text: string; border: string } {
  const r = rec.toLowerCase();
  if (r === 'buy') return { bg: 'bg-mint-500/15', text: 'text-mint-400', border: 'border-mint-500/40' };
  if (r === 'sell') return { bg: 'bg-error-500/15', text: 'text-error-400', border: 'border-error-500/40' };
  if (r === 'wait') return { bg: 'bg-warning-500/15', text: 'text-warning-400', border: 'border-warning-500/40' };
  return { bg: 'bg-charcoal-500/15', text: 'text-charcoal-300', border: 'border-charcoal-500/40' };
}

export { supabase };
