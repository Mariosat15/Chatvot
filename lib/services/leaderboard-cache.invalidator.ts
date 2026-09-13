/**
 * Fire-and-forget leaderboard cache invalidator.
 *
 * Reason: the public leaderboard is cached in-process for 5 minutes
 * (CACHE_TTL in lib/actions/leaderboard/global-leaderboard.actions.ts) to
 * avoid ~7s rebuilds on every request. Every admin action that changes
 * whether a user is hidden from public (ban, suspend, hideFromPublic toggle,
 * OR unban / restriction lift / chargeback resolution) must invalidate that
 * cache, otherwise the user will appear / disappear only after the cache
 * naturally expires — which admins interpret as "unban is broken".
 *
 * Cross-process note: the admin Next.js app runs in a separate process from
 * the main Next.js app (and therefore keeps its own in-memory cache). We
 * invalidate via HTTP to the main app's /api/leaderboard/invalidate endpoint
 * so the correct cache is cleared regardless of which process calls this.
 *
 * This function is intentionally fire-and-forget: a failed invalidation
 * should never block a user-visible admin flow. Worst case, the cache
 * expires on its own within 5 minutes.
 */
export async function invalidateLeaderboardCache(): Promise<void> {
  try {
    const mainAppUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const secret =
      process.env.INTERNAL_API_SECRET || "simulator-cleanup";
    await fetch(`${mainAppUrl}/api/leaderboard/invalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
      cache: "no-store",
    });
  } catch {
    // Intentional: degrade gracefully. Cache TTL is 5 minutes.
  }
}
