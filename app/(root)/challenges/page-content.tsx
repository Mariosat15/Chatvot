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

  // Track presence
  usePresence('/challenges');

  const fetchChallenges = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
    // Refresh every 10 seconds
    const interval = setInterval(fetchChallenges, 10000);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Swords className="h-8 w-8 text-orange-500" />
            My Challenges
          </h1>
          <p className="text-gray-400 mt-1">1v1 Trading Battles</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Link href="/leaderboard">
            <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
              <User className="h-4 w-4 mr-2" />
              Find Opponents
            </Button>
          </Link>
        </div>
      </div>

      {/* Pending Challenges Alert */}
      {pendingReceived.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-yellow-400 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="text-yellow-300 font-semibold">
                You have {pendingReceived.length} pending challenge{pendingReceived.length > 1 ? 's' : ''}!
              </h3>
              <p className="text-yellow-300/70 text-sm">
                Respond before they expire
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {(['all', 'pending', 'active', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-orange-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'pending' && pendingReceived.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingReceived.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Challenges Grid */}
      {filteredChallenges.length === 0 ? (
        <div className="text-center py-12">
          <Swords className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl text-gray-400 mb-2">No challenges yet</h3>
          <p className="text-gray-500 mb-4">
            Head to the leaderboard to challenge other traders!
          </p>
          <Link href="/leaderboard">
            <Button className="bg-orange-500 hover:bg-orange-600">
              Find Opponents
            </Button>
          </Link>
        </div>
      ) : (
        <div className={viewMode === 'card' ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3' : 'space-y-4'}>
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

