'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy, TrendingUp, TrendingDown, Target, Zap, Users, DollarSign,
  BarChart3, Activity, Clock, Calendar, Award, Crown, Medal,
  ArrowUpRight, ArrowDownRight, RefreshCw, ChevronRight, Flame,
  Swords, LineChart, PieChart, Timer, Sparkles, Shield, Eye
} from 'lucide-react';
import type { ComprehensiveDashboardData } from '@/lib/actions/comprehensive-dashboard.actions';
import WinPotentialCard from './WinPotentialCard';
import MarketHolidaysCard from './MarketHolidaysCard';
import type { RankingMethod } from '@/lib/services/ranking-config.service';
import { useAppSettings } from '@/contexts/AppSettingsContext';

interface ModernDashboardProps {
  data: ComprehensiveDashboardData;
}

export default function ModernDashboard({ data }: ModernDashboardProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { settings, formatCredits } = useAppSettings();

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (absValue >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header - Mobile Optimized */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg sm:rounded-xl flex-shrink-0">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-white" />
            </div>
            <span className="truncate">Trading Dashboard</span>
          </h1>
          <p className="text-gray-400 mt-0.5 sm:mt-1 text-sm sm:text-base truncate">
            Welcome back, <span className="text-yellow-400 font-medium">{data.user.name}</span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-gray-900 font-semibold rounded-xl transition-all shadow-lg shadow-yellow-500/25 disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Hero Stats Grid - Mobile Optimized */}
      <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        {/* Total Capital */}
        <div className="col-span-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-lg">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            </div>
            <span className="text-[10px] sm:text-xs text-emerald-400 font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 bg-emerald-500/20 rounded-full">
              Live Balance
            </span>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-0.5 sm:mb-1 tabular-nums">
            {formatCurrency(data.overview.totalCapital)}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">
            Across {data.overview.activeContests} active contest{data.overview.activeContests !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Total P&L */}
        <div className={`col-span-2 bg-gradient-to-br ${
          data.overview.totalPnL >= 0 
            ? 'from-green-500/20 to-green-600/10 border-green-500/30' 
            : 'from-red-500/20 to-red-600/10 border-red-500/30'
        } border rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5`}>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className={`p-1.5 sm:p-2 rounded-lg ${data.overview.totalPnL >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {data.overview.totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
              )}
            </div>
            <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
              data.overview.totalPnL >= 0 ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'
            }`}>
              {formatPercent(data.overview.totalPnLPercentage)}
            </span>
          </div>
          <p className={`text-xl sm:text-2xl md:text-3xl font-black mb-0.5 sm:mb-1 tabular-nums ${data.overview.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.overview.totalPnL >= 0 ? '+' : ''}{formatCurrency(data.overview.totalPnL)}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">Total Profit & Loss</p>
        </div>

        {/* Win Rate */}
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
          </div>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-white mb-0.5 sm:mb-1 tabular-nums">{data.overview.winRate.toFixed(1)}%</p>
          <p className="text-[10px] sm:text-xs text-gray-400">Win Rate</p>
        </div>

        {/* Profit Factor */}
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
          </div>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-white mb-0.5 sm:mb-1 tabular-nums">
            {data.overview.profitFactor > 99 ? '∞' : data.overview.profitFactor.toFixed(2)}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400">Profit Factor</p>
        </div>
      </section>

      {/* Secondary Stats - Mobile: 4 cols, scrollable on very small screens */}
      <section className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-1.5 sm:gap-2 md:gap-3">
        <StatCard icon={Activity} label="Trades" value={data.overview.totalTrades} color="gray" />
        <StatCard icon={TrendingUp} label="Wins" value={data.overview.winningTrades} color="green" />
        <StatCard icon={TrendingDown} label="Losses" value={data.overview.losingTrades} color="red" />
        <StatCard icon={Flame} label="Streak" value={data.streaks.currentWinStreak} color="orange" />
        <StatCard icon={ArrowUpRight} label="Avg Win" value={formatCurrency(data.overview.averageWin)} color="green" small />
        <StatCard icon={ArrowDownRight} label="Avg Loss" value={formatCurrency(data.overview.averageLoss)} color="red" small />
        <StatCard 
          icon={Award} 
          label="Prizes" 
          value={`${settings?.credits.symbol || '⚡'}${data.overview.totalPrizesWon.toLocaleString()}`} 
          color="yellow" 
          small 
        />
        <StatCard icon={Calendar} label="Days" value={data.streaks.tradingDaysThisMonth} color="blue" />
      </section>

      {/* Win Potential by Competition */}
      {data.competitions.active.length > 0 && (
        <section className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-3 sm:p-4 md:p-5 border-b border-gray-700/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg flex-shrink-0">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate">Win Potential</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400 truncate">
                    Each competition has its own ranking method
                  </p>
                </div>
              </div>
              <Link href="/competitions" className="text-xs sm:text-sm text-yellow-400 hover:text-yellow-300 flex items-center gap-1 self-end sm:self-auto">
                All Competitions <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Link>
            </div>
          </div>
          <div className="p-3 sm:p-4 md:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {data.competitions.active.map((comp) => (
                <WinPotentialCard
                  key={comp.id}
                  competition={{
                    _id: comp.id,
                    name: comp.name,
                    rankingMethod: comp.rankingMethod as RankingMethod,
                    prizeDistribution: comp.prizeDistribution,
                    minimumTrades: comp.minimumTrades,
                  }}
                  userParticipation={comp.userParticipation}
                  allParticipants={comp.allParticipants}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content Grid - Stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
          {/* Equity Curve */}
          <section className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="p-3 sm:p-4 md:p-5 border-b border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg">
                  <LineChart className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white">Equity Curve</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">Last 30 days performance</p>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4 md:p-5">
              <EquityCurveChart data={data.charts.equityCurve} />
            </div>
          </section>

          {/* Daily P&L */}
          <section className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="p-3 sm:p-4 md:p-5 border-b border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-500/20 rounded-lg">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white">Daily P&L</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">Profit/Loss by day</p>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4 md:p-5">
              <DailyPnLBars data={data.charts.dailyPnL} />
            </div>
          </section>

          {/* Trading Analytics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Win/Loss Distribution */}
            <section className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
                  <PieChart className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white">Win/Loss Distribution</h3>
              </div>
              <WinLossDonut data={data.charts.winLossDistribution} />
            </section>

            {/* Top Traded Symbols */}
            <section className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-cyan-500/20 rounded-lg">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white">Top Symbols</h3>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {data.charts.tradesBySymbol.slice(0, 5).map((item, i) => (
                  <div key={item.symbol} className="flex items-center justify-between p-1.5 sm:p-2 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span className="text-[10px] sm:text-xs font-bold text-gray-500 w-3 sm:w-4 flex-shrink-0">{i + 1}</span>
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">{item.symbol}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-[10px] sm:text-xs text-gray-400">{item.count} trades</p>
                      <p className={`text-xs sm:text-sm font-bold tabular-nums ${item.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {item.pnl >= 0 ? '+' : ''}{formatCurrency(item.pnl)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Right Column - Contests & Activity - Shows first on mobile */}
        <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
          {/* Active Competitions */}
          <section className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-yellow-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-lg">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Competitions</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">{data.competitions.active.length} active</p>
                </div>
              </div>
              <Link href="/competitions" className="text-[10px] sm:text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-0.5 sm:gap-1">
                View All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto scrollbar-thin">
              {data.competitions.active.length > 0 ? (
                data.competitions.active.map((comp) => (
                  <CompetitionCard key={comp.id} competition={comp} />
                ))
              ) : (
                <EmptyState icon={Trophy} message="No active competitions" action="Browse Competitions" href="/competitions" />
              )}
            </div>
            {/* Competition Stats */}
            <div className="p-2 sm:p-3 border-t border-yellow-500/20 grid grid-cols-3 gap-2">
              <MiniStat label="Total" value={data.competitions.stats.total} />
              <MiniStat label="Won" value={data.competitions.stats.won} color="yellow" />
              <MiniStat label="Top 3" value={data.competitions.stats.topThreeFinishes} color="orange" />
            </div>
          </section>

          {/* Active Challenges */}
          <section className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
                  <Swords className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">1v1 Challenges</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">{data.challenges.active.length} active</p>
                </div>
              </div>
              <Link href="/challenges" className="text-[10px] sm:text-xs text-purple-400 hover:text-purple-300 flex items-center gap-0.5 sm:gap-1">
                View All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto scrollbar-thin">
              {data.challenges.active.length > 0 ? (
                data.challenges.active.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))
              ) : (
                <EmptyState icon={Swords} message="No active challenges" action="Create Challenge" href="/challenges" />
              )}
            </div>
            {/* Challenge Stats */}
            <div className="p-2 sm:p-3 border-t border-purple-500/20 grid grid-cols-3 gap-2">
              <MiniStat label="Played" value={data.challenges.stats.total} />
              <MiniStat label="Wins" value={data.challenges.stats.wins} color="green" />
              <MiniStat label="Win Rate" value={`${data.challenges.stats.winRate.toFixed(0)}%`} color="purple" />
            </div>
          </section>

          {/* Recent Trades */}
          <section className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Recent Trades</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">Latest closed positions</p>
                </div>
              </div>
            </div>
            <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto scrollbar-thin">
              {data.recentActivity.trades.slice(0, 5).map((trade) => (
                <TradeCard key={trade.id} trade={trade} />
              ))}
              {data.recentActivity.trades.length === 0 && (
                <EmptyState icon={Activity} message="No trades yet" />
              )}
            </div>
          </section>

          {/* Open Positions */}
          {data.recentActivity.positions.length > 0 && (
            <section className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl sm:rounded-2xl overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-green-500/20 rounded-lg">
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white">Open Positions</h3>
                    <p className="text-[10px] sm:text-xs text-gray-400">{data.recentActivity.positions.length} active</p>
                  </div>
                </div>
              </div>
              <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
                {data.recentActivity.positions.map((pos) => (
                  <PositionCard key={pos.id} position={pos} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Streaks & Achievements */}
      <section className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-lg">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white">Trading Streaks</h3>
            <p className="text-[10px] sm:text-xs text-gray-400">Your current performance streaks</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          <StreakCard 
            icon={Flame} 
            label="Win Streak" 
            value={data.streaks.currentWinStreak} 
            subtitle={`Best: ${data.streaks.longestWinStreak}`}
            color="green" 
          />
          <StreakCard 
            icon={TrendingDown} 
            label="Loss Streak" 
            value={data.streaks.currentLossStreak} 
            subtitle={`Worst: ${data.streaks.longestLossStreak}`}
            color="red" 
          />
          <StreakCard 
            icon={Calendar} 
            label="Trading Days" 
            value={data.streaks.tradingDaysThisMonth} 
            subtitle="This month"
            color="blue" 
          />
          <StreakCard 
            icon={TrendingUp} 
            label="Profit Days" 
            value={data.streaks.consecutiveProfitableDays} 
            subtitle="In a row"
            color="emerald" 
          />
          <StreakCard 
            icon={Trophy} 
            label="Best Rank" 
            value={data.competitions.stats.bestRank > 0 ? `#${data.competitions.stats.bestRank}` : '-'} 
            subtitle="All time"
            color="yellow" 
          />
          <StreakCard 
            icon={Award} 
            label="Challenge W/L" 
            value={`${data.challenges.stats.wins}/${data.challenges.stats.losses}`} 
            subtitle={`${data.challenges.stats.winRate.toFixed(0)}% rate`}
            color="purple" 
          />
        </div>
      </section>

      {/* Market Holidays */}
      <MarketHolidaysCard />
    </div>
  );
}

// Helper Components - Mobile Optimized
function StatCard({ icon: Icon, label, value, color, small }: { 
  icon: any; label: string; value: string | number; color: string; small?: boolean 
}) {
  const colorClasses: Record<string, string> = {
    gray: 'from-gray-700/50 to-gray-800/50 border-gray-600/30',
    green: 'from-green-500/10 to-green-600/10 border-green-500/30',
    red: 'from-red-500/10 to-red-600/10 border-red-500/30',
    orange: 'from-orange-500/10 to-orange-600/10 border-orange-500/30',
    yellow: 'from-yellow-500/10 to-yellow-600/10 border-yellow-500/30',
    blue: 'from-blue-500/10 to-blue-600/10 border-blue-500/30',
  };
  const iconColors: Record<string, string> = {
    gray: 'text-gray-400',
    green: 'text-green-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg sm:rounded-xl p-2 sm:p-3`}>
      <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${iconColors[color]} mb-1 sm:mb-2`} />
      <p className={`${small ? 'text-sm sm:text-base md:text-lg' : 'text-base sm:text-lg md:text-xl'} font-bold text-white tabular-nums truncate`}>{value}</p>
      <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 truncate">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const textColor = color ? `text-${color}-400` : 'text-white';
  return (
    <div className="text-center">
      <p className={`text-sm sm:text-base md:text-lg font-bold tabular-nums ${color === 'yellow' ? 'text-yellow-400' : color === 'orange' ? 'text-orange-400' : color === 'green' ? 'text-green-400' : color === 'purple' ? 'text-purple-400' : 'text-white'}`}>{value}</p>
      <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500">{label}</p>
    </div>
  );
}

function StreakCard({ icon: Icon, label, value, subtitle, color }: {
  icon: any; label: string; value: string | number; subtitle: string; color: string;
}) {
  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    green: { bg: 'bg-green-500/10 border-green-500/30', icon: 'text-green-400', text: 'text-green-400' },
    red: { bg: 'bg-red-500/10 border-red-500/30', icon: 'text-red-400', text: 'text-red-400' },
    blue: { bg: 'bg-blue-500/10 border-blue-500/30', icon: 'text-blue-400', text: 'text-blue-400' },
    emerald: { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: 'text-emerald-400', text: 'text-emerald-400' },
    yellow: { bg: 'bg-yellow-500/10 border-yellow-500/30', icon: 'text-yellow-400', text: 'text-yellow-400' },
    purple: { bg: 'bg-purple-500/10 border-purple-500/30', icon: 'text-purple-400', text: 'text-purple-400' },
  };
  const c = colorClasses[color] || colorClasses.blue;
  return (
    <div className={`${c.bg} border rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center`}>
      <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${c.icon} mx-auto mb-1 sm:mb-2`} />
      <p className={`text-lg sm:text-xl md:text-2xl font-black ${c.text} tabular-nums`}>{value}</p>
      <p className="text-[9px] sm:text-[10px] md:text-xs text-white font-medium truncate">{label}</p>
      <p className="text-[8px] sm:text-[9px] md:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{subtitle}</p>
    </div>
  );
}

function CompetitionCard({ competition }: { competition: any }) {
  return (
    <Link 
      href={`/competitions/${competition.id}`}
      className="block p-2 sm:p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg sm:rounded-xl border border-gray-700/50 transition-all active:scale-98"
    >
      <div className="flex items-center justify-between mb-1 sm:mb-2">
        <span className="text-xs sm:text-sm font-semibold text-white truncate mr-2">{competition.name}</span>
        <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${
          competition.currentRank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
          competition.currentRank <= 3 ? 'bg-orange-500/20 text-orange-400' :
          'bg-gray-700 text-gray-300'
        }`}>
          #{competition.currentRank || '-'}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] sm:text-xs">
        <span className="text-gray-400">{competition.totalParticipants} traders</span>
        <span className={`font-bold tabular-nums ${competition.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {competition.pnl >= 0 ? '+' : ''}${competition.pnl.toFixed(2)}
        </span>
      </div>
    </Link>
  );
}

function ChallengeCard({ challenge }: { challenge: any }) {
  return (
    <Link 
      href={`/challenges/${challenge.id}`}
      className="block p-2 sm:p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg sm:rounded-xl border border-gray-700/50 transition-all active:scale-98"
    >
      <div className="flex items-center justify-between mb-1 sm:mb-2">
        <span className="text-xs sm:text-sm font-semibold text-white truncate mr-2">
          vs {challenge.opponent?.name || 'Opponent'}
        </span>
        <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${
          challenge.isLeading ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {challenge.isLeading ? '🏆' : '📉'}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] sm:text-xs">
        <span className="text-gray-400">${challenge.stakeAmount}</span>
        <span className={`font-bold tabular-nums ${challenge.userPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {challenge.userPnL >= 0 ? '+' : ''}${challenge.userPnL.toFixed(2)}
        </span>
      </div>
    </Link>
  );
}

function TradeCard({ trade }: { trade: any }) {
  return (
    <div className="flex items-center justify-between p-1.5 sm:p-2 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          trade.side === 'long' ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {trade.side === 'long' ? (
            <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
          ) : (
            <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-white truncate">{trade.symbol}</p>
          <p className="text-[9px] sm:text-xs text-gray-500 uppercase">{trade.side}</p>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <p className={`text-xs sm:text-sm font-bold tabular-nums ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
        </p>
        <p className="text-[9px] sm:text-xs text-gray-500">
          {new Date(trade.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function PositionCard({ position }: { position: any }) {
  return (
    <div className="flex items-center justify-between p-1.5 sm:p-2 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          position.side === 'long' ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {position.side === 'long' ? (
            <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
          ) : (
            <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-white truncate">{position.symbol}</p>
          <p className="text-[9px] sm:text-xs text-gray-500">@ {position.entryPrice.toFixed(5)}</p>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <p className={`text-xs sm:text-sm font-bold tabular-nums ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
        </p>
        <p className="text-[9px] sm:text-xs text-gray-500">
          {position.unrealizedPnLPercentage >= 0 ? '+' : ''}{position.unrealizedPnLPercentage.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message, action, href }: { 
  icon: any; message: string; action?: string; href?: string 
}) {
  return (
    <div className="text-center py-4 sm:py-6">
      <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 mx-auto mb-1.5 sm:mb-2" />
      <p className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2">{message}</p>
      {action && href && (
        <Link href={href} className="text-[10px] sm:text-xs text-yellow-400 hover:text-yellow-300">
          {action} →
        </Link>
      )}
    </div>
  );
}

// Chart Components - Mobile Optimized
function EquityCurveChart({ data }: { data: { date: string; equity: number; pnl: number }[] }) {
  if (data.length < 2) {
    return <div className="h-32 sm:h-40 md:h-48 flex items-center justify-center text-gray-500 text-xs sm:text-sm">Not enough data</div>;
  }
  
  const min = Math.min(...data.map(d => d.equity));
  const max = Math.max(...data.map(d => d.equity));
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.equity - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  
  const lastEquity = data[data.length - 1]?.equity || 0;
  const firstEquity = data[0]?.equity || 0;
  const change = lastEquity - firstEquity;
  const isPositive = change >= 0;
  
  return (
    <div className="relative">
      <div className="absolute top-0 right-0 text-right">
        <p className={`text-lg sm:text-xl md:text-2xl font-bold tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          ${lastEquity.toFixed(0)}
        </p>
        <p className={`text-xs sm:text-sm tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)} ({((change / (firstEquity || 1)) * 100).toFixed(2)}%)
        </p>
      </div>
      <svg className="w-full h-32 sm:h-40 md:h-48" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#equityGradient)"
        />
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[9px] sm:text-[10px] md:text-xs text-gray-500 mt-1 sm:mt-2">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function DailyPnLBars({ data }: { data: { date: string; pnl: number; trades: number }[] }) {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
  // Show fewer bars on mobile
  const displayData = typeof window !== 'undefined' && window.innerWidth < 640 ? data.slice(-7) : data.slice(-14);
  
  return (
    <div className="h-24 sm:h-28 md:h-32 flex items-end gap-0.5 sm:gap-1">
      {displayData.map((d, i) => {
        const height = (Math.abs(d.pnl) / maxAbs) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: $${d.pnl.toFixed(2)}`}>
            <div 
              className={`w-full rounded-t transition-all hover:opacity-80 ${
                d.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ height: `${Math.max(height, 2)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function WinLossDonut({ data }: { data: { wins: number; losses: number; breakeven: number } }) {
  const total = data.wins + data.losses + data.breakeven;
  if (total === 0) {
    return <div className="h-24 sm:h-28 md:h-32 flex items-center justify-center text-gray-500 text-xs sm:text-sm">No data</div>;
  }
  
  const winPercent = (data.wins / total) * 100;
  const lossPercent = (data.losses / total) * 100;
  
  const circumference = 2 * Math.PI * 40;
  const winDash = (winPercent / 100) * circumference;
  const lossDash = (lossPercent / 100) * circumference;
  
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" fill="none" stroke="#374151" strokeWidth="8" />
          <circle 
            cx="50%" cy="50%" r="40%" fill="none" 
            stroke="#22c55e" strokeWidth="8"
            strokeDasharray={`${winDash} ${circumference}`}
            strokeLinecap="round"
          />
          <circle 
            cx="50%" cy="50%" r="40%" fill="none" 
            stroke="#ef4444" strokeWidth="8"
            strokeDasharray={`${lossDash} ${circumference}`}
            strokeDashoffset={-winDash}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm sm:text-base md:text-lg font-bold text-white tabular-nums">{total}</span>
        </div>
      </div>
      <div className="space-y-1 sm:space-y-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500" />
          <span className="text-xs sm:text-sm text-gray-300">{data.wins} Wins</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500" />
          <span className="text-xs sm:text-sm text-gray-300">{data.losses} Losses</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-500" />
          <span className="text-xs sm:text-sm text-gray-300">{data.breakeven} BE</span>
        </div>
      </div>
    </div>
  );
}
