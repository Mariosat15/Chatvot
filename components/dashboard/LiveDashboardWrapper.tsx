'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import DashboardStats from './DashboardStats';
import GlobalRiskMetrics from './GlobalRiskMetrics';
import CompetitionsTable from './CompetitionsTable';
import RecentClosedTrades from './RecentClosedTrades';
import OpenPositions from './OpenPositions';
import DailyPnLChart from './DailyPnLChart';
import Link from 'next/link';
import { Trophy, TrendingUp, RefreshCw } from 'lucide-react';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

interface LiveDashboardWrapperProps {
  initialData: {
    activeCompetitions: any[];
    overallStats: {
      totalCapital: number;
      totalPnL: number;
      totalPositions: number;
      totalTrades: number;
      totalWinningTrades: number;
      totalLosingTrades: number;
      overallWinRate: number;
      profitFactor: number;
      activeCompetitionsCount: number;
    };
    globalCharts?: {
      dailyPnL: any[];
    };
  };
}

export default function LiveDashboardWrapper({ initialData }: LiveDashboardWrapperProps) {
  const [dashboardData, setDashboardData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(0);

  // Auto-refresh function
  const refreshData = async () => {
    if (isRefreshing) return; // Prevent duplicate requests
    
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/dashboard/live-stats?t=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      
      if (response.ok) {
        const newData = await response.json();
        setDashboardData(newData);
        setLastUpdate(Date.now());
      }
    } catch {
      // Silently handle refresh errors
    } finally {
      setIsRefreshing(false);
    }
  };

  // Device fingerprinting happens globally via FingerprintProvider
  // No need to track here

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSinceUpdate(Math.floor((Date.now() - lastUpdate) / 1000));
    }, PERFORMANCE_INTERVALS.COUNTDOWN_UPDATE);

    return () => clearInterval(timer);
  }, [lastUpdate]);

  // Auto-refresh with visibility awareness - optimized to 15 seconds
  useEffect(() => {
    const handleRefresh = () => {
      // Skip if tab is hidden
      if (document.hidden) return;
      refreshData();
    };

    const interval = setInterval(handleRefresh, PERFORMANCE_INTERVALS.DASHBOARD_REFRESH);
    
    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Empty dependency array - only set up once

  // Manual refresh handler
  const handleManualRefresh = () => {
    refreshData();
  };

  return (
    <>
      {/* Dashboard Header */}
      <div className="w-full flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Competition Dashboard
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-gray-400">Track your performance and compete in real-time</p>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-yellow-500 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>
                {isRefreshing ? 'Refreshing...' : `Updated ${timeSinceUpdate}s ago`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <DashboardStats overallStats={dashboardData.overallStats} />

      {/* Global Daily P&L Chart - Above Competitions */}
      {dashboardData.globalCharts?.dailyPnL && dashboardData.globalCharts.dailyPnL.length > 0 && (
        <section className="w-full mt-8">
          <DailyPnLChart data={dashboardData.globalCharts.dailyPnL} />
        </section>
      )}

      {/* Global Risk Metrics */}
      {dashboardData.activeCompetitions.length > 0 && (
        <section className="w-full mt-8">
          <GlobalRiskMetrics 
            competitions={dashboardData.activeCompetitions}
            overallStats={dashboardData.overallStats}
          />
        </section>
      )}

      {/* Competitions Table */}
      {dashboardData.activeCompetitions.length > 0 && (
        <section className="w-full mt-8">
          <CompetitionsTable competitions={dashboardData.activeCompetitions} />
        </section>
      )}

      {/* Trades and Positions Section */}
      {dashboardData.activeCompetitions.length > 0 ? (
        <section className="w-full mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-yellow-500" />
              Trades & Positions
            </h2>
          </div>
          
          <div className="space-y-6">
            {dashboardData.activeCompetitions.map((comp: any) => (
              <div key={comp.competition._id} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Closed Trades */}
                <RecentClosedTrades 
                  trades={comp.recentClosedTrades || []}
                  competitionName={comp.competition.name}
                />
                
                {/* Open Positions */}
                <OpenPositions 
                  positions={comp.openPositions || []}
                  competitionName={comp.competition.name}
                />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="w-full mt-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
            <Trophy className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-100 mb-2">
              No Live Competitions
            </h3>
            <p className="text-gray-400 mb-6">
              Join a competition to start trading and compete with others in real-time!
            </p>
            <Link
              href="/competitions"
              className="inline-block px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-lg transition-colors"
            >
              Browse Competitions
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

