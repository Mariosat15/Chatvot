"use client";

import { useEffect, useState } from "react";

/**
 * The set of active Game Master user ids, fetched once per page and shared by every
 * badge on it. Reason: a leaderboard renders one badge per row, and a fetch per badge
 * would be a hundred identical requests.
 */
const TTL_MS = 60_000;
let inflight: Promise<Set<string>> | null = null;
let fetchedAt = 0;
let current: Set<string> = new Set();

function loadGameMasterIds(): Promise<Set<string>> {
  if (inflight && Date.now() - fetchedAt < TTL_MS) return inflight;
  fetchedAt = Date.now();
  inflight = fetch("/api/gamemaster/active-ids")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      // Reason: a failed read keeps the last good set rather than un-badging everyone.
      if (data?.success && Array.isArray(data.userIds)) {
        current = new Set(data.userIds.map(String));
      }
      return current;
    })
    .catch(() => current);
  return inflight;
}

export function useGameMasterIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(current);
  useEffect(() => {
    let mounted = true;
    void loadGameMasterIds().then((next) => {
      if (mounted) setIds(next);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return ids;
}
