'use client';

import { useEffect, useState } from 'react';
import { MarketStatus, MarketHoliday } from '@/lib/services/real-forex-prices.service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useTradingMode } from '@/components/trading/TradingInterface';

interface MarketStatusBannerProps {
  className?: string;
}

export default function MarketStatusBanner({ className }: MarketStatusBannerProps) {
  const { mode } = useTradingMode();
  const isGameMode = mode === 'game';
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState<MarketHoliday[]>([]);
  const [countdown, setCountdown] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch market status and holidays
  useEffect(() => {
    async function fetchMarketData() {
      try {
        const [statusRes, holidaysRes] = await Promise.all([
          fetch('/api/trading/market-status'),
          fetch('/api/trading/market-holidays')
        ]);

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setMarketStatus(statusData);
        } else {
          // Market status API might not be available - use time-based fallback
          console.warn('Market status API not available, using time-based detection');
        }

        if (holidaysRes.ok) {
          const holidaysData = await holidaysRes.json();
          setUpcomingHolidays(holidaysData.holidays || []);
        } else {
          // Holidays API might not be available
          console.warn('Holidays API not available');
        }
      } catch (error) {
        console.warn('Error fetching market data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMarketData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (!marketStatus) return;

    function updateCountdown() {
      const now = new Date();
      let targetTime: Date;
      let prefix: string;

      if (marketStatus?.isOpen) {
        // Market is open, countdown to close (Friday 22:00 UTC)
        targetTime = getNextMarketClose(now);
        prefix = 'Market closes in';
      } else {
        // Market is closed, countdown to open (Monday 00:00 UTC or next day)
        targetTime = getNextMarketOpen(now);
        prefix = 'Market opens in';
      }

      const diff = targetTime.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdown('Updating...');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let timeString = '';
      if (days > 0) {
        timeString = `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        timeString = `${hours}h ${minutes}m ${seconds}s`;
      } else {
        timeString = `${minutes}m ${seconds}s`;
      }

      setCountdown(`${prefix} ${timeString}`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [marketStatus]);

  if (loading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  if (!marketStatus) return null;

  // Get next 3 upcoming holidays for forex
  const forexHolidays = upcomingHolidays
    .filter(h => h.exchange === 'forex' || h.exchange === 'all')
    .slice(0, 3);

  // Gamified Market Status for Game Mode
  if (isGameMode) {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Gamified Market Status Banner */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border-4 p-4 shadow-2xl transition-all',
            marketStatus.isOpen
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 border-green-400 shadow-green-500/50'
              : 'bg-gradient-to-r from-red-600 to-rose-600 border-red-400 shadow-red-500/50'
          )}
        >
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent animate-pulse" />
          </div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Large Pulsing Indicator */}
              <div className="relative">
                <div
                  className={cn(
                    'absolute inset-0 rounded-full animate-ping',
                    marketStatus.isOpen ? 'bg-white' : 'bg-white'
                  )}
                  style={{ animationDuration: '1.5s' }}
                />
                <div
                  className={cn(
                    'relative h-8 w-8 rounded-full flex items-center justify-center text-2xl',
                    marketStatus.isOpen ? 'bg-white' : 'bg-white'
                  )}
                >
                  {marketStatus.isOpen ? '🟢' : '🔴'}
                </div>
              </div>

              {/* Status Text with Gaming Font */}
              <div>
                <p className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider drop-shadow-lg" style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}>
                  {marketStatus.isOpen ? '⚡ MARKET OPEN ⚡' : '💤 MARKET CLOSED 💤'}
                </p>
                <p className="text-sm md:text-base text-white font-bold mt-1">
                  {marketStatus.isOpen ? '🚀 Place your trades now!' : '⏰ Come back when market opens'}
                </p>
              </div>
            </div>

            {/* Countdown with Gaming Style */}
            {countdown && (
              <div className="hidden md:flex flex-col items-end">
                <p className="text-xs text-white/80 uppercase font-bold tracking-wider">
                  {marketStatus.isOpen ? 'Closes in' : 'Opens in'}
                </p>
                <div className="bg-black/30 px-4 py-2 rounded-lg border-2 border-white/50 backdrop-blur-sm mt-1">
                  <p className="text-xl md:text-2xl font-black text-white font-mono tracking-wider drop-shadow-lg">
                    {countdown.split(' ').slice(2).join(' ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Countdown */}
          {countdown && (
            <div className="md:hidden mt-3 flex justify-center">
              <div className="bg-black/30 px-4 py-2 rounded-lg border-2 border-white/50 backdrop-blur-sm">
                <p className="text-sm text-white/80 uppercase font-bold tracking-wider text-center mb-1">
                  {marketStatus.isOpen ? 'Closes in' : 'Opens in'}
                </p>
                <p className="text-lg font-black text-white font-mono tracking-wider drop-shadow-lg text-center">
                  {countdown.split(' ').slice(2).join(' ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Gamified Upcoming Holidays Warning */}
        {forexHolidays.length > 0 && (
          <div className="relative overflow-hidden rounded-xl border-4 border-amber-400 bg-gradient-to-r from-amber-600 to-orange-600 p-4 shadow-2xl shadow-amber-500/50">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent animate-pulse" />
            </div>
            <div className="relative flex items-start gap-3">
              <span className="text-3xl md:text-4xl">⚠️</span>
              <div className="flex-1">
                <p className="text-xl md:text-2xl font-black text-white uppercase tracking-wider drop-shadow-lg mb-3" style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}>
                  🎯 UPCOMING MARKET HOLIDAYS! 🎯
                </p>
                <ul className="space-y-2">
                  {forexHolidays.map((holiday, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-white">
                      <span className="font-mono text-sm md:text-base bg-black/30 px-3 py-1 rounded-lg font-bold border-2 border-white/50">
                        {formatDate(holiday.date)}
                      </span>
                      <span className="font-bold text-sm md:text-base">{holiday.name}</span>
                      <span className="text-xs md:text-sm text-white/80">
                        ({holiday.status})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Professional Market Status (default)
  return (
    <div className={cn('space-y-3', className)}>
      {/* Market Status Banner */}
      <Alert
        className={cn(
          'border-2',
          marketStatus.isOpen
            ? 'border-green-500 bg-green-50 dark:bg-green-950'
            : 'border-red-500 bg-red-50 dark:bg-red-950'
        )}
      >
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-3 w-3 rounded-full animate-pulse',
                marketStatus.isOpen ? 'bg-green-500' : 'bg-red-500'
              )}
            />
            <span className="font-semibold">
              {marketStatus.isOpen ? 'Market is OPEN' : 'Market is CLOSED'}
            </span>
          </div>
          
          {countdown && (
            <span className="text-sm font-mono text-muted-foreground">
              {countdown}
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Upcoming Holidays Warning */}
      {forexHolidays.length > 0 && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <AlertDescription>
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold mb-2">Upcoming Market Holidays</p>
                <ul className="space-y-1 text-sm">
                  {forexHolidays.map((holiday, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded">
                        {formatDate(holiday.date)}
                      </span>
                      <span>{holiday.name}</span>
                      <span className="text-muted-foreground">
                        ({holiday.status})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Helper functions
function getNextMarketOpen(now: Date): Date {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  // If Sunday, open is Monday 00:00 UTC
  if (day === 0) {
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + 1);
    nextMonday.setUTCHours(0, 0, 0, 0);
    return nextMonday;
  }

  // If Saturday, open is Monday 00:00 UTC
  if (day === 6) {
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + 2);
    nextMonday.setUTCHours(0, 0, 0, 0);
    return nextMonday;
  }

  // If Friday after 22:00 UTC, next open is Monday 00:00 UTC
  if (day === 5 && hour >= 22) {
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + 3);
    nextMonday.setUTCHours(0, 0, 0, 0);
    return nextMonday;
  }

  // Otherwise, market should be open (return current time)
  return now;
}

function getNextMarketClose(now: Date): Date {
  const day = now.getUTCDay();

  // Next close is Friday 22:00 UTC
  const nextFriday = new Date(now);
  let daysUntilFriday = (5 - day + 7) % 7;
  
  // If it's already Friday but before 22:00, close is today
  if (day === 5 && now.getUTCHours() < 22) {
    daysUntilFriday = 0;
  } else if (daysUntilFriday === 0) {
    // If it's Friday after 22:00, next close is next Friday
    daysUntilFriday = 7;
  }

  nextFriday.setUTCDate(now.getUTCDate() + daysUntilFriday);
  nextFriday.setUTCHours(22, 0, 0, 0);
  
  return nextFriday;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

