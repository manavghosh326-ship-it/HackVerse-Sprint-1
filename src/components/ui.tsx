import { ReactNode } from 'react';

interface SignalChipProps {
  signal: string;
  className?: string;
}

export function SignalChip({ signal, className = '' }: SignalChipProps) {
  const s = signal.toLowerCase();
  let bg = 'bg-charcoal-700';
  let text = 'text-charcoal-300';
  let border = 'border-charcoal-600';

  if (s === 'bullish' || s === 'positive') {
    bg = 'bg-mint-500/10'; text = 'text-mint-400'; border = 'border-mint-500/30';
  } else if (s === 'bearish' || s === 'negative') {
    bg = 'bg-error-500/10'; text = 'text-error-400'; border = 'border-error-500/30';
  } else if (s === 'unavailable') {
    bg = 'bg-warning-500/10'; text = 'text-warning-400'; border = 'border-warning-500/30';
  } else if (s === 'neutral') {
    bg = 'bg-charcoal-600/40'; text = 'text-charcoal-300'; border = 'border-charcoal-500/40';
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${bg} ${text} ${border} ${className}`}>
      {signal}
    </span>
  );
}

interface ConfidenceBarProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBar({ confidence, className = '' }: ConfidenceBarProps) {
  const pct = Math.max(0, Math.min(100, confidence));
  let color = 'bg-teal-500';
  if (pct >= 70) color = 'bg-mint-500';
  else if (pct >= 40) color = 'bg-teal-500';
  else if (pct > 0) color = 'bg-warning-500';
  else color = 'bg-charcoal-600';

  return (
    <div className={`h-1.5 w-full rounded-full bg-charcoal-800 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface MomentumChipProps {
  momentum: number;
}

export function MomentumChip({ momentum }: MomentumChipProps) {
  const isUp = momentum > 0;
  const isFlat = Math.abs(momentum) < 0.01;
  const color = isFlat ? 'text-charcoal-300' : isUp ? 'text-mint-400' : 'text-error-400';
  const bg = isFlat ? 'bg-charcoal-700' : isUp ? 'bg-mint-500/10' : 'bg-error-500/10';
  const border = isFlat ? 'border-charcoal-600' : isUp ? 'border-mint-500/20' : 'border-error-500/20';
  const arrow = isFlat ? '→' : isUp ? '↑' : '↓';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border ${bg} ${color} ${border}`}>
      {arrow} {Math.abs(momentum).toFixed(2)}%
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-charcoal-700/60 bg-charcoal-900/60 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <svg className={`animate-spin ${dims} text-teal-400`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ShimmerRow({ className = '' }: { className?: string }) {
  return <div className={`shimmer-bg rounded-lg ${className}`} />;
}
