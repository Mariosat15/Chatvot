"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardFriendButtonProps {
  userId: string;
  username: string;
  isCurrentUser: boolean;
  compact?: boolean;
}

// ============================================================
// SINGLE GLOBAL FETCH — shared by all 50+ button instances
// Instead of 50 separate fetch calls to /api/messaging/friends/status/{id},
// ONE fetch gets the status for ALL visible users and shares via
// a lightweight subscribe/notify pattern.
// ============================================================
type FriendStatus = "none" | "pending" | "friends" | "disabled";
let globalFriendStatusCache: Record<string, FriendStatus> = {};
let globalFriendFetchInProgress = false;
const friendSubscribers = new Set<() => void>();

// Collect all userIds that need checking, then fetch once
let pendingUserIds = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function requestFriendStatusCheck(userId: string) {
  pendingUserIds.add(userId);
  // Debounce: wait 50ms to collect all userIds from mount, then fetch once
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(doBatchFetch, 50);
}

async function doBatchFetch() {
  if (globalFriendFetchInProgress) return;
  const ids = Array.from(pendingUserIds);
  pendingUserIds.clear();
  if (ids.length === 0) return;

  globalFriendFetchInProgress = true;
  try {
    // Fetch statuses in parallel batches of 10 to avoid overloading
    // But ideally we'd have a batch endpoint. For now, use Promise.allSettled
    // with the existing per-user endpoint but capped at one round of requests.
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/messaging/friends/status/${id}`);
        if (!res.ok) return { id, status: "none" as FriendStatus };
        const data = await res.json();
        let status: FriendStatus = "none";
        if (data.disabled) status = "disabled";
        else if (data.isFriend) status = "friends";
        else if (data.hasPendingRequest) status = "pending";
        return { id, status };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        globalFriendStatusCache[result.value.id] = result.value.status;
      }
    }
    friendSubscribers.forEach((cb) => cb());
  } catch {
    // Silent fail
  } finally {
    globalFriendFetchInProgress = false;
  }
}

export default function LeaderboardFriendButton({
  userId,
  username,
  isCurrentUser,
  compact = false,
}: LeaderboardFriendButtonProps) {
  const [status, setStatus] = useState<
    "none" | "pending" | "friends" | "loading" | "disabled"
  >("loading");
  const [sending, setSending] = useState(false);

  const updateFromCache = useCallback(() => {
    const cached = globalFriendStatusCache[userId];
    if (cached !== undefined) {
      setStatus(cached);
    }
  }, [userId]);

  useEffect(() => {
    // Subscribe to global updates
    friendSubscribers.add(updateFromCache);

    // Check if we already have the data
    if (globalFriendStatusCache[userId] !== undefined) {
      setStatus(globalFriendStatusCache[userId]);
    } else {
      // Request this user's status to be fetched in the next batch
      requestFriendStatusCheck(userId);
    }

    return () => {
      friendSubscribers.delete(updateFromCache);
    };
  }, [userId, updateFromCache]);

  const sendFriendRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sending || status !== "none") return;
    setSending(true);

    try {
      const response = await fetch("/api/messaging/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: userId }),
      });

      if (response.ok) {
        setStatus("pending");
        globalFriendStatusCache[userId] = "pending";
      } else {
        const data = await response.json();
        if (data.error?.includes("disabled")) {
          setStatus("disabled");
          globalFriendStatusCache[userId] = "disabled";
        }
      }
    } catch {
      // Silent fail
    } finally {
      setSending(false);
    }
  };

  // Don't show button for current user
  if (isCurrentUser) return null;

  const baseClasses = cn(
    "flex items-center justify-center rounded-xl transition-all duration-200 font-medium",
    compact ? "w-9 h-9" : "w-10 h-10",
  );

  // Loading state
  if (status === "loading") {
    return (
      <div
        className={cn(baseClasses, "bg-gray-800/50 border border-gray-700/50")}
      >
        <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Already friends
  if (status === "friends") {
    return (
      <div
        className={cn(
          baseClasses,
          "bg-gradient-to-br from-emerald-500/20 to-green-500/20 text-emerald-400 border border-emerald-500/30",
        )}
        title="Already friends"
      >
        <Users className="w-4 h-4" />
      </div>
    );
  }

  // Request pending
  if (status === "pending") {
    return (
      <div
        className={cn(
          baseClasses,
          "bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30",
        )}
        title="Request pending"
      >
        <Clock className="w-4 h-4" />
      </div>
    );
  }

  // Friend requests disabled
  if (status === "disabled") {
    return (
      <div
        className={cn(
          baseClasses,
          "bg-gray-800/50 text-gray-600 border border-gray-700/50 cursor-not-allowed",
        )}
        title="Friend requests disabled by user"
      >
        <UserPlus className="w-4 h-4" />
      </div>
    );
  }

  // Can send request
  return (
    <button
      onClick={sendFriendRequest}
      disabled={sending}
      className={cn(
        baseClasses,
        "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30",
        "hover:from-cyan-500/30 hover:to-blue-500/30 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10",
        sending && "opacity-50 cursor-not-allowed",
      )}
      title={`Add ${username} as friend`}
    >
      {sending ? (
        <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-cyan-400 rounded-full animate-spin" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
    </button>
  );
}
