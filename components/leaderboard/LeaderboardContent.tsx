'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Medal,
  Star,
  Crown,
  Zap,
  Swords,
  LayoutList,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import LeaderboardChallengeButton from '@/components/leaderboard/LeaderboardChallengeButton';
import MatchmakingCards from '@/components/leaderboard/MatchmakingCards';
import ProfileCard from '@/components/profile/ProfileCard';
import ChallengeCreateDialog from '@/components/challenges/ChallengeCreateDialog';
import { cn } from '@/lib/utils';

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

export default function LeaderboardContent({
  leaderboard,
  myPosition,
  currentUserId,
}: LeaderboardContentProps) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);

  const getRankIcon = (rank: number, isTied?: boolean) => {
    const tieRingClass = isTied ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-gray-900 rounded-full p-1' : '';
    
    if (rank === 1) return <div className={tieRingClass}><Crown className="h-6 w-6 text-yellow-400" /></div>;
    if (rank === 2) return <div className={tieRingClass}><Medal className="h-6 w-6 text-gray-300" /></div>;
    if (rank === 3) return <div className={tieRingClass}><Medal className="h-6 w-6 text-amber-600" /></div>;
    return <span className={`text-lg font-bold text-gray-500 ${tieRingClass}`}>#{rank}</span>;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    if (rank === 2) return 'bg-gray-300/20 text-gray-300 border-gray-300/50';
    if (rank === 3) return 'bg-amber-600/20 text-amber-600 border-amber-600/50';
    if (rank <= 10) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    if (rank <= 50) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
    return 'bg-gray-700/20 text-gray-400 border-gray-700/50';
  };

  // Convert user title to level number for VsScreen
  const getLevelFromTitle = (title?: string): number => {
    if (!title) return 3; // Default to intermediate
    const titleLower = title.toLowerCase();
    if (titleLower.includes('beginner') || titleLower.includes('newbie')) return 1;
    if (titleLower.includes('apprentice')) return 2;
    if (titleLower.includes('intermediate') || titleLower.includes('trader')) return 3;
    if (titleLower.includes('advanced') || titleLower.includes('skilled')) return 4;
    if (titleLower.includes('expert') || titleLower.includes('veteran')) return 5;
    if (titleLower.includes('master')) return 6;
    if (titleLower.includes('grandmaster') || titleLower.includes('elite')) return 7;
    if (titleLower.includes('legend') || titleLower.includes('champion')) return 8;
    return 3; // Default
  };

  return (
    <div className="flex min-h-screen flex-col gap-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-100 mb-2 flex items-center gap-3">
              <Trophy className="h-10 w-10 text-yellow-500" />
              Global Leaderboard
            </h1>
            <p className="text-gray-400 text-lg">
              {viewMode === 'table' 
                ? 'The best traders of all time - ranked by overall performance'
                : 'Swipe to find your perfect opponent!'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-800 rounded-lg border border-gray-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('table')}
                className={cn(
                  "px-3 py-2 rounded-md transition-all",
                  viewMode === 'table'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <LayoutList className="h-4 w-4 mr-2" />
                Table
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('cards')}
                className={cn(
                  "px-3 py-2 rounded-md transition-all",
                  viewMode === 'cards'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Match Cards
              </Button>
            </div>
            <Link href="/profile" className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium">
              View My Profile
            </Link>
          </div>
        </div>

        {/* User's Position Card */}
        {myPosition && myPosition.rank > 0 && (
          <div className="rounded-xl bg-gradient-to-br from-primary-500/20 via-gray-800 to-gray-900 p-6 shadow-xl border border-primary-500/20">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`rounded-full p-4 border-2 ${getRankBadge(myPosition.rank)}`}>
                  {getRankIcon(myPosition.rank)}
                </div>
                <div>
                  <p className="text-sm text-gray-400">Your Global Rank</p>
                  <p className="text-3xl font-bold text-white">#{myPosition.rank}</p>
                  <p className="text-xs text-gray-500">out of {myPosition.totalUsers} traders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Top Percentile</p>
                <p className="text-2xl font-bold text-green-400">{myPosition.percentile.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">Better than {(100 - myPosition.percentile).toFixed(1)}% of traders</p>
              </div>
            </div>
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
          {/* Leaderboard Table */}
          <div className="rounded-xl bg-gray-800/50 border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900/80 px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                All Traders ({leaderboard.length})
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
                  {leaderboard.map((entry) => {
                    const isCurrentUser = entry.userId === currentUserId;
                    
                    return (
                      <div
                        key={entry.userId}
                        className={`grid grid-cols-14 gap-4 px-6 py-4 transition-colors ${
                          isCurrentUser
                            ? 'bg-primary-500/10 border-l-4 border-primary-500'
                            : entry.rank <= 3
                            ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                            : entry.rank <= 10
                            ? 'bg-blue-500/5 hover:bg-blue-500/10'
                            : 'hover:bg-gray-800/50'
                        }`}
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
                                {entry.tiedWith && entry.tiedWith.length > 0 && (
                                  <span className="text-amber-300/70 ml-1">({entry.tiedWith.length + 1} equal)</span>
                                )}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{entry.totalTrades} trades</p>
                        </div>

                        {/* P&L */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <p className={`text-sm font-semibold tabular-nums ${
                            entry.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {entry.totalPnl >= 0 ? '+' : ''}
                            {entry.totalPnl.toFixed(0)}
                          </p>
                        </div>

                        {/* ROI */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <p className={`text-sm font-semibold tabular-nums ${
                            entry.totalPnlPercentage >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {entry.totalPnlPercentage >= 0 ? '+' : ''}
                            {entry.totalPnlPercentage.toFixed(1)}%
                          </p>
                        </div>

                        {/* Win Rate */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <p className="text-sm font-medium text-gray-100 tabular-nums">
                            {entry.winRate.toFixed(0)}%
                          </p>
                        </div>

                        {/* Profit Factor */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <p className={`text-sm font-semibold tabular-nums ${
                            entry.profitFactor >= 2
                              ? 'text-green-500'
                              : entry.profitFactor >= 1
                              ? 'text-yellow-500'
                              : 'text-red-500'
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
                            {entry.podiumFinishes > 0 && (
                              <span className="text-xs text-orange-400">
                                🥇 {entry.podiumFinishes}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="col-span-1 flex flex-col items-end justify-center">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-gray-300">{entry.totalBadges}</span>
                            {entry.legendaryBadges > 0 && (
                              <span className="text-yellow-400 text-xs">
                                ⚡{entry.legendaryBadges}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Score */}
                        <div className="col-span-2 flex flex-col items-end justify-center">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary-400" />
                            <p className="text-sm font-bold text-primary-400 tabular-nums">
                              {entry.overallScore.toFixed(0)}
                            </p>
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

          {/* Info Section */}
          <div className="rounded-xl bg-gray-800/30 border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">📊 How Rankings Work</h3>
            <div className="space-y-3 text-sm text-gray-400">
              <p>
                <strong className="text-gray-300">Overall Score</strong> is calculated using a weighted formula:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>30% - Total P&L (absolute profit/loss)</li>
                <li>25% - ROI (return on investment percentage)</li>
                <li>20% - Win Rate (percentage of winning trades)</li>
                <li>10% - Profit Factor (gross profit / gross loss ratio)</li>
                <li>5% - Competition Wins</li>
                <li>5% - Podium Finishes (Top 3)</li>
                <li>3% - Badge Collection</li>
                <li>2% - Legendary Badges</li>
              </ul>
              <p className="pt-2">
                <strong className="text-gray-300">Rankings update in real-time</strong> as traders complete competitions and earn badges.
              </p>
            </div>
          </div>
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

