'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Trophy, TrendingUp, TrendingDown, Target, BarChart3, 
  Activity, Clock, Flame, Award, Users, DollarSign,
  ArrowUpRight, ArrowDownRight, Zap, Shield, RefreshCw,
  Play, Eye, ChevronRight, Sparkles, Medal, Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

interface CompetitionDashboardProps {
  competitionId: string;
  initialParticipant: {
    _id: string;
    currentCapital: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    currentRank?: number;
    winningTrades?: number;
    losingTrades?: number;
  } | null;
  competitionStatus: 'upcoming' | 'active' | 'completed';
  startTime: string;
  endTime: string;
  startingCapital: number;
  totalParticipants: number;
}

interface AllTimeStats {
  totalCompetitions: number;
  activeCompetitions: number;
  completedCompetitions: number;
  totalPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  bestRank: number | null;
  averageRank: number;
  totalPrizesWon: number;
  totalEntryFees: number;
  netProfit: number;
  winRate: number;
  averagePnLPerCompetition: number;
  biggestWin: number;
  biggestLoss: number;
  rankHistory: { date: string; rank: number; competition: string }[];
  pnlHistory: { date: string; pnl: number; competition: string }[];
}

interface CurrentStats {
  competitionName: string;
  competitionStatus: string;
  startingCapital: number;
  currentCapital: number;
  currentRank: number | null;
  totalParticipants: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  openPositionsCount: number;
  unrealizedPnL: number;
  realizedPnL: number;
  equity: number;
  marginUsed: number;
  availableMargin: number;
  todayPnL: number;
  todayTrades: number;
  todayWinRate: number;
  winStreak: number;
  loseStreak: number;
  currentStreak: number;
  isOnWinStreak: boolean;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingTime: number;
}

interface EquityPoint {
  time: string;
  equity: number;
}

export default function CompetitionDashboard({
  competitionId,
  initialParticipant,
  competitionStatus,
  startTime,
  endTime,
  startingCapital,
  totalParticipants,
}: CompetitionDashboardProps) {
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null);
  const [currentStats, setCurrentStats] = useState<CurrentStats | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('live');

  const isActive = competitionStatus === 'active';
  const isCompleted = competitionStatus === 'completed';
  const isUpcoming = competitionStatus === 'upcoming';

  // Fetch comprehensive stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/user/competition-stats?competitionId=${competitionId}`);
      if (response.ok) {
        const data = await response.json();
        setAllTimeStats(data.allTimeStats);
        setCurrentStats(data.currentCompetitionStats);
        setEquityCurve(data.equityCurve || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch competition stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 30 seconds for active competitions
    if (isActive) {
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchStats, isActive]);

  // Calculate equity curve chart points
  const chartData = useMemo(() => {
    if (equityCurve.length < 2) return null;
    
    const minEquity = Math.min(...equityCurve.map(p => p.equity));
    const maxEquity = Math.max(...equityCurve.map(p => p.equity));
    const range = maxEquity - minEquity || 1;
    
    const points = equityCurve.map((point, index) => {
      const x = (index / (equityCurve.length - 1)) * 100;
      const y = 100 - ((point.equity - minEquity) / range) * 100;
      return `${x},${y}`;
    }).join(' ');
    
    return { points, minEquity, maxEquity };
  }, [equityCurve]);

  // Ranking position indicator
  const getRankBadge = (rank: number | null | undefined, total: number) => {
    if (!rank) return { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: null, label: 'Unranked' };
    
    const percentile = (rank / total) * 100;
    
    if (rank === 1) return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Crown, label: '1st Place' };
    if (rank === 2) return { color: 'text-gray-300', bg: 'bg-gray-400/20', icon: Medal, label: '2nd Place' };
    if (rank === 3) return { color: 'text-orange-400', bg: 'bg-orange-500/20', icon: Medal, label: '3rd Place' };
    if (percentile <= 10) return { color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Award, label: 'Top 10%' };
    if (percentile <= 25) return { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Trophy, label: 'Top 25%' };
    if (percentile <= 50) return { color: 'text-green-400', bg: 'bg-green-500/20', icon: Target, label: 'Top 50%' };
    return { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: null, label: `#${rank}` };
  };

  if (!initialParticipant) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-8">
        <div className="flex items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 text-blue-400 animate-spin" />
          <span className="text-slate-400">Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  const stats = currentStats || {
    currentCapital: initialParticipant.currentCapital,
    pnl: initialParticipant.pnl,
    pnlPercentage: initialParticipant.pnlPercentage,
    totalTrades: initialParticipant.totalTrades,
    currentRank: initialParticipant.currentRank,
    winningTrades: initialParticipant.winningTrades || 0,
    losingTrades: initialParticipant.losingTrades || 0,
    winRate: initialParticipant.totalTrades > 0 
      ? ((initialParticipant.winningTrades || 0) / initialParticipant.totalTrades) * 100 
      : 0,
    unrealizedPnL: 0,
    realizedPnL: initialParticipant.pnl,
    equity: initialParticipant.currentCapital,
    openPositionsCount: 0,
    todayPnL: 0,
    todayTrades: 0,
    winStreak: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    totalParticipants,
  };

  const rankInfo = getRankBadge(stats.currentRank, stats.totalParticipants || totalParticipants);

  return (
    <div className="space-y-6">
      {/* Main Dashboard Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800/95 to-slate-900 border border-slate-700/50 overflow-hidden shadow-2xl">
        {/* Header with Status */}
        <div className="relative px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${rankInfo.bg}`}>
                {rankInfo.icon ? <rankInfo.icon className={`h-6 w-6 ${rankInfo.color}`} /> : <Trophy className={`h-6 w-6 ${rankInfo.color}`} />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Your Competition Dashboard
                  {isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                      LIVE
                    </span>
                  )}
                  {isCompleted && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                      FINAL
                    </span>
                  )}
                </h2>
                <p className="text-sm text-slate-400 flex items-center gap-2">
                  <span className={rankInfo.color}>{rankInfo.label}</span>
                  <span className="text-slate-600">•</span>
                  <span>Rank #{stats.currentRank || '—'} of {stats.totalParticipants || totalParticipants}</span>
                </p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {isActive && (
                <Link href={`/competitions/${competitionId}/trade`}>
                  <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25">
                    <Play className="h-4 w-4 mr-2" />
                    Trade Now
                  </Button>
                </Link>
              )}
              {isCompleted && (
                <Link href={`/competitions/${competitionId}/results`}>
                  <Button className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-semibold">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Results
                  </Button>
                </Link>
              )}
              {isUpcoming && (
                <div className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Starting Soon
                </div>
              )}
            </div>
          </div>
          
          {/* Last update indicator */}
          <div className="absolute bottom-2 right-4 text-xs text-slate-500 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Updated {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-4 border-b border-slate-700/30">
            <TabsList className="bg-slate-800/50 p-1 rounded-xl">
              <TabsTrigger 
                value="live" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg px-4"
              >
                <Activity className="h-4 w-4 mr-2" />
                Live Stats
              </TabsTrigger>
              <TabsTrigger 
                value="performance" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white rounded-lg px-4"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger 
                value="alltime" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg px-4"
              >
                <Trophy className="h-4 w-4 mr-2" />
                All-Time
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Live Stats Tab */}
          <TabsContent value="live" className="p-6 space-y-6 mt-0">
            {/* Primary Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Current Capital */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Capital</span>
                  <DollarSign className="h-4 w-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white" suppressHydrationWarning>
                  ${stats.currentCapital?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Started: ${startingCapital?.toLocaleString()}
                </p>
              </div>

              {/* P&L */}
              <div className={`p-4 rounded-xl border transition-colors ${
                stats.pnl >= 0 
                  ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30 hover:border-green-500/50' 
                  : 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30 hover:border-red-500/50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total P&L</span>
                  {stats.pnl >= 0 ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                </div>
                <p className={`text-2xl font-bold ${stats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.pnl >= 0 ? '+' : ''}${stats.pnl?.toFixed(2) || '0.00'}
                </p>
                <p className={`text-xs mt-1 ${stats.pnlPercentage >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                  {stats.pnlPercentage >= 0 ? '+' : ''}{stats.pnlPercentage?.toFixed(2) || '0.00'}% ROI
                </p>
              </div>

              {/* Win Rate */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Win Rate</span>
                  <Target className="h-4 w-4 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {stats.winRate?.toFixed(1) || '0.0'}%
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.winningTrades || 0}W / {stats.losingTrades || 0}L
                </p>
              </div>

              {/* Rank */}
              <div className={`p-4 rounded-xl border transition-colors ${rankInfo.bg} border-slate-700/50`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Your Rank</span>
                  {rankInfo.icon ? <rankInfo.icon className={`h-4 w-4 ${rankInfo.color}`} /> : <Trophy className="h-4 w-4 text-amber-400" />}
                </div>
                <p className={`text-2xl font-bold ${rankInfo.color}`}>
                  #{stats.currentRank || '—'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  of {stats.totalParticipants || totalParticipants} traders
                </p>
              </div>
            </div>

            {/* Equity Chart */}
            {chartData && equityCurve.length > 1 && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-400" />
                    Equity Curve
                  </h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">
                      Min: <span className="text-white font-medium">${chartData.minEquity.toFixed(2)}</span>
                    </span>
                    <span className="text-slate-400">
                      Max: <span className="text-white font-medium">${chartData.maxEquity.toFixed(2)}</span>
                    </span>
                  </div>
                </div>
                <div className="h-32 relative">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(100,116,139,0.2)" strokeWidth="0.5" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(100,116,139,0.2)" strokeWidth="0.5" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(100,116,139,0.2)" strokeWidth="0.5" />
                    
                    {/* Starting capital line */}
                    {(() => {
                      const startY = 100 - ((startingCapital - chartData.minEquity) / (chartData.maxEquity - chartData.minEquity || 1)) * 100;
                      return (
                        <line 
                          x1="0" y1={startY} x2="100" y2={startY} 
                          stroke="rgba(59,130,246,0.3)" 
                          strokeWidth="0.5" 
                          strokeDasharray="2,2"
                        />
                      );
                    })()}
                    
                    {/* Equity line */}
                    <polyline
                      fill="none"
                      stroke={stats.pnl >= 0 ? '#22c55e' : '#ef4444'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={chartData.points}
                      vectorEffect="non-scaling-stroke"
                    />
                    
                    {/* Area fill */}
                    <polygon
                      fill={stats.pnl >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
                      points={`0,100 ${chartData.points} 100,100`}
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Trades */}
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Total Trades</p>
                <p className="text-lg font-bold text-white">{stats.totalTrades || 0}</p>
              </div>
              
              {/* Open Positions */}
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Open Positions</p>
                <p className="text-lg font-bold text-cyan-400">{currentStats?.openPositionsCount || 0}</p>
              </div>
              
              {/* Unrealized P&L */}
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Unrealized P&L</p>
                <p className={`text-lg font-bold ${(currentStats?.unrealizedPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(currentStats?.unrealizedPnL || 0) >= 0 ? '+' : ''}${(currentStats?.unrealizedPnL || 0).toFixed(2)}
                </p>
              </div>
              
              {/* Today's P&L */}
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Today&apos;s P&L</p>
                <p className={`text-lg font-bold ${(currentStats?.todayPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(currentStats?.todayPnL || 0) >= 0 ? '+' : ''}${(currentStats?.todayPnL || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="p-6 space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Trading Stats */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-400" />
                  Trading Statistics
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Avg Win</p>
                    <p className="text-lg font-bold text-green-400">
                      +${(currentStats?.avgWin || 0).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Avg Loss</p>
                    <p className="text-lg font-bold text-red-400">
                      -${(currentStats?.avgLoss || 0).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Largest Win</p>
                    <p className="text-lg font-bold text-green-400">
                      +${(currentStats?.largestWin || 0).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Largest Loss</p>
                    <p className="text-lg font-bold text-red-400">
                      ${(currentStats?.largestLoss || 0).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Profit Factor</p>
                    <p className={`text-lg font-bold ${(currentStats?.profitFactor || 0) >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                      {(currentStats?.profitFactor || 0).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Avg Hold Time</p>
                    <p className="text-lg font-bold text-white">
                      {(currentStats?.avgHoldingTime || 0).toFixed(0)}m
                    </p>
                  </div>
                </div>
              </div>

              {/* Streaks & Momentum */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-400" />
                  Streaks & Momentum
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-4 rounded-lg border ${
                    currentStats?.isOnWinStreak 
                      ? 'bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30' 
                      : 'bg-slate-800/50 border-slate-700/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className={`h-4 w-4 ${currentStats?.isOnWinStreak ? 'text-green-400' : 'text-slate-400'}`} />
                      <p className="text-xs text-slate-400">Win Streak</p>
                    </div>
                    <p className={`text-2xl font-bold ${currentStats?.isOnWinStreak && (currentStats?.winStreak || 0) > 0 ? 'text-green-400' : 'text-white'}`}>
                      {currentStats?.winStreak || 0}
                    </p>
                    {currentStats?.isOnWinStreak && (currentStats?.winStreak || 0) >= 3 && (
                      <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> On fire!
                      </p>
                    )}
                  </div>
                  
                  <div className={`p-4 rounded-lg border ${
                    !currentStats?.isOnWinStreak && (currentStats?.loseStreak || 0) > 0
                      ? 'bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30' 
                      : 'bg-slate-800/50 border-slate-700/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className={`h-4 w-4 ${!currentStats?.isOnWinStreak && (currentStats?.loseStreak || 0) > 0 ? 'text-red-400' : 'text-slate-400'}`} />
                      <p className="text-xs text-slate-400">Lose Streak</p>
                    </div>
                    <p className={`text-2xl font-bold ${!currentStats?.isOnWinStreak && (currentStats?.loseStreak || 0) > 0 ? 'text-red-400' : 'text-white'}`}>
                      {currentStats?.loseStreak || 0}
                    </p>
                  </div>
                </div>

                {/* Win Rate Visual */}
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-400">Win Rate Distribution</p>
                    <p className="text-sm font-bold text-white">{(stats.winRate || 0).toFixed(1)}%</p>
                  </div>
                  <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${stats.winRate || 0}%` }}
                    />
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-rose-400"
                      style={{ width: `${100 - (stats.winRate || 0)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-green-400">{stats.winningTrades || 0} wins</span>
                    <span className="text-red-400">{stats.losingTrades || 0} losses</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* All-Time Tab */}
          <TabsContent value="alltime" className="p-6 space-y-6 mt-0">
            {allTimeStats ? (
              <>
                {/* Career Overview */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <p className="text-xs text-slate-400">Competitions</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{allTimeStats.totalCompetitions}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {allTimeStats.completedCompetitions} completed
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-purple-400" />
                      <p className="text-xs text-slate-400">Best Rank</p>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      #{allTimeStats.bestRank || '—'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Avg: #{allTimeStats.averageRank.toFixed(1)}
                    </p>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${
                    allTimeStats.totalPnL >= 0 
                      ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30'
                      : 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className={`h-4 w-4 ${allTimeStats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                      <p className="text-xs text-slate-400">Total P&L</p>
                    </div>
                    <p className={`text-2xl font-bold ${allTimeStats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {allTimeStats.totalPnL >= 0 ? '+' : ''}${allTimeStats.totalPnL.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Avg: ${allTimeStats.averagePnLPerCompetition.toFixed(2)}/comp
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-cyan-400" />
                      <p className="text-xs text-slate-400">Prizes Won</p>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      ${allTimeStats.totalPrizesWon.toFixed(0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Net: ${allTimeStats.netProfit.toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* Career Trading Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Total Trades</p>
                    <p className="text-lg font-bold text-white">{allTimeStats.totalTrades}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Career Win Rate</p>
                    <p className="text-lg font-bold text-white">{allTimeStats.winRate.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Biggest Win</p>
                    <p className="text-lg font-bold text-green-400">+${allTimeStats.biggestWin.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Biggest Loss</p>
                    <p className="text-lg font-bold text-red-400">${allTimeStats.biggestLoss.toFixed(2)}</p>
                  </div>
                </div>

                {/* P&L History Mini Chart */}
                {allTimeStats.pnlHistory.length > 1 && (
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-amber-400" />
                      Competition History
                    </h3>
                    <div className="flex items-end gap-1 h-20">
                      {allTimeStats.pnlHistory.slice(-12).map((item, index) => {
                        const maxPnl = Math.max(...allTimeStats.pnlHistory.map(h => Math.abs(h.pnl)));
                        const height = maxPnl > 0 ? (Math.abs(item.pnl) / maxPnl) * 100 : 0;
                        return (
                          <div 
                            key={index}
                            className="flex-1 flex flex-col justify-end"
                            title={`${item.competition}: ${item.pnl >= 0 ? '+' : ''}$${item.pnl.toFixed(2)}`}
                          >
                            <div 
                              className={`rounded-t transition-all hover:opacity-80 ${
                                item.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'
                              }`}
                              style={{ height: `${Math.max(height, 5)}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">Last {Math.min(allTimeStats.pnlHistory.length, 12)} competitions</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Complete more competitions to see your all-time stats!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

