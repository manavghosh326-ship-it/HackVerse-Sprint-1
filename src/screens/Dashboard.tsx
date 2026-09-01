import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Stock, WatchlistItem, PriceData } from '@/lib/types';
import { formatPrice, formatMarketCap, formatVolume } from '@/lib/api';
import { Card, MomentumChip, LoadingSpinner, ShimmerRow } from '@/components/ui';
import { Search, Plus, Trash2, TrendingUp, X, Microscope, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

interface DashboardProps {
  onNavigate: (screen: 'dashboard' | 'analyze' | 'history' | 'metrics') => void;
}

interface WatchlistEntry extends WatchlistItem {
  latestPrice?: PriceData | null;
  stock?: Stock;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedStatus, setEmbedStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [embedMessage, setEmbedMessage] = useState<string | null>(null);

  const fetchWatchlist = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: wlData, error: wlErr } = await supabase
      .from('watchlist')
      .select('id, ticker, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (wlErr) {
      setError('Failed to load watchlist');
      setLoading(false);
      return;
    }

    const { data: stocksData } = await supabase
      .from('stocks')
      .select('ticker, company_name, sector, market_cap, description');

    const stockMap = new Map<string, Stock>((stocksData || []).map((s: Stock) => [s.ticker, s]));

    // Fetch latest price for each watchlist ticker
    const entries: WatchlistEntry[] = [];
    for (const item of wlData || []) {
      const { data: prices } = await supabase
        .from('price_data')
        .select('id, ticker, date, open, high, low, close, volume, avg_volume_20d')
        .eq('ticker', item.ticker)
        .order('date', { ascending: false })
        .limit(2);

      const fiveDaysAgo = prices?.[1];
      const latest = prices?.[0];
      let momentum = 0;
      if (latest && fiveDaysAgo) {
        momentum = ((latest.close - fiveDaysAgo.close) / fiveDaysAgo.close) * 100;
      }
      // Attach momentum to latest price object
      const latestWithMomentum = latest
        ? { ...latest, _momentum: momentum } as any
        : null;

      entries.push({
        ...item,
        latestPrice: latestWithMomentum,
        stock: stockMap.get(item.ticker),
      });
    }

    setWatchlist(entries);
    setStocks(stocksData || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Search stocks
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toUpperCase().trim();
    const filtered = stocks.filter(
      (s) =>
        s.ticker.includes(q) ||
        s.company_name.toUpperCase().includes(searchQuery.toUpperCase())
    );
    setSearchResults(filtered);
  }, [searchQuery, stocks]);

  const handleAddTicker = async (ticker: string) => {
    if (!user) return;
    setAdding(true);
    setError(null);

    const { error: insErr } = await supabase
      .from('watchlist')
      .insert({ ticker, user_id: user.id });

    if (insErr) {
      if (insErr.code === '23505') {
        setError(`${ticker} is already in your watchlist`);
      } else {
        setError(insErr.message);
      }
      setAdding(false);
      return;
    }

    setSearchQuery('');
    setSearchResults([]);
    await fetchWatchlist();
    setAdding(false);
  };

  const handleRemoveTicker = async (ticker: string, id: string) => {
    if (!user) return;
    const { error: delErr } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (delErr) {
      setError(delErr.message);
      return;
    }
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
  };

  const watchlistTickers = watchlist.map((w) => w.ticker);

  const handleInitEmbeddings = async () => {
    setEmbedStatus('loading');
    setEmbedMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supabase_url: SUPABASE_URL,
          supabase_key: SUPABASE_ANON_KEY,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error || `Failed (${resp.status})`);
      }
      setEmbedStatus('success');
      setEmbedMessage(data.message || `Embedded ${data.embedded} of ${data.total} filings`);
    } catch (e) {
      setEmbedStatus('error');
      setEmbedMessage(e instanceof Error ? e.message : 'Failed to initialize embeddings');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Dashboard</h2>
          <p className="text-sm text-charcoal-400 mt-1">Your watchlist and quick market overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-charcoal-500">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-charcoal-800/60 border border-charcoal-700">
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
            {watchlist.length} {watchlist.length === 1 ? 'ticker' : 'tickers'}
          </span>
        </div>
      </div>

      {/* Add ticker search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticker or company name to add..."
            className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-charcoal-800/60 border border-charcoal-700 text-sm text-white placeholder-charcoal-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-500 hover:text-charcoal-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-charcoal-700 bg-charcoal-900 shadow-xl z-10 overflow-hidden animate-slide-down">
              {searchResults.map((stock) => {
                const inWatchlist = watchlistTickers.includes(stock.ticker);
                return (
                  <button
                    key={stock.ticker}
                    onClick={() => !inWatchlist && handleAddTicker(stock.ticker)}
                    disabled={inWatchlist || adding}
                    className={`flex items-center justify-between w-full px-4 py-2.5 text-left transition-colors ${
                      inWatchlist
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-charcoal-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-medium text-teal-400">{stock.ticker}</span>
                      <span className="text-sm text-charcoal-300">{stock.company_name}</span>
                    </div>
                    {inWatchlist ? (
                      <span className="text-xs text-charcoal-500">Added</span>
                    ) : (
                      <Plus className="w-4 h-4 text-charcoal-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-error-400">{error}</p>}
      </Card>

      {/* Initialize Embeddings — temporary admin setup */}
      <Card className="p-4 border-dashed border-charcoal-600/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-charcoal-200">Initialize Embeddings</p>
              <p className="text-xs text-charcoal-500">One-time setup: generates Gemini embeddings for all filing excerpts</p>
            </div>
          </div>
          <button
            onClick={handleInitEmbeddings}
            disabled={embedStatus === 'loading'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-sm font-medium border border-teal-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {embedStatus === 'loading' ? (
              <>
                <LoadingSpinner size="sm" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Initialize
              </>
            )}
          </button>
        </div>
        {embedStatus === 'success' && embedMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-mint-500/10 border border-mint-500/30 px-3 py-2 animate-slide-down">
            <CheckCircle className="w-4 h-4 text-mint-400 flex-shrink-0" />
            <p className="text-xs text-mint-400">{embedMessage}</p>
          </div>
        )}
        {embedStatus === 'error' && embedMessage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-error-500/10 border border-error-500/30 px-3 py-2 animate-slide-down">
            <AlertCircle className="w-4 h-4 text-error-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-error-400">{embedMessage}</p>
          </div>
        )}
      </Card>

      {/* Watchlist grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <ShimmerRow className="h-5 w-20 mb-3" />
              <ShimmerRow className="h-7 w-28 mb-4" />
              <ShimmerRow className="h-4 w-full mb-2" />
              <ShimmerRow className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-charcoal-800/60 border border-charcoal-700 mb-4">
            <Search className="w-6 h-6 text-charcoal-500" />
          </div>
          <h3 className="text-sm font-medium text-charcoal-200 mb-1">Your watchlist is empty</h3>
          <p className="text-xs text-charcoal-500">Search above to add your first ticker</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((item, idx) => {
            const price = item.latestPrice as any;
            const momentum = price?._momentum ?? 0;
            const stock = item.stock;

            return (
              <Card
                key={item.id}
                className="p-5 hover:border-teal-500/30 transition-colors group animate-slide-up"
              >
                <div
                  className="flex items-start justify-between mb-4"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-mono font-semibold text-white">{item.ticker}</h3>
                      {momentum !== 0 && <MomentumChip momentum={momentum} />}
                    </div>
                    <p className="text-xs text-charcoal-500 mt-0.5 truncate max-w-[180px]">
                      {stock?.company_name || item.ticker}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveTicker(item.ticker, item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-charcoal-500 hover:text-error-400 hover:bg-error-500/5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-white tabular-nums">
                      {formatPrice(price?.close)}
                    </span>
                    {price && (
                      <span className="text-xs text-charcoal-500">
                        {new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-charcoal-500">Volume</span>
                      <p className="text-charcoal-300 font-medium tabular-nums">
                        {formatVolume(price?.volume)}
                      </p>
                    </div>
                    <div>
                      <span className="text-charcoal-500">Market Cap</span>
                      <p className="text-charcoal-300 font-medium">
                        {formatMarketCap(stock?.market_cap)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate('analyze')}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-xs font-medium border border-teal-500/20 transition-colors"
                  >
                    <Microscope className="w-3.5 h-3.5" />
                    Analyze
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
