'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Trophy, Clock, TrendingUp, Zap, LayoutGrid, List, Filter, Search, X, ChevronDown, Target, Flame, Crown, Sparkles, SlidersHorizontal, RefreshCw, Skull, Star } from 'lucide-react';
import CompetitionCard from '@/components/trading/CompetitionCard';
import WalletBalanceDisplay from '@/components/trading/WalletBalanceDisplay';
import UTCClock from '@/components/trading/UTCClock';
import LiveStatusIndicator from '@/components/trading/LiveStatusIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { calculateCompetitionDifficulty, DifficultyLevel, getAllDifficultyLevels } from '@/lib/utils/competition-difficulty';

// Auto-refresh interval (10 seconds for real-time updates)
const AUTO_REFRESH_INTERVAL = 10000;

interface Competition {
  _id: string;
  name: string;
  description: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  entryFee?: number;
  entryFeeCredits?: number;
  prizePool?: number;
  prizePoolCredits?: number;
  startingCapital?: number;
  startingTradingPoints?: number;
  currentParticipants: number;
  maxParticipants: number;
  minParticipants?: number;
  startTime: string;
  endTime: string;
  assetClasses: string[];
  leverageAllowed?: number;
  rules?: {
    rankingMethod: string;
    minimumTrades?: number;
    minimumWinRate?: number;
    disqualifyOnLiquidation?: boolean;
  };
  riskLimits?: {
    enabled?: boolean;
    maxDrawdownPercent?: number;
    dailyLossLimitPercent?: number;
  };
  levelRequirement?: {
    enabled: boolean;
    minLevel: number;
    maxLevel?: number;
  };
}

interface CompetitionsPageContentProps {
  initialCompetitions: Competition[];
  initialBalance: number;
  userInCompetitionIds: string[];
}

// Storage key for filter preferences
const FILTER_STORAGE_KEY = 'competition-filters';

interface SavedFilters {
  viewMode: 'card' | 'list';
  statusFilter: string[];
  rankingFilter: string[];
  assetFilter: string[];
  difficultyFilter: DifficultyLevel[];
  levelFilter: number[];
  sortBy: 'prize' | 'start' | 'participants' | 'entry' | 'difficulty';
}

// Load saved filters from localStorage
const loadSavedFilters = (): Partial<SavedFilters> => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

// Save filters to localStorage
const saveFilters = (filters: SavedFilters) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
};

export default function CompetitionsPageContent({
  initialCompetitions,
  initialBalance,
  userInCompetitionIds,
}: CompetitionsPageContentProps) {
  // Use server-fetched data as initial state - make mutable for auto-refresh
  const [competitions, setCompetitions] = useState<Competition[]>(initialCompetitions);
  const [userBalance, setUserBalance] = useState(initialBalance);
  const [userInCompetitionIdsState, setUserInCompetitionIdsState] = useState<string[]>(userInCompetitionIds);
  const userInCompetitions = useMemo(() => new Set(userInCompetitionIdsState), [userInCompetitionIdsState]);
  
  // Auto-refresh state (always enabled - no toggle needed)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [_lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Mobile filter drawer state
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Load saved preferences on mount
  const [isHydrated, setIsHydrated] = useState(false);
  
  // View & Filter State - with defaults that will be overridden by saved values
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(['active', 'upcoming']);
  const [rankingFilter, setRankingFilter] = useState<string[]>([]);
  const [assetFilter, setAssetFilter] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel[]>([]);
  const [levelFilter, setLevelFilter] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'prize' | 'start' | 'participants' | 'entry' | 'difficulty'>('prize');

  // Fetch fresh data
  const refreshData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const [competitionsRes, walletRes] = await Promise.all([
        fetch('/api/competitions'),
        fetch('/api/wallet/balance'),
      ]);

      if (competitionsRes.ok) {
        const data = await competitionsRes.json();
        setCompetitions(data.competitions || []);
        setUserInCompetitionIdsState(data.userInCompetitionIds || []);
      }

      if (walletRes.ok) {
        const walletData = await walletRes.json();
        setUserBalance(walletData.balance ?? initialBalance);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing competitions:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [initialBalance]);

  // Load saved filters on mount
  useEffect(() => {
    const saved = loadSavedFilters();
    if (saved.viewMode) setViewMode(saved.viewMode);
    if (saved.statusFilter) setStatusFilter(saved.statusFilter);
    if (saved.rankingFilter) setRankingFilter(saved.rankingFilter);
    if (saved.assetFilter) setAssetFilter(saved.assetFilter);
    if (saved.difficultyFilter) setDifficultyFilter(saved.difficultyFilter);
    if (saved.levelFilter) setLevelFilter(saved.levelFilter);
    if (saved.sortBy) setSortBy(saved.sortBy);
    setIsHydrated(true);
  }, []);

  // Auto-refresh interval (always on)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData(false); // Silent refresh (no spinner)
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refreshData]);

  // Refresh when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData(false);
      }
    };

    const handleFocus = () => {
      refreshData(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshData]);

  // Save filters whenever they change
  useEffect(() => {
    if (!isHydrated) return; // Don't save until initial load is complete
    saveFilters({
      viewMode,
      statusFilter,
      rankingFilter,
      assetFilter,
      difficultyFilter,
      levelFilter,
      sortBy,
    });
  }, [viewMode, statusFilter, rankingFilter, assetFilter, difficultyFilter, levelFilter, sortBy, isHydrated]);

  // Available filters
  const availableRankingMethods = useMemo(() => {
    const methods = new Set(competitions.map(c => c.rules?.rankingMethod).filter(Boolean));
    return Array.from(methods);
  }, [competitions]);

  const availableAssets = useMemo(() => {
    const assets = new Set(competitions.flatMap(c => c.assetClasses || []));
    return Array.from(assets);
  }, [competitions]);

  // Calculate difficulty for a competition
  const getCompetitionDifficulty = useCallback((c: Competition) => {
    const start = new Date(c.startTime);
    const end = new Date(c.endTime);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return calculateCompetitionDifficulty({
      entryFeeCredits: c.entryFee || c.entryFeeCredits || 0,
      startingCapital: c.startingCapital || c.startingTradingPoints || 10000,
      leverageAllowed: c.leverageAllowed || 100,
      maxParticipants: c.maxParticipants,
      participantCount: c.currentParticipants,
      durationHours,
      rules: c.rules,
      riskLimits: c.riskLimits,
      levelRequirement: c.levelRequirement,
    });
  }, []);

  // Get available level requirements
  const availableLevels = useMemo(() => {
    const levels = new Set<number>();
    competitions.forEach(c => {
      if (c.levelRequirement?.enabled && c.levelRequirement.minLevel) {
        levels.add(c.levelRequirement.minLevel);
      }
    });
    // Add "Open to All" option (level 0 means no requirement)
    levels.add(0);
    return Array.from(levels).sort((a, b) => a - b);
  }, [competitions]);

  // Apply filters to competitions
  const applyFilters = useCallback((comps: Competition[]) => {
    let result = [...comps];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      );
    }

    // Ranking method filter
    if (rankingFilter.length > 0) {
      result = result.filter(c => rankingFilter.includes(c.rules?.rankingMethod || ''));
    }

    // Asset filter
    if (assetFilter.length > 0) {
      result = result.filter(c => 
        c.assetClasses?.some(asset => assetFilter.includes(asset))
      );
    }

    // Difficulty filter
    if (difficultyFilter.length > 0) {
      result = result.filter(c => {
        const difficulty = getCompetitionDifficulty(c);
        return difficultyFilter.includes(difficulty.level);
      });
    }

    // Level requirement filter
    if (levelFilter.length > 0) {
      result = result.filter(c => {
        // If 0 is selected, show competitions with no level requirement
        if (levelFilter.includes(0) && (!c.levelRequirement?.enabled || !c.levelRequirement?.minLevel)) {
          return true;
        }
        // Otherwise check if the competition's level requirement matches
        if (c.levelRequirement?.enabled && c.levelRequirement?.minLevel) {
          return levelFilter.includes(c.levelRequirement.minLevel);
        }
        return false;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'prize':
          return (b.prizePool || b.prizePoolCredits || 0) - (a.prizePool || a.prizePoolCredits || 0);
        case 'start':
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        case 'participants':
          return b.currentParticipants - a.currentParticipants;
        case 'entry':
          return (a.entryFee || a.entryFeeCredits || 0) - (b.entryFee || b.entryFeeCredits || 0);
        case 'difficulty':
          return getCompetitionDifficulty(a).score - getCompetitionDifficulty(b).score;
        default:
          return 0;
      }
    });

    return result;
  }, [searchQuery, rankingFilter, assetFilter, difficultyFilter, levelFilter, sortBy, getCompetitionDifficulty]);

  // Separate upcoming competitions (always shown first)
  const upcomingCompetitions = useMemo(() => {
    if (!statusFilter.includes('upcoming')) return [];
    return applyFilters(competitions.filter(c => c.status === 'upcoming'));
  }, [competitions, applyFilters, statusFilter]);

  // Other filtered competitions (active, completed, cancelled)
  const otherCompetitions = useMemo(() => {
    const otherStatuses = statusFilter.filter(s => s !== 'upcoming');
    if (otherStatuses.length === 0) return [];
    return applyFilters(competitions.filter(c => otherStatuses.includes(c.status)));
  }, [competitions, applyFilters, statusFilter]);

  // Total count for display
  const totalFilteredCount = upcomingCompetitions.length + otherCompetitions.length;

  // Stats
  const activeCount = competitions.filter(c => c.status === 'active').length;
  const upcomingCount = competitions.filter(c => c.status === 'upcoming').length;
  const totalPrizePool = competitions
    .filter(c => ['active', 'upcoming'].includes(c.status))
    .reduce((sum, c) => sum + (c.prizePool || c.prizePoolCredits || 0), 0);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter(['active', 'upcoming']);
    setRankingFilter([]);
    setAssetFilter([]);
    setDifficultyFilter([]);
    setLevelFilter([]);
  };

  const hasActiveFilters = searchQuery || rankingFilter.length > 0 || assetFilter.length > 0 || 
    difficultyFilter.length > 0 || levelFilter.length > 0 ||
    statusFilter.length !== 2 || !statusFilter.includes('active') || !statusFilter.includes('upcoming');

  const RANKING_LABELS: Record<string, string> = {
    pnl: '💰 Profit & Loss',
    roi: '📈 ROI',
    total_capital: '💎 Total Capital',
    win_rate: '🎯 Win Rate',
    total_wins: '🏆 Total Wins',
    profit_factor: '⚡ Profit Factor',
  };

  const DIFFICULTY_LABELS: Record<DifficultyLevel, { label: string; emoji: string; color: string }> = {
    beginner: { label: 'Beginner', emoji: '🌱', color: 'text-green-400' },
    intermediate: { label: 'Intermediate', emoji: '📊', color: 'text-blue-400' },
    advanced: { label: 'Advanced', emoji: '⚡', color: 'text-yellow-400' },
    expert: { label: 'Expert', emoji: '🔥', color: 'text-orange-400' },
    extreme: { label: 'Extreme', emoji: '💀', color: 'text-red-400' },
  };

  const LEVEL_LABELS: Record<number, string> = {
    0: '🌐 Open to All',
    1: '🌱 Level 1+',
    2: '📚 Level 2+',
    3: '⚔️ Level 3+',
    4: '🎯 Level 4+',
    5: '💎 Level 5+',
    6: '👑 Level 6+',
    7: '🔥 Level 7+',
    8: '⚡ Level 8+',
    9: '🌟 Level 9+',
    10: '👑 Level 10',
  };

  const activeFiltersCount = (statusFilter.length !== 2 || !statusFilter.includes('active') || !statusFilter.includes('upcoming') ? 1 : 0) + 
    (rankingFilter.length > 0 ? 1 : 0) + 
    (assetFilter.length > 0 ? 1 : 0) +
    (difficultyFilter.length > 0 ? 1 : 0) +
    (levelFilter.length > 0 ? 1 : 0);

  return (
    <div className="flex min-h-screen flex-col gap-4 sm:gap-6">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-4">
        {/* Title Row */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-yellow-500/30 rounded-full blur-xl animate-pulse"></div>
              <div className="relative rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 p-2.5 sm:p-4 shadow-xl shadow-yellow-500/30">
                <Trophy className="h-5 w-5 sm:h-8 sm:w-8 text-yellow-900" />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-100 flex items-center gap-2 truncate">
                <span className="truncate">Trading Arena</span>
                <Sparkles className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-500 flex-shrink-0" />
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                Compete with traders worldwide • Win massive prizes
              </p>
            </div>
          </div>

          {/* Mobile: Refresh + Filter buttons */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={() => refreshData(true)}
              disabled={isRefreshing}
              className="p-2 bg-gray-800 rounded-lg border border-gray-700"
            >
              <RefreshCw className={`h-4 w-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="relative p-2 bg-gray-800 rounded-lg border border-gray-700"
            >
              <Filter className="h-4 w-4 text-gray-400" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-gray-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Actions Row - Desktop */}
        <div className="hidden sm:flex items-center gap-3 flex-wrap">
          <UTCClock />
          <WalletBalanceDisplay balance={userBalance} />
          <Link href="/wallet">
            <Button className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-gray-900 font-bold h-auto py-2 px-4 rounded-xl shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 hover:scale-105 transition-all">
              <Zap className="mr-2 h-4 w-4" />
              Add Credits
            </Button>
          </Link>
          <LiveStatusIndicator onRefresh={async () => refreshData(false)} />
        </div>

        {/* Mobile: Balance + Add Credits */}
        <div className="flex sm:hidden items-center gap-2">
          <div className="flex-1">
            <WalletBalanceDisplay balance={userBalance} />
          </div>
          <Link href="/wallet">
            <Button size="sm" className="bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 font-bold rounded-lg shadow-lg">
              <Zap className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-transparent border border-blue-500/30 p-3 sm:p-6 group hover:border-blue-500/50 transition-colors">
          <div className="absolute top-0 right-0 w-16 sm:w-32 h-16 sm:h-32 bg-blue-500/10 rounded-full blur-2xl sm:blur-3xl group-hover:scale-150 transition-transform"></div>
          <div className="relative">
            <p className="text-[10px] sm:text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <Flame className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline">Live Now</span>
              <span className="sm:hidden">Live</span>
            </p>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-4xl font-black text-gray-100 tabular-nums">{activeCount}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Active competitions</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-600/20 via-yellow-500/10 to-transparent border border-yellow-500/30 p-3 sm:p-6 group hover:border-yellow-500/50 transition-colors">
          <div className="absolute top-0 right-0 w-16 sm:w-32 h-16 sm:h-32 bg-yellow-500/10 rounded-full blur-2xl sm:blur-3xl group-hover:scale-150 transition-transform"></div>
          <div className="relative">
            <p className="text-[10px] sm:text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline">Starting Soon</span>
              <span className="sm:hidden">Soon</span>
            </p>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-4xl font-black text-gray-100 tabular-nums">{upcomingCount}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Reserve your spot</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-600/20 via-green-500/10 to-transparent border border-green-500/30 p-3 sm:p-6 group hover:border-green-500/50 transition-colors">
          <div className="absolute top-0 right-0 w-16 sm:w-32 h-16 sm:h-32 bg-green-500/10 rounded-full blur-2xl sm:blur-3xl group-hover:scale-150 transition-transform"></div>
          <div className="relative">
            <p className="text-[10px] sm:text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-1">
              <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline">Prize Pool</span>
              <span className="sm:hidden">Prize</span>
            </p>
            <div className="mt-1 sm:mt-2 flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 tabular-nums">
                {totalPrizePool.toFixed(0)}
              </span>
              <Zap className="h-3 w-3 sm:h-5 sm:w-5 text-green-400" />
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Available to win</p>
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showMobileFilters && (
        <div className="sm:hidden bg-gray-800/90 backdrop-blur-xl border border-gray-700 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-900/50 border-gray-700 text-gray-100 rounded-xl h-10"
            />
          </div>

          {/* Status Quick Filters */}
          <div>
            <span className="text-xs text-gray-400 mb-1.5 block">Status</span>
            <div className="flex flex-wrap gap-2">
              {['active', 'upcoming', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    if (statusFilter.includes(status)) {
                      setStatusFilter(statusFilter.filter(s => s !== status));
                    } else {
                      setStatusFilter([...statusFilter, status]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter.includes(status)
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {status === 'active' && '🔴 Live'}
                  {status === 'upcoming' && '🟡 Soon'}
                  {status === 'completed' && '🟢 Done'}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Quick Filters */}
          <div>
            <span className="text-xs text-gray-400 mb-1.5 block">Difficulty</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    if (difficultyFilter.includes(level)) {
                      setDifficultyFilter(difficultyFilter.filter(d => d !== level));
                    } else {
                      setDifficultyFilter([...difficultyFilter, level]);
                    }
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    difficultyFilter.includes(level)
                      ? level === 'beginner' ? 'bg-green-500 text-gray-900'
                        : level === 'intermediate' ? 'bg-blue-500 text-white'
                        : level === 'advanced' ? 'bg-yellow-500 text-gray-900'
                        : level === 'expert' ? 'bg-orange-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {DIFFICULTY_LABELS[level].emoji} {DIFFICULTY_LABELS[level].label}
                </button>
              ))}
            </div>
          </div>

          {/* Level Quick Filters */}
          {availableLevels.length > 1 && (
            <div>
              <span className="text-xs text-gray-400 mb-1.5 block">Trader Level</span>
              <div className="flex flex-wrap gap-1.5">
                {availableLevels.slice(0, 6).map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      if (levelFilter.includes(level)) {
                        setLevelFilter(levelFilter.filter(l => l !== level));
                      } else {
                        setLevelFilter([...levelFilter, level]);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                      levelFilter.includes(level)
                        ? 'bg-amber-500 text-gray-900'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {LEVEL_LABELS[level] || `Lvl ${level}+`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300"
            >
              <option value="prize">🏆 Prize Pool</option>
              <option value="start">⏰ Start Time</option>
              <option value="participants">👥 Participants</option>
              <option value="entry">💰 Entry Fee</option>
              <option value="difficulty">🌱 Difficulty</option>
            </select>
          </div>

          {/* View Toggle + Clear */}
          <div className="flex items-center justify-between">
            <div className="flex items-center bg-gray-900/50 rounded-lg border border-gray-700 p-1">
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'card' ? 'bg-yellow-500 text-gray-900' : 'text-gray-400'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-yellow-500 text-gray-900' : 'text-gray-400'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-400">
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Desktop Filter Bar */}
      <div className="hidden sm:flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search competitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-900/50 border-gray-700 text-gray-100 rounded-xl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-gray-900/50 border-gray-700 text-gray-300 rounded-xl">
                <Filter className="h-4 w-4 mr-2" />
                Status
                {statusFilter.length > 0 && statusFilter.length < 4 && (
                  <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 text-[10px]">{statusFilter.length}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700">
              <DropdownMenuLabel className="text-gray-400">Competition Status</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700" />
              {['active', 'upcoming', 'completed', 'cancelled'].map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilter.includes(status)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setStatusFilter([...statusFilter, status]);
                    } else {
                      setStatusFilter(statusFilter.filter(s => s !== status));
                    }
                  }}
                  className="text-gray-300"
                >
                  {status === 'active' && '🔴 Live'}
                  {status === 'upcoming' && '🟡 Upcoming'}
                  {status === 'completed' && '🟢 Completed'}
                  {status === 'cancelled' && '⚫ Cancelled'}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Ranking Filter */}
          {availableRankingMethods.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-gray-900/50 border-gray-700 text-gray-300 rounded-xl">
                  <Target className="h-4 w-4 mr-2" />
                  Type
                  {rankingFilter.length > 0 && (
                    <Badge className="ml-2 bg-blue-500/20 text-blue-400 text-[10px]">{rankingFilter.length}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-800 border-gray-700">
                <DropdownMenuLabel className="text-gray-400">Competition Type</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {availableRankingMethods.filter((m): m is string => !!m).map((method) => (
                  <DropdownMenuCheckboxItem
                    key={method}
                    checked={rankingFilter.includes(method)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setRankingFilter([...rankingFilter, method]);
                      } else {
                        setRankingFilter(rankingFilter.filter(m => m !== method));
                      }
                    }}
                    className="text-gray-300"
                  >
                    {RANKING_LABELS[method as keyof typeof RANKING_LABELS] || method}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Asset Filter */}
          {availableAssets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-gray-900/50 border-gray-700 text-gray-300 rounded-xl">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Assets
                  {assetFilter.length > 0 && (
                    <Badge className="ml-2 bg-purple-500/20 text-purple-400 text-[10px]">{assetFilter.length}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-800 border-gray-700">
                <DropdownMenuLabel className="text-gray-400">Asset Classes</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {availableAssets.map((asset) => (
                  <DropdownMenuCheckboxItem
                    key={asset}
                    checked={assetFilter.includes(asset)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setAssetFilter([...assetFilter, asset]);
                      } else {
                        setAssetFilter(assetFilter.filter(a => a !== asset));
                      }
                    }}
                    className="text-gray-300"
                  >
                    {asset === 'forex' && '💱 Forex'}
                    {asset === 'crypto' && '₿ Crypto'}
                    {asset === 'stocks' && '📊 Stocks'}
                    {asset === 'indices' && '📈 Indices'}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Difficulty Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-gray-900/50 border-gray-700 text-gray-300 rounded-xl">
                <Skull className="h-4 w-4 mr-2" />
                Difficulty
                {difficultyFilter.length > 0 && (
                  <Badge className="ml-2 bg-red-500/20 text-red-400 text-[10px]">{difficultyFilter.length}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700">
              <DropdownMenuLabel className="text-gray-400">Difficulty Level</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700" />
              {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map((level) => (
                <DropdownMenuCheckboxItem
                  key={level}
                  checked={difficultyFilter.includes(level)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setDifficultyFilter([...difficultyFilter, level]);
                    } else {
                      setDifficultyFilter(difficultyFilter.filter(d => d !== level));
                    }
                  }}
                  className="text-gray-300"
                >
                  <span className={DIFFICULTY_LABELS[level].color}>
                    {DIFFICULTY_LABELS[level].emoji} {DIFFICULTY_LABELS[level].label}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Level Requirement Filter */}
          {availableLevels.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-gray-900/50 border-gray-700 text-gray-300 rounded-xl">
                  <Star className="h-4 w-4 mr-2" />
                  Level
                  {levelFilter.length > 0 && (
                    <Badge className="ml-2 bg-amber-500/20 text-amber-400 text-[10px]">{levelFilter.length}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-800 border-gray-700">
                <DropdownMenuLabel className="text-gray-400">Trader Level Required</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {availableLevels.map((level) => (
                  <DropdownMenuCheckboxItem
                    key={level}
                    checked={levelFilter.includes(level)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setLevelFilter([...levelFilter, level]);
                      } else {
                        setLevelFilter(levelFilter.filter(l => l !== level));
                      }
                    }}
                    className="text-gray-300"
                  >
                    {LEVEL_LABELS[level] || `Level ${level}+`}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-gray-900/50 border-gray-700 text-gray-300 rounded-xl">
                <ChevronDown className="h-4 w-4 mr-2" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700">
              <DropdownMenuLabel className="text-gray-400">Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700" />
              {[
                { value: 'prize', label: '🏆 Prize Pool (High to Low)' },
                { value: 'start', label: '⏰ Start Time (Soonest)' },
                { value: 'participants', label: '👥 Participants (Most)' },
                { value: 'entry', label: '💰 Entry Fee (Lowest)' },
                { value: 'difficulty', label: '🌱 Difficulty (Easiest First)' },
              ].map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={sortBy === option.value}
                  onCheckedChange={() => setSortBy(option.value as 'prize' | 'start' | 'participants' | 'entry' | 'difficulty')}
                  className="text-gray-300"
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-gray-400 hover:text-gray-200"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}

          {/* View Toggle */}
          <div className="flex items-center bg-gray-900/50 rounded-xl border border-gray-700 p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'card'
                  ? 'bg-yellow-500 text-gray-900'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-yellow-500 text-gray-900'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs sm:text-sm text-gray-400">
          Showing <span className="font-bold text-gray-200">{totalFilteredCount}</span> competitions
        </p>
      </div>

      {/* Upcoming Competitions - Always First */}
      {upcomingCompetitions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/30">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
              <h2 className="text-base sm:text-xl font-bold text-gray-100">Starting Soon</h2>
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] sm:text-xs">
                {upcomingCompetitions.length}
              </Badge>
            </div>
          </div>

          <div className={viewMode === 'card' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6'
            : 'flex flex-col gap-2 sm:gap-3'
          }>
            {upcomingCompetitions.map((competition) => (
              <CompetitionCard
                key={competition._id}
                competition={competition}
                userBalance={userBalance}
                isCompleted={false}
                isUserIn={userInCompetitions.has(competition._id)}
                viewMode={viewMode}
              />
            ))}
          </div>
        </section>
      )}

      {/* Other Competitions (Active, Completed, Cancelled) */}
      {otherCompetitions.length > 0 && (
        <section>
          {upcomingCompetitions.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 mt-4 sm:mt-8">
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/10 border border-blue-500/30">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                <h2 className="text-base sm:text-xl font-bold text-gray-100">
                  {statusFilter.includes('active') && statusFilter.includes('completed') 
                    ? 'All Competitions' 
                    : statusFilter.includes('active') 
                    ? 'Live Competitions'
                    : statusFilter.includes('completed')
                    ? 'Completed'
                    : 'Other Competitions'}
                </h2>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] sm:text-xs">
                  {otherCompetitions.length}
                </Badge>
              </div>
            </div>
          )}

          <div className={viewMode === 'card' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6'
            : 'flex flex-col gap-2 sm:gap-3'
          }>
            {otherCompetitions.map((competition) => (
              <CompetitionCard
                key={competition._id}
                competition={competition}
                userBalance={userBalance}
                isCompleted={competition.status === 'completed'}
                isUserIn={userInCompetitions.has(competition._id)}
                viewMode={viewMode}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {totalFilteredCount === 0 && (
        <div className="py-12 sm:py-20 text-center">
          <div className="mx-auto w-16 h-16 sm:w-24 sm:h-24 bg-gray-800/50 rounded-full flex items-center justify-center mb-4 sm:mb-6 border border-gray-700">
            <Trophy className="h-8 w-8 sm:h-12 sm:w-12 text-gray-600" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-300 mb-2">
            No Competitions Found
          </h3>
          <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6 px-4">
            {hasActiveFilters 
              ? 'Try adjusting your filters to see more competitions'
              : 'Check back soon for new trading competitions!'}
          </p>
          {hasActiveFilters && (
            <Button onClick={clearFilters} variant="outline" className="border-gray-600 text-gray-300">
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
