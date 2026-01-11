'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DashboardStats from './DashboardStats';
import GlobalRiskMetrics from './GlobalRiskMetrics';
import CompetitionsTable from './CompetitionsTable';
import RecentClosedTrades from './RecentClosedTrades';
import OpenPositions from './OpenPositions';
import DailyPnLChart from './DailyPnLChart';
import Link from 'next/link';
import { Trophy, TrendingUp, RefreshCw } from 'lucide-react';

interface DashboardData {
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
}

interface LiveDashboardWrapperProps {
  initialData: DashboardData;
}

/**
 * Dashboard Wrapper Component
 * 
 * Design principles:
 * - Uses ONLY server-rendered data (no client-side fetching)
 * - No auto-refresh (user controls when to refresh)
 * - Refresh = page reload (ensures consistent data from server)
 * - Simple, predictable, no layout shifts
 */
export default function LiveDashboardWrapper({ initialData }: LiveDashboardWrapperProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use server data directly - no client-side state mutations
  const dashboardData = initialData;

  // Refresh handler - reloads the page to get fresh server data
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Use router.refresh() to re-fetch server data without full page reload
    router.refresh();
    // Reset refreshing state after a short delay
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <>
      {/* Dashboard Header */}
      <div className="w-full flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Competition Dashboard
          </h1>
          <p className="text-gray-400 mt-2">Track your performance and compete in real-time</p>
        </div>
        
        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
            ${isRefreshing 
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
              : 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
            }
          `}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
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
