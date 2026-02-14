'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Building2, Zap, FileText, Play, Download, RefreshCw } from 'lucide-react';

interface Company {
  id: string; ticker: string; name: string;
  researchBrief: string; sentiment: string; recentMention: string;
  price?: number; priceChange?: number; priceChangePct?: string;
  firstMentioned: string; lastUpdated: string;
}

interface Catalyst {
  id: string; type: string; description: string;
  analysis: string; sentiment: string; detectedAt: string;
  company: { name: string; ticker: string };
}

interface Digest {
  id: string; content: string;
  stockCount: number; catalystCount: number; generatedAt: string;
}

function PriceBadge({ company }: { company: Company }) {
  if (!company.price) return null;
  const up = (company.priceChange ?? 0) >= 0;
  return (
    <div className="text-right">
      <p className="text-white text-2xl font-bold">${company.price.toFixed(2)}</p>
      <p className={`text-sm font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
        {up ? '▲' : '▼'} {company.priceChangePct}
      </p>
    </div>
  );
}

function SentimentPill({ value }: { value: string }) {
  const colors: Record<string, string> = {
    bullish:  'bg-green-500/20 text-green-300',
    bearish:  'bg-red-500/20 text-red-300',
    positive: 'bg-green-500/20 text-green-300',
    negative: 'bg-red-500/20 text-red-300',
    neutral:  'bg-gray-500/20 text-gray-300',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[value] ?? colors.neutral}`}>
      {value}
    </span>
  );
}

export default function Dashboard() {
  const [tab,       setTab]       = useState<'profiles' | 'catalysts' | 'digest'>('profiles');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [catalysts, setCatalysts] = useState<Catalyst[]>([]);
  const [digests,   setDigests]   = useState<Digest[]>([]);
  const [tweets,    setTweets]    = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [scraping,  setScraping]  = useState(false);
  const [digesting, setDigesting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/data');
      const data = await res.json();
      setCompanies(data.companies);
      setCatalysts(data.catalysts);
      setDigests(data.digests);
      setTweets(data.tweetCount);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runScrape = async () => {
    setScraping(true);
    try {
      await fetch('/api/scrape', { method: 'POST' });
      await fetchData();
    } finally {
      setScraping(false);
    }
  };

  const runDigest = async () => {
    setDigesting(true);
    try {
      await fetch('/api/digest', { method: 'POST' });
      await fetchData();
    } finally {
      setDigesting(false);
    }
  };

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ companies, catalysts, digests }, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `x-market-int-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-indigo-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">x-market-int</h1>
              <p className="text-indigo-200 text-sm">
                Monitoring @{process.env.NEXT_PUBLIC_MONITOR_HANDLE ?? 'elonmusk'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportData}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={fetchData} disabled={loading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 text-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={runScrape} disabled={scraping}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 text-sm">
              <Play className={`w-4 h-4 ${scraping ? 'animate-pulse' : ''}`} />
              {scraping ? 'Scraping…' : 'Scrape Now'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-400/30 rounded-lg p-4">
            <Building2 className="w-6 h-6 text-blue-300 mb-2" />
            <p className="text-blue-200 text-sm">Stocks Tracked</p>
            <p className="text-white text-3xl font-bold">{companies.length}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-400/30 rounded-lg p-4">
            <Zap className="w-6 h-6 text-amber-300 mb-2" />
            <p className="text-amber-200 text-sm">Catalysts Found</p>
            <p className="text-white text-3xl font-bold">{catalysts.length}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-lg p-4">
            <FileText className="w-6 h-6 text-purple-300 mb-2" />
            <p className="text-purple-200 text-sm">Digests</p>
            <p className="text-white text-3xl font-bold">{digests.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-400/30 rounded-lg p-4">
            <TrendingUp className="w-6 h-6 text-green-300 mb-2" />
            <p className="text-green-200 text-sm">Tweets Processed</p>
            <p className="text-white text-3xl font-bold">{tweets}</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 overflow-hidden">
          <div className="flex border-b border-white/20">
            {(['profiles', 'catalysts', 'digest'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 px-6 py-4 font-medium capitalize transition-colors ${
                  tab === t
                    ? 'bg-white/10 text-white border-b-2 border-indigo-400'
                    : 'text-indigo-300 hover:bg-white/5'
                }`}>
                {t === 'profiles'  && `Stock Profiles (${companies.length})`}
                {t === 'catalysts' && `Catalysts (${catalysts.length})`}
                {t === 'digest'    && `Research Digest (${digests.length})`}
              </button>
            ))}
          </div>

          <div className="p-6 max-h-[800px] overflow-y-auto">
            {tab === 'profiles' && (
              <div className="space-y-6">
                {companies.length === 0 && (
                  <p className="text-center text-indigo-300 py-12">No companies tracked yet. Run a scrape to begin.</p>
                )}
                {companies.map(c => (
                  <div key={c.ticker} className="bg-white/5 border border-white/20 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-white">{c.name}</h2>
                        <p className="text-indigo-300 text-lg">{c.ticker}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <SentimentPill value={c.sentiment} />
                        <PriceBadge company={c} />
                      </div>
                    </div>
                    <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-lg p-3 mb-4">
                      <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">Recent Mention</p>
                      <p className="text-white text-sm italic">"{c.recentMention}"</p>
                    </div>
                    <div className="text-indigo-100 leading-relaxed whitespace-pre-wrap text-sm">{c.researchBrief}</div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-xs text-indigo-400">
                      <span>First seen: {new Date(c.firstMentioned).toLocaleDateString()}</span>
                      <span>Updated: {new Date(c.lastUpdated).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'catalysts' && (
              <div className="space-y-6">
                {catalysts.length === 0 && (
                  <p className="text-center text-indigo-300 py-12">No catalysts detected yet.</p>
                )}
                {catalysts.map(c => (
                  <div key={c.id} className="bg-white/5 border border-white/20 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="text-xl font-bold text-white">{c.company.name}</h2>
                        <p className="text-indigo-300">{c.company.ticker}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-medium">{c.type}</span>
                        <SentimentPill value={c.sentiment} />
                      </div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-400/20 rounded-lg p-3 mb-4">
                      <p className="text-amber-200 text-xs font-semibold uppercase tracking-wider mb-1">Catalyst</p>
                      <p className="text-white">{c.description}</p>
                    </div>
                    <div className="text-indigo-100 leading-relaxed whitespace-pre-wrap text-sm">{c.analysis}</div>
                    <p className="mt-4 text-xs text-indigo-400">Detected: {new Date(c.detectedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'digest' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button onClick={runDigest} disabled={digesting || companies.length < 3}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm">
                    {digesting ? 'Generating…' : 'Generate New Digest'}
                  </button>
                </div>
                {digests.length === 0 && (
                  <p className="text-center text-indigo-300 py-12">No digests yet. Track at least 3 companies first.</p>
                )}
                {digests.map(d => (
                  <div key={d.id} className="bg-white/5 border border-white/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-white">Research Digest</h2>
                        <p className="text-indigo-300 text-sm">
                          {new Date(d.generatedAt).toLocaleString()} • {d.stockCount} stocks • {d.catalystCount} catalysts
                        </p>
                      </div>
                    </div>
                    <div className="text-indigo-50 leading-relaxed whitespace-pre-wrap">{d.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
