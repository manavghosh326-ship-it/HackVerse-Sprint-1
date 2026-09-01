import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { RiskProfile } from '@/lib/types';
import { TrendingUp, Mail, Lock, Shield, BarChart3, Newspaper, FileText } from 'lucide-react';

type Mode = 'signin' | 'signup';

const riskProfiles: { value: RiskProfile; label: string; desc: string }[] = [
  { value: 'conservative', label: 'Conservative', desc: 'Prioritize capital preservation' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced growth and stability' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Maximize growth potential' },
];

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('moderate');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fn = mode === 'signin' ? signIn : () => signUp(email, password, riskProfile);
    const { error: err } = await fn(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-charcoal-950 via-navy-950 to-charcoal-950">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-navy-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-4">
            <TrendingUp className="w-7 h-7 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">MarketMind</h1>
          <p className="text-sm text-charcoal-400 mt-1">Multi-agent AI investment intelligence</p>
        </div>

        <div className="rounded-2xl border border-charcoal-700/60 bg-charcoal-900/80 backdrop-blur-xl p-6 sm:p-8">
          <div className="flex gap-1 mb-6 p-1 rounded-lg bg-charcoal-800/60">
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signup' ? 'bg-teal-500/20 text-teal-300' : 'text-charcoal-400 hover:text-charcoal-200'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signin' ? 'bg-teal-500/20 text-teal-300' : 'text-charcoal-400 hover:text-charcoal-200'
              }`}
            >
              Sign In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-charcoal-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-charcoal-800/60 border border-charcoal-700 text-sm text-white placeholder-charcoal-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-charcoal-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-charcoal-800/60 border border-charcoal-700 text-sm text-white placeholder-charcoal-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div className="animate-slide-down">
                <label className="block text-xs font-medium text-charcoal-400 mb-1.5">Risk Profile</label>
                <div className="grid grid-cols-1 gap-2">
                  {riskProfiles.map((rp) => (
                    <button
                      key={rp.value}
                      type="button"
                      onClick={() => setRiskProfile(rp.value)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        riskProfile === rp.value
                          ? 'border-teal-500/50 bg-teal-500/10'
                          : 'border-charcoal-700 bg-charcoal-800/40 hover:border-charcoal-600'
                      }`}
                    >
                      <Shield className={`w-4 h-4 ${riskProfile === rp.value ? 'text-teal-400' : 'text-charcoal-500'}`} />
                      <div>
                        <div className={`text-sm font-medium ${riskProfile === rp.value ? 'text-teal-300' : 'text-charcoal-200'}`}>
                          {rp.label}
                        </div>
                        <div className="text-xs text-charcoal-500">{rp.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-error-500/10 border border-error-500/30 px-3 py-2 text-sm text-error-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-charcoal-950 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-charcoal-800/60 border border-charcoal-700 mb-2">
              <BarChart3 className="w-5 h-5 text-teal-400" />
            </div>
            <p className="text-xs text-charcoal-500">Technical</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-charcoal-800/60 border border-charcoal-700 mb-2">
              <Newspaper className="w-5 h-5 text-mint-400" />
            </div>
            <p className="text-xs text-charcoal-500">Sentiment</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-charcoal-800/60 border border-charcoal-700 mb-2">
              <FileText className="w-5 h-5 text-navy-300" />
            </div>
            <p className="text-xs text-charcoal-500">Fundamentals</p>
          </div>
        </div>
      </div>
    </div>
  );
}
