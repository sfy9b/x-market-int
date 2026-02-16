'use client';

import { useState } from 'react';
import { History, TrendingUp, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface TickerResult {
  ticker:       string;
  name:         string;
  context:      string;
  timestamp:    string;
  mentionCount: number;
}

interface BackfillResult {
  success:       boolean;
  monthsBack:    number;
  totalTweets:   number;
  uniqueTickers: number;
  tickers:       TickerResult[];
}

export default function BackfillPage() {
  const [monthsBack,  setMonthsBack]  = useState(3);
  const [running,     setRunning]     = useState(false);
  const [results,     setResults]     = useState<BackfillResult | null>(null);
  const [error,       setError]       = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const runBackfill = async () => {
    setRunning(true);
    setError('');
    setResults(null);
    try {
      const res  = await fetch('/api/backfill', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ monthsBack }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  };

  const filtered = results?.tickers.filter(t =>
    !searchQuery ||
    t.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const exportCSV = () => {
    if (!results) return;
    const rows = [
      ['Ticker', 'Company', 'Mentions', 'Last Context', 'Last Seen'],
      ...results.tickers.map(t => [
        t.ticker,
        t.name,
        t.mentionCount,
        `"${t.context.replace(/"/g, "'")}"`,
        new Date(t.timestamp).toLocaleDateString(),
      ])
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `x-market-int-backfill-${monthsBack}mo-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-8 h-8 text-indigo-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Historical Backfill</h1>
                <p className="text-indigo-200 text-sm">Scan past tweets for company and ticker mentions</p>
              </div>
            </div>
            <Link href="/"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-indigo-200 text-sm mb-2 block">How far back to scan</label>
              <div className="flex gap-2">
                {[1, 2, 3, 6].map(m => (
                  <button key={m} onClick={() => setMonthsBack(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      monthsBack === m
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/10 text-indigo-200 hover:bg-white/20'
                    }`}>
                    {m} {m === 1 ? 'month' : 'months'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={runBackfill} disabled={running}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2">
              {running ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Run Backfill
                </>
              )}
            </button>
          </div>

          {running && (
            <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-400/20 rounded-lg">
              <p className="text-indigo-200 text-sm">
                Scraping {monthsBack} month{monthsBack > 1 ? 's' : ''} of tweets — this takes
                <span className="text-white font-medium"> {monthsBack * 1}-{monthsBack * 3} minutes</span>. Hang tight…
              </p>
              <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-400/30 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {results && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 p-4">
                <p className="text-indigo-200 text-sm">Tweets Scanned</p>
                <p className="text-white text-3xl font-bold">{results.totalTweets}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 p-4">
                <p className="text-indigo-200 text-sm">Unique Tickers</p>
                <p className="text-white text-3xl font-bold">{results.uniqueTickers}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 p-4">
                <p className="text-indigo-200 text-sm">Period</p>
                <p className="text-white text-3xl font-bold">{results.monthsBack}mo</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter by ticker or company name…"
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <button onClick={exportCSV}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">
                Export CSV
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20 text-left">
                    <th className="px-6 py-4 text-indigo-300 text-sm font-semibold">Ticker</th>
                    <th className="px-6 py-4 text-indigo-300 text-sm font-semibold">Company</th>
                    <th className="px-6 py-4 text-indigo-300 text-sm font-semibold text-center">Mentions</th>
                    <th className="px-6 py-4 text-indigo-300 text-sm font-semibold">Context</th>
                    <th className="px-6 py-4 text-indigo-300 text-sm font-semibold">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.ticker}
                      className={`border-b border-white/10 hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/5'}`}>
                      <td className="px-6 py-4">
                        <span className="text-white font-bold text-lg">{t.ticker}</span>
                      </td>
                      <td className="px-6 py-4 text-indigo-100">{t.name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          t.mentionCount >= 3 ? 'bg-green-500/20 text-green-300' :
                          t.mentionCount === 2 ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-white/10 text-indigo-300'
                        }`}>
                          {t.mentionCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-indigo-200 text-sm italic max-w-xs truncate">"{t.context}"</td>
                      <td className="px-6 py-4 text-indigo-300 text-sm">{new Date(t.timestamp).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-indigo-300">No results found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
