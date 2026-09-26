import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { calculateRankings } from "@/lib/services/competition-ranking.service";
import { getUsersWithTitles } from "@/lib/services/xp-level.service";
import { getTitleLevels } from "@/lib/services/xp-config.service";
import { resolveLevelTitle } from "@/lib/utils/level-title";
import { getContestActivity } from "./contest-activity.service";
import { resolveLiveDisplayScores } from "./live-display-score.service";
import {
  attachArenaBoardExtras,
  type WithProfileImage,
} from "./leaderboard-avatars";
import type { RoundActivitySummary } from "@/lib/utils/round-activity";

/**
 * Everything the arena's standings rail AND its contest sidebar need after the page loads.
 *
 * WHY IT IS A SERVICE RATHER THAN TWO READS IN THE PAGE. The arena renders once on the server,
 * then hosts a live round in an iframe - so making the board live means a second reader, and a
 * second reader is where two screens start disagreeing. The page and the polling route call
 * THIS, so there is one composition and the figure a player sees five seconds later is produced
 * by the same code that drew the first one.
 *
 * 26 SEP 2026 — THREE FACTS TRAVEL TOGETHER. The poll used to refresh only the ranked rows.
 * Joins and prize redistribution sat on server props and went stale until a full reload. The
 * contest snapshot below is the same document both of those panels already read, so one fetch
 * keeps the players count, the prize floor and the board in agreement.
 *
 * LIVE RANKING uses `resolveLiveDisplayScores`: finished rounds via `rawScore`, open rounds via
 * optional `provisionalScore` from progress. Never from `scoreBreakdown` keys - that would be
 * per-game code. Settlement still ignores provisional entirely.
 */

export interface ArenaFeedEntry {
  userId: string;
  username?: string;
  activity: RoundActivitySummary;
}

export interface ArenaContestSnapshot {
  currentParticipants: number;
  maxParticipants?: number;
  prizePool?: number;
  prizePoolCredits?: number;
  entryFee?: number;
  platformFeePercentage?: number;
  prizeDistribution?: { percentage: number; rank?: number }[];
}

export interface ArenaStandingsRow {
  userId: string;
  username: string;
  score?: number;
  currentRank: number;
  isTied?: boolean;
  tiedWith?: string[];
  qualificationStatus?: string;
  disqualificationReason?: string;
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
  enteredAt?: Date | string;
  status?: string;
}

export interface ArenaStandings {
  rows: (ArenaStandingsRow & WithProfileImage)[];
  activity: Record<string, RoundActivitySummary>;
  feed: ArenaFeedEntry[];
  countries: Record<string, string>;
  yourRank?: number;
  /**
   * Pot / seats / prize shares as stored right now. The prize table and contest-info tiles
   * consume this so a join mid-contest redistributes without a page reload.
   */
  contest: ArenaContestSnapshot;
}

export async function getArenaStandings(
  competitionId: string,
  userId: string,
  options?: { limit?: number; recentLimit?: number },
): Promise<ArenaStandings> {
  const limit = options?.limit ?? 25;
  const recentLimit = options?.recentLimit ?? 6;

  const competition = (await Competition.findById(competitionId)
    .select(
      "rules status gameType gameKey currentParticipants maxParticipants prizePool prizePoolCredits entryFee platformFeePercentage prizeDistribution",
    )
    .lean()) as {
    rules?: Record<string, unknown>;
    status: string;
    gameType?: string;
    gameKey?: string;
    currentParticipants?: number;
    maxParticipants?: number;
    prizePool?: number;
    prizePoolCredits?: number;
    entryFee?: number;
    platformFeePercentage?: number;
    prizeDistribution?: { percentage: number; rank?: number }[];
  } | null;

  const emptyContest: ArenaContestSnapshot = { currentParticipants: 0 };

  if (!competition) {
    return {
      rows: [],
      activity: {},
      feed: [],
      countries: {},
      contest: emptyContest,
    };
  }

  const contest: ArenaContestSnapshot = {
    currentParticipants: competition.currentParticipants ?? 0,
    maxParticipants: competition.maxParticipants,
    prizePool: competition.prizePool,
    prizePoolCredits: competition.prizePoolCredits,
    entryFee: competition.entryFee,
    platformFeePercentage: competition.platformFeePercentage,
    prizeDistribution: competition.prizeDistribution,
  };

  const participants = await CompetitionParticipant.find({
    competitionId,
  })
    .select(
      "userId username currentCapital pnl pnlPercentage totalTrades winningTrades losingTrades status enteredAt startingCapital score",
    )
    .lean();

  const { byUser: liveScores, scoreDirection } =
    await resolveLiveDisplayScores(competitionId);

  const participantData = participants.map((p) => {
    const live = liveScores.get(p.userId);
    // Prefer the live effective score when anything has been scored (finished or provisional).
    // Fall back to the stored seat score so a title that never sends progress still ranks
    // after rounds complete. Absent stays absent - never coerce to 0 (R50).
    const score =
      live?.score !== undefined
        ? live.score
        : typeof p.score === "number" && Number.isFinite(p.score)
          ? p.score
          : undefined;

    return {
      userId: p.userId,
      username: p.username || "Anonymous",
      currentCapital: p.currentCapital,
      pnl: p.pnl,
      pnlPercentage: p.pnlPercentage,
      totalTrades: p.totalTrades,
      winningTrades: p.winningTrades,
      losingTrades: p.losingTrades,
      winRate:
        p.totalTrades > 0 ? (p.winningTrades / p.totalTrades) * 100 : 0,
      status: p.status,
      enteredAt: p.enteredAt,
      startingCapital: p.startingCapital,
      score,
      scoreDirection:
        competition.gameType === "provider" ? scoreDirection : undefined,
    };
  });

  const rules = (competition.rules as Record<string, unknown>) || {
    rankingMethod: "pnl" as const,
    tieBreaker1: "trades_count" as const,
    minimumTrades: 0,
    tiePrizeDistribution: "split_equally" as const,
    disqualifyOnLiquidation: true,
  };

  const rankedParticipants = calculateRankings(participantData, rules as never, {
    competitionStatus: competition.status as
      | "upcoming"
      | "active"
      | "completed"
      | "cancelled",
    gameType: competition.gameType,
  });

  const limited = rankedParticipants.slice(0, limit);
  const userIds = limited.map((p) => p.userId);
  const userLevels = await getUsersWithTitles(userIds);
  const ladder = await getTitleLevels();

  const participantMap = new Map(participants.map((p) => [p.userId, p]));

  // Caller's rank from the FULL board, not the truncated list - otherwise anyone outside
  // the top `limit` silently loses their rank tile while still appearing in activity.
  const yourRank = rankedParticipants.find((p) => p.userId === userId)?.rank;

  const ranked: ArenaStandingsRow[] = limited.map((p) => {
    const original = participantMap.get(p.userId);
    const titleLevel = resolveLevelTitle(userLevels.get(p.userId), ladder);
    const live = liveScores.get(p.userId);
    const score =
      live?.score !== undefined
        ? live.score
        : typeof original?.score === "number"
          ? original.score
          : p.score;

    return {
      userId: p.userId,
      username: p.username,
      score,
      currentRank: p.rank,
      isTied: p.isTied,
      tiedWith: p.tiedWith,
      qualificationStatus: p.qualificationStatus,
      disqualificationReason: p.disqualificationReason,
      userTitle: titleLevel.title,
      userTitleIcon: titleLevel.icon,
      userTitleColor: titleLevel.color,
      enteredAt: original?.enteredAt,
      status: original?.status,
    };
  });

  // JSON round-trip matches getCompetitionLeaderboard's serialisation so Date fields stay
  // strings on both the first render and every poll - disagreement there reads as flicker.
  const serialised = JSON.parse(JSON.stringify(ranked)) as ArenaStandingsRow[];

  const { rows, countries } = await attachArenaBoardExtras(serialised);

  const activity = await getContestActivity(
    competitionId,
    rows.map((row) => row.userId),
    { recentLimit },
  );

  const nameByUser = new Map(rows.map((row) => [row.userId, row.username]));

  return {
    rows,
    activity: activity.latestByUser,
    feed: activity.recent.map((entry) => ({
      userId: entry.userId,
      username: nameByUser.get(entry.userId),
      activity: entry,
    })),
    countries,
    yourRank,
    contest,
  };
}
