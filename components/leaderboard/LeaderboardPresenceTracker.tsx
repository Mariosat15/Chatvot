'use client';

import usePresence from '@/hooks/usePresence';

/**
 * Client component that tracks user presence when viewing the leaderboard
 * This ensures the current user is marked as online
 */
export default function LeaderboardPresenceTracker() {
  // Track presence while on leaderboard page
  usePresence('/leaderboard');

  return null; // This component doesn't render anything
}

