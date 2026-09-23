/**
 * Per-game challenge matchmaking (X11.5). Ranking uses `UserGameStats.rating` for
 * the matched gameKey - never overall standing (X16). Trading keep using the
 * leaderboard path in `matchmaking.service.ts`.
 *
 * Consent: candidates must have acceptingChallenges AND not have opted out of
 * this game. Inference alone does not put anyone on this list as an invitee -
 * willingness defaults to true only when no row exists; a stored false excludes.
 */
import { connectToDatabase } from "@/database/mongoose";
import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import UserGamePreference from "@/database/models/games/user-game-preference.model";
import UserPresence from "@/database/models/user-presence.model";
import BlockedUser from "@/database/models/messaging/blocked-user.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";
import {
  indexWillingness,
  isWillingToBeChallengedAt,
} from "@/lib/services/games/challenge-willingness";
import type {
  MatchResult,
  MatchableTrader,
} from "@/lib/services/matchmaking.service";
// Type-only import - no runtime cycle with matchmaking.service.ts which calls us.

function ratingProximityScore(
  a: number,
  b: number,
): { score: number; reasons: string[] } {
  const diff = Math.abs(a - b);
  const reasons: string[] = [];
  // 100 points at equal rating; lose 1 point per 10 rating apart, floor at 0.
  let score = Math.max(0, 100 - diff / 10);
  if (diff <= 50) reasons.push("Closely matched skill");
  else if (diff <= 150) reasons.push("Comparable skill");
  else reasons.push("Same game experience");
  return { score, reasons };
}

function toMatchable(
  userId: string,
  profile: { username?: string; email?: string; profileImage?: string },
  rating: number,
  presence: { isOnline: boolean; acceptingChallenges: boolean },
  contestsCompleted: number,
): MatchableTrader {
  const level =
    contestsCompleted < 3
      ? "beginner"
      : contestsCompleted < 10
        ? "intermediate"
        : contestsCompleted < 25
          ? "advanced"
          : contestsCompleted < 50
            ? "expert"
            : "master";

  return {
    userId,
    email: profile.email ?? "",
    username: profile.username ?? "Player",
    profileImage: profile.profileImage,
    level,
    winRate: 0,
    totalTrades: 0,
    totalPnl: 0,
    totalPnlPercentage: 0,
    profitFactor: 0,
    competitionsEntered: contestsCompleted,
    competitionsWon: 0,
    challengesEntered: 0,
    challengesWon: 0,
    totalBadges: 0,
    legendaryBadges: 0,
    overallScore: rating,
    isOnline: presence.isOnline,
    acceptingChallenges: presence.acceptingChallenges,
  };
}

/**
 * Ranked opponents for a specific game. Empty when the caller has no stats for
 * that game yet - we do not invent a rating.
 */
export async function getRankedGameMatches(
  currentUserId: string,
  gameKey: string,
  limit = 50,
): Promise<MatchResult[]> {
  const key = gameKey.trim();
  if (!key || key === OVERALL_GAME_KEY) return [];

  await connectToDatabase();

  const myStats = await UserGameStats.findOne({
    userId: currentUserId,
    gameKey: key,
  })
    .select("rating contestsCompleted")
    .lean<{ rating?: number; contestsCompleted?: number } | null>();

  if (!myStats) return [];

  const myRating = typeof myStats.rating === "number" ? myStats.rating : 1200;

  const candidates = await UserGameStats.find({
    gameKey: key,
    userId: { $ne: currentUserId },
    contestsCompleted: { $gte: 1 },
  })
    .select("userId rating contestsCompleted")
    .limit(Math.max(limit * 4, 80))
    .lean<
      Array<{
        userId: string;
        rating?: number;
        contestsCompleted?: number;
      }>
    >();

  if (candidates.length === 0) return [];

  const userIds = candidates.map((c) => c.userId);

  const [presenceRows, preferenceRows, blocks, profiles] = await Promise.all([
    UserPresence.find({ userId: { $in: userIds } })
      .select("userId status acceptingChallenges")
      .lean<
        Array<{
          userId: string;
          status?: string;
          acceptingChallenges?: boolean;
        }>
      >(),
    UserGamePreference.find({
      userId: { $in: userIds },
      gameKey: key,
    })
      .select("userId willingToBeChallenged")
      .lean<Array<{ userId: string; willingToBeChallenged?: boolean }>>(),
    BlockedUser.find({
      $or: [
        { blockerUserId: currentUserId, blockedUserId: { $in: userIds } },
        { blockedUserId: currentUserId, blockerUserId: { $in: userIds } },
      ],
    })
      .select("blockerUserId blockedUserId")
      .lean<Array<{ blockerUserId: string; blockedUserId: string }>>(),
    getUsersByIds(userIds),
  ]);

  const presenceMap = new Map(presenceRows.map((p) => [p.userId, p]));
  const prefsByUser = new Map<string, Map<string, boolean>>();
  for (const row of preferenceRows) {
    prefsByUser.set(
      row.userId,
      indexWillingness([
        {
          gameKey: key,
          willingToBeChallenged: row.willingToBeChallenged !== false,
        },
      ]),
    );
  }

  const blocked = new Set<string>();
  for (const b of blocks) {
    if (b.blockerUserId === currentUserId) blocked.add(b.blockedUserId);
    if (b.blockedUserId === currentUserId) blocked.add(b.blockerUserId);
  }

  const matches: MatchResult[] = [];

  for (const candidate of candidates) {
    if (blocked.has(candidate.userId)) continue;

    const presence = presenceMap.get(candidate.userId);
    const accepting = presence?.acceptingChallenges !== false;
    if (!accepting) continue;

    const willingnessMap =
      prefsByUser.get(candidate.userId) ?? new Map<string, boolean>();
    if (!isWillingToBeChallengedAt(willingnessMap, key)) continue;

    const rating =
      typeof candidate.rating === "number" ? candidate.rating : 1200;
    const { score, reasons } = ratingProximityScore(myRating, rating);
    const profile = profiles.get(candidate.userId);
    const trader = toMatchable(
      candidate.userId,
      {
        username: profile?.name,
        email: profile?.email,
        profileImage: profile?.profileImage,
      },
      rating,
      {
        isOnline: presence?.status === "online",
        acceptingChallenges: accepting,
      },
      candidate.contestsCompleted ?? 0,
    );

    if (trader.isOnline && trader.acceptingChallenges) {
      reasons.push("Online & ready");
    }

    matches.push({
      trader: { ...trader, matchScore: score },
      matchScore: score,
      matchReasons: reasons,
    });
  }

  matches.sort((a, b) => b.matchScore - a.matchScore);
  return matches.slice(0, limit);
}
