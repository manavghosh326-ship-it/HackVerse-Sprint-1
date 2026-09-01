import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { TrendingUp, LayoutDashboard, Microscope, History, BarChart2, LogOut, Menu, X } from 'lucide-react';
import { Dashboard } from '@/screens/Dashboard';
import { Analyze } from '@/screens/Analyze';
import { SessionHistory } from '@/screens/SessionHistory';
import { Metrics } from '@/screens/Metrics';

type Screen = 'dashboard' | 'analyze' | 'history' | 'metrics';

const navItems: { id: Screen; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analyze', label: 'Analyze', icon: Microscope },
  { id: 'history', label: 'History', icon: History },
  { id: 'metrics', label: 'Metrics', icon: BarChart2 },
];

export function AppShell() {
  const { user, signOut, riskProfile } = useAuth();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleNav = (s: Screen) => {
    setScreen(s);
    setMobileNavOpen(false);
  };

  const riskLabel = riskProfile.charAt(0).toUpperCase() + riskProfile.slice(1);

  return (
    <div className="min-h-screen bg-charcoal-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-charcoal-800/80 bg-charcoal-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <TrendingUp className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-white tracking-tight leading-none">MarketMind</h1>
                <p className="text-[10px] text-charcoal-500 leading-none mt-0.5">AI Investment Intelligence</p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = screen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                        : 'text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-800/50 border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Right: risk profile + user + sign out */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800/40 border border-navy-700/40">
                <span className="text-xs text-charcoal-400">Risk:</span>
                <span className="text-xs font-medium text-teal-300">{riskLabel}</span>
              </div>
              <div className="hidden lg:flex items-center text-xs text-charcoal-500">
                {user?.email}
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-charcoal-400 hover:text-error-400 hover:bg-error-500/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="md:hidden p-1.5 rounded-lg text-charcoal-400 hover:text-charcoal-200"
              >
                {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileNavOpen && (
          <nav className="md:hidden border-t border-charcoal-800/60 bg-charcoal-950 animate-slide-down">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = screen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-teal-500/10 text-teal-300'
                        : 'text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6">
        {screen === 'dashboard' && <Dashboard onNavigate={setScreen} />}
        {screen === 'analyze' && <Analyze />}
        {screen === 'history' && <SessionHistory />}
        {screen === 'metrics' && <Metrics />}
      </main>

      {/* Footer */}
      <footer className="border-t border-charcoal-800/60 py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-charcoal-600 text-center">
            MarketMind — AI-powered investment intelligence. Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
