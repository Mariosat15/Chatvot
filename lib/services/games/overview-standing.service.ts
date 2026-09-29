/**
 * Overview standing — Global board rank, contest win rate, play-by-game cards.
 *
 * Main-app only. Never calls `getEnabledGameTypes()` for stats (R29).
 * Global Rank comes from `getGlobalBoard` (seven-component board), not the
 * legacy trading-shaped `getUserGlobalRank`.
 */

import { TRADING_GAME_TYPE } from "@/lib/games/types";
import { getGlobalBoard } from "@/lib/services/leaderboard/global-board.service";
import {
  listBrowsableGames,
  type BrowsableGame,
} from "@/lib/services/games/player-catalogue.service";
import type { PlayerGameProfile } from "@/lib/services/games/player-game-stats.service";
import { overviewPlayCardArt } from "@/lib/services/games/overview-assets";
import {
  OVERVIEW_MISSION_LIMIT,
  OVERVIEW_PLAY_CARD_LIMIT,
  type OverviewActivityItem,
  type OverviewMission,
  type OverviewPlayCard,
  type OverviewStanding,
} from "@/lib/services/games/overview-types";
import { resolveOverviewRankBadge, OVERVIEW_RANK_TOP_N } from "@/lib/utils/overview-rank-badge";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import GameRound from "@/database/models/games/game-round.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { SCORE_PRODUCING_ROUND_STATUSES } from "@/lib/services/games/round-types";
import { calculateMilestoneProgress } from "@/lib/services/journey-progress.service";

export {
  OVERVIEW_MISSION_LIMIT,
  OVERVIEW_PLAY_CARD_LIMIT,
  type OverviewActivityItem,
  type OverviewMission,
  type OverviewPlayCard,
  type OverviewStanding,
} from "@/lib/services/games/overview-types";

function activityLabelFor(game: {
  isTrading: boolean;
  gameCode?: string;
}): string {
  if (game.isTrading) return "Trades";
  const code = (game.gameCode ?? "").toLowerCase();
  if (code.includes("sprint") || code.includes("race")) return "Races";
  return "Runs";
}

/**
 * Best score shown on a Play-by-Game card.
 *
 * Provider games prefer stored `bestScore`; when that is still zero (legacy
 * seats / missing sync) fall back to `totalPoints`. Trading has no provider
 * score — use totalPoints. Round maxes are merged in by the caller.
 */
export function resolvePlayCardBestScore(
  row: {
    isTrading?: boolean;
    gameKey: string;
    bestScore?: number;
    totalPoints?: number;
  },
  roundBest?: number | null,
): number | null {
  const isTrading = row.isTrading || row.gameKey === TRADING_GAME_TYPE;
  const stored =
    typeof row.bestScore === "number" && Number.isFinite(row.bestScore)
      ? row.bestScore
      : 0;
  const points =
    typeof row.totalPoints === "number" && Number.isFinite(row.totalPoints)
      ? row.totalPoints
      : 0;
  const fromRound =
    typeof roundBest === "number" && Number.isFinite(roundBest) && roundBest > 0
      ? roundBest
      : 0;

  if (isTrading) {
    const n = Math.max(points, fromRound);
    return n > 0 ? n : null;
  }
  const n = Math.max(stored, points, fromRound);
  return n > 0 ? n : null;
}

/**
 * Max rawScore per gameKey for this player from scored rounds.
 * Complements UserGameStats.bestScore when that field was never stamped.
 */
async function loadRoundBestScores(
  userId: string,
  gameKeys: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (gameKeys.length === 0) return out;
  try {
    const rows = await GameRound.aggregate<{
      _id: string;
      best: number;
    }>([
      {
        $match: {
          userId,
          gameKey: { $in: gameKeys },
          status: { $in: [...SCORE_PRODUCING_ROUND_STATUSES] },
          rawScore: { $type: "number" },
        },
      },
      {
        $group: {
          _id: "$gameKey",
          // Reason: live catalogue titles are higher-is-better; lower-is-better
          // titles still prefer UserGameStats.bestScore when stamped correctly.
          best: { $max: "$rawScore" },
        },
      },
    ]);
    for (const row of rows) {
      if (typeof row.best === "number" && Number.isFinite(row.best)) {
        out.set(row._id, row.best);
      }
    }
  } catch {
    /* fail soft — cards still render with stored bestScore */
  }
  return out;
}

/**
 * Resolve card art the same way `/games` cards do: admin banner, then thumbnail,
 * then neon fallback. Never invents per-title art in Overview code.
 */
function resolvePlayArt(cat: BrowsableGame | undefined, isTrading: boolean): string {
  const banner = cat?.bannerUrl?.trim();
  if (banner) return banner;
  const thumb = cat?.thumbnailUrl?.trim();
  if (thumb) return thumb;
  return overviewPlayCardArt(cat?.gameCode, isTrading);
}

/**
 * Top N games this player has played, ranked by contests entered.
 *
 * When the player has not played anything yet, fall back to the first N
 * catalogue titles by featured + sortOrder (discovery order) so the row is
 * never an empty dead end. Once they have play history, only played titles
 * appear — new catalogue games do not crowd the strip forever.
 */
export function buildTopPlayCards(
  standing: PlayerGameProfile,
  catalogue: BrowsableGame[],
  limit: number = OVERVIEW_PLAY_CARD_LIMIT,
  roundBests: Map<string, number> = new Map(),
): OverviewPlayCard[] {
  const byKey = new Map(catalogue.map((g) => [g.gameKey, g]));
  const cap = Math.max(0, limit);

  const ranked = [...standing.perGame]
    .filter((row) => (row.contestsEntered ?? 0) > 0 || (row.contestsCompleted ?? 0) > 0)
    .sort((a, b) => {
      const entered = (b.contestsEntered ?? 0) - (a.contestsEntered ?? 0);
      if (entered !== 0) return entered;
      const completed = (b.contestsCompleted ?? 0) - (a.contestsCompleted ?? 0);
      if (completed !== 0) return completed;
      const aAt = a.lastPlayedAt ? Date.parse(a.lastPlayedAt) : 0;
      const bAt = b.lastPlayedAt ? Date.parse(b.lastPlayedAt) : 0;
      return bAt - aAt;
    })
    .slice(0, cap);

  if (ranked.length > 0) {
    return ranked.map((row) => {
      const cat = byKey.get(row.gameKey);
      const isTrading = row.isTrading || row.gameKey === TRADING_GAME_TYPE;
      const slug = cat?.slug ?? (isTrading ? TRADING_GAME_TYPE : row.gameKey);
      const gameCode = cat?.gameCode;
      return {
        gameKey: row.gameKey,
        slug,
        label: cat?.displayName ?? row.label,
        tagline: cat?.tagline,
        isTrading,
        gameCode,
        href: `/games/${slug}`,
        artSrc: resolvePlayArt(cat, isTrading),
        contestsEntered: row.contestsEntered,
        contestsCompleted: row.contestsCompleted,
        wins: row.wins,
        bestRank: row.bestRank,
        bestScore: resolvePlayCardBestScore(row, roundBests.get(row.gameKey)),
        activityLabel: activityLabelFor({ isTrading, gameCode }),
      };
    });
  }

  // Discovery fallback — catalogue order (featured first, then sortOrder).
  const discovery = [...catalogue]
    .sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, cap);

  return discovery.map((cat) => {
    const isTrading = cat.kind === "trading" || cat.gameKey === TRADING_GAME_TYPE;
    return {
      gameKey: cat.gameKey,
      slug: cat.slug,
      label: cat.displayName,
      tagline: cat.tagline,
      isTrading,
      gameCode: cat.gameCode,
      href: `/games/${cat.slug}`,
      artSrc: resolvePlayArt(cat, isTrading),
      contestsEntered: 0,
      contestsCompleted: 0,
      wins: 0,
      bestRank: 0,
      bestScore: null,
      activityLabel: activityLabelFor({
        isTrading,
        gameCode: cat.gameCode,
      }),
    };
  });
}

async function loadMissions(userId: string): Promise<{
  journeyMapName: string;
  journeyMilestonesDone: number;
  journeyMilestonesTotal: number;
  missions: OverviewMission[];
}> {
  const empty = {
    journeyMapName: "",
    journeyMilestonesDone: 0,
    journeyMilestonesTotal: 0,
    missions: [] as OverviewMission[],
  };
  try {
    // Reason: one user can have many progress rows (one per map). Prefer the
    // incomplete map with the highest sequence index — that is the live map.
    let progress = await UserJourneyProgress.findOne({
      userId,
      isMapComplete: { $ne: true },
    })
      .sort({ currentMapIndex: -1, updatedAt: -1 })
      .lean();
    if (!progress) {
      progress = await UserJourneyProgress.findOne({ userId })
        .sort({ currentMapIndex: -1, updatedAt: -1 })
        .lean();
    }
    if (!progress?.mapId) return empty;

    const mapId = String(progress.mapId);
    const mapConfig = await JourneyMapConfig.findOne({ mapId })
      .select("name mapId")
      .lean();
    const journeyMapName =
      (mapConfig as { name?: string } | null)?.name?.trim() || mapId;

    const done = new Set(
      (
        (progress as { completedMilestones?: { milestoneId: string }[] })
          .completedMilestones ?? []
      ).map((m) => m.milestoneId),
    );
    const unlocked = new Set(
      (progress as { unlockedMilestones?: string[] }).unlockedMilestones ?? [],
    );

    const allActive = await JourneyMilestone.find({
      mapId,
      isActive: true,
    })
      .select("id name description icon rewards order")
      .sort({ order: 1 })
      .lean();

    const journeyMilestonesTotal = allActive.length;
    const journeyMilestonesDone = allActive.filter((m) =>
      done.has((m as { id: string }).id),
    ).length;

    const openRows = (
      allActive as Array<{
        id: string;
        name?: string;
        description?: string;
        icon?: string;
        rewards?: { xp?: number };
      }>
    ).filter((m) => !done.has(m.id));

    // Reason: unlocked incomplete first (what the player can do now), then the
    // next locked steps in map order — still the genuine journey sequence.
    const unlockedOpen = openRows.filter((m) => unlocked.has(m.id));
    const lockedOpen = openRows.filter((m) => !unlocked.has(m.id));
    const next = [...unlockedOpen, ...lockedOpen].slice(0, OVERVIEW_MISSION_LIMIT);

    const progressRows = await calculateMilestoneProgress(userId, mapId).catch(
      () => [] as Array<{ milestoneId: string; currentValue: number; targetValue: number }>,
    );
    const byId = new Map(progressRows.map((r) => [r.milestoneId, r]));

    return {
      journeyMapName,
      journeyMilestonesDone,
      journeyMilestonesTotal,
      missions: next.map((m) => {
        const p = byId.get(m.id);
        const target = Math.max(1, p?.targetValue ?? 1);
        const current = Math.min(target, Math.max(0, p?.currentValue ?? 0));
        return {
          id: m.id,
          name: m.name || m.id,
          description:
            (m.description || "").trim() ||
            `Next milestone on ${journeyMapName}`,
          icon: m.icon || "🎯",
          xp: m.rewards?.xp ?? 0,
          current,
          target,
        };
      }),
    };
  } catch {
    return empty;
  }
}

function weekWindows(now = Date.now()): { thisWeek: Date; lastWeek: Date } {
  const day = 24 * 60 * 60 * 1000;
  return {
    thisWeek: new Date(now - 7 * day),
    lastWeek: new Date(now - 14 * day),
  };
}

function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

async function loadKpiWeekDelta(userId: string): Promise<OverviewStanding["kpiWeekDelta"]> {
  const empty = { credits: null, winRate: null, roi: null, prizes: null };
  try {
    const { thisWeek, lastWeek } = weekWindows();

    const [txThis, txPrev, seats] = await Promise.all([
      WalletTransaction.aggregate<{ net: number }>([
        {
          $match: {
            userId,
            createdAt: { $gte: thisWeek },
          },
        },
        { $group: { _id: null, net: { $sum: "$amount" } } },
      ]).catch(() => [] as { net: number }[]),
      WalletTransaction.aggregate<{ net: number }>([
        {
          $match: {
            userId,
            createdAt: { $gte: lastWeek, $lt: thisWeek },
          },
        },
        { $group: { _id: null, net: { $sum: "$amount" } } },
      ]).catch(() => [] as { net: number }[]),
      CompetitionParticipant.find({
        userId,
        status: "completed",
        updatedAt: { $gte: lastWeek },
      })
        .select("prizeWon isWinner updatedAt")
        .lean()
        .catch(() => []),
    ]);

    const credits = pctDelta(
      txThis[0]?.net ?? 0,
      txPrev[0]?.net ?? 0,
    );

    const seatRows = seats as Array<{
      prizeWon?: number;
      isWinner?: boolean;
      updatedAt?: Date;
    }>;
    const inThis = seatRows.filter(
      (s) => s.updatedAt && s.updatedAt >= thisWeek,
    );
    const inPrev = seatRows.filter(
      (s) => s.updatedAt && s.updatedAt >= lastWeek && s.updatedAt < thisWeek,
    );

    const prizeThis = inThis.reduce((n, s) => n + (s.prizeWon || 0), 0);
    const prizePrev = inPrev.reduce((n, s) => n + (s.prizeWon || 0), 0);
    const prizes = pctDelta(prizeThis, prizePrev);

    const rate = (rows: typeof inThis) => {
      if (rows.length === 0) return null;
      const wins = rows.filter((s) => s.isWinner).length;
      return (wins / rows.length) * 100;
    };
    const winThis = rate(inThis);
    const winPrev = rate(inPrev);
    const winRate =
      winThis == null || winPrev == null ? null : pctDelta(winThis, winPrev);

    // ROI has no honest week series on Overview — leave null rather than invent.
    return { credits, winRate, roi: null, prizes };
  } catch {
    return empty;
  }
}

async function loadRecentContestActivity(
  userId: string,
): Promise<OverviewActivityItem[]> {
  try {
    const seats = await CompetitionParticipant.find({
      userId,
      status: { $in: ["completed", "active"] },
    })
      .select("competitionId currentRank prizeWon isWinner updatedAt score gameKey")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    return (seats as Array<{
      _id: { toString(): string };
      currentRank?: number;
      prizeWon?: number;
      isWinner?: boolean;
      updatedAt?: Date;
      score?: number;
      gameKey?: string;
    }>).map((s) => {
      const rank = s.currentRank && s.currentRank > 0 ? `#${s.currentRank}` : null;
      const prize =
        typeof s.prizeWon === "number" && s.prizeWon > 0
          ? `+${Math.round(s.prizeWon)} ⚡`
          : null;
      const score =
        typeof s.score === "number" && Number.isFinite(s.score)
          ? `Score: ${Math.round(s.score).toLocaleString()}`
          : null;
      const detail =
        [rank ? `Rank ${rank}` : null, prize, score].filter(Boolean).join(" · ") ||
        "Contest result";
      return {
        id: s._id.toString(),
        title: s.isWinner
          ? "Won a contest"
          : rank
            ? `Contest finish (${rank})`
            : "Contest finish",
        detail,
        at: (s.updatedAt ?? new Date()).toISOString(),
        kind: "contest" as const,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Assemble Overview-only facts. Call beside the existing dashboard payload —
 * does not replace wallet KPIs or trading chrome.
 */
export async function getOverviewStanding(opts: {
  userId: string;
  gameStanding: PlayerGameProfile;
}): Promise<OverviewStanding> {
  const { userId, gameStanding } = opts;

  const playedKeys = gameStanding.perGame
    .filter((row) => (row.contestsEntered ?? 0) > 0 || (row.contestsCompleted ?? 0) > 0)
    .map((row) => row.gameKey);

  const [board, catalogue, missionPack, contestActivity, roundBests, kpiWeekDelta] =
    await Promise.all([
      getGlobalBoard({ viewerUserId: userId, limit: OVERVIEW_RANK_TOP_N }).catch(
        () => ({
          entries: [],
          totalCount: 0,
          page: 1,
          limit: OVERVIEW_RANK_TOP_N,
          weights: [],
          myPosition: { rank: 0, totalUsers: 0, percentile: 0 },
        }),
      ),
      listBrowsableGames().catch(() => [] as BrowsableGame[]),
      loadMissions(userId),
      loadRecentContestActivity(userId),
      loadRoundBestScores(userId, playedKeys),
      loadKpiWeekDelta(userId),
    ]);

  const overall = gameStanding.overall;
  const completed = overall?.contestsCompleted ?? 0;
  const wins = overall?.wins ?? 0;
  const contestWinRate =
    completed > 0 ? Math.round((wins / completed) * 1000) / 10 : null;

  return {
    globalRank: resolveOverviewRankBadge(board.myPosition.rank),
    totalUsers: board.myPosition.totalUsers,
    contestWinRate,
    playCards: buildTopPlayCards(gameStanding, catalogue, OVERVIEW_PLAY_CARD_LIMIT, roundBests),
    journeyMapName: missionPack.journeyMapName,
    journeyMilestonesDone: missionPack.journeyMilestonesDone,
    journeyMilestonesTotal: missionPack.journeyMilestonesTotal,
    missions: missionPack.missions,
    recentActivity: contestActivity,
    kpiWeekDelta,
    streaks: {
      podiumStreak: overall?.currentStreak ?? 0,
      bestStreak: overall?.bestStreak ?? 0,
      contestWins: wins,
      contestsPlayed: completed,
      topThreeFinishes: overall?.podiums ?? 0,
      // Reason: no per-day activity ledger for games yet; ~4 finishes ≈ a busy week.
      weeksActive: completed > 0 ? Math.max(1, Math.ceil(completed / 4)) : 0,
    },
  };
}
