'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Play, Eye, TrendingUp, TrendingDown, Trophy, BarChart3, Clock, RefreshCw } from 'lucide-react';

interface UserParticipant {
  _id: string;
  currentCapital: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  currentRank?: number;
  winningTrades?: number;
  losingTrades?: number;
}

interface CompetitionStatusWrapperProps {
  competitionId: string;
  startTime: string;
  endTime: string;
  initialStatus: 'upcoming' | 'active' | 'completed';
  isUserIn: boolean;
  userParticipant: UserParticipant | null;
}

export default function CompetitionStatusWrapper({
  competitionId,
  startTime,
  endTime,
  initialStatus,
  isUserIn,
  userParticipant,
}: CompetitionStatusWrapperProps) {
  const [status, setStatus] = useState(initialStatus);
  const [timeToStart, setTimeToStart] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      const now = new Date();
      const start = new Date(startTime);
      const end = new Date(endTime);

      let newStatus: 'upcoming' | 'active' | 'completed' = 'upcoming';
      
      if (now >= end) {
        newStatus = 'completed';
      } else if (now >= start) {
        newStatus = 'active';
      } else {
        newStatus = 'upcoming';
        setTimeToStart(start.getTime() - now.getTime());
      }

      // Status changed - show transition animation
      if (newStatus !== status) {
        setIsTransitioning(true);
        setTimeout(() => {
          setStatus(newStatus);
          setIsTransitioning(false);
        }, 500);
      }
    };

    // Check immediately
    checkStatus();

    // Check every second for more responsive updates
    const interval = setInterval(checkStatus, 1000);

    return () => clearInterval(interval);
  }, [startTime, endTime, status]);

  // Don't show anything if user is not in the competition
  if (!isUserIn || !userParticipant) {
    return null;
  }

  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isUpcoming = status === 'upcoming';

  return (
    <div className={`rounded-xl bg-gradient-to-br ${
      isCompleted 
        ? 'from-purple-500/10 to-gray-800/50 border-purple-500/30' 
        : 'from-blue-500/10 to-gray-800/50 border-blue-500/30'
    } border p-6 transition-all duration-500 ${isTransitioning ? 'scale-[0.98] opacity-80' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">
          {isCompleted ? '🏁 Your Final Results' : 'Your Performance'}
        </h3>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium animate-pulse flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              LIVE
            </span>
          )}
          {isUpcoming && timeToStart !== null && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Starting soon...
            </span>
          )}
          {isCompleted && (
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              COMPLETED
            </span>
          )}
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
            Rank #{userParticipant.currentRank || '—'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500">{isCompleted ? 'Final Capital' : 'Current Capital'}</p>
          <p className="text-xl font-bold text-gray-100">
            ${userParticipant.currentCapital.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{isCompleted ? 'Final P&L' : 'P&L'}</p>
          <p
            className={`text-xl font-bold flex items-center gap-1 ${
              userParticipant.pnl >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {userParticipant.pnl >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {userParticipant.pnl >= 0 ? '+' : ''}
            ${userParticipant.pnl.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">ROI</p>
          <p
            className={`text-xl font-bold ${
              userParticipant.pnlPercentage >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {userParticipant.pnlPercentage >= 0 ? '+' : ''}
            {userParticipant.pnlPercentage.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Trades</p>
          <p className="text-xl font-bold text-gray-100">
            {userParticipant.totalTrades}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 space-y-2">
        {/* Upcoming - Waiting */}
        {isUpcoming && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center">
            <p className="text-amber-400 text-sm font-medium flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 animate-pulse" />
              Competition hasn't started yet. Trading button will appear when it begins!
            </p>
          </div>
        )}

        {/* Active - Trade Button */}
        {isActive && (
          <Link href={`/competitions/${competitionId}/trade`} className="block">
            <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 text-lg shadow-lg shadow-green-500/25 transition-all hover:scale-[1.02]">
              <Play className="h-5 w-5 mr-2" />
              Start Trading Now
            </Button>
          </Link>
        )}

        {/* Completed - View Results Button */}
        {isCompleted && (
          <div className="space-y-3">
            <Link href={`/competitions/${competitionId}/results`} className="block">
              <Button className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-bold py-3 text-lg shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02]">
                <BarChart3 className="h-5 w-5 mr-2" />
                View Trading Results
              </Button>
            </Link>
            
            <Link href={`/competitions/${competitionId}/trade?viewOnly=true`} className="block">
              <Button variant="outline" className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                <Eye className="h-4 w-4 mr-2" />
                Review Charts & Trade History
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Transition indicator */}
      {isTransitioning && (
        <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg text-center">
          <p className="text-blue-400 text-sm font-medium flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Competition status updating...
          </p>
        </div>
      )}
    </div>
  );
}

