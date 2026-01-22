'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Schedule {
  type: 'weekly' | 'monthly';
  weekDays: number[];  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  monthDay: number;    // 1-28 for monthly runs
  hour: number;        // 0-23
  minute: number;      // 0-59
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
  // Historical data settings
  useLocalHistory: boolean;
  autoFetchHistory: boolean;
  chartHistoryLimitEnabled: boolean;
  chartHistoryLimitDays: number;
  chartHistoryLimitHours: number;
  chartHistoryLimitMinutes: number;
  initialCandleCount: number;
  lazyLoadBatchSize: number;
  historicalYearsToDownload: number;
  seedingDaysBack: number;
  seedingHours: number;
  seedingMinutes: number;
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
            {Array.from({ length: 60 }, (_, i) => i).map(m => (
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
  timeframe?: string;
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
  
  // Cleanup options state - two independent cleanup types
  const [deleteOldestEnabled, setDeleteOldestEnabled] = useState(true);
  const [deleteOldestDays, setDeleteOldestDays] = useState(1);
  const [keepRecentEnabled, setKeepRecentEnabled] = useState(false);
  const [keepRecentDays, setKeepRecentDays] = useState(365);
  const [cleanupIncludeHistorical, setCleanupIncludeHistorical] = useState(true);
  const [cleanupResults, setCleanupResults] = useState<{
    deleteOldest?: { enabled: boolean; days: number };
    keepRecent?: { enabled: boolean; days: number };
    deletedCount: number;
    freedMB?: string;
    timestamp?: string;
    collections: Record<string, {
      deleted: number;
      before: number;
      after: number;
      dataRange?: { oldest: string; newest: string };
      deleteOldestCutoff?: string;
      keepRecentCutoff?: string;
      operations?: string[];
    }>;
  } | null>(null);
  
  // Historical data download state
  const [historyDownloadRunning, setHistoryDownloadRunning] = useState(false);
  const [historyDownloadResults, setHistoryDownloadResults] = useState<SeedResult[] | null>(null);
  const [selectedHistoryTimeframes, setSelectedHistoryTimeframes] = useState<string[]>(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);
  const [historyYearsBack, setHistoryYearsBack] = useState(10);
  const [historyDownloadMode, setHistoryDownloadMode] = useState<'years' | 'daterange'>('years');
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
    currentSymbol: string;
    currentTimeframe: string;
    completed: Array<{ symbol: string; timeframe: string; saved: number }>;
  } | null>(null);

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

  const [detectingGaps, setDetectingGaps] = useState(false);
  const detectingGapsRef = React.useRef(false);
  
  const fetchGaps = useCallback(async () => {
    // Prevent multiple simultaneous calls using ref
    if (detectingGapsRef.current) return;
    detectingGapsRef.current = true;
    setDetectingGaps(true);
    try {
      const res = await fetch('/api/market-data/gap-fill');
      if (res.ok) {
        const data = await res.json();
        console.log('[Gap Detection] Response:', data);
        setGaps(data.gaps || []);
      }
    } catch (error) {
      console.error('Error fetching gaps:', error);
    } finally {
      detectingGapsRef.current = false;
      setDetectingGaps(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchGaps();
    fetchSymbols();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Initialize cleanup state from loaded settings
  useEffect(() => {
    if (settings?.cleanup) {
      // Load deleteOldest config
      if (settings.cleanup.deleteOldest) {
        setDeleteOldestEnabled(settings.cleanup.deleteOldest.enabled ?? true);
        setDeleteOldestDays(settings.cleanup.deleteOldest.days ?? 1);
      }
      // Load keepRecent config
      if (settings.cleanup.keepRecent) {
        setKeepRecentEnabled(settings.cleanup.keepRecent.enabled ?? false);
        setKeepRecentDays(settings.cleanup.keepRecent.days ?? 365);
      }
      // Load includeHistorical
      if (settings.cleanup.includeHistorical !== undefined) {
        setCleanupIncludeHistorical(settings.cleanup.includeHistorical);
      }
      // Load last results
      if (settings.cleanup.lastResults) {
        setCleanupResults(settings.cleanup.lastResults as typeof cleanupResults);
      }
    }
  }, [settings?.cleanup]);

  // Save cleanup settings when they change (debounced)
  useEffect(() => {
    if (!settings) return;
    const timeoutId = setTimeout(() => {
      saveSettings({
        cleanup: {
          ...settings.cleanup,
          deleteOldest: { enabled: deleteOldestEnabled, days: deleteOldestDays },
          keepRecent: { enabled: keepRecentEnabled, days: keepRecentDays },
          includeHistorical: cleanupIncludeHistorical,
        }
      });
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteOldestEnabled, deleteOldestDays, keepRecentEnabled, keepRecentDays, cleanupIncludeHistorical]);

  useEffect(() => {
    // Set initial date range for seeding
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setSeedToDate(today.toISOString().split('T')[0]);
    setSeedFromDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

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
    
    // Validate at least one type is enabled
    if (!deleteOldestEnabled && !keepRecentEnabled) {
      setMessage({ type: 'error', text: 'Enable at least one cleanup type' });
      return;
    }
    
    setCleanupRunning(true);
    setCleanupResults(null);
    
    try {
      const res = await fetch('/api/market-data/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deleteOldest: { enabled: deleteOldestEnabled, days: deleteOldestDays },
          keepRecent: { enabled: keepRecentEnabled, days: keepRecentDays },
          includeHistorical: cleanupIncludeHistorical,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const collectionsCount = Object.keys(data.cleanup.collections || {}).length;
        setCleanupResults(data.cleanup);
        setMessage({ 
          type: 'success', 
          text: `Deleted ${data.cleanup.deletedCount.toLocaleString()} candles from ${collectionsCount} collections, freed ${data.cleanup.freedMB} MB` 
        });
        fetchData();
      } else {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        setMessage({ type: 'error', text: error.error || 'Cleanup failed' });
        setCleanupResults(null);
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
        // New non-blocking format: returns immediately with jobId
        if (data.jobId) {
          setMessage({ type: 'success', text: `✅ ${data.message}. ${data.note}` });
        } else if (data.results) {
          // Old format for backward compatibility
          setSeedResults(data.results);
          setMessage({ type: 'success', text: `Seeding complete! Inserted ${data.summary?.totalInserted || 0} candles` });
        } else {
          setMessage({ type: 'success', text: data.message || 'Seeding started!' });
        }
        fetchData();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Seeding failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error running seed' });
    } finally {
      setSeedRunning(false);
      setTimeout(() => setMessage(null), 15000); // Longer timeout for background job message
    }
  };

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
  };

  const toggleHistoryTimeframe = (tf: string) => {
    setSelectedHistoryTimeframes(prev => 
      prev.includes(tf) ? prev.filter(t => t !== tf) : [...prev, tf]
    );
  };

  const runHistoryDownload = async () => {
    if (selectedSymbols.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one symbol' });
      return;
    }
    if (selectedHistoryTimeframes.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one timeframe' });
      return;
    }
    
    // Validate date range if in daterange mode
    if (historyDownloadMode === 'daterange') {
      if (!historyFromDate || !historyToDate) {
        setMessage({ type: 'error', text: 'Please select both From and To dates' });
        return;
      }
      if (new Date(historyFromDate) >= new Date(historyToDate)) {
        setMessage({ type: 'error', text: 'From date must be before To date' });
        return;
      }
    }
    
    setHistoryDownloadRunning(true);
    setHistoryDownloadResults(null);
    
    // Calculate total tasks (symbol × timeframe combinations)
    const totalTasks = selectedSymbols.length * selectedHistoryTimeframes.length;
    const completed: Array<{ symbol: string; timeframe: string; saved: number }> = [];
    let currentTask = 0;
    let totalSaved = 0;
    
    setDownloadProgress({
      current: 0,
      total: totalTasks,
      currentSymbol: '',
      currentTimeframe: '',
      completed: [],
    });
    
    try {
      // Download one symbol+timeframe at a time for progress tracking
      for (const symbol of selectedSymbols) {
        for (const timeframe of selectedHistoryTimeframes) {
          currentTask++;
          
          setDownloadProgress({
            current: currentTask,
            total: totalTasks,
            currentSymbol: symbol,
            currentTimeframe: timeframe,
            completed: [...completed],
          });
          
          try {
            // Build request body based on mode
            const requestBody = historyDownloadMode === 'daterange'
              ? {
                  symbols: [symbol],
                  timeframes: [timeframe],
                  fromDate: historyFromDate,
                  toDate: historyToDate,
                }
              : {
                  symbols: [symbol],
                  timeframes: [timeframe],
                  yearsBack: historyYearsBack,
                  startFromLastCandle: true,
                };
            
            const res = await fetch('/api/market-data/download-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });
            
            if (res.ok) {
              const data = await res.json();
              // Handle new non-blocking format (returns jobId)
              if (data.jobId) {
                // Background job started - mark as pending
                completed.push({ symbol, timeframe, saved: -1, jobId: data.jobId });
              } else {
                // Old format for backward compatibility
                const saved = data.summary?.totalSaved || 0;
                totalSaved += saved;
                completed.push({ symbol, timeframe, saved });
              }
            } else {
              completed.push({ symbol, timeframe, saved: 0 });
            }
          } catch {
            completed.push({ symbol, timeframe, saved: 0 });
          }
          
          // Update progress after each download
          setDownloadProgress({
            current: currentTask,
            total: totalTasks,
            currentSymbol: symbol,
            currentTimeframe: timeframe,
            completed: [...completed],
          });
        }
      }
      
      // Check if any jobs are running in background
      const backgroundJobs = completed.filter(c => c.saved === -1);
      
      setHistoryDownloadResults(completed.map(c => ({
        symbol: c.symbol,
        timeframe: c.timeframe,
        count: c.saved === -1 ? 0 : c.saved,
        status: c.saved === -1 ? 'pending' as const : (c.saved > 0 ? 'success' as const : 'skipped' as const),
      })));
      
      if (backgroundJobs.length > 0) {
        setMessage({ 
          type: 'success', 
          text: `✅ ${backgroundJobs.length} download(s) started in background. Check server logs for progress.` 
        });
      } else {
        setMessage({ 
          type: 'success', 
          text: `Download complete! Saved ${totalSaved.toLocaleString()} candles across ${completed.length} downloads` 
        });
      }
      fetchData();
      
    } catch {
      setMessage({ type: 'error', text: 'Error downloading history' });
    } finally {
      setHistoryDownloadRunning(false);
      setDownloadProgress(null);
      setTimeout(() => setMessage(null), 10000);
    }
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
            {/* ==================== CLEANUP CARD ==================== */}
            <div className="bg-[#12141c] rounded-xl p-5 border border-gray-800/30 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-800/50">
                <h4 className="text-white font-semibold text-lg flex items-center gap-2">
                  🗑️ Cleanup Data
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
              
              <div className="space-y-4 flex-1">
                {/* DELETE OLDEST Type - Independent Toggle */}
                <div className={`rounded-lg p-3 border transition-all ${
                  deleteOldestEnabled 
                    ? 'bg-red-900/20 border-red-600/30' 
                    : 'bg-gray-900/30 border-gray-800/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🗑️</span>
                      <div>
                        <div className="text-white text-sm font-medium">Delete Oldest</div>
                        <div className="text-gray-500 text-xs">Remove oldest data from start of database</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deleteOldestEnabled}
                        onChange={(e) => setDeleteOldestEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                  {deleteOldestEnabled && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800/30">
                      <span className="text-gray-400 text-sm">Delete oldest</span>
                      <input
                        type="number"
                        min="0"
                        value={deleteOldestDays}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setDeleteOldestDays(Number.isNaN(val) ? 0 : Math.max(0, val));
                        }}
                        className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-24 border border-gray-700 focus:border-red-500 focus:outline-none text-center font-mono text-sm"
                      />
                      <span className="text-gray-400 text-sm">days</span>
                    </div>
                  )}
                </div>

                {/* KEEP RECENT Type - Independent Toggle */}
                <div className={`rounded-lg p-3 border transition-all ${
                  keepRecentEnabled 
                    ? 'bg-blue-900/20 border-blue-600/30' 
                    : 'bg-gray-900/30 border-gray-800/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📅</span>
                      <div>
                        <div className="text-white text-sm font-medium">Keep Recent</div>
                        <div className="text-gray-500 text-xs">Keep only last X days, delete older</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepRecentEnabled}
                        onChange={(e) => setKeepRecentEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {keepRecentEnabled && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800/30">
                      <span className="text-gray-400 text-sm">Keep last</span>
                      <input
                        type="number"
                        min="0"
                        value={keepRecentDays}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setKeepRecentDays(Number.isNaN(val) ? 0 : Math.max(0, val));
                        }}
                        className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-24 border border-gray-700 focus:border-blue-500 focus:outline-none text-center font-mono text-sm"
                      />
                      <span className="text-gray-400 text-sm">days</span>
                    </div>
                  )}
                </div>

                {/* Combined Mode Explanation */}
                {deleteOldestEnabled && keepRecentEnabled && (
                  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3">
                    <div className="text-yellow-400 text-xs font-medium mb-1">⚡ Combined Mode Active</div>
                    <p className="text-yellow-500/80 text-xs">
                      Both operations will run: First delete oldest {deleteOldestDays} days, then ensure only last {keepRecentDays} days remain.
                      This maintains a constant database size.
                    </p>
                  </div>
                )}

                {/* Include Historical Toggle */}
                <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-800/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Include Historical</div>
                      <div className="text-gray-500 text-xs">Clean 1m + all historical collections</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cleanupIncludeHistorical}
                        onChange={(e) => setCleanupIncludeHistorical(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                  {/* Collections to clean list */}
                  <div className="mt-2 pt-2 border-t border-gray-800/30">
                    <div className="text-gray-500 text-xs mb-1">Collections to clean:</div>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">candles_1m</span>
                      {cleanupIncludeHistorical && (
                        <>
                          <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">historical_1m</span>
                          <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">historical_5m</span>
                          <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">historical_15m</span>
                          <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">historical_30m</span>
                          <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">historical_1h</span>
                          <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">historical_4h</span>
                          <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">historical_1d</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Auto/Manual Mode Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-16">Schedule</span>
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
                disabled={cleanupRunning || saving || (!deleteOldestEnabled && !keepRecentEnabled)}
                className="w-full mt-4 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {cleanupRunning ? '⏳ Running...' : '🗑️ Run Cleanup Now'}
              </button>

              {/* Warning if nothing selected */}
              {!deleteOldestEnabled && !keepRecentEnabled && (
                <p className="text-yellow-500 text-xs mt-2 text-center">
                  ⚠️ Enable at least one cleanup type to run
                </p>
              )}
              
              {/* Cleanup Results Box */}
              {cleanupResults && (
                <div className="mt-4 bg-gray-900/50 rounded-lg border border-gray-800/30 overflow-hidden">
                  {/* Header */}
                  <div className="bg-green-900/30 border-b border-green-600/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-green-400 text-sm font-medium flex items-center gap-2">
                        ✅ Cleanup Completed
                      </div>
                      {cleanupResults.timestamp && (
                        <span className="text-gray-500 text-xs">
                          {new Date(cleanupResults.timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-white">
                        Total: <span className="text-red-400 font-mono">{cleanupResults.deletedCount.toLocaleString()}</span> deleted
                      </span>
                      {cleanupResults.freedMB && (
                        <span className="text-gray-400">
                          Freed: <span className="text-green-400 font-mono">{cleanupResults.freedMB} MB</span>
                        </span>
                      )}
                    </div>
                    {/* Mode info */}
                    <div className="flex gap-3 mt-2 text-xs">
                      {cleanupResults.deleteOldest?.enabled && (
                        <span className="bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                          Delete Oldest: {cleanupResults.deleteOldest.days} days
                        </span>
                      )}
                      {cleanupResults.keepRecent?.enabled && (
                        <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                          Keep Recent: {cleanupResults.keepRecent.days} days
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Collections Details */}
                  <div className="p-3 max-h-60 overflow-y-auto">
                    <div className="text-gray-400 text-xs mb-2 uppercase font-medium">Collections</div>
                    <div className="space-y-2">
                      {Object.entries(cleanupResults.collections).map(([name, data]) => (
                        <div key={name} className={`rounded p-2 text-xs ${
                          data.deleted > 0 ? 'bg-red-900/20 border border-red-600/20' : 'bg-gray-800/30'
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 font-mono text-xs">{name}</span>
                            <span className={data.deleted > 0 ? 'text-red-400 font-medium' : 'text-gray-500'}>
                              {data.deleted > 0 ? `-${data.deleted.toLocaleString()}` : '0'} / {data.before.toLocaleString()}
                            </span>
                          </div>
                          {/* Operations performed */}
                          {data.operations && data.operations.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {data.operations.map((op, i) => (
                                <div key={i} className="text-gray-500 text-[10px]">• {op}</div>
                              ))}
                            </div>
                          )}
                          {/* Data range */}
                          {data.dataRange && (
                            <div className="text-gray-500 mt-1 text-[10px]">
                              📅 Range: {new Date(data.dataRange.oldest).toLocaleDateString()} → {new Date(data.dataRange.newest).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Auto Mode Last Results (show when auto mode is selected) */}
              {settings.cleanup.mode === 'auto' && settings.cleanup.lastResults && !cleanupResults && (
                <div className="mt-4 bg-gray-900/50 rounded-lg border border-gray-800/30 overflow-hidden">
                  <div className="bg-blue-900/20 border-b border-blue-600/20 p-3">
                    <div className="text-blue-400 text-sm font-medium flex items-center gap-2">
                      📊 Last Auto Cleanup Results
                    </div>
                    {(settings.cleanup.lastResults as any).timestamp && (
                      <span className="text-gray-500 text-xs block mt-1">
                        {new Date((settings.cleanup.lastResults as any).timestamp).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="p-3 text-xs">
                    <div className="text-white mb-2">
                      Deleted: <span className="text-red-400 font-mono">{((settings.cleanup.lastResults as any).deletedCount || 0).toLocaleString()}</span> candles
                    </div>
                    {(settings.cleanup.lastResults as any).collections && (
                      <div className="space-y-1">
                        {Object.entries((settings.cleanup.lastResults as any).collections).map(([name, data]: [string, any]) => (
                          <div key={name} className="flex justify-between text-gray-400">
                            <span className="font-mono">{name}</span>
                            <span className={data.deleted > 0 ? 'text-red-400' : 'text-gray-600'}>
                              -{data.deleted}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                {/* Detect Gaps Button */}
                <button
                  onClick={fetchGaps}
                  disabled={detectingGaps}
                  className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {detectingGaps ? '🔍 Scanning...' : '🔍 Detect Gaps Now'}
                </button>
                
                {/* Gap List Section */}
                <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/30 min-h-[80px]">
                  {gaps.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {gaps.slice(0, 15).map((gap, i) => {
                        const startDate = new Date(gap.startTime * 1000);
                        const endDate = new Date(gap.endTime * 1000);
                        return (
                          <div key={i} className="text-xs text-gray-400 py-1 flex items-center justify-between">
                            <span>
                              <span className="text-white font-medium">{gap.symbol}</span>
                              {gap.timeframe && <span className="text-purple-400 ml-1">({gap.timeframe})</span>}
                              <span className="mx-1.5">:</span>
                              <span className="text-gray-500">{startDate.toLocaleString()}</span>
                              <span className="mx-1"> → </span>
                              <span className="text-gray-500">{endDate.toLocaleString()}</span>
                            </span>
                            <span className="text-yellow-400 text-[10px] px-1.5 py-0.5 bg-yellow-600/20 rounded ml-2 whitespace-nowrap">
                              {gap.missingMinutes >= 1440 ? `${Math.round(gap.missingMinutes / 1440)}d` : 
                               gap.missingMinutes >= 60 ? `${Math.round(gap.missingMinutes / 60)}h` : `${gap.missingMinutes}m`}
                            </span>
                          </div>
                        );
                      })}
                      {gaps.length > 15 && (
                        <div className="text-gray-500 text-xs pt-1 text-center">
                          +{gaps.length - 15} more gaps
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
          {/* Date Range with Time */}
          <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
            <h4 className="text-white font-medium mb-4">Date & Time Range</h4>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-gray-500 text-xs block mb-1">From (Date & Time)</label>
                <input
                  type="datetime-local"
                  value={seedFromDate}
                  onChange={(e) => setSeedFromDate(e.target.value)}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">To (Date & Time)</label>
                <input
                  type="datetime-local"
                  value={seedToDate}
                  onChange={(e) => setSeedToDate(e.target.value)}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => {
                  const today = new Date();
                  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0);
                  setSeedFromDate(todayStart.toISOString().slice(0, 16));
                  setSeedToDate(today.toISOString().slice(0, 16));
                }}
                className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-xs font-medium"
              >
                📅 Today (00:00 → Now)
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                  yesterday.setHours(0, 0, 0, 0);
                  setSeedFromDate(yesterday.toISOString().slice(0, 16));
                  setSeedToDate(now.toISOString().slice(0, 16));
                }}
                className="px-3 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg text-xs font-medium"
              >
                📅 Last 24 Hours
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setSeedFromDate(weekAgo.toISOString().slice(0, 16));
                  setSeedToDate(now.toISOString().slice(0, 16));
                }}
                className="px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg text-xs font-medium"
              >
                📅 Last 7 Days
              </button>
              <button
                onClick={() => setSeedToDate(new Date().toISOString().slice(0, 16))}
                className="px-3 py-1.5 bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 rounded-lg text-xs font-medium"
              >
                Set &quot;To&quot; = Now
              </button>
            </div>
            
            <p className="text-yellow-500/70 text-xs mt-3">
              💡 Now supports time selection! Use &quot;Today (00:00 → Now)&quot; to fill today&apos;s gap.
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
              {(() => {
                const fromMs = new Date(seedFromDate).getTime();
                const toMs = new Date(seedToDate).getTime();
                const minutes = Math.ceil((toMs - fromMs) / (1000 * 60));
                const hours = Math.round(minutes / 60 * 10) / 10;
                const days = Math.round(hours / 24 * 10) / 10;
                return (
                  <>
                    <span className="text-white ml-2">
                      ~{(minutes * selectedSymbols.length).toLocaleString()} candles
                    </span>
                    <span className="text-gray-500 ml-2">
                      ({hours < 24 ? `${hours} hours` : `${days} days`} × {selectedSymbols.length} symbols)
                    </span>
                  </>
                );
              })()}
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

      {/* Download Higher Timeframe History Section */}
      <Section title="Download Higher Timeframe History" icon="📊" defaultOpen={false}>
        <div className="space-y-5">
          <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4 text-sm">
            <span className="text-blue-400">💡 Step 2:</span>
            <span className="text-gray-300 ml-2">
              Download historical data for all timeframes. This stores years of data in separate collections
              (candles_historical_1m, candles_historical_5m, etc.) for fast chart scrolling without API calls.
            </span>
          </div>
          
          <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-3 text-xs text-gray-400">
            <strong className="text-yellow-400">Architecture:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li><span className="text-white">candles_1m</span> = Recent ~30 days (for real-time + aggregation)</li>
              <li><span className="text-white">candles_historical_*</span> = Years of history (for chart scrolling)</li>
            </ul>
          </div>

          {/* Download Mode Toggle */}
          <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Download Mode</h4>
              <div className="inline-flex bg-gray-900/50 rounded-lg p-0.5 border border-gray-800/50">
                <button
                  onClick={() => setHistoryDownloadMode('years')}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    historyDownloadMode === 'years'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Years Back
                </button>
                <button
                  onClick={() => setHistoryDownloadMode('daterange')}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    historyDownloadMode === 'daterange'
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Date Range (Fill Gaps)
                </button>
              </div>
            </div>
            
            {historyDownloadMode === 'years' ? (
              <>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={historyYearsBack}
                    onChange={(e) => setHistoryYearsBack(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="w-20 text-right">
                    <span className="text-white font-mono text-lg">{historyYearsBack}</span>
                    <span className="text-gray-500 text-sm ml-1">years</span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  Downloads history starting from the last candle backwards
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">From Date</label>
                    <input
                      type="datetime-local"
                      value={historyFromDate}
                      onChange={(e) => setHistoryFromDate(e.target.value)}
                      className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">To Date</label>
                    <input
                      type="datetime-local"
                      value={historyToDate}
                      onChange={(e) => setHistoryToDate(e.target.value)}
                      className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => {
                      const now = new Date();
                      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      setHistoryFromDate(weekAgo.toISOString().slice(0, 16));
                      setHistoryToDate(now.toISOString().slice(0, 16));
                    }}
                    className="px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg text-xs font-medium"
                  >
                    📅 Last 7 Days
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      setHistoryFromDate(monthAgo.toISOString().slice(0, 16));
                      setHistoryToDate(now.toISOString().slice(0, 16));
                    }}
                    className="px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg text-xs font-medium"
                  >
                    📅 Last 30 Days
                  </button>
                  <button
                    onClick={() => setHistoryToDate(new Date().toISOString().slice(0, 16))}
                    className="px-3 py-1.5 bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 rounded-lg text-xs font-medium"
                  >
                    Set &quot;To&quot; = Now
                  </button>
                </div>
                
                <p className="text-green-500/70 text-xs">
                  💡 Use this mode to fill specific gaps in your historical data
                </p>
              </>
            )}
          </div>

          {/* Timeframe Selection */}
          <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Select Timeframes</h4>
              <div className="flex gap-3 text-sm">
                <button 
                  onClick={() => setSelectedHistoryTimeframes(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'])} 
                  className="text-blue-400 hover:text-blue-300"
                >
                  Select All
                </button>
                <button 
                  onClick={() => setSelectedHistoryTimeframes([])} 
                  className="text-gray-400 hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => toggleHistoryTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedHistoryTimeframes.includes(tf)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Symbol Selection (reuse from above) */}
          <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">
                Select Symbols 
                <span className="text-gray-500 font-normal ml-2">({selectedSymbols.length}/{availableSymbols.length})</span>
              </h4>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-32 overflow-y-auto">
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
          {selectedSymbols.length > 0 && selectedHistoryTimeframes.length > 0 && (
            <div className={`border rounded-lg p-4 text-sm ${
              historyDownloadMode === 'daterange' 
                ? 'bg-green-600/10 border-green-600/20' 
                : 'bg-blue-600/10 border-blue-600/20'
            }`}>
              <span className={historyDownloadMode === 'daterange' ? 'text-green-400' : 'text-blue-400'}>
                📊 Will download:
              </span>
              <span className="text-white ml-2">
                {selectedSymbols.length} symbols × {selectedHistoryTimeframes.length} timeframes
                {historyDownloadMode === 'daterange' 
                  ? (historyFromDate && historyToDate 
                      ? ` (${new Date(historyFromDate).toLocaleDateString()} → ${new Date(historyToDate).toLocaleDateString()})` 
                      : ' (select dates)')
                  : ` × ${historyYearsBack} years`}
              </span>
              <span className="text-gray-500 ml-2">
                (May take several minutes)
              </span>
            </div>
          )}

          {/* Results */}
          {historyDownloadResults && (
            <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-medium">Results</h4>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-blue-400">
                    {historyDownloadResults.filter(r => r.status === 'pending').length} running
                  </span>
                  <span className="text-green-400">
                    {historyDownloadResults.filter(r => r.status === 'success').length} done
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                {historyDownloadResults.map((result, i) => {
                  const r = result as { symbol: string; timeframe?: string; count?: number; status?: string; error?: string };
                  const savedCount = r.count ?? 0;
                  const isPending = r.status === 'pending';
                  return (
                    <div key={i} className={`text-xs flex items-center justify-between ${result.error ? 'text-red-400' : isPending ? 'text-blue-400' : 'text-gray-400'}`}>
                      <span>
                        <span className="text-white">{result.symbol}</span>
                        {r.timeframe && <span className="text-gray-500 ml-1">({r.timeframe})</span>}
                      </span>
                      <span>
                        {result.error ? (
                          `❌ ${result.error}`
                        ) : isPending ? (
                          <span className="flex items-center gap-1">
                            <span className="animate-pulse">⏳</span> Running in background...
                          </span>
                        ) : (
                          `✓ ${savedCount.toLocaleString()} saved`
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {downloadProgress && (
            <div className="w-full bg-gray-900/50 rounded-lg p-4 border border-blue-500/30 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 text-sm font-medium">
                  {downloadProgress.current < downloadProgress.total 
                    ? `📤 Sending ${downloadProgress.currentSymbol} ${downloadProgress.currentTimeframe}...`
                    : '✅ All download jobs submitted!'}
                </span>
                <span className="text-gray-400 text-sm">
                  {downloadProgress.current} / {downloadProgress.total} jobs
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {Math.round((downloadProgress.current / downloadProgress.total) * 100)}% jobs submitted
              </div>
              {downloadProgress.current >= downloadProgress.total && (
                <div className="mt-3 p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-400 text-sm font-medium mb-1">📊 Downloads Running in Background</p>
                  <p className="text-gray-400 text-xs">
                    Jobs are processing on the server. Check server logs (PM2) for real-time progress.
                    Depending on the amount of data, this may take several minutes to hours.
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-gray-500">
                      ⏱️ Est. time: ~{historyDownloadMode === 'daterange' 
                        ? Math.ceil(downloadProgress.total * 2) 
                        : Math.ceil(downloadProgress.total * historyYearsBack * 2)} minutes
                    </span>
                    <button 
                      onClick={fetchData}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      🔄 Refresh to check results
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={runHistoryDownload}
            disabled={historyDownloadRunning || selectedSymbols.length === 0 || selectedHistoryTimeframes.length === 0}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {historyDownloadRunning ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Downloading... ({downloadProgress?.current || 0}/{downloadProgress?.total || 0})
              </span>
            ) : (
              '📊 Download History'
            )}
          </button>
        </div>
      </Section>

      {/* Historical Data Settings Section */}
      <Section title="Historical Data Settings" icon="⚙️" defaultOpen={false}>
        {settings && (
          <div className="space-y-5">
            <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-4 text-sm">
              <span className="text-yellow-400">💡 These settings control how charts load historical data.</span>
              <p className="text-gray-400 text-xs mt-2">
                <strong className="text-white">Trade-off:</strong> Lower count = faster loading, but less history visible initially. 
                Users can still scroll left to lazy-load more history.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Data Source Toggle */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-medium">Data Source</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.useLocalHistory}
                      onChange={(e) => saveSettings({ useLocalHistory: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
                <p className="text-gray-500 text-xs">
                  {settings.useLocalHistory 
                    ? '✓ Using local database (fast, recommended)'
                    : '⚠️ Fetching from Massive.com API (slower, uses API quota)'}
                </p>
              </div>

              {/* Chart History Limit Toggle */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-medium">Limit Chart History</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.chartHistoryLimitEnabled}
                      onChange={(e) => saveSettings({ chartHistoryLimitEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-gray-500 text-xs mb-2">
                  {settings.chartHistoryLimitEnabled 
                    ? `Charts show max ${settings.chartHistoryLimitDays}d ${settings.chartHistoryLimitHours || 0}h ${settings.chartHistoryLimitMinutes || 0}m of history`
                    : 'Charts can show all available history'}
                </p>
                {settings.chartHistoryLimitEnabled && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="3650"
                        value={settings.chartHistoryLimitDays}
                        onChange={(e) => saveSettings({ chartHistoryLimitDays: parseInt(e.target.value) || 0 })}
                        className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-20 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <span className="text-gray-500 text-sm">d</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={settings.chartHistoryLimitHours || 0}
                        onChange={(e) => saveSettings({ chartHistoryLimitHours: parseInt(e.target.value) || 0 })}
                        className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-16 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <span className="text-gray-500 text-sm">h</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={settings.chartHistoryLimitMinutes || 0}
                        onChange={(e) => saveSettings({ chartHistoryLimitMinutes: parseInt(e.target.value) || 0 })}
                        className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-16 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <span className="text-gray-500 text-sm">m</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Initial Candle Count */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <h4 className="text-white font-medium mb-3">Initial Load</h4>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={settings.initialCandleCount}
                    onChange={(e) => saveSettings({ initialCandleCount: parseInt(e.target.value) || 0 })}
                    className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-24 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                  />
                  <span className="text-gray-500 text-sm">candles</span>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  How many candles to load when chart first opens
                </p>
                {/* Performance Impact Table - All Aggregator Timeframes */}
                <div className="mt-3 bg-gray-900/50 rounded-lg p-3 border border-gray-800/20">
                  <div className="text-yellow-400 text-xs font-medium mb-2">⚡ Performance Impact (all aggregator timeframes):</div>
                  <div className="text-xs">
                    <div className="grid grid-cols-6 gap-1 mb-1 text-gray-500 border-b border-gray-700 pb-1">
                      <div>TF</div>
                      <div>×</div>
                      <div>Query</div>
                      <div>Est. Time</div>
                      <div>Visible</div>
                      <div></div>
                    </div>
                    {/* 5m */}
                    <div className="grid grid-cols-6 gap-1 py-0.5">
                      <div className="text-cyan-400">5m</div>
                      <div className="text-gray-500">×5</div>
                      <div className="text-white">{(settings.initialCandleCount * 5).toLocaleString()}</div>
                      <div className={settings.initialCandleCount * 5 <= 1000 ? 'text-green-400' : settings.initialCandleCount * 5 <= 5000 ? 'text-yellow-400' : 'text-red-400'}>
                        {settings.initialCandleCount * 5 <= 1000 ? '~0.5s' : settings.initialCandleCount * 5 <= 5000 ? '~2s' : '~5s+'}
                      </div>
                      <div className="text-gray-400">{Math.round(settings.initialCandleCount * 5 / 60 / 24)}d</div>
                      <div>{settings.initialCandleCount * 5 <= 1000 ? '🟢' : settings.initialCandleCount * 5 <= 5000 ? '🟡' : '🔴'}</div>
                    </div>
                    {/* 15m */}
                    <div className="grid grid-cols-6 gap-1 py-0.5">
                      <div className="text-cyan-400">15m</div>
                      <div className="text-gray-500">×15</div>
                      <div className="text-white">{(settings.initialCandleCount * 15).toLocaleString()}</div>
                      <div className={settings.initialCandleCount * 15 <= 3000 ? 'text-green-400' : settings.initialCandleCount * 15 <= 10000 ? 'text-yellow-400' : 'text-red-400'}>
                        {settings.initialCandleCount * 15 <= 3000 ? '~1s' : settings.initialCandleCount * 15 <= 10000 ? '~5s' : '~15s+'}
                      </div>
                      <div className="text-gray-400">{Math.round(settings.initialCandleCount * 15 / 60 / 24)}d</div>
                      <div>{settings.initialCandleCount * 15 <= 3000 ? '🟢' : settings.initialCandleCount * 15 <= 10000 ? '🟡' : '🔴'}</div>
                    </div>
                    {/* 30m */}
                    <div className="grid grid-cols-6 gap-1 py-0.5">
                      <div className="text-cyan-400">30m</div>
                      <div className="text-gray-500">×30</div>
                      <div className="text-white">{(settings.initialCandleCount * 30).toLocaleString()}</div>
                      <div className={settings.initialCandleCount * 30 <= 6000 ? 'text-green-400' : settings.initialCandleCount * 30 <= 15000 ? 'text-yellow-400' : 'text-red-400'}>
                        {settings.initialCandleCount * 30 <= 6000 ? '~2s' : settings.initialCandleCount * 30 <= 15000 ? '~8s' : '~20s+'}
                      </div>
                      <div className="text-gray-400">{Math.round(settings.initialCandleCount * 30 / 60 / 24)}d</div>
                      <div>{settings.initialCandleCount * 30 <= 6000 ? '🟢' : settings.initialCandleCount * 30 <= 15000 ? '🟡' : '🔴'}</div>
                    </div>
                    {/* 1h */}
                    <div className="grid grid-cols-6 gap-1 py-0.5 bg-blue-500/10 rounded">
                      <div className="text-blue-400 font-medium">1h</div>
                      <div className="text-gray-500">×60</div>
                      <div className="text-white font-medium">{(settings.initialCandleCount * 60).toLocaleString()}</div>
                      <div className={settings.initialCandleCount * 60 <= 6000 ? 'text-green-400' : settings.initialCandleCount * 60 <= 20000 ? 'text-yellow-400' : 'text-red-400'}>
                        {settings.initialCandleCount * 60 <= 6000 ? '~3s' : settings.initialCandleCount * 60 <= 20000 ? '~15s' : '~30s+'}
                      </div>
                      <div className="text-gray-400">{Math.round(settings.initialCandleCount / 24)}d</div>
                      <div>{settings.initialCandleCount * 60 <= 6000 ? '🟢' : settings.initialCandleCount * 60 <= 20000 ? '🟡' : '🔴'}</div>
                    </div>
                    {/* 4h */}
                    <div className="grid grid-cols-6 gap-1 py-0.5 bg-purple-500/10 rounded">
                      <div className="text-purple-400 font-medium">4h</div>
                      <div className="text-gray-500">×240</div>
                      <div className="text-white font-medium">{(settings.initialCandleCount * 240).toLocaleString()}</div>
                      <div className={settings.initialCandleCount * 240 <= 12000 ? 'text-green-400' : settings.initialCandleCount * 240 <= 50000 ? 'text-yellow-400' : 'text-red-400'}>
                        {settings.initialCandleCount * 240 <= 12000 ? '~5s' : settings.initialCandleCount * 240 <= 50000 ? '~30s' : '~60s+'}
                      </div>
                      <div className="text-gray-400">{Math.round(settings.initialCandleCount * 4 / 24)}d</div>
                      <div>{settings.initialCandleCount * 240 <= 12000 ? '🟢' : settings.initialCandleCount * 240 <= 50000 ? '🟡' : '🔴'}</div>
                    </div>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-2">
                    Formula: count × multiplier = 1m candles queried for aggregation
                  </p>
                </div>
              </div>

              {/* Lazy Load Batch Size */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <h4 className="text-white font-medium mb-3">Scroll Load Batch</h4>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="100"
                    max="2000"
                    step="100"
                    value={settings.lazyLoadBatchSize}
                    onChange={(e) => saveSettings({ lazyLoadBatchSize: parseInt(e.target.value) || 500 })}
                    className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-24 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                  />
                  <span className="text-gray-500 text-sm">candles</span>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  How many candles to load when user scrolls to load more
                </p>
              </div>

              {/* Auto-Seeding Days Back */}
              <div className="bg-[#12141c] rounded-lg p-4 border border-gray-800/30">
                <h4 className="text-white font-medium mb-3">🌱 Auto-Seeding (Empty DB)</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      step="1"
                      value={settings.seedingDaysBack || 0}
                      onChange={(e) => saveSettings({ seedingDaysBack: parseInt(e.target.value) || 0 })}
                      className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-20 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <span className="text-gray-500 text-sm">d</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={settings.seedingHours || 0}
                      onChange={(e) => saveSettings({ seedingHours: parseInt(e.target.value) || 0 })}
                      className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-16 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <span className="text-gray-500 text-sm">h</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={settings.seedingMinutes || 0}
                      onChange={(e) => saveSettings({ seedingMinutes: parseInt(e.target.value) || 0 })}
                      className="bg-gray-800 text-white rounded-lg px-3 py-1.5 w-16 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <span className="text-gray-500 text-sm">m</span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  When database is empty, fetch this amount of data from Massive.com API
                </p>
                <div className="mt-2 text-xs text-yellow-400/80">
                  ⚡ Higher = slower initial load, but more history immediately available
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
