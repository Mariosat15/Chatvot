"use server";
/* eslint-disable security/detect-object-injection */

import { connectToDatabase } from "@/database/mongoose";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import TradeHistory from "@/database/models/trading/trade-history.model";
import UserBadge from "@/database/models/user-badge.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { getAllUsers } from "@/lib/utils/user-lookup";
import { getHiddenUserIds } from "@/lib/services/user-restriction.service";
import {
  computeProfitFactor,
  computeWinRate,
  clampProfitFactorForScore,
} from "@/lib/services/trading-metrics";
// Titles are added per-page in the API to avoid loading 4000+ UserLevel docs on every cache build

export interface GlobalLeaderboardEntry {
  userId: string;
  email: string; // Primary identifier for traders
  username: string; // Display name (for reference only)
  profileImage?: string; // Profile image URL
  rank: number;
  isTied?: boolean;
  tiedWith?: string[];

  // Title
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;

  // Overall stats
  totalPnl: number;
  totalPnlPercentage: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;

  // Competition stats
  competitionsEntered: number;
  competitionsWon: number;
  podiumFinishes: number;

  // Challenge stats
  challengesEntered?: number;
  challengesWon?: number;

  // Badges
  totalBadges: number;
  legendaryBadges: number;

  // Score (for ranking)
  overallScore: number;
}

// ============================================
// CACHING - 60s TTL to avoid repeated heavy builds
// ============================================
interface CachedLeaderboard {
  data: GlobalLeaderboardEntry[];
  timestamp: number;
}
let leaderboardCache: CachedLeaderboard | null = null;
const CACHE_TTL = 300000; // 5 minutes - rebuild is ~7s on free tier, minimize cold starts
const MAX_LEADERBOARD_USERS = 5000; // Cap to keep memory and query size bounded

function isCacheValid(): boolean {
  return (
    leaderboardCache !== null &&
    Date.now() - leaderboardCache.timestamp < CACHE_TTL
  );
}

/**
 * Clear the leaderboard cache.
 * Called after simulator cleanup, competition end, or manual data deletion
 * to force a fresh build on the next request.
 */
export async function clearLeaderboardCache(): Promise<void> {
  leaderboardCache = null;
}

/**
 * Get global leaderboard - ranks ALL users (including those without competition/challenge history)
 *
 * OPTIMIZED VERSION:
 * - 2 min in-memory cache; titles loaded per-page in API only
 * - Parallel database queries
 * - O(n) lookups with Maps instead of O(n²)
 * - Static imports (no dynamic import overhead)
 */
export async function getGlobalLeaderboard(
  limit: number = 0,
): Promise<GlobalLeaderboardEntry[]> {
  if (isCacheValid()) {
    const cached = leaderboardCache!.data;
    return limit > 0 ? cached.slice(0, limit) : cached;
  }

  await connectToDatabase();

  try {
    const allUsersRaw = await getAllUsers();
    // Reason: Exclude users that admins have flagged as hidden from public
    const hiddenIds = await getHiddenUserIds();
    const visibleUsers = allUsersRaw.filter((u) => !hiddenIds.has(u.id));
    const usersToProcess = visibleUsers.slice(0, MAX_LEADERBOARD_USERS);
    const userIds = usersToProcess.map((u) => u.id).filter(Boolean);

    if (userIds.length === 0) {
      leaderboardCache = { data: [], timestamp: Date.now() };
      return [];
    }

    // PERF FIX: Fetch ALL participants/badges (tiny collections: 5+2+33 docs)
    // instead of $in with 4952 IDs (was 1.8s due to huge $in filter on free tier).
    // Join in JS via the userIdsSet — O(n) and instant.
    const userIdsSet = new Set(userIds);
    const [allCompetitionParticipants, allChallengeParticipants, allUserBadges, tradeStatsByUser] =
      await Promise.all([
        // Reason: Include `status` so we only count wins/podiums from completed competitions.
        // Active competitions have temporary ranks that would incorrectly inflate win counts.
        CompetitionParticipant.find({})
          .select(
            "userId pnl startingCapital currentRank status",
          )
          .read("secondaryPreferred")
          .lean()
          .then((docs) => docs.filter((d) => userIdsSet.has(d.userId))),
        ChallengeParticipant.find({})
          .select(
            "userId pnl startingCapital isWinner",
          )
          .read("secondaryPreferred")
          .lean()
          .then((docs) => docs.filter((d) => userIdsSet.has(d.userId))),
        UserBadge.find({})
          .select("userId badgeId")
          .read("secondaryPreferred")
          .lean()
          .then((docs) => docs.filter((d) => userIdsSet.has(d.userId))),
        // Reason: TradeHistory is the SINGLE SOURCE OF TRUTH for totalTrades/winRate
        // to stay consistent with dashboard, profile, and admin views.
        TradeHistory.aggregate([
          {
            $group: {
              _id: "$userId",
              totalTrades: { $sum: 1 },
              winningTrades: { $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] } },
              // Reason: only genuine losses (PnL < 0); breakeven trades excluded
              // so win rate / profit factor match the dashboard and profile.
              losingTrades: { $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] } },
              grossProfit: {
                $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
              },
              grossLoss: {
                $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, { $abs: "$realizedPnl" }, 0] },
              },
            },
          },
        ]).read("secondaryPreferred"),
      ]);

    // Build a map of TradeHistory-based stats per userId
    const tradeHistoryMap = new Map<
      string,
      { totalTrades: number; winningTrades: number; losingTrades: number; grossProfit: number; grossLoss: number }
    >();
    for (const row of tradeStatsByUser) {
      tradeHistoryMap.set(row._id, {
        totalTrades: row.totalTrades,
        winningTrades: row.winningTrades,
        losingTrades: row.losingTrades,
        grossProfit: row.grossProfit,
        grossLoss: row.grossLoss,
      });
    }

    // OPTIMIZATION: Pre-process badge counts into a Map (O(n) instead of repeated lookups)
    const badgeCounts = new Map<string, { total: number; legendary: number }>();
    for (const userBadge of allUserBadges) {
      if (!badgeCounts.has(userBadge.userId)) {
        badgeCounts.set(userBadge.userId, { total: 0, legendary: 0 });
      }
      const counts = badgeCounts.get(userBadge.userId)!;
      counts.total += 1;
      if (userBadge.badgeId.startsWith("legend_")) {
        counts.legendary += 1;
      }
    }

    // Group by userId - start with all users (even those with no history)
    const userStatsMap = new Map<
      string,
      {
        userId: string;
        email: string;
        username: string;
        profileImage?: string;
        totalPnl: number;
        totalCapital: number;
        competitionsEntered: number;
        competitionsWon: number;
        podiumFinishes: number;
        challengesEntered: number;
        challengesWon: number;
      }
    >();

    for (const user of usersToProcess) {
      if (!user.id || !user.email) continue;

      userStatsMap.set(user.id, {
        userId: user.id,
        email: user.email,
        username: user.name || user.email.split("@")[0] || "Unknown",
        profileImage: user.profileImage,
        totalPnl: 0,
        totalCapital: 0,
        competitionsEntered: 0,
        competitionsWon: 0,
        podiumFinishes: 0,
        challengesEntered: 0,
        challengesWon: 0,
      });
    }

    // Add competition stats (PnL, capital, comp/challenge counts)
    // Reason: totalTrades/winRate now come from TradeHistory (single source of truth).
    // Participant docs are only used for PnL, capital, comp/challenge enter/win counts.
    for (const participant of allCompetitionParticipants) {
      const userId = participant.userId;
      const userStats = userStatsMap.get(userId);
      if (!userStats) continue;

      userStats.totalPnl += participant.pnl || 0;
      userStats.totalCapital += participant.startingCapital || 0;
      userStats.competitionsEntered += 1;

      // Reason: Only count wins/podiums from COMPLETED competitions.
      // Active competitions have temporary ranks that shift — counting them
      // as "won" would be misleading and inconsistent with the dashboard.
      const isCompleted = (participant as Record<string, unknown>).status === "completed";
      if (isCompleted && participant.currentRank === 1) {
        userStats.competitionsWon += 1;
      }
      if (isCompleted && participant.currentRank && participant.currentRank <= 3) {
        userStats.podiumFinishes += 1;
      }
    }

    // Add challenge stats
    for (const participant of allChallengeParticipants) {
      const userId = participant.userId;
      const userStats = userStatsMap.get(userId);
      if (!userStats) continue;

      userStats.totalPnl += participant.pnl || 0;
      userStats.totalCapital += participant.startingCapital || 0;
      userStats.challengesEntered += 1;

      if (participant.isWinner) {
        userStats.challengesWon += 1;
      }
    }

    // Convert to leaderboard entries
    const leaderboardEntries: GlobalLeaderboardEntry[] = [];

    for (const [userId, stats] of userStatsMap.entries()) {
      // Reason: Use TradeHistory aggregate as SINGLE SOURCE OF TRUTH for totalTrades/winRate.
      // This ensures consistency with dashboard, profile, and admin views.
      const th = tradeHistoryMap.get(userId) || {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        grossProfit: 0,
        grossLoss: 0,
      };

      const winRate = computeWinRate(th.winningTrades, th.losingTrades);
      // Reason: shared helper — a flawless (no-loss) trader now gets the same
      // 999 sentinel shown on the dashboard/profile instead of 0.
      const profitFactor = computeProfitFactor(th.grossProfit, th.grossLoss);
      const totalPnlPercentage =
        stats.totalCapital > 0
          ? (stats.totalPnl / stats.totalCapital) * 100
          : 0;

      const badges = badgeCounts.get(userId) || { total: 0, legendary: 0 };

      const overallScore = calculateOverallScore({
        totalPnl: stats.totalPnl,
        totalPnlPercentage,
        winRate,
        profitFactor,
        competitionsWon: stats.competitionsWon,
        podiumFinishes: stats.podiumFinishes,
        challengesWon: stats.challengesWon,
        totalBadges: badges.total,
        legendaryBadges: badges.legendary,
      });

      leaderboardEntries.push({
        userId,
        email: stats.email,
        username: stats.username,
        profileImage: stats.profileImage,
        rank: 0,
        isTied: false,
        tiedWith: [],
        totalPnl: stats.totalPnl,
        totalPnlPercentage,
        totalTrades: th.totalTrades,
        winRate,
        profitFactor,
        competitionsEntered: stats.competitionsEntered,
        competitionsWon: stats.competitionsWon,
        podiumFinishes: stats.podiumFinishes,
        challengesEntered: stats.challengesEntered,
        challengesWon: stats.challengesWon,
        totalBadges: badges.total,
        legendaryBadges: badges.legendary,
        overallScore,
      });
    }

    // Sort by overall score (descending)
    leaderboardEntries.sort((a, b) => b.overallScore - a.overallScore);

    // Assign ranks with tie detection (single pass - no O(n²) tiedWith expansion)
    const epsilon = 0.0001;
    for (let i = 0; i < leaderboardEntries.length; i++) {
      const current = leaderboardEntries[i];
      if (i === 0) {
        current.rank = 1;
        current.isTied = false;
      } else {
        const previous = leaderboardEntries[i - 1];
        const isTied =
          Math.abs(current.overallScore - previous.overallScore) < epsilon;
        if (isTied) {
          current.rank = previous.rank;
          current.isTied = true;
          previous.isTied = true;
          if (!current.tiedWith) current.tiedWith = [];
          if (!previous.tiedWith) previous.tiedWith = [];
          current.tiedWith.push(previous.userId);
          previous.tiedWith.push(current.userId);
        } else {
          current.rank = i + 1;
          current.isTied = false;
        }
      }
    }

    // Cache entries without titles; API adds titles only for the requested page slice
    leaderboardCache = {
      data: leaderboardEntries,
      timestamp: Date.now(),
    };

    return limit > 0 ? leaderboardEntries.slice(0, limit) : leaderboardEntries;
  } catch (error) {
    console.error("Error getting global leaderboard:", error);
    return [];
  }
}

/**
 * Calculate overall score for ranking
 * Weighted formula considering multiple factors
 */
function calculateOverallScore(params: {
  totalPnl: number;
  totalPnlPercentage: number;
  winRate: number;
  profitFactor: number;
  competitionsWon: number;
  podiumFinishes: number;
  challengesWon: number;
  totalBadges: number;
  legendaryBadges: number;
}): number {
  const {
    totalPnl,
    totalPnlPercentage,
    winRate,
    profitFactor,
    competitionsWon,
    podiumFinishes,
    challengesWon,
    totalBadges,
    legendaryBadges,
  } = params;

  // Weighted scoring system
  const score =
    totalPnl * 0.3 + // 30% weight on absolute P&L
    totalPnlPercentage * 5 + // 25% weight on ROI (scaled)
    winRate * 2 + // 20% weight on win rate
    // Reason: cap profit factor before scoring so a no-loss trader's 999
    // sentinel cannot dominate the ranking (clamped to PROFIT_FACTOR_SCORE_CAP).
    clampProfitFactorForScore(profitFactor) * 10 + // 10% weight on profit factor
    competitionsWon * 50 + // 5% weight on competition wins
    podiumFinishes * 20 + // 5% weight on podiums
    challengesWon * 25 + // Weight on challenge wins
    totalBadges * 2 + // 3% weight on badges
    legendaryBadges * 10; // 2% weight on legendary badges

  return Math.max(0, score);
}

/**
 * Get user's global rank
 */
export async function getUserGlobalRank(userId: string): Promise<{
  rank: number;
  totalUsers: number;
  percentile: number;
}> {
  const leaderboard = await getGlobalLeaderboard(999999); // Get all
  const userEntry = leaderboard.find((entry) => entry.userId === userId);

  return {
    rank: userEntry?.rank || 0,
    totalUsers: leaderboard.length,
    percentile: userEntry
      ? ((leaderboard.length - userEntry.rank + 1) / leaderboard.length) * 100
      : 0,
  };
}

/**
 * Get current user's leaderboard position
 */
export async function getMyLeaderboardPosition() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return null;
  }

  const userId = session.user.id;
  return getUserGlobalRank(userId);
}
