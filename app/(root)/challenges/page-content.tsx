'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Swords,
  RefreshCw,
  User,
  AlertCircle,
  LayoutGrid,
  List,
  Trophy,
  Target,
  Zap,
} from 'lucide-react';
import usePresence from '@/hooks/usePresence';
import ChallengeCard from '@/components/trading/ChallengeCard';

interface Challenge {
  _id: string;
  slug: string;
  challengerId: string;
  challengerName: string;
  challengedId: string;
  challengedName: string;
  entryFee: number;
  prizePool: number;
  winnerPrize: number;
  duration: number;
  status: string;
  acceptDeadline: string;
  startTime?: string;
  endTime?: string;
  winnerId?: string;
  winnerName?: string;
  createdAt: string;
}

interface ChallengesPageContentProps {
  userId: string;
}

export default function ChallengesPageContent({ userId }: ChallengesPageContentProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const [responding, setResponding] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track presence
  usePresence('/challenges');

  const fetchChallenges = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const res = await fetch('/api/challenges');
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges || []);
      }
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
    // Refresh every 10 seconds
    const interval = setInterval(() => fetchChallenges(false), 10000);
    return () => clearInterval(interval);
  }, [fetchChallenges]);

  const handleAccept = async (challengeId: string) => {
    setResponding(challengeId);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept');
      }

      toast.success('Challenge accepted! The battle begins NOW!');
      fetchChallenges();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept challenge');
    } finally {
      setResponding(null);
    }
  };

  const handleDecline = async (challengeId: string) => {
    setResponding(challengeId);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/decline`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline');
      }

      toast.success('Challenge declined');
      fetchChallenges();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decline challenge');
    } finally {
      setResponding(null);
    }
  };

  const filteredChallenges = challenges.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return c.status === 'pending';
    if (activeTab === 'active') return c.status === 'active';
    if (activeTab === 'completed') return ['completed', 'declined', 'expired', 'cancelled'].includes(c.status);
    return true;
  });

  const pendingReceived = challenges.filter(
    (c) => c.status === 'pending' && c.challengedId === userId
  );

  const stats = {
    total: challenges.length,
    active: challenges.filter(c => c.status === 'active').length,
    won: challenges.filter(c => c.status === 'completed' && c.winnerId === userId).length,
    pending: challenges.filter(c => c.status === 'pending').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-4">
        {/* Title Row */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-xl animate-pulse"></div>
              <div className="relative rounded-full bg-gradient-to-br from-orange-500 to-red-600 p-2.5 sm:p-4 shadow-xl shadow-orange-500/30">
                <Swords className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate">
                My Challenges
              </h1>
              <p className="text-xs sm:text-sm text-gray-400">1v1 Trading Battles</p>
            </div>
          </div>

          {/* Mobile: Refresh button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchChallenges(true)}
              disabled={isRefreshing}
              className="p-2 bg-gray-800 rounded-lg border border-gray-700 sm:hidden"
            >
              <RefreshCw className={`h-4 w-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            {/* View Mode Toggle */}
            <div className="flex rounded-lg bg-gray-800 p-1">
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'card'
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Card View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Find Opponents Button - Full width on mobile */}
        <Link href="/leaderboard" className="block sm:hidden">
          <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-semibold">
            <User className="h-4 w-4 mr-2" />
            Find Opponents
          </Button>
        </Link>

        {/* Desktop: Find Opponents Button */}
        <div className="hidden sm:flex items-center gap-3">
          <Link href="/leaderboard">
            <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
              <User className="h-4 w-4 mr-2" />
              Find Opponents
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-2.5 sm:p-4 text-center">
          <div className="flex justify-center mb-1 sm:mb-2">
            <Swords className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-white tabular-nums">{stats.total}</p>
          <p className="text-[9px] sm:text-xs text-gray-400">Total</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-2.5 sm:p-4 text-center">
          <div className="flex justify-center mb-1 sm:mb-2">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-blue-400 tabular-nums">{stats.active}</p>
          <p className="text-[9px] sm:text-xs text-gray-400">Active</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-xl p-2.5 sm:p-4 text-center">
          <div className="flex justify-center mb-1 sm:mb-2">
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-green-400 tabular-nums">{stats.won}</p>
          <p className="text-[9px] sm:text-xs text-gray-400">Won</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30 rounded-xl p-2.5 sm:p-4 text-center">
          <div className="flex justify-center mb-1 sm:mb-2">
            <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-yellow-400 tabular-nums">{stats.pending}</p>
          <p className="text-[9px] sm:text-xs text-gray-400">Pending</p>
        </div>
      </div>

      {/* Pending Challenges Alert */}
      {pendingReceived.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/50 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base text-yellow-300 font-semibold">
                {pendingReceived.length} pending challenge{pendingReceived.length > 1 ? 's' : ''}!
              </h3>
              <p className="text-xs sm:text-sm text-yellow-300/70 truncate">
                Respond before they expire
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - Scrollable on mobile */}
      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5 sm:gap-2 border-b border-gray-700 pb-2 min-w-max">
          {(['all', 'pending', 'active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'pending' && pendingReceived.length > 0 && (
                <span className="ml-1.5 sm:ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {pendingReceived.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Challenges Grid */}
      {filteredChallenges.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <Swords className="h-12 w-12 sm:h-16 sm:w-16 text-gray-600 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl text-gray-400 mb-2">No challenges yet</h3>
          <p className="text-sm text-gray-500 mb-4 px-4">
            Head to the leaderboard to challenge other traders!
          </p>
          <Link href="/leaderboard">
            <Button className="bg-orange-500 hover:bg-orange-600">
              Find Opponents
            </Button>
          </Link>
        </div>
      ) : (
        <div className={viewMode === 'card' 
          ? 'grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
          : 'space-y-2 sm:space-y-4'
        }>
          {filteredChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge._id}
              challenge={challenge}
              userId={userId}
              viewMode={viewMode}
              onAccept={handleAccept}
              onDecline={handleDecline}
              responding={responding === challenge._id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
