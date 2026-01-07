'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trophy,
  Medal,
  Star,
  Crown,
  Zap,
  Swords,
  LayoutList,
  Sparkles,
  TrendingUp,
  Target,
  Award,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  BarChart3,
  Percent,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import LeaderboardChallengeButton from '@/components/leaderboard/LeaderboardChallengeButton';
import MatchmakingCards from '@/components/leaderboard/MatchmakingCards';
import ProfileCard from '@/components/profile/ProfileCard';
import ChallengeCreateDialog from '@/components/challenges/ChallengeCreateDialog';
import { cn } from '@/lib/utils';

// Filter types
interface LeaderboardFilters {
  search: string;
  rankRange: string;
  winRateRange: string;
  tradesRange: string;
  levelRange: string;
  pnlRange: string;
  hasCompetitions: string;
  hasChallenges: string;
  hasBadges: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface LeaderboardEntry {
  userId: string;
  email: string;
  username: string;
  profileImage?: string;
  rank: number;
  isTied?: boolean;
  tiedWith?: string[];
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
  totalPnl: number;
  totalPnlPercentage: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  competitionsEntered: number;
  competitionsWon: number;
  podiumFinishes: number;
  challengesEntered?: number;
  challengesWon?: number;
  totalBadges: number;
  legendaryBadges: number;
  overallScore: number;
}

interface MyPosition {
  rank: number;
  totalUsers: number;
  percentile: number;
}

interface LeaderboardContentProps {
  leaderboard: LeaderboardEntry[];
  myPosition: MyPosition | null;
  currentUserId: string;
}

// Default filter values
const defaultFilters: LeaderboardFilters = {
  search: '',
  rankRange: 'all',
  winRateRange: 'all',
  tradesRange: 'all',
  levelRange: 'all',
  pnlRange: 'all',
  hasCompetitions: 'all',
  hasChallenges: 'all',
  hasBadges: 'all',
  sortBy: 'score',
  sortOrder: 'desc',
};

export default function LeaderboardContent({
  leaderboard,
  myPosition,
  currentUserId,
}: LeaderboardContentProps) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<LeaderboardFilters>(defaultFilters);

  // Filter and sort the leaderboard
  const filteredLeaderboard = useMemo(() => {
    let result = [...leaderboard];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(entry => 
        entry.username.toLowerCase().includes(searchLower) ||
        entry.email.toLowerCase().includes(searchLower)
      );
    }

    // Rank range filter
    if (filters.rankRange !== 'all') {
      switch (filters.rankRange) {
        case 'top10':
          result = result.filter(e => e.rank <= 10);
          break;
        case 'top25':
          result = result.filter(e => e.rank <= 25);
          break;
        case 'top50':
          result = result.filter(e => e.rank <= 50);
          break;
        case 'top100':
          result = result.filter(e => e.rank <= 100);
          break;
        case '11-50':
          result = result.filter(e => e.rank > 10 && e.rank <= 50);
          break;
        case '51-100':
          result = result.filter(e => e.rank > 50 && e.rank <= 100);
          break;
        case '100+':
          result = result.filter(e => e.rank > 100);
          break;
      }
    }

    // Win rate filter
    if (filters.winRateRange !== 'all') {
      switch (filters.winRateRange) {
        case 'elite':
          result = result.filter(e => e.winRate >= 70);
          break;
        case 'high':
          result = result.filter(e => e.winRate >= 55 && e.winRate < 70);
          break;
        case 'average':
          result = result.filter(e => e.winRate >= 40 && e.winRate < 55);
          break;
        case 'learning':
          result = result.filter(e => e.winRate < 40);
          break;
        case 'any_active':
          result = result.filter(e => e.winRate > 0);
          break;
      }
    }

    // Trades range filter
    if (filters.tradesRange !== 'all') {
      switch (filters.tradesRange) {
        case 'veteran':
          result = result.filter(e => e.totalTrades >= 100);
          break;
        case 'experienced':
          result = result.filter(e => e.totalTrades >= 50 && e.totalTrades < 100);
          break;
        case 'intermediate':
          result = result.filter(e => e.totalTrades >= 20 && e.totalTrades < 50);
          break;
        case 'beginner':
          result = result.filter(e => e.totalTrades >= 1 && e.totalTrades < 20);
          break;
        case 'new':
          result = result.filter(e => e.totalTrades === 0);
          break;
        case 'has_trades':
          result = result.filter(e => e.totalTrades > 0);
          break;
      }
    }

    // Level/Title filter
    if (filters.levelRange !== 'all') {
      switch (filters.levelRange) {
        case 'legend':
          result = result.filter(e => 
            e.userTitle?.toLowerCase().includes('legend') ||
            e.userTitle?.toLowerCase().includes('champion') ||
            e.userTitle?.toLowerCase().includes('grandmaster')
          );
          break;
        case 'master':
          result = result.filter(e => 
            e.userTitle?.toLowerCase().includes('master') ||
            e.userTitle?.toLowerCase().includes('elite')
          );
          break;
        case 'expert':
          result = result.filter(e => 
            e.userTitle?.toLowerCase().includes('expert') ||
            e.userTitle?.toLowerCase().includes('veteran') ||
            e.userTitle?.toLowerCase().includes('skilled')
          );
          break;
        case 'intermediate':
          result = result.filter(e => 
            e.userTitle?.toLowerCase().includes('intermediate') ||
            e.userTitle?.toLowerCase().includes('trader')
          );
          break;
        case 'beginner':
          result = result.filter(e => 
            e.userTitle?.toLowerCase().includes('beginner') ||
            e.userTitle?.toLowerCase().includes('novice') ||
            e.userTitle?.toLowerCase().includes('apprentice') ||
            !e.userTitle
          );
          break;
      }
    }

    // P&L filter
    if (filters.pnlRange !== 'all') {
      switch (filters.pnlRange) {
        case 'profitable':
          result = result.filter(e => e.totalPnl > 0);
          break;
        case 'highly_profitable':
          result = result.filter(e => e.totalPnl >= 1000);
          break;
        case 'breakeven':
          result = result.filter(e => e.totalPnl >= -100 && e.totalPnl <= 100);
          break;
        case 'losing':
          result = result.filter(e => e.totalPnl < 0);
          break;
      }
    }

    // Competition filter
    if (filters.hasCompetitions !== 'all') {
      switch (filters.hasCompetitions) {
        case 'champion':
          result = result.filter(e => e.competitionsWon > 0);
          break;
        case 'podium':
          result = result.filter(e => e.podiumFinishes > 0);
          break;
        case 'active':
          result = result.filter(e => e.competitionsEntered > 0);
          break;
        case 'veteran':
          result = result.filter(e => e.competitionsEntered >= 5);
          break;
        case 'none':
          result = result.filter(e => e.competitionsEntered === 0);
          break;
      }
    }

    // Challenge filter
    if (filters.hasChallenges !== 'all') {
      switch (filters.hasChallenges) {
        case 'champion':
          result = result.filter(e => (e.challengesWon || 0) > 0);
          break;
        case 'active':
          result = result.filter(e => (e.challengesEntered || 0) > 0);
          break;
        case 'veteran':
          result = result.filter(e => (e.challengesEntered || 0) >= 5);
          break;
        case 'none':
          result = result.filter(e => (e.challengesEntered || 0) === 0);
          break;
      }
    }

    // Badge filter
    if (filters.hasBadges !== 'all') {
      switch (filters.hasBadges) {
        case 'legendary':
          result = result.filter(e => e.legendaryBadges > 0);
          break;
        case 'collector':
          result = result.filter(e => e.totalBadges >= 10);
          break;
        case 'some':
          result = result.filter(e => e.totalBadges > 0);
          break;
        case 'none':
          result = result.filter(e => e.totalBadges === 0);
          break;
      }
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'score':
          comparison = a.overallScore - b.overallScore;
          break;
        case 'rank':
          comparison = a.rank - b.rank;
          break;
        case 'pnl':
          comparison = a.totalPnl - b.totalPnl;
          break;
        case 'roi':
          comparison = a.totalPnlPercentage - b.totalPnlPercentage;
          break;
        case 'winrate':
          comparison = a.winRate - b.winRate;
          break;
        case 'trades':
          comparison = a.totalTrades - b.totalTrades;
          break;
        case 'competitions':
          comparison = a.competitionsEntered - b.competitionsEntered;
          break;
        case 'challenges':
          comparison = (a.challengesEntered || 0) - (b.challengesEntered || 0);
          break;
        case 'badges':
          comparison = a.totalBadges - b.totalBadges;
          break;
        default:
          comparison = a.overallScore - b.overallScore;
      }
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [leaderboard, filters]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).some(key => {
      if (key === 'sortBy') return filters.sortBy !== 'score';
      if (key === 'sortOrder') return filters.sortOrder !== 'desc';
      return filters[key as keyof LeaderboardFilters] !== defaultFilters[key as keyof LeaderboardFilters];
    });
  }, [filters]);

  // Reset all filters
  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const getRankIcon = (rank: number, isTied?: boolean, size: 'sm' | 'md' = 'md') => {
    const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
    const tieRingClass = isTied ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-gray-900 rounded-full p-1' : '';
    
    if (rank === 1) return <div className={tieRingClass}><Crown className={`${iconSize} text-yellow-400`} /></div>;
    if (rank === 2) return <div className={tieRingClass}><Medal className={`${iconSize} text-gray-300`} /></div>;
    if (rank === 3) return <div className={tieRingClass}><Medal className={`${iconSize} text-amber-600`} /></div>;
    return <span className={`text-sm sm:text-lg font-bold text-gray-500 ${tieRingClass}`}>#{rank}</span>;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    if (rank === 2) return 'bg-gray-300/20 text-gray-300 border-gray-300/50';
    if (rank === 3) return 'bg-amber-600/20 text-amber-600 border-amber-600/50';
    if (rank <= 10) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    if (rank <= 50) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
    return 'bg-gray-700/20 text-gray-400 border-gray-700/50';
  };

  const getRankBgColor = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return 'bg-primary-500/10 border-l-4 border-primary-500';
    if (rank <= 3) return 'bg-yellow-500/5 hover:bg-yellow-500/10';
    if (rank <= 10) return 'bg-blue-500/5 hover:bg-blue-500/10';
    return 'hover:bg-gray-800/50';
  };

  // Convert user title to level number for VsScreen
  const getLevelFromTitle = (title?: string): number => {
    if (!title) return 3;
    const titleLower = title.toLowerCase();
    if (titleLower.includes('beginner') || titleLower.includes('newbie')) return 1;
    if (titleLower.includes('apprentice')) return 2;
    if (titleLower.includes('intermediate') || titleLower.includes('trader')) return 3;
    if (titleLower.includes('advanced') || titleLower.includes('skilled')) return 4;
    if (titleLower.includes('expert') || titleLower.includes('veteran')) return 5;
    if (titleLower.includes('master')) return 6;
    if (titleLower.includes('grandmaster') || titleLower.includes('elite')) return 7;
    if (titleLower.includes('legend') || titleLower.includes('champion')) return 8;
    return 3;
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 sm:gap-6 md:gap-8">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-yellow-500/30 rounded-full blur-xl animate-pulse"></div>
              <div className="relative rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 p-2.5 sm:p-4 shadow-xl">
                <Trophy className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-gray-100">
                Global Leaderboard
              </h1>
              <p className="text-xs sm:text-sm lg:text-lg text-gray-400">
                {viewMode === 'table' ? 'Top traders ranked by performance' : 'Find your opponent!'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Toggle */}
            <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-gray-800 rounded-lg border border-gray-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('table')}
                className={cn(
                  "px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-all text-xs sm:text-sm",
                  viewMode === 'table'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <LayoutList className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Table</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('cards')}
                className={cn(
                  "px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-all text-xs sm:text-sm",
                  viewMode === 'cards'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Match Cards</span>
              </Button>
            </div>
            <Link href="/profile" className="hidden sm:block px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm">
              My Profile
            </Link>
          </div>
        </div>

        {/* User's Position Card - Mobile Optimized */}
        {myPosition && myPosition.rank > 0 && (
          <div className="rounded-xl bg-gradient-to-br from-primary-500/20 via-gray-800 to-gray-900 p-4 sm:p-6 shadow-xl border border-primary-500/20">
            <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`rounded-full p-2 sm:p-4 border-2 ${getRankBadge(myPosition.rank)}`}>
                  {getRankIcon(myPosition.rank)}
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-400">Your Rank</p>
                  <p className="text-xl sm:text-3xl font-bold text-white">#{myPosition.rank}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">of {myPosition.totalUsers} traders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs sm:text-sm text-gray-400">Percentile</p>
                <p className="text-lg sm:text-2xl font-bold text-green-400">{myPosition.percentile.toFixed(1)}%</p>
                <p className="text-[10px] sm:text-xs text-gray-500">Top {(100 - myPosition.percentile).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter Section */}
        {viewMode === 'table' && (
          <div className="rounded-xl bg-gray-800/50 border border-gray-700 overflow-hidden">
            {/* Search Bar & Filter Toggle */}
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search by username or email..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 bg-gray-900 border-gray-600 text-white placeholder-gray-500 h-10"
                />
                {filters.search && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filter Toggle & Sort */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 gap-2",
                    showFilters && "bg-gray-700 text-white",
                    hasActiveFilters && "border-primary-500 text-primary-400"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && (
                    <span className="px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                      !
                    </span>
                  )}
                  {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {/* Quick Sort */}
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
                >
                  <SelectTrigger className="w-[140px] sm:w-[160px] bg-gray-900 border-gray-600 text-white">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="score" className="text-gray-300 focus:bg-gray-700 focus:text-white">🏆 Score</SelectItem>
                    <SelectItem value="rank" className="text-gray-300 focus:bg-gray-700 focus:text-white">📊 Rank</SelectItem>
                    <SelectItem value="pnl" className="text-gray-300 focus:bg-gray-700 focus:text-white">💰 P&L</SelectItem>
                    <SelectItem value="roi" className="text-gray-300 focus:bg-gray-700 focus:text-white">📈 ROI %</SelectItem>
                    <SelectItem value="winrate" className="text-gray-300 focus:bg-gray-700 focus:text-white">🎯 Win Rate</SelectItem>
                    <SelectItem value="trades" className="text-gray-300 focus:bg-gray-700 focus:text-white">📊 Trades</SelectItem>
                    <SelectItem value="competitions" className="text-gray-300 focus:bg-gray-700 focus:text-white">🏅 Competitions</SelectItem>
                    <SelectItem value="challenges" className="text-gray-300 focus:bg-gray-700 focus:text-white">⚔️ Challenges</SelectItem>
                    <SelectItem value="badges" className="text-gray-300 focus:bg-gray-700 focus:text-white">🎖️ Badges</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc' 
                  }))}
                  className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                >
                  {filters.sortOrder === 'desc' ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="px-3 sm:px-4 pb-4 border-t border-gray-700 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Rank Range */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 flex items-center gap-1">
                      <Trophy className="h-3 w-3" /> Rank
                    </Label>
                    <Select
                      value={filters.rankRange}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, rankRange: value }))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">All Ranks</SelectItem>
                        <SelectItem value="top10" className="text-gray-300 focus:bg-gray-700 focus:text-white">🥇 Top 10</SelectItem>
                        <SelectItem value="top25" className="text-gray-300 focus:bg-gray-700 focus:text-white">🏅 Top 25</SelectItem>
                        <SelectItem value="top50" className="text-gray-300 focus:bg-gray-700 focus:text-white">📊 Top 50</SelectItem>
                        <SelectItem value="top100" className="text-gray-300 focus:bg-gray-700 focus:text-white">📈 Top 100</SelectItem>
                        <SelectItem value="11-50" className="text-gray-300 focus:bg-gray-700 focus:text-white">Rank 11-50</SelectItem>
                        <SelectItem value="51-100" className="text-gray-300 focus:bg-gray-700 focus:text-white">Rank 51-100</SelectItem>
                        <SelectItem value="100+" className="text-gray-300 focus:bg-gray-700 focus:text-white">Rank 100+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Win Rate */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 flex items-center gap-1">
                      <Target className="h-3 w-3" /> Win Rate
                    </Label>
                    <Select
                      value={filters.winRateRange}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, winRateRange: value }))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">Any Win Rate</SelectItem>
                        <SelectItem value="elite" className="text-gray-300 focus:bg-gray-700 focus:text-white">🔥 Elite (70%+)</SelectItem>
                        <SelectItem value="high" className="text-gray-300 focus:bg-gray-700 focus:text-white">⭐ High (55-70%)</SelectItem>
                        <SelectItem value="average" className="text-gray-300 focus:bg-gray-700 focus:text-white">📊 Average (40-55%)</SelectItem>
                        <SelectItem value="learning" className="text-gray-300 focus:bg-gray-700 focus:text-white">📚 Learning (&lt;40%)</SelectItem>
                        <SelectItem value="any_active" className="text-gray-300 focus:bg-gray-700 focus:text-white">✅ Has Trades</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Experience (Trades) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Experience
                    </Label>
                    <Select
                      value={filters.tradesRange}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, tradesRange: value }))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">Any Experience</SelectItem>
                        <SelectItem value="veteran" className="text-gray-300 focus:bg-gray-700 focus:text-white">🏆 Veteran (100+)</SelectItem>
                        <SelectItem value="experienced" className="text-gray-300 focus:bg-gray-700 focus:text-white">⭐ Experienced (50-100)</SelectItem>
                        <SelectItem value="intermediate" className="text-gray-300 focus:bg-gray-700 focus:text-white">📈 Intermediate (20-50)</SelectItem>
                        <SelectItem value="beginner" className="text-gray-300 focus:bg-gray-700 focus:text-white">🌱 Beginner (1-20)</SelectItem>
                        <SelectItem value="new" className="text-gray-300 focus:bg-gray-700 focus:text-white">✨ New (0 trades)</SelectItem>
                        <SelectItem value="has_trades" className="text-gray-300 focus:bg-gray-700 focus:text-white">✅ Has Trades</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Level/Title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 flex items-center gap-1">
                      <Star className="h-3 w-3" /> Level
                    </Label>
                    <Select
                      value={filters.levelRange}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, levelRange: value }))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">Any Level</SelectItem>
                        <SelectItem value="legend" className="text-gray-300 focus:bg-gray-700 focus:text-white">👑 Legend/Champion</SelectItem>
                        <SelectItem value="master" className="text-gray-300 focus:bg-gray-700 focus:text-white">🏆 Master/Elite</SelectItem>
                        <SelectItem value="expert" className="text-gray-300 focus:bg-gray-700 focus:text-white">⭐ Expert/Veteran</SelectItem>
                        <SelectItem value="intermediate" className="text-gray-300 focus:bg-gray-700 focus:text-white">📊 Intermediate</SelectItem>
                        <SelectItem value="beginner" className="text-gray-300 focus:bg-gray-700 focus:text-white">🌱 Beginner/Novice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* P&L */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> P&L
                    </Label>
                    <Select
                      value={filters.pnlRange}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, pnlRange: value }))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">Any P&L</SelectItem>
                        <SelectItem value="highly_profitable" className="text-gray-300 focus:bg-gray-700 focus:text-white">🚀 High Profit (1000+)</SelectItem>
                        <SelectItem value="profitable" className="text-gray-300 focus:bg-gray-700 focus:text-white">💰 Profitable</SelectItem>
                        <SelectItem value="breakeven" className="text-gray-300 focus:bg-gray-700 focus:text-white">⚖️ Break Even</SelectItem>
                        <SelectItem value="losing" className="text-gray-300 focus:bg-gray-700 focus:text-white">📉 In Loss</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Competitions */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 flex items-center gap-1">
                      <Trophy className="h-3 w-3" /> Competitions
                    </Label>
                    <Select
                      value={filters.hasCompetitions}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, hasCompetitions: value }))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">Any</SelectItem>
                        <SelectItem value="champion" className="text-gray-300 focus:bg-gray-700 focus:text-white">🏆 Has Wins</SelectItem>
                        <SelectItem value="podium" className="text-gray-300 focus:bg-gray-700 focus:text-white">🥇 Has Podiums</SelectItem>
                        <SelectItem value="veteran" className="text-gray-300 focus:bg-gray-700 focus:text-white">⭐ 5+ Entered</SelectItem>
                        <SelectItem value="active" className="text-gray-300 focus:bg-gray-700 focus:text-white">✅ Has Entered</SelectItem>
                        <SelectItem value="none" className="text-gray-300 focus:bg-gray-700 focus:text-white">🆕 None Yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Challenges */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 flex items-center gap-1">
                      <Swords className="h-3 w-3" /> Challenges
                    </Label>
                    <Select
                      value={filters.hasChallenges}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, hasChallenges: value }))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">Any</SelectItem>
                        <SelectItem value="champion" className="text-gray-300 focus:bg-gray-700 focus:text-white">🏆 Has Wins</SelectItem>
                        <SelectItem value="veteran" className="text-gray-300 focus:bg-gray-700 focus:text-white">⭐ 5+ Battles</SelectItem>
                        <SelectItem value="active" className="text-gray-300 focus:bg-gray-700 focus:text-white">✅ Has Battled</SelectItem>
                        <SelectItem value="none" className="text-gray-300 focus:bg-gray-700 focus:text-white">🆕 None Yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Badges */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 flex items-center gap-1">
                      <Award className="h-3 w-3" /> Badges
                    </Label>
                    <Select
                      value={filters.hasBadges}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, hasBadges: value }))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-gray-300 focus:bg-gray-700 focus:text-white">Any</SelectItem>
                        <SelectItem value="legendary" className="text-gray-300 focus:bg-gray-700 focus:text-white">⚡ Has Legendary</SelectItem>
                        <SelectItem value="collector" className="text-gray-300 focus:bg-gray-700 focus:text-white">🏅 10+ Badges</SelectItem>
                        <SelectItem value="some" className="text-gray-300 focus:bg-gray-700 focus:text-white">✅ Has Badges</SelectItem>
                        <SelectItem value="none" className="text-gray-300 focus:bg-gray-700 focus:text-white">🆕 None Yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reset Button */}
                  <div className="space-y-1.5 flex items-end">
                    <Button
                      variant="outline"
                      onClick={resetFilters}
                      disabled={!hasActiveFilters}
                      className="w-full h-9 border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reset All
                    </Button>
                  </div>
                </div>

                {/* Active filter count */}
                {hasActiveFilters && (
                  <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Showing <span className="text-white font-medium">{filteredLeaderboard.length}</span> of{' '}
                      <span className="text-gray-300">{leaderboard.length}</span> traders
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {filters.search && (
                        <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full flex items-center gap-1">
                          Search: {filters.search}
                          <X className="h-3 w-3 cursor-pointer hover:text-white" onClick={() => setFilters(prev => ({ ...prev, search: '' }))} />
                        </span>
                      )}
                      {filters.rankRange !== 'all' && (
                        <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full flex items-center gap-1">
                          Rank: {filters.rankRange}
                          <X className="h-3 w-3 cursor-pointer hover:text-white" onClick={() => setFilters(prev => ({ ...prev, rankRange: 'all' }))} />
                        </span>
                      )}
                      {filters.winRateRange !== 'all' && (
                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                          Win Rate: {filters.winRateRange}
                          <X className="h-3 w-3 cursor-pointer hover:text-white" onClick={() => setFilters(prev => ({ ...prev, winRateRange: 'all' }))} />
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content based on view mode */}
      {viewMode === 'cards' ? (
        <div className="flex justify-center w-full overflow-visible">
          <MatchmakingCards currentUserId={currentUserId} />
        </div>
      ) : (
        <>
          {/* Mobile: Card-based view */}
          <div className="lg:hidden space-y-2">
            {filteredLeaderboard.length === 0 ? (
              <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-8 text-center">
                <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No traders match your filters</p>
                <Button variant="outline" size="sm" onClick={resetFilters} className="border-gray-600 text-gray-300">
                  Reset Filters
                </Button>
              </div>
            ) : filteredLeaderboard.map((entry) => {
              const isCurrentUser = entry.userId === currentUserId;
              
              return (
                <div
                  key={entry.userId}
                  className={`rounded-xl p-3 border border-gray-700/50 transition-all ${getRankBgColor(entry.rank, isCurrentUser)}`}
                >
                  {/* Top Row: Rank + Name + Score */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`rounded-lg px-2 py-1 border ${getRankBadge(entry.rank)}`}>
                      {getRankIcon(entry.rank, entry.isTied, 'sm')}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => {
                          setSelectedUser(entry);
                          setShowProfileCard(true);
                        }}
                        className={`text-sm font-medium truncate block hover:underline ${isCurrentUser ? 'text-primary-400' : 'text-white'}`}
                      >
                        {entry.username}
                        {isCurrentUser && <span className="ml-1 text-xs text-primary-400">(You)</span>}
                      </button>
                      {entry.userTitle && (
                        <span className={`text-[10px] ${entry.userTitleColor || 'text-purple-400'}`}>
                          {entry.userTitleIcon} {entry.userTitle}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4 text-primary-400" />
                      <span className="text-sm font-bold text-primary-400 tabular-nums">{entry.overallScore.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2 text-center mb-3">
                    <div>
                      <p className={`text-xs font-semibold tabular-nums ${entry.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.totalPnl >= 0 ? '+' : ''}{entry.totalPnl.toFixed(0)}
                      </p>
                      <p className="text-[9px] text-gray-500">P&L</p>
                    </div>
                    <div>
                      <p className={`text-xs font-semibold tabular-nums ${entry.totalPnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.totalPnlPercentage >= 0 ? '+' : ''}{entry.totalPnlPercentage.toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-gray-500">ROI</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white tabular-nums">{entry.winRate.toFixed(0)}%</p>
                      <p className="text-[9px] text-gray-500">Win Rate</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white tabular-nums">{entry.totalTrades}</p>
                      <p className="text-[9px] text-gray-500">Trades</p>
                    </div>
                  </div>

                  {/* Badges + Challenge Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {entry.competitionsWon > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Trophy className="h-3 w-3 text-yellow-400" />
                          {entry.competitionsWon}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Award className="h-3 w-3 text-purple-400" />
                        {entry.totalBadges}
                      </span>
                    </div>
                    
                    <LeaderboardChallengeButton
                      userId={entry.userId}
                      username={entry.username}
                      isCurrentUser={isCurrentUser}
                      winRate={entry.winRate}
                      totalTrades={entry.totalTrades}
                      challengesEntered={entry.challengesEntered || 0}
                      level={getLevelFromTitle(entry.userTitle)}
                      profileImage={entry.profileImage}
                      compact
                    />
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Desktop: Table view */}
          <div className="hidden lg:block rounded-xl bg-gray-800/50 border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900/80 px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                {hasActiveFilters ? (
                  <>Filtered Traders ({filteredLeaderboard.length} of {leaderboard.length})</>
                ) : (
                  <>All Traders ({leaderboard.length})</>
                )}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Challenge anyone online to a 1v1 battle!
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <div className="min-w-full">
                {/* Table Header */}
                <div className="grid grid-cols-14 gap-4 px-6 py-3 bg-gray-900/50 border-b border-gray-700 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-2">Trader</div>
                  <div className="col-span-1 text-right">P&L</div>
                  <div className="col-span-1 text-right">ROI</div>
                  <div className="col-span-1 text-right">Win Rate</div>
                  <div className="col-span-1 text-right">P.Factor</div>
                  <div className="col-span-2 text-right">Competitions</div>
                  <div className="col-span-1 text-right">Badges</div>
                  <div className="col-span-2 text-right">Score</div>
                  <div className="col-span-2 text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Swords className="h-3 w-3" />
                      Challenge
                    </span>
                  </div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-gray-700/50">
                  {filteredLeaderboard.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 mb-2">No traders match your filters</p>
                      <Button variant="outline" size="sm" onClick={resetFilters} className="border-gray-600 text-gray-300">
                        Reset Filters
                      </Button>
                    </div>
                  ) : filteredLeaderboard.map((entry) => {
                    const isCurrentUser = entry.userId === currentUserId;
                    
                    return (
                      <div
                        key={entry.userId}
                        className={`grid grid-cols-14 gap-4 px-6 py-4 transition-colors ${getRankBgColor(entry.rank, isCurrentUser)}`}
                      >
                        {/* Rank */}
                        <div className="col-span-1 flex items-center">
                          <div className={`rounded-lg px-3 py-1 border ${getRankBadge(entry.rank)}`}>
                            {getRankIcon(entry.rank, entry.isTied)}
                          </div>
                        </div>

                        {/* Trader */}
                        <div className="col-span-2 flex flex-col justify-center">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedUser(entry);
                                setShowProfileCard(true);
                              }}
                              className={`text-sm font-medium truncate hover:underline cursor-pointer transition-colors ${isCurrentUser ? 'text-primary-400 hover:text-primary-300' : 'text-gray-100 hover:text-white'}`}
                            >
                              {entry.username}
                            </button>
                            {entry.userTitle && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${entry.userTitleColor || 'text-purple-400'} bg-gray-800/80 border border-gray-700`}>
                                {entry.userTitleIcon} {entry.userTitle}
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 rounded text-xs bg-primary-500/20 text-primary-400 flex-shrink-0">
                                You
                              </span>
                            )}
                            {entry.isTied && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 flex-shrink-0 font-semibold">
                                = #{entry.rank}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{entry.totalTrades} trades</p>
                        </div>

                        {/* P&L */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <p className={`text-sm font-semibold tabular-nums ${entry.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {entry.totalPnl >= 0 ? '+' : ''}{entry.totalPnl.toFixed(0)}
                          </p>
                        </div>

                        {/* ROI */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <p className={`text-sm font-semibold tabular-nums ${entry.totalPnlPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {entry.totalPnlPercentage >= 0 ? '+' : ''}{entry.totalPnlPercentage.toFixed(1)}%
                          </p>
                        </div>

                        {/* Win Rate */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <p className="text-sm font-medium text-gray-100 tabular-nums">{entry.winRate.toFixed(0)}%</p>
                        </div>

                        {/* Profit Factor */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <p className={`text-sm font-semibold tabular-nums ${
                            entry.profitFactor >= 2 ? 'text-green-500' : entry.profitFactor >= 1 ? 'text-yellow-500' : 'text-red-500'
                          }`}>
                            {entry.profitFactor.toFixed(2)}
                          </p>
                        </div>

                        {/* Competitions */}
                        <div className="col-span-2 flex flex-col items-end justify-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{entry.competitionsEntered} entered</span>
                            {entry.competitionsWon > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                🏆 {entry.competitionsWon}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-gray-300">{entry.totalBadges}</span>
                            {entry.legendaryBadges > 0 && (
                              <span className="text-yellow-400 text-xs">⚡{entry.legendaryBadges}</span>
                            )}
                          </div>
                        </div>

                        {/* Score */}
                        <div className="col-span-2 flex flex-col items-end justify-center">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary-400" />
                            <p className="text-sm font-bold text-primary-400 tabular-nums">{entry.overallScore.toFixed(0)}</p>
                          </div>
                        </div>

                        {/* Challenge Button */}
                        <div className="col-span-2 flex items-center justify-center">
                          <LeaderboardChallengeButton
                            userId={entry.userId}
                            username={entry.username}
                            isCurrentUser={isCurrentUser}
                            winRate={entry.winRate}
                            totalTrades={entry.totalTrades}
                            challengesEntered={entry.challengesEntered || 0}
                            level={getLevelFromTitle(entry.userTitle)}
                            profileImage={entry.profileImage}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Info Section - Collapsible on Mobile */}
          <details className="rounded-xl bg-gray-800/30 border border-gray-700 overflow-hidden">
            <summary className="p-4 sm:p-6 cursor-pointer hover:bg-gray-800/50 transition-colors">
              <span className="text-base sm:text-lg font-semibold text-gray-100">📊 How Rankings Work</span>
            </summary>
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 text-xs sm:text-sm text-gray-400">
              <p>
                <strong className="text-gray-300">Overall Score</strong> is calculated using a weighted formula:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2 sm:ml-4">
                <li>30% - Total P&L</li>
                <li>25% - ROI percentage</li>
                <li>20% - Win Rate</li>
                <li>10% - Profit Factor</li>
                <li>5% - Competition Wins</li>
                <li>5% - Podium Finishes</li>
                <li>3% - Badge Collection</li>
                <li>2% - Legendary Badges</li>
              </ul>
              <p className="pt-2">
                <strong className="text-gray-300">Rankings update in real-time</strong> as traders complete competitions.
              </p>
            </div>
          </details>
        </>
      )}

      {/* Profile Card Popup */}
      {selectedUser && (
        <ProfileCard
          show={showProfileCard}
          onClose={() => {
            setShowProfileCard(false);
            setSelectedUser(null);
          }}
          userId={selectedUser.userId}
          username={selectedUser.username}
          stats={{
            rank: selectedUser.rank,
            winRate: selectedUser.winRate,
            totalTrades: selectedUser.totalTrades,
            totalPnl: selectedUser.totalPnl,
            competitionsEntered: selectedUser.competitionsEntered,
            competitionsWon: selectedUser.competitionsWon,
            challengesEntered: selectedUser.challengesEntered,
            challengesWon: selectedUser.challengesWon,
            totalBadges: selectedUser.totalBadges,
            overallScore: selectedUser.overallScore,
            userTitle: selectedUser.userTitle,
            userTitleIcon: selectedUser.userTitleIcon,
            userTitleColor: selectedUser.userTitleColor,
          }}
          showChallengeButton={selectedUser.userId !== currentUserId}
          onChallenge={() => {
            setShowProfileCard(false);
            setShowChallengeDialog(true);
          }}
        />
      )}

      {/* Challenge Dialog */}
      {selectedUser && (
        <ChallengeCreateDialog
          open={showChallengeDialog}
          onOpenChange={(open) => {
            setShowChallengeDialog(open);
            if (!open) setSelectedUser(null);
          }}
          challengedUser={{ userId: selectedUser.userId, username: selectedUser.username }}
        />
      )}
    </div>
  );
}
