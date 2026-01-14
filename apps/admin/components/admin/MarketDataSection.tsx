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

export default function MarketDataSection() {
  const [settings, setSettings] = useState<MarketDataSettings | null>(null);
  const [stats, setStats] = useState<MarketDataStats | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [gapFillRunning, setGapFillRunning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Seed history state
  const [availableSymbols, setAvailableSymbols] = useState<TradingSymbol[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [seedFromDate, setSeedFromDate] = useState('');
  const [seedToDate, setSeedToDate] = useState('');
  const [seedRunning, setSeedRunning] = useState(false);
  const [seedResults, setSeedResults] = useState<SeedResult[] | null>(null);

  // Fetch settings and stats
  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        fetch('/api/market-data/settings'),
        fetch('/api/market-data/stats'),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch available symbols from admin
  const fetchSymbols = async () => {
    try {
      const res = await fetch('/api/symbols?enabled=true');
      if (res.ok) {
        const data = await res.json();
        setAvailableSymbols(data.symbols || []);
      }
    } catch (error) {
      console.error('Error fetching symbols:', error);
    }
  };

  // Fetch gaps
  const fetchGaps = async () => {
    try {
      const res = await fetch('/api/market-data/gap-fill');
      if (res.ok) {
        const data = await res.json();
        setGaps(data.gaps || []);
      }
    } catch (error) {
      console.error('Error fetching gaps:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchGaps();
    fetchSymbols();
    
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    setSeedToDate(today.toISOString().split('T')[0]);
    setSeedFromDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, [fetchData]);

  // Save settings
  const saveSettings = async (newSettings: Partial<MarketDataSettings>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/market-data/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Run cleanup
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
        setMessage({ 
          type: 'success', 
          text: `Cleanup complete! Deleted ${data.cleanup.deletedCount} candles, freed ${data.cleanup.freedMB} MB` 
        });
        fetchData(); // Refresh stats
      } else {
        setMessage({ type: 'error', text: 'Cleanup failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error running cleanup' });
    } finally {
      setCleanupRunning(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Run gap fill
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
        setMessage({ 
          type: 'success', 
          text: `Gap fill complete! Filled ${data.gapFill.totalCandlesFilled} candles across ${data.gapFill.totalGapsFilled} gaps` 
        });
        fetchGaps(); // Refresh gaps
        fetchData(); // Refresh stats
      } else {
        setMessage({ type: 'error', text: 'Gap fill failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error running gap fill' });
    } finally {
      setGapFillRunning(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Run seed history
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
        body: JSON.stringify({
          symbols: selectedSymbols,
          fromDate: seedFromDate,
          toDate: seedToDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSeedResults(data.results);
        setMessage({ 
          type: 'success', 
          text: `Seeding complete! Fetched ${data.summary.totalFetched} candles, inserted ${data.summary.totalInserted} new` 
        });
        fetchData(); // Refresh stats
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Seeding failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error running seed' });
    } finally {
      setSeedRunning(false);
      setTimeout(() => setMessage(null), 10000);
    }
  };

  // Toggle symbol selection
  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  // Select all symbols
  const selectAllSymbols = () => {
    setSelectedSymbols(availableSymbols.map(s => s.symbol));
  };

  // Deselect all symbols
  const deselectAllSymbols = () => {
    setSelectedSymbols([]);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Market Data Management</h2>
        <button
          onClick={() => { fetchData(); fetchGaps(); }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Stats Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📊 Database Statistics</h3>
        
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Total Candles</div>
              <div className="text-2xl font-bold text-white">{stats.totalCandles.toLocaleString()}</div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Storage Size</div>
              <div className="text-2xl font-bold text-white">{stats.storage.mb} MB</div>
              <div className="text-gray-400 text-xs">{stats.storage.gb} GB</div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Days of Data</div>
              <div className="text-2xl font-bold text-white">{stats.dateRange.daysOfData}</div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Growth Rate</div>
              <div className="text-xl font-bold text-white">{stats.growth.mbPerDay} MB/day</div>
              <div className="text-gray-400 text-xs">{stats.growth.projectedMbPerMonth} MB/month</div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4 col-span-2">
              <div className="text-gray-400 text-sm">Health Status</div>
              <div className={`text-lg font-bold ${stats.health.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'}`}>
                {stats.health.message}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cleanup Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🧹 Candle Cleanup</h3>
        
        {settings && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.cleanup.enabled}
                  onChange={(e) => saveSettings({ cleanup: { ...settings.cleanup, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-white">Enable Cleanup</span>
              </label>
              
              <select
                value={settings.cleanup.mode}
                onChange={(e) => saveSettings({ cleanup: { ...settings.cleanup, mode: e.target.value as 'auto' | 'manual' } })}
                className="bg-gray-700 text-white rounded-lg px-3 py-2"
                disabled={!settings.cleanup.enabled}
              >
                <option value="manual">Manual</option>
                <option value="auto">Auto (Scheduled)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4">
              <label className="text-white">Days to Keep:</label>
              <input
                type="number"
                min="0"
                max="365"
                value={settings.cleanup.daysToKeep}
                onChange={(e) => saveSettings({ cleanup: { ...settings.cleanup, daysToKeep: parseInt(e.target.value) ?? 0 } })}
                className="bg-gray-700 text-white rounded-lg px-3 py-2 w-24"
              />
              <span className="text-gray-400">
                {settings.cleanup.daysToKeep === 0 
                  ? '⚠️ Will delete ALL history!' 
                  : `(~${((settings.cleanup.daysToKeep * 9.5)).toFixed(0)} MB storage)`}
              </span>
            </div>
            
            {/* Schedule Settings - only shown in auto mode */}
            {settings.cleanup.mode === 'auto' && settings.cleanup.enabled && (
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                <h4 className="text-white font-medium">📅 Schedule</h4>
                
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="text-gray-300">Run:</label>
                  <select
                    value={settings.cleanup.schedule?.type || 'daily'}
                    onChange={(e) => saveSettings({ 
                      cleanup: { 
                        ...settings.cleanup, 
                        schedule: { ...settings.cleanup.schedule, type: e.target.value as 'daily' | 'weekly' | 'monthly' } 
                      } 
                    })}
                    className="bg-gray-700 text-white rounded-lg px-3 py-2"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  
                  <label className="text-gray-300">at</label>
                  <select
                    value={settings.cleanup.schedule?.hour ?? 0}
                    onChange={(e) => saveSettings({ 
                      cleanup: { 
                        ...settings.cleanup, 
                        schedule: { ...settings.cleanup.schedule, hour: parseInt(e.target.value) } 
                      } 
                    })}
                    className="bg-gray-700 text-white rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00 UTC</option>
                    ))}
                  </select>
                </div>
                
                {/* Day selection for weekly/monthly */}
                {(settings.cleanup.schedule?.type === 'weekly' || settings.cleanup.schedule?.type === 'monthly') && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-gray-300">On:</label>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                      <label key={day} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={settings.cleanup.schedule?.weekDays?.includes(i) ?? (i === 0 || i === 6)}
                          onChange={(e) => {
                            const currentDays = settings.cleanup.schedule?.weekDays || [0, 6];
                            const newDays = e.target.checked 
                              ? [...currentDays, i]
                              : currentDays.filter(d => d !== i);
                            saveSettings({ 
                              cleanup: { 
                                ...settings.cleanup, 
                                schedule: { ...settings.cleanup.schedule, weekDays: newDays } 
                              } 
                            });
                          }}
                          className="w-3 h-3 rounded"
                        />
                        <span className="text-gray-300 text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {/* Week of month for monthly */}
                {settings.cleanup.schedule?.type === 'monthly' && (
                  <div className="flex items-center gap-2">
                    <label className="text-gray-300">Week:</label>
                    <select
                      value={settings.cleanup.schedule?.monthWeek ?? 1}
                      onChange={(e) => saveSettings({ 
                        cleanup: { 
                          ...settings.cleanup, 
                          schedule: { ...settings.cleanup.schedule, monthWeek: parseInt(e.target.value) } 
                        } 
                      })}
                      className="bg-gray-700 text-white rounded-lg px-3 py-2"
                    >
                      <option value={1}>1st week</option>
                      <option value={2}>2nd week</option>
                      <option value={3}>3rd week</option>
                      <option value={4}>4th week</option>
                    </select>
                  </div>
                )}
                
                <div className="text-gray-400 text-xs">
                  ℹ️ Worker checks every 5 minutes. Cleanup runs once when schedule matches.
                </div>
              </div>
            )}
            
            {settings.cleanup.lastRun && (
              <div className="text-gray-400 text-sm">
                Last run: {new Date(settings.cleanup.lastRun).toLocaleString()}
              </div>
            )}
            
            <button
              onClick={runCleanup}
              disabled={cleanupRunning || saving}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {cleanupRunning ? '⏳ Running...' : '🗑️ Run Cleanup Now'}
            </button>
          </div>
        )}
      </div>

      {/* Gap Fill Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🔧 Gap Detection & Fill</h3>
        
        {settings && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.gapFill.enabled}
                  onChange={(e) => saveSettings({ gapFill: { ...settings.gapFill, enabled: e.target.checked } })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-white">Enable Gap Fill</span>
              </label>
              
              <select
                value={settings.gapFill.mode}
                onChange={(e) => saveSettings({ gapFill: { ...settings.gapFill, mode: e.target.value as 'auto' | 'manual' } })}
                className="bg-gray-700 text-white rounded-lg px-3 py-2"
                disabled={!settings.gapFill.enabled}
              >
                <option value="manual">Manual</option>
                <option value="auto">Auto (Background)</option>
              </select>
            </div>
            
            <div className="text-gray-400 text-sm bg-gray-700/50 rounded-lg p-3">
              ℹ️ Gap fill uses Massive.com Custom Bars API with exact timestamps.
              <br />
              <strong>History available:</strong> Up to 2 years (Basic plan) or all history (Starter/Business).
            </div>
            
            {settings.gapFill.lastRun && (
              <div className="text-gray-400 text-sm">
                Last run: {new Date(settings.gapFill.lastRun).toLocaleString()}
              </div>
            )}
            
            {/* Detected Gaps */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">Detected Gaps (recent, fillable): {gaps.length}</span>
                <button
                  onClick={fetchGaps}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Refresh
                </button>
              </div>
              
              {gaps.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {gaps.slice(0, 10).map((gap, i) => (
                    <div key={i} className="text-sm text-gray-300">
                      {gap.symbol}: {new Date(gap.startTime * 1000).toLocaleTimeString()} - {new Date(gap.endTime * 1000).toLocaleTimeString()} ({gap.missingMinutes} min)
                    </div>
                  ))}
                  {gaps.length > 10 && (
                    <div className="text-gray-400">...and {gaps.length - 10} more</div>
                  )}
                </div>
              ) : (
                <div className="text-green-400">✅ No recent fillable gaps detected</div>
              )}
            </div>
            
            <button
              onClick={runGapFill}
              disabled={gapFillRunning || saving || gaps.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {gapFillRunning ? '⏳ Filling Gaps...' : '🔧 Fill Gaps Now'}
            </button>
          </div>
        )}
      </div>

      {/* Seed Historical Data Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📥 Seed Historical Data</h3>
        
        <div className="space-y-4">
          <div className="text-gray-400 text-sm bg-gray-700/50 rounded-lg p-3">
            ℹ️ Import historical 1-minute candles from Massive.com into your database.
            <br />
            <strong>History available:</strong> Up to 2 years (Basic plan) or all history (Starter/Business).
          </div>
          
          {/* Date Range */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-white">From:</label>
            <input
              type="date"
              value={seedFromDate}
              onChange={(e) => setSeedFromDate(e.target.value)}
              className="bg-gray-700 text-white rounded-lg px-3 py-2"
            />
            <label className="text-white">To:</label>
            <input
              type="date"
              value={seedToDate}
              onChange={(e) => setSeedToDate(e.target.value)}
              className="bg-gray-700 text-white rounded-lg px-3 py-2"
            />
          </div>
          
          {/* Symbol Selection */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium">Select Symbols ({selectedSymbols.length}/{availableSymbols.length})</span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllSymbols}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Select All
                </button>
                <span className="text-gray-500">|</span>
                <button
                  onClick={deselectAllSymbols}
                  className="text-gray-400 hover:text-gray-300 text-sm"
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
              {availableSymbols.map((sym) => (
                <label
                  key={sym.symbol}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    selectedSymbols.includes(sym.symbol)
                      ? 'bg-blue-600/30 border border-blue-500'
                      : 'bg-gray-600/30 hover:bg-gray-600/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSymbols.includes(sym.symbol)}
                    onChange={() => toggleSymbol(sym.symbol)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-white text-sm">{sym.symbol}</span>
                </label>
              ))}
            </div>
            
            {availableSymbols.length === 0 && (
              <div className="text-gray-400 text-center py-4">
                No symbols available. Add symbols in Trading Symbols section.
              </div>
            )}
          </div>
          
          {/* Estimation */}
          {selectedSymbols.length > 0 && seedFromDate && seedToDate && (
            <div className="text-gray-400 text-sm">
              📊 Estimated: ~{Math.ceil((new Date(seedToDate).getTime() - new Date(seedFromDate).getTime()) / (1000 * 60 * 60 * 24))} days × {selectedSymbols.length} symbols = 
              ~{(Math.ceil((new Date(seedToDate).getTime() - new Date(seedFromDate).getTime()) / (1000 * 60 * 60 * 24)) * 1440 * selectedSymbols.length).toLocaleString()} candles
            </div>
          )}
          
          {/* Seed Results */}
          {seedResults && (
            <div className="bg-gray-700 rounded-lg p-4 max-h-40 overflow-y-auto">
              <div className="text-white font-medium mb-2">Results:</div>
              {seedResults.map((result, i) => (
                <div key={i} className={`text-sm ${result.error ? 'text-red-400' : 'text-gray-300'}`}>
                  {result.symbol}: {result.error ? `❌ ${result.error}` : `✅ Fetched ${result.fetched}, Inserted ${result.inserted}`}
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={runSeedHistory}
            disabled={seedRunning || selectedSymbols.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {seedRunning ? '⏳ Seeding Data...' : '📥 Start Seeding'}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-gray-800/50 rounded-lg p-4 text-gray-400 text-sm">
        <p><strong>ℹ️ How it works:</strong></p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong>Cleanup:</strong> Deletes candles where timestamp (t) &lt; cutoff. Example: t: 1768348800 is Jan 14, 2026 00:00 UTC.</li>
          <li><strong>Schedule:</strong> Worker checks every 5 minutes. When schedule matches (right hour + day), cleanup runs once.</li>
          <li><strong>Gap Fill:</strong> Uses Massive.com Custom Bars API with exact from/to timestamps.</li>
          <li><strong>History:</strong> Basic plan = 2 years, Starter/Business = All history.</li>
        </ul>
      </div>
    </div>
  );
}
