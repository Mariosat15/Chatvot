'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CleanupSchedule {
  type: 'daily' | 'weekly' | 'monthly';
  hour: number;
  weekDays: number[];
  monthWeek: number;
}

interface MarketDataSettings {
  cleanup: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    daysToKeep: number;
    lastRun: string | null;
    schedule: CleanupSchedule;
  };
  gapFill: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    lastRun: string | null;
  };
  priceUpdateMode: 'polling' | 'websocket';
  pollingIntervalMs: number;
  websocketIntervalMs: number;
}

interface MarketDataStats {
  totalCandles: number;
  storage: {
    mb: string;
    gb: string;
  };
  dateRange: {
    oldest: string | null;
    newest: string | null;
    daysOfData: number;
  };
  growth: {
    candlesPerDay: number;
    mbPerDay: string;
    projectedMbPerMonth: string;
    projectedGbPerYear: string;
  };
  symbolCounts: Array<{ symbol: string; count: number }>;
  health: {
    status: string;
    message: string;
  };
}

interface Gap {
  symbol: string;
  startTime: number;
  endTime: number;
  missingMinutes: number;
}

interface TradingSymbol {
  symbol: string;
  name: string;
  enabled: boolean;
  category: string;
}

interface SeedResult {
  symbol: string;
  fetched: number;
  inserted: number;
  skipped: number;
  error?: string;
}

// Collapsible Section Component
function Section({ 
  title, 
  icon, 
  children, 
  defaultOpen = true,
  badge,
  badgeColor = 'gray'
}: { 
  title: string; 
  icon: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: 'gray' | 'green' | 'blue' | 'red' | 'yellow' | 'purple';
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const badgeColors = {
    gray: 'bg-gray-600 text-gray-200',
    green: 'bg-green-600/30 text-green-400 border border-green-500/30',
    blue: 'bg-blue-600/30 text-blue-400 border border-blue-500/30',
    red: 'bg-red-600/30 text-red-400 border border-red-500/30',
    yellow: 'bg-yellow-600/30 text-yellow-400 border border-yellow-500/30',
    purple: 'bg-purple-600/30 text-purple-400 border border-purple-500/30',
  };
  
  return (
    <div className="bg-[#1a1d29] rounded-xl border border-gray-800/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="text-white font-semibold text-lg">{title}</span>
          {badge !== undefined && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColors[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, subValue, color = 'white' }: { 
  label: string; 
  value: string | number; 
  subValue?: string;
  color?: 'white' | 'green' | 'blue' | 'yellow' | 'red';
}) {
  const colors = {
    white: 'text-white',
    green: 'text-green-400',
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };
  
  return (
    <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
      <div className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
      {subValue && <div className="text-gray-500 text-xs mt-0.5">{subValue}</div>}
    </div>
  );
}

export default function MarketDataSection() {
  const [settings, setSettings] = useState<MarketDataSettings | null>(null);
  const [stats, setStats] = useState<MarketDataStats | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [gapFillRunning, setGapFillRunning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [availableSymbols, setAvailableSymbols] = useState<TradingSymbol[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [seedFromDate, setSeedFromDate] = useState('');
  const [seedToDate, setSeedToDate] = useState('');
  const [seedRunning, setSeedRunning] = useState(false);
  const [seedResults, setSeedResults] = useState<SeedResult[] | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        fetch('/api/market-data/settings'),
        fetch('/api/market-data/stats'),
      ]);
      if (settingsRes.ok) setSettings((await settingsRes.json()).settings);
      if (statsRes.ok) setStats((await statsRes.json()).stats);
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSymbols = async () => {
    try {
      const res = await fetch('/api/symbols?enabled=true');
      if (res.ok) setAvailableSymbols((await res.json()).symbols || []);
    } catch (error) {
      console.error('Error fetching symbols:', error);
    }
  };

  const fetchGaps = async () => {
    try {
      const res = await fetch('/api/market-data/gap-fill');
      if (res.ok) setGaps((await res.json()).gaps || []);
    } catch (error) {
      console.error('Error fetching gaps:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchGaps();
    fetchSymbols();
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setSeedToDate(today.toISOString().split('T')[0]);
    setSeedFromDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, [fetchData]);

  const saveSettings = async (newSettings: Partial<MarketDataSettings>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/market-data/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        setSettings((await res.json()).settings);
        setMessage({ type: 'success', text: 'Settings saved!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error saving' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const runCleanup = async () => {
    if (!settings) return;
    setCleanupRunning(true);
    try {
      const res = await fetch('/api/market-data/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysToKeep: settings.cleanup.daysToKeep }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: 'success', text: `Deleted ${data.cleanup.deletedCount} candles, freed ${data.cleanup.freedMB} MB` });
        fetchData();
      } else {
        setMessage({ type: 'error', text: 'Cleanup failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error running cleanup' });
    } finally {
      setCleanupRunning(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const runGapFill = async () => {
    setGapFillRunning(true);
    try {
      const res = await fetch('/api/market-data/gap-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: 'success', text: `Filled ${data.gapFill.totalCandlesFilled} candles across ${data.gapFill.totalGapsFilled} gaps` });
        fetchGaps();
        fetchData();
      } else {
        setMessage({ type: 'error', text: 'Gap fill failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error running gap fill' });
    } finally {
      setGapFillRunning(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const runSeedHistory = async () => {
    if (selectedSymbols.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one symbol' });
      return;
    }
    if (!seedFromDate || !seedToDate) {
      setMessage({ type: 'error', text: 'Please select date range' });
      return;
    }
    setSeedRunning(true);
    setSeedResults(null);
    try {
      const res = await fetch('/api/market-data/seed-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: selectedSymbols, fromDate: seedFromDate, toDate: seedToDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setSeedResults(data.results);
        setMessage({ type: 'success', text: `Seeding complete! Inserted ${data.summary.totalInserted} candles` });
        fetchData();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Seeding failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error running seed' });
    } finally {
      setSeedRunning(false);
      setTimeout(() => setMessage(null), 10000);
    }
  };

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-gray-400">Loading market data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Market Data</h1>
          <p className="text-gray-500 text-sm mt-1">Manage candle data, price updates, and historical data</p>
        </div>
        <button
          onClick={() => { fetchData(); fetchGaps(); }}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 border border-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Toast Message */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {message.type === 'success' ? '✓' : '✕'} {message.text}
        </div>
      )}

      {/* Quick Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Candles" value={stats.totalCandles.toLocaleString()} />
          <StatCard label="Storage" value={`${stats.storage.mb} MB`} subValue={`${stats.storage.gb} GB`} />
          <StatCard label="Days of Data" value={stats.dateRange.daysOfData} color="blue" />
          <StatCard 
            label="Health" 
            value={stats.health.status === 'healthy' ? '● Healthy' : '● Warning'} 
            color={stats.health.status === 'healthy' ? 'green' : 'yellow'} 
          />
        </div>
      )}

      {/* Real-Time Updates Section */}
      <Section 
        title="Real-Time Updates" 
        icon="📡" 
        badge={settings?.priceUpdateMode === 'websocket' ? 'WebSocket' : 'Polling'}
        badgeColor={settings?.priceUpdateMode === 'websocket' ? 'green' : 'blue'}
      >
        {settings && (
          <div className="space-y-5">
            {/* Mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="inline-flex bg-[#12141c] rounded-lg p-1 border border-gray-800/50">
                <button
                  onClick={() => saveSettings({ priceUpdateMode: 'polling' })}
                  className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                    settings.priceUpdateMode === 'polling'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  📊 Polling
                </button>
                <button
                  onClick={() => saveSettings({ priceUpdateMode: 'websocket' })}
                  className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                    settings.priceUpdateMode === 'websocket'
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  ⚡ WebSocket
                </button>
              </div>
              <p className="text-sm text-gray-400">
                {settings.priceUpdateMode === 'polling' 
                  ? `Browsers poll every ${settings.pollingIntervalMs}ms`
                  : `Server broadcasts every ${settings.websocketIntervalMs}ms`}
              </p>
            </div>

            {/* Interval Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-blue-400 font-medium text-sm">Polling Interval</span>
                  <span className="text-gray-500 text-xs">50-2000ms</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="50"
                    value={settings.pollingIntervalMs}
                    onChange={(e) => saveSettings({ pollingIntervalMs: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="w-16 text-right">
                    <span className="text-white font-mono text-sm">{settings.pollingIntervalMs}</span>
                    <span className="text-gray-500 text-xs ml-0.5">ms</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-green-400 font-medium text-sm">WebSocket Interval</span>
                  <span className="text-gray-500 text-xs">50-2000ms</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="50"
                    value={settings.websocketIntervalMs}
                    onChange={(e) => saveSettings({ websocketIntervalMs: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  <div className="w-16 text-right">
                    <span className="text-white font-mono text-sm">{settings.websocketIntervalMs}</span>
                    <span className="text-gray-500 text-xs ml-0.5">ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mode Info */}
            <div className="bg-[#12141c]/50 rounded-lg p-4 border border-gray-800/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <div className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    Polling Mode
                  </div>
                  <ul className="text-gray-500 space-y-1 ml-4">
                    <li>• Browsers request data periodically</li>
                    <li>• Higher server load with many users</li>
                    <li>• Most reliable & stable</li>
                  </ul>
                </div>
                <div>
                  <div className="text-green-400 font-medium mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    WebSocket Mode
                  </div>
                  <ul className="text-gray-500 space-y-1 ml-4">
                    <li>• Server pushes to all browsers</li>
                    <li>• 99% less server requests</li>
                    <li>• Faster updates (~10ms)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Data Maintenance Section */}
      <Section title="Data Maintenance" icon="🔧" defaultOpen={false}>
        {settings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cleanup Card */}
            <div className="bg-[#12141c] rounded-lg p-5 border border-gray-800/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold flex items-center gap-2">
                  🗑️ Cleanup Old Data
                </h4>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.cleanup.enabled}
                    onChange={(e) => saveSettings({ cleanup: { ...settings.cleanup, enabled: e.target.checked } })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Keep data for</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={settings.cleanup.daysToKeep}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        saveSettings({ cleanup: { ...settings.cleanup, daysToKeep: Number.isNaN(val) ? 0 : Math.max(0, val) } });
                      }}
                      className="bg-gray-800 text-white rounded-lg px-3 py-2 w-20 border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                    <span className="text-gray-400">days</span>
                    <span className="text-gray-600 text-sm">
                      (~{((settings.cleanup.daysToKeep * 9.5)).toFixed(0)} MB)
                    </span>
                  </div>
                  {settings.cleanup.daysToKeep === 0 && (
                    <p className="text-red-400 text-xs mt-2">⚠️ Will delete ALL history!</p>
                  )}
                </div>

                {settings.cleanup.lastRun && (
                  <p className="text-gray-500 text-xs">
                    Last run: {new Date(settings.cleanup.lastRun).toLocaleString()}
                  </p>
                )}
                
                <button
                  onClick={runCleanup}
                  disabled={cleanupRunning || saving}
                  className="w-full px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {cleanupRunning ? '⏳ Running...' : '🗑️ Run Cleanup Now'}
                </button>
              </div>
            </div>

            {/* Gap Fill Card */}
            <div className="bg-[#12141c] rounded-lg p-5 border border-gray-800/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold flex items-center gap-2">
                  🔧 Gap Detection
                  {gaps.length > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded-full">
                      {gaps.length} gaps
                    </span>
                  )}
                </h4>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.gapFill.enabled}
                    onChange={(e) => saveSettings({ gapFill: { ...settings.gapFill, enabled: e.target.checked } })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="space-y-4">
                {gaps.length > 0 ? (
                  <div className="bg-gray-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {gaps.slice(0, 8).map((gap, i) => {
                      const startDate = new Date(gap.startTime * 1000);
                      const endDate = new Date(gap.endTime * 1000);
                      return (
                        <div key={i} className="text-xs text-gray-400 py-1 border-b border-gray-800/50 last:border-0">
                          <span className="text-white">{gap.symbol}</span>: {startDate.toLocaleDateString()} → {endDate.toLocaleDateString()} 
                          <span className="text-yellow-400 ml-1">
                            ({gap.missingMinutes >= 1440 ? `${Math.round(gap.missingMinutes / 1440)}d` : `${gap.missingMinutes}m`})
                          </span>
                        </div>
                      );
                    })}
                    {gaps.length > 8 && <div className="text-gray-500 text-xs pt-1">+{gaps.length - 8} more</div>}
                  </div>
                ) : (
                  <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-3 text-green-400 text-sm text-center">
                    ✓ No gaps detected
                  </div>
                )}

                {settings.gapFill.lastRun && (
                  <p className="text-gray-500 text-xs">
                    Last run: {new Date(settings.gapFill.lastRun).toLocaleString()}
                  </p>
                )}
                
                <button
                  onClick={runGapFill}
                  disabled={gapFillRunning || saving || gaps.length === 0}
                  className="w-full px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {gapFillRunning ? '⏳ Filling...' : '🔧 Fill Gaps Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Historical Data Import Section */}
      <Section title="Import Historical Data" icon="📥" defaultOpen={false}>
        <div className="space-y-5">
          {/* Date Range */}
          <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
            <h4 className="text-white font-medium mb-4">Date Range</h4>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-gray-500 text-xs block mb-1">From</label>
                <input
                  type="date"
                  value={seedFromDate}
                  onChange={(e) => setSeedFromDate(e.target.value)}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">To</label>
                <input
                  type="date"
                  value={seedToDate}
                  onChange={(e) => setSeedToDate(e.target.value)}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setSeedToDate(new Date().toISOString().split('T')[0])}
                className="text-blue-400 hover:text-blue-300 text-sm mt-5"
              >
                Set to today →
              </button>
            </div>
            <p className="text-yellow-500/70 text-xs mt-3">
              💡 Set &quot;To&quot; date to today to avoid gaps between seeded and live data
            </p>
          </div>

          {/* Symbol Selection */}
          <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">
                Select Symbols 
                <span className="text-gray-500 font-normal ml-2">({selectedSymbols.length}/{availableSymbols.length})</span>
              </h4>
              <div className="flex gap-3 text-sm">
                <button onClick={() => setSelectedSymbols(availableSymbols.map(s => s.symbol))} className="text-blue-400 hover:text-blue-300">
                  Select All
                </button>
                <button onClick={() => setSelectedSymbols([])} className="text-gray-400 hover:text-gray-300">
                  Clear
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-40 overflow-y-auto">
              {availableSymbols.map((sym) => (
                <button
                  key={sym.symbol}
                  onClick={() => toggleSymbol(sym.symbol)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedSymbols.includes(sym.symbol)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {sym.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Estimation */}
          {selectedSymbols.length > 0 && seedFromDate && seedToDate && (
            <div className="bg-purple-600/10 border border-purple-600/20 rounded-lg p-4 text-sm">
              <span className="text-purple-400">📊 Estimated:</span>
              <span className="text-white ml-2">
                ~{(Math.ceil((new Date(seedToDate).getTime() - new Date(seedFromDate).getTime()) / (1000 * 60 * 60 * 24)) * 1440 * selectedSymbols.length).toLocaleString()} candles
              </span>
              <span className="text-gray-500 ml-2">
                ({Math.ceil((new Date(seedToDate).getTime() - new Date(seedFromDate).getTime()) / (1000 * 60 * 60 * 24))} days × {selectedSymbols.length} symbols)
              </span>
            </div>
          )}

          {/* Results */}
          {seedResults && (
            <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30 max-h-40 overflow-y-auto">
              <h4 className="text-white font-medium mb-2">Results</h4>
              <div className="space-y-1">
                {seedResults.map((result, i) => (
                  <div key={i} className={`text-xs ${result.error ? 'text-red-400' : 'text-gray-400'}`}>
                    <span className="text-white">{result.symbol}</span>: {result.error ? `❌ ${result.error}` : `✓ ${result.inserted} inserted`}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={runSeedHistory}
            disabled={seedRunning || selectedSymbols.length === 0}
            className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {seedRunning ? '⏳ Importing...' : '📥 Start Import'}
          </button>
        </div>
      </Section>
    </div>
  );
}
