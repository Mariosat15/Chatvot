'use client';

import { useState, useEffect, useCallback } from 'react';

interface RiskSettings {
  defaultLeverage: number;
  marginLiquidation: number;
  marginCall: number;
  marginWarning: number;
  marginSafe: number;
  maxOpenPositions: number;
  maxPositionSize: number;
  marginCheckIntervalSeconds: number;
}

const DEFAULT_SETTINGS: RiskSettings = {
  defaultLeverage: 10,
  marginLiquidation: 50,
  marginCall: 100,
  marginWarning: 150,
  marginSafe: 200,
  maxOpenPositions: 10,
  maxPositionSize: 100,
  marginCheckIntervalSeconds: 60,
};

/**
 * Hook to automatically poll for risk settings updates
 * 
 * @param pollInterval - How often to check for updates (in milliseconds)
 * @returns Current risk settings that update automatically
 */
export function useRiskSettings(pollInterval = 10000) { // Poll every 10 seconds
  const [settings, setSettings] = useState<RiskSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/trading/risk-settings', {
        method: 'GET',
        cache: 'no-store', // Never cache
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
          setError(null);
        }
      } else if (response.status === 404) {
        // API endpoint doesn't exist (likely not on trading page) - use defaults silently
        setSettings(DEFAULT_SETTINGS);
        setError(null);
      }
    } catch (err) {
      // Fail silently if not on a page that uses risk settings - use defaults
      setSettings(DEFAULT_SETTINGS);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(fetchSettings, pollInterval);
    return () => clearInterval(interval);
  }, [fetchSettings, pollInterval]);

  return { settings, isLoading, error, refetch: fetchSettings };
}

