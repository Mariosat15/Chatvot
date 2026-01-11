'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Swords, Circle, Loader2 } from 'lucide-react';
import ChallengeCreateDialog from '@/components/challenges/ChallengeCreateDialog';
import VsScreen, { VsOpponent } from '@/components/challenges/VsScreen';

interface LeaderboardChallengeButtonProps {
  userId: string;
  username: string;
  isCurrentUser: boolean;
  // Stats from leaderboard data
  winRate?: number;
  totalTrades?: number;
  challengesEntered?: number;
  level?: number;
  profileImage?: string;
  // Mobile: compact display
  compact?: boolean;
}

interface OnlineUser {
  userId: string;
  status: 'online' | 'away' | 'offline';
  acceptingChallenges: boolean;
}

// Global cache for online users - shared across all instances
let globalOnlineUsersCache: OnlineUser[] = [];
let globalLastFetchTime = 0;
const CACHE_DURATION = 1500; // 1.5 seconds cache for real-time updates

// Subscribe/unsubscribe pattern for real-time updates
const subscribers = new Set<() => void>();

async function fetchGlobalOnlineUsers() {
  try {
    const res = await fetch(`/api/user/presence?online=true`);
    if (res.ok) {
      const data = await res.json();
      globalOnlineUsersCache = data.users || [];
      globalLastFetchTime = Date.now();
      // Notify all subscribers
      subscribers.forEach(callback => callback());
      return globalOnlineUsersCache;
    }
  } catch (error) {
    console.error('Failed to fetch online users:', error);
  }
  return globalOnlineUsersCache;
}

export default function LeaderboardChallengeButton({
  userId,
  username,
  isCurrentUser,
  winRate = 0,
  totalTrades = 0,
  challengesEntered = 0,
  level = 3,
  profileImage,
  compact = false,
}: LeaderboardChallengeButtonProps) {
  const [onlineStatus, setOnlineStatus] = useState<OnlineUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showVsScreen, setShowVsScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState<string>('You');
  const [currentUserImage, setCurrentUserImage] = useState<string | undefined>();
  const [opponentStats, setOpponentStats] = useState<VsOpponent | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateStatusFromCache = useCallback(() => {
    const user = globalOnlineUsersCache.find((u: OnlineUser) => u.userId === userId);
    setOnlineStatus(user || null);
    setLoading(false);
  }, [userId]);

  const fetchOnlineStatus = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    
    // Use cache if recent enough and not forcing refresh
    if (!forceRefresh && now - globalLastFetchTime < CACHE_DURATION && globalOnlineUsersCache.length >= 0) {
      updateStatusFromCache();
      return;
    }

    // Fetch fresh data
    await fetchGlobalOnlineUsers();
    updateStatusFromCache();
  }, [updateStatusFromCache]);

  useEffect(() => {
    // Subscribe to cache updates
    subscribers.add(updateStatusFromCache);
    
    // Initial fetch
    fetchOnlineStatus();
    
    // Refresh every 2 seconds for real-time updates
    intervalRef.current = setInterval(() => fetchOnlineStatus(true), 2000);
    
    return () => {
      subscribers.delete(updateStatusFromCache);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchOnlineStatus, updateStatusFromCache]);

  // Also refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOnlineStatus(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchOnlineStatus]);

  // Fetch current user name and image on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        const user = data.user || data;
        if (user?.name) {
          setCurrentUserName(user.name);
        }
        if (user?.profileImage) {
          setCurrentUserImage(user.profileImage);
        }
      } catch {
        // Ignore - use default "You"
      }
    };
    fetchCurrentUser();
  }, []);

  // Handle challenge button click - show VS screen first
  const handleChallengeClick = () => {
    // Use stats passed from leaderboard (no need to fetch)
    setOpponentStats({
      username,
      profileImage,
      level,
      winRate,
      totalTrades,
      challengesEntered,
    });
    
    setShowVsScreen(true);
  };

  const handleVsChallenge = () => {
    setShowVsScreen(false);
    setDialogOpen(true);
  };

  const handleVsClose = () => {
    setShowVsScreen(false);
  };

  // Current user - handled in parent component
  if (isCurrentUser) {
    return null;
  }

  const isOnline = onlineStatus?.status === 'online';
  const canChallenge = isOnline && onlineStatus?.acceptingChallenges !== false;

  // Compact mode for mobile
  if (compact) {
    return (
      <>
        <button
          onClick={canChallenge ? handleChallengeClick : undefined}
          disabled={!canChallenge || loading}
          className={`
            flex-1 h-9 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all
            ${canChallenge 
              ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40' 
              : 'bg-gray-800/50 text-gray-600 border border-gray-700/50 cursor-not-allowed'
            }
          `}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Circle className={`h-2 w-2 ${isOnline ? 'fill-green-400 text-green-400' : 'fill-gray-500 text-gray-500'}`} />
              <Swords className="h-3.5 w-3.5" />
              {canChallenge ? 'Challenge' : 'Offline'}
            </>
          )}
        </button>

        {/* VS Screen */}
        {opponentStats && (
          <VsScreen
            show={showVsScreen}
            player1Name={currentUserName}
            player1Image={currentUserImage}
            opponent={opponentStats}
            onChallenge={handleVsChallenge}
            onClose={handleVsClose}
          />
        )}

        {/* Challenge Dialog */}
        <ChallengeCreateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          challengedUser={dialogOpen ? { userId, username } : null}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={canChallenge ? handleChallengeClick : undefined}
        disabled={!canChallenge || loading}
        className={`
          h-10 px-4 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all
          ${canChallenge 
            ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02]' 
            : 'bg-gray-800/50 text-gray-500 border border-gray-700/50 cursor-not-allowed'
          }
        `}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Circle className={`h-2 w-2 ${isOnline ? 'fill-green-400 text-green-400' : 'fill-gray-500 text-gray-500'}`} />
            <Swords className="h-4 w-4" />
            <span className="hidden sm:inline">{canChallenge ? 'Challenge' : 'Offline'}</span>
          </>
        )}
      </button>

      {/* VS Screen */}
      {opponentStats && (
        <VsScreen
          show={showVsScreen}
          player1Name={currentUserName}
          player1Image={currentUserImage}
          opponent={opponentStats}
          onChallenge={handleVsChallenge}
          onClose={handleVsClose}
        />
      )}

      {/* Challenge Dialog */}
      <ChallengeCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        challengedUser={dialogOpen ? { userId, username } : null}
      />
    </>
  );
}

