'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Schedule {
  type: 'weekly' | 'monthly';
  weekDays: number[];  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  monthDay: number;    // 1-28 for monthly runs
  hour: number;        // 0-23
  minute: number;      // 0-59
}

interface CandleLimits {
  '1m': number;
  '5m': number;
  '15m': number;
  '30m': number;
  '1h': number;
  '4h': number;
  '1d': number;
}

interface MarketDataSettings {
  cleanup: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    daysToKeep: number;
    lastRun: string | null;
    schedule: Schedule;
  };
  gapFill: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    lastRun: string | null;
    schedule: Schedule;
  };
  priceUpdateMode: 'polling' | 'websocket';
  pollingIntervalMs: number;
  websocketIntervalMs: number;
  candleLimits: CandleLimits;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Unified Schedule Picker Component - IDENTICAL layout for both Weekly and Monthly
function SchedulePicker({ 
  schedule, 
  onChange,
  disabled = false,
  color = 'blue'
}: { 
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
  disabled?: boolean;
  color?: 'blue' | 'purple';
}) {
  const colorClasses = {
    blue: {
      active: 'bg-blue-600 text-white border-blue-600',
      activeTab: 'bg-blue-600 text-white shadow-lg shadow-blue-600/20',
      text: 'text-blue-400',
      summary: 'border-blue-600/20 bg-blue-600/5',
    },
    purple: {
      active: 'bg-purple-600 text-white border-purple-600',
      activeTab: 'bg-purple-600 text-white shadow-lg shadow-purple-600/20',
      text: 'text-purple-400',
      summary: 'border-purple-600/20 bg-purple-600/5',
    },
  };
  
  const colors = colorClasses[color];

  const toggleDay = (day: number) => {
    const newDays = schedule.weekDays.includes(day)
      ? schedule.weekDays.filter(d => d !== day)
      : [...schedule.weekDays, day].sort();
    onChange({ ...schedule, weekDays: newDays });
  };

  const formatTime = (hour: number, minute: number) => {
    const h = hour.toString().padStart(2, '0');
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const getOrdinal = (n: number) => {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
  };

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Row 1: Frequency */}
      <div className="grid grid-cols-[80px_1fr] items-center gap-3">
        <span className="text-gray-400 text-sm">Frequency</span>
        <div className="inline-flex bg-gray-900/50 rounded-lg p-0.5 border border-gray-800/50 w-fit">
          <button
            onClick={() => onChange({ ...schedule, type: 'weekly' })}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              schedule.type === 'weekly' ? colors.activeTab : 'text-gray-400 hover:text-white'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => onChange({ ...schedule, type: 'monthly' })}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              schedule.type === 'monthly' ? colors.activeTab : 'text-gray-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Row 2: Day Selection - SAME LABEL AND HEIGHT FOR BOTH */}
      <div className="grid grid-cols-[80px_1fr] items-center gap-3">
        <span className="text-gray-400 text-sm">Day</span>
        <div className="min-h-[32px] flex items-center">
          {schedule.type === 'weekly' ? (
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES.map((day, index) => (
                <button
                  key={day}
                  onClick={() => toggleDay(index)}
                  className={`w-10 h-8 rounded-md text-xs font-medium transition-all border ${
                    schedule.weekDays.includes(index)
                      ? colors.active
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                  }`}
                  title={DAY_FULL_NAMES[index]}
                >
                  {day}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={schedule.monthDay}
                onChange={(e) => onChange({ ...schedule, monthDay: parseInt(e.target.value) })}
                className="bg-gray-800 text-white rounded-lg px-3 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm w-20 h-8"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    {day}{getOrdinal(day)}
                  </option>
                ))}
              </select>
              <span className="text-gray-500 text-xs">of each month</span>
            </div>
          )}
        </div>
      </div>

      {/* Warning for no days selected */}
      {schedule.type === 'weekly' && schedule.weekDays.length === 0 && (
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <span></span>
          <p className="text-yellow-500 text-xs">⚠️ Select at least one day</p>
        </div>
      )}

      {/* Row 3: Time */}
      <div className="grid grid-cols-[80px_1fr] items-center gap-3">
        <span className="text-gray-400 text-sm">Time</span>
        <div className="flex items-center gap-1.5">
          <select
            value={schedule.hour}
            onChange={(e) => onChange({ ...schedule, hour: parseInt(e.target.value) })}
            className="bg-gray-800 text-white rounded-lg px-2 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono w-14 h-8"
          >
            {Array.from({ length: 24 }, (_, i) => i).map(h => (
              <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
            ))}
          </select>
          <span className="text-gray-500 font-bold">:</span>
          <select
            value={schedule.minute}
            onChange={(e) => onChange({ ...schedule, minute: parseInt(e.target.value) })}
            className="bg-gray-800 text-white rounded-lg px-2 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono w-14 h-8"
          >
            {[0, 15, 30, 45].map(m => (
              <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
            ))}
          </select>
          <span className="text-gray-500 text-xs ml-1">(UTC)</span>
        </div>
      </div>

      {/* Row 4: Summary */}
      <div className={`rounded-lg px-3 py-2.5 border ${colors.summary}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <span className="text-gray-400 text-xs">
            Will run{' '}
            {schedule.type === 'weekly' ? (
              schedule.weekDays.length > 0 ? (
                <>every <span className={`font-medium ${colors.text}`}>{schedule.weekDays.map(d => DAY_NAMES[d]).join(', ')}</span></>
              ) : (
                <span className="text-yellow-400 font-medium">no days selected</span>
              )
            ) : (
              <>on the <span className={`font-medium ${colors.text}`}>{schedule.monthDay}{getOrdinal(schedule.monthDay)}</span> of each month</>
            )}
            {' '}at <span className={`font-medium ${colors.text}`}>{formatTime(schedule.hour, schedule.minute)} UTC</span>
          </span>
        </div>
      </div>
    </div>
  );
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

      {/* Chart History Limits Section */}
      <Section 
        title="Chart History Limits" 
        icon="📊" 
        badge="Performance"
        badgeColor="yellow"
        defaultOpen={false}
      >
        {settings && (
          <div className="space-y-5">
            <div className="bg-[#12141c]/50 rounded-lg p-4 border border-gray-800/20 mb-4">
              <p className="text-gray-400 text-sm">
                Control how many candles each timeframe loads. Lower values = faster chart loading. 
                These limits are applied per user chart request.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* 1m */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 font-medium text-sm">1 Minute</span>
                </div>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="100"
                  value={settings.candleLimits?.['1m'] || 1440}
                  onChange={(e) => saveSettings({ 
                    candleLimits: { ...settings.candleLimits, '1m': parseInt(e.target.value) || 1440 } 
                  })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <div className="text-gray-500 text-xs mt-1">
                  ≈ {Math.round((settings.candleLimits?.['1m'] || 1440) / 60)} hours
                </div>
              </div>

              {/* 5m */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 font-medium text-sm">5 Minutes</span>
                </div>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="100"
                  value={settings.candleLimits?.['5m'] || 2016}
                  onChange={(e) => saveSettings({ 
                    candleLimits: { ...settings.candleLimits, '5m': parseInt(e.target.value) || 2016 } 
                  })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <div className="text-gray-500 text-xs mt-1">
                  ≈ {Math.round((settings.candleLimits?.['5m'] || 2016) * 5 / 60 / 24)} days
                </div>
              </div>

              {/* 15m */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 font-medium text-sm">15 Minutes</span>
                </div>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="100"
                  value={settings.candleLimits?.['15m'] || 2688}
                  onChange={(e) => saveSettings({ 
                    candleLimits: { ...settings.candleLimits, '15m': parseInt(e.target.value) || 2688 } 
                  })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <div className="text-gray-500 text-xs mt-1">
                  ≈ {Math.round((settings.candleLimits?.['15m'] || 2688) * 15 / 60 / 24)} days
                </div>
              </div>

              {/* 30m */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 font-medium text-sm">30 Minutes</span>
                </div>
                <input
                  type="number"
                  min="100"
                  max="5000"
                  step="100"
                  value={settings.candleLimits?.['30m'] || 1440}
                  onChange={(e) => saveSettings({ 
                    candleLimits: { ...settings.candleLimits, '30m': parseInt(e.target.value) || 1440 } 
                  })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <div className="text-gray-500 text-xs mt-1">
                  ≈ {Math.round((settings.candleLimits?.['30m'] || 1440) * 30 / 60 / 24)} days
                </div>
              </div>

              {/* 1h */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 font-medium text-sm">1 Hour</span>
                </div>
                <input
                  type="number"
                  min="100"
                  max="5000"
                  step="50"
                  value={settings.candleLimits?.['1h'] || 720}
                  onChange={(e) => saveSettings({ 
                    candleLimits: { ...settings.candleLimits, '1h': parseInt(e.target.value) || 720 } 
                  })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <div className="text-gray-500 text-xs mt-1">
                  ≈ {Math.round((settings.candleLimits?.['1h'] || 720) / 24)} days
                </div>
              </div>

              {/* 4h */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 font-medium text-sm">4 Hours</span>
                </div>
                <input
                  type="number"
                  min="50"
                  max="2000"
                  step="50"
                  value={settings.candleLimits?.['4h'] || 540}
                  onChange={(e) => saveSettings({ 
                    candleLimits: { ...settings.candleLimits, '4h': parseInt(e.target.value) || 540 } 
                  })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <div className="text-gray-500 text-xs mt-1">
                  ≈ {Math.round((settings.candleLimits?.['4h'] || 540) * 4 / 24)} days
                </div>
              </div>

              {/* 1d */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 font-medium text-sm">1 Day</span>
                </div>
                <input
                  type="number"
                  min="30"
                  max="1000"
                  step="10"
                  value={settings.candleLimits?.['1d'] || 365}
                  onChange={(e) => saveSettings({ 
                    candleLimits: { ...settings.candleLimits, '1d': parseInt(e.target.value) || 365 } 
                  })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <div className="text-gray-500 text-xs mt-1">
                  ≈ {Math.round((settings.candleLimits?.['1d'] || 365) / 30)} months
                </div>
              </div>

              {/* Quick Presets */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30 flex flex-col justify-center">
                <div className="text-gray-400 text-xs mb-2">Quick Presets</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => saveSettings({ 
                      candleLimits: {
                        '1m': 500, '5m': 500, '15m': 500, '30m': 500, '1h': 500, '4h': 300, '1d': 200
                      }
                    })}
                    className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition-colors"
                  >
                    ⚡ Fast
                  </button>
                  <button
                    onClick={() => saveSettings({ 
                      candleLimits: {
                        '1m': 1440, '5m': 2016, '15m': 2688, '30m': 1440, '1h': 720, '4h': 540, '1d': 365
                      }
                    })}
                    className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
                  >
                    📊 Balanced
                  </button>
                  <button
                    onClick={() => saveSettings({ 
                      candleLimits: {
                        '1m': 5000, '5m': 5000, '15m': 5000, '30m': 3000, '1h': 2000, '4h': 1000, '1d': 500
                      }
                    })}
                    className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30 transition-colors"
                  >
                    📈 Deep History
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Tip */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
              <span className="text-yellow-500 text-xl">💡</span>
              <div>
                <div className="text-yellow-400 font-medium text-sm">Performance Tip</div>
                <p className="text-gray-400 text-xs mt-1">
                  Lower limits = faster chart loading. The &quot;Fast&quot; preset is recommended for production. 
                  Users can still scroll back in time - additional data loads on demand.
                </p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Data Maintenance Section */}
      <Section title="Data Maintenance" icon="🔧" defaultOpen={false}>
        {settings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ==================== CLEANUP CARD ==================== */}
            <div className="bg-[#12141c] rounded-xl p-5 border border-gray-800/30 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-800/50">
                <h4 className="text-white font-semibold text-lg flex items-center gap-2">
                  🗑️ Cleanup Old Data
                </h4>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.cleanup.enabled}
                    onChange={(e) => saveSettings({ cleanup: { ...settings.cleanup, enabled: e.target.checked } })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="space-y-5 flex-1">
                {/* Settings Section */}
                <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/30">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">Keep data for</span>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={settings.cleanup.daysToKeep}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        saveSettings({ cleanup: { ...settings.cleanup, daysToKeep: Number.isNaN(val) ? 0 : Math.max(0, val) } });
                      }}
                      className="bg-gray-800 text-white rounded-lg px-3 py-2 w-20 border border-gray-700 focus:border-blue-500 focus:outline-none text-center font-mono"
                    />
                    <span className="text-gray-400 text-sm">days</span>
                    <span className="text-gray-600 text-sm ml-auto">
                      ~{((settings.cleanup.daysToKeep * 9.5)).toFixed(0)} MB
                    </span>
                  </div>
                  {settings.cleanup.daysToKeep === 0 && (
                    <p className="text-red-400 text-xs mt-3 flex items-center gap-1">
                      <span>⚠️</span> Will delete ALL history!
                    </p>
                  )}
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-12">Mode</span>
                  <div className="inline-flex bg-gray-900/50 rounded-lg p-0.5 border border-gray-800/50">
                    <button
                      onClick={() => saveSettings({ cleanup: { ...settings.cleanup, mode: 'manual' } })}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                        settings.cleanup.mode === 'manual'
                          ? 'bg-gray-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Manual
                    </button>
                    <button
                      onClick={() => saveSettings({ cleanup: { ...settings.cleanup, mode: 'auto' } })}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                        settings.cleanup.mode === 'auto'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Auto
                    </button>
                  </div>
                </div>

                {/* Schedule Picker (only when auto mode) */}
                {settings.cleanup.mode === 'auto' && settings.cleanup.enabled && (
                  <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/30">
                    <SchedulePicker
                      schedule={settings.cleanup.schedule || {
                        type: 'weekly',
                        weekDays: [0],
                        monthDay: 1,
                        hour: 3,
                        minute: 0,
                      }}
                      onChange={(schedule) => saveSettings({ cleanup: { ...settings.cleanup, schedule } })}
                      color="blue"
                    />
                  </div>
                )}

                {/* Last Run */}
                {settings.cleanup.lastRun && (
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <span>🕐</span> Last run: {new Date(settings.cleanup.lastRun).toLocaleString()}
                  </p>
                )}
              </div>
              
              {/* Action Button */}
              <button
                onClick={runCleanup}
                disabled={cleanupRunning || saving}
                className="w-full mt-4 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {cleanupRunning ? '⏳ Running...' : '🗑️ Run Cleanup Now'}
              </button>
            </div>

            {/* ==================== GAP DETECTION CARD ==================== */}
            <div className="bg-[#12141c] rounded-xl p-5 border border-gray-800/30 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-800/50">
                <h4 className="text-white font-semibold text-lg flex items-center gap-2">
                  🔧 Gap Detection
                  {gaps.length > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded-full font-normal">
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
                  <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              
              <div className="space-y-5 flex-1">
                {/* Gap List Section */}
                <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/30 min-h-[80px]">
                  {gaps.length > 0 ? (
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {gaps.slice(0, 8).map((gap, i) => {
                        const startDate = new Date(gap.startTime * 1000);
                        const endDate = new Date(gap.endTime * 1000);
                        return (
                          <div key={i} className="text-xs text-gray-400 py-1 flex items-center justify-between">
                            <span>
                              <span className="text-white font-medium">{gap.symbol}</span>
                              <span className="mx-1.5">:</span>
                              {startDate.toLocaleDateString()} → {endDate.toLocaleDateString()}
                            </span>
                            <span className="text-yellow-400 text-[10px] px-1.5 py-0.5 bg-yellow-600/20 rounded">
                              {gap.missingMinutes >= 1440 ? `${Math.round(gap.missingMinutes / 1440)}d` : `${gap.missingMinutes}m`}
                            </span>
                          </div>
                        );
                      })}
                      {gaps.length > 8 && (
                        <div className="text-gray-500 text-xs pt-1 text-center">
                          +{gaps.length - 8} more gaps
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-green-400 text-sm gap-2">
                      <span>✓</span> No gaps detected
                    </div>
                  )}
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-12">Mode</span>
                  <div className="inline-flex bg-gray-900/50 rounded-lg p-0.5 border border-gray-800/50">
                    <button
                      onClick={() => saveSettings({ gapFill: { ...settings.gapFill, mode: 'manual' } })}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                        settings.gapFill.mode === 'manual'
                          ? 'bg-gray-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Manual
                    </button>
                    <button
                      onClick={() => saveSettings({ gapFill: { ...settings.gapFill, mode: 'auto' } })}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                        settings.gapFill.mode === 'auto'
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Auto
                    </button>
                  </div>
                </div>

                {/* Schedule Picker (only when auto mode) */}
                {settings.gapFill.mode === 'auto' && settings.gapFill.enabled && (
                  <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/30">
                    <SchedulePicker
                      schedule={settings.gapFill.schedule || {
                        type: 'weekly',
                        weekDays: [1, 3, 5],
                        monthDay: 1,
                        hour: 4,
                        minute: 0,
                      }}
                      onChange={(schedule) => saveSettings({ gapFill: { ...settings.gapFill, schedule } })}
                      color="purple"
                    />
                  </div>
                )}

                {/* Last Run */}
                {settings.gapFill.lastRun && (
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <span>🕐</span> Last run: {new Date(settings.gapFill.lastRun).toLocaleString()}
                  </p>
                )}
              </div>
              
              {/* Action Button */}
              <button
                onClick={runGapFill}
                disabled={gapFillRunning || saving || gaps.length === 0}
                className="w-full mt-4 px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 text-purple-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {gapFillRunning ? '⏳ Filling...' : '🔧 Fill Gaps Now'}
              </button>
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
