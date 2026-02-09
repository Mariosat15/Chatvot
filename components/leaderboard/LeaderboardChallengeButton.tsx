"use client";

import { useState, useEffect, useCallback } from "react";
import { Swords, Circle, Loader2 } from "lucide-react";
import ChallengeCreateDialog from "@/components/challenges/ChallengeCreateDialog";
import VsScreen, { VsOpponent } from "@/components/challenges/VsScreen";

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
  status: "online" | "away" | "offline";
  acceptingChallenges: boolean;
}

// ============================================================
// SINGLE GLOBAL POLLER — shared by all 50+ button instances
// Instead of 50 separate setIntervals (each hitting the API),
// ONE interval fetches every 15s and notifies all buttons via
// a lightweight subscribe/notify pattern.
// ============================================================
let globalOnlineUsersCache: OnlineUser[] = [];
let globalLastFetchTime = 0;
let globalIntervalId: ReturnType<typeof setInterval> | null = null;
let globalCurrentUserName = "";
let globalCurrentUserImage: string | undefined;
let globalCurrentUserFetched = false;
const POLL_INTERVAL = 15_000; // 15 seconds (was 2s per button = 25 req/s)

const subscribers = new Set<() => void>();

function startGlobalPoller() {
  if (globalIntervalId) return; // Already running

  const doFetch = async () => {
    try {
      const res = await fetch(`/api/user/presence?online=true`);
      if (res.ok) {
        const data = await res.json();
        globalOnlineUsersCache = data.users || [];
        globalLastFetchTime = Date.now();
        subscribers.forEach((cb) => cb());
      }
    } catch {
      // Silently retry on next interval
    }
  };

  // Fetch immediately, then every POLL_INTERVAL
  doFetch();
  globalIntervalId = setInterval(doFetch, POLL_INTERVAL);
}

function stopGlobalPollerIfEmpty() {
  if (subscribers.size === 0 && globalIntervalId) {
    clearInterval(globalIntervalId);
    globalIntervalId = null;
  }
}

// Fetch current user profile ONCE globally (not per button)
async function fetchCurrentUserOnce() {
  if (globalCurrentUserFetched) return;
  globalCurrentUserFetched = true;
  try {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    const user = data.user || data;
    if (user?.name) globalCurrentUserName = user.name;
    if (user?.profileImage) globalCurrentUserImage = user.profileImage;
    subscribers.forEach((cb) => cb()); // Notify so buttons pick up name/image
  } catch {
    globalCurrentUserFetched = false; // Retry next mount
  }
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
  const [currentUserName, setCurrentUserName] = useState<string>(
    globalCurrentUserName || "You",
  );
  const [currentUserImage, setCurrentUserImage] = useState<
    string | undefined
  >(globalCurrentUserImage);
  const [opponentStats, setOpponentStats] = useState<VsOpponent | null>(null);

  // Subscribe to the SINGLE global poller (no per-button interval)
  const updateFromGlobal = useCallback(() => {
    const user = globalOnlineUsersCache.find(
      (u: OnlineUser) => u.userId === userId,
    );
    setOnlineStatus(user || null);
    setLoading(false);
    // Also pick up current user info if available
    if (globalCurrentUserName) setCurrentUserName(globalCurrentUserName);
    if (globalCurrentUserImage) setCurrentUserImage(globalCurrentUserImage);
  }, [userId]);

  useEffect(() => {
    subscribers.add(updateFromGlobal);
    startGlobalPoller(); // Starts only once; subsequent calls are no-ops
    fetchCurrentUserOnce(); // Fetches only once globally

    // Read from cache immediately if available
    if (globalLastFetchTime > 0) {
      updateFromGlobal();
    }

    return () => {
      subscribers.delete(updateFromGlobal);
      stopGlobalPollerIfEmpty(); // Stops poller when last button unmounts
    };
  }, [updateFromGlobal]);

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

  const isOnline = onlineStatus?.status === "online";
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
            ${
              canChallenge
                ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
                : "bg-gray-800/50 text-gray-600 border border-gray-700/50 cursor-not-allowed"
            }
          `}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Circle
                className={`h-2 w-2 ${isOnline ? "fill-green-400 text-green-400" : "fill-gray-500 text-gray-500"}`}
              />
              <Swords className="h-3.5 w-3.5" />
              {canChallenge ? "Challenge" : "Offline"}
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
          ${
            canChallenge
              ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02]"
              : "bg-gray-800/50 text-gray-500 border border-gray-700/50 cursor-not-allowed"
          }
        `}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Circle
              className={`h-2 w-2 ${isOnline ? "fill-green-400 text-green-400" : "fill-gray-500 text-gray-500"}`}
            />
            <Swords className="h-4 w-4" />
            <span className="hidden sm:inline">
              {canChallenge ? "Challenge" : "Offline"}
            </span>
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
