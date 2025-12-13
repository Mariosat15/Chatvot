'use client';

import { useEffect, useState } from 'react';
import DashboardStats from './DashboardStats';
import GlobalRiskMetrics from './GlobalRiskMetrics';
import CompetitionsTable from './CompetitionsTable';
import RecentClosedTrades from './RecentClosedTrades';
import OpenPositions from './OpenPositions';
import WinPotentialCard from './WinPotentialCard';
import DailyPnLChart from './DailyPnLChart';
import Link from 'next/link';
import { Trophy, TrendingUp, RefreshCw } from 'lucide-react';

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
      console.log('🔄 Client: Fetching dashboard data...');
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
        console.log('✅ Client: Dashboard data received:', {
          activeCompetitions: newData.activeCompetitions?.length || 0,
          totalCapital: newData.overallStats?.totalCapital || 0,
          totalPnL: newData.overallStats?.totalPnL || 0,
          totalPositions: newData.overallStats?.totalPositions || 0,
          totalTrades: newData.overallStats?.totalTrades || 0,
        });
        
        // Log open positions for debugging
        newData.activeCompetitions?.forEach((comp: any, index: number) => {
          console.log(`Competition ${index + 1} (${comp.competition?.name}):`, {
            openPositionsCount: comp.openPositionsCount,
            openPositionsArray: comp.openPositions?.length || 0,
            currentOpenPositions: comp.participation?.currentOpenPositions || 0,
          });
        });
        setDashboardData(newData);
        setLastUpdate(Date.now());
      } else {
        console.error('❌ Client: Failed to fetch dashboard data:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Client Error refreshing dashboard:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Device fingerprinting happens globally via FingerprintProvider
  // No need to track here

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSinceUpdate(Math.floor((Date.now() - lastUpdate) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [lastUpdate]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    console.log('🔄 Setting up auto-refresh interval (10 seconds)');
    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh triggered');
      refreshData();
    }, 10000); // 10 seconds

    return () => {
      console.log('🛑 Clearing auto-refresh interval');
      clearInterval(interval);
    };
  }, []); // Empty dependency array - only set up once

  // Manual refresh handler
  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered');
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

