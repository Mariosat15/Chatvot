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

  // Current user sees their own row but no challenge button
  if (isCurrentUser) {
    return (
      <div className="flex items-center gap-1">
        <Circle className="h-2 w-2 text-green-500 fill-green-500" />
        <span className="text-xs text-green-400">You</span>
      </div>
    );
  }

  const isOnline = onlineStatus?.status === 'online';
  const canChallenge = isOnline && onlineStatus?.acceptingChallenges !== false;

  return (
    <div className="flex items-center gap-2">
      {/* Online Status Indicator */}
      <div className="flex items-center gap-1">
        {loading ? (
          <Loader2 className="h-2 w-2 text-gray-500 animate-spin" />
        ) : (
          <Circle
            className={`h-2 w-2 ${
              isOnline
                ? 'text-green-500 fill-green-500'
                : 'text-gray-500 fill-gray-500'
            }`}
          />
        )}
        <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
          {loading ? '...' : isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Challenge Button */}
      {canChallenge && (
        <Button
          size="sm"
          onClick={handleChallengeClick}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs px-2 py-1 h-7"
        >
          <Swords className="h-3 w-3 mr-1" />
          Challenge
        </Button>
      )}

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
    </div>
  );
}

