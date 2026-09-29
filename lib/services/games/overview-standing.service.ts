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
  OVERVIEW_RANK_TOP_N,
  resolveOverviewRankBadge,
  type OverviewRankBadge,
} from "@/lib/utils/overview-rank-badge";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";

/** Cap on Play-by-Game cards — top N most-played only (owner, 29 Sep 2026). */
export const OVERVIEW_PLAY_CARD_LIMIT = 4;

export interface OverviewPlayCard {
  gameKey: string;
  slug: string;
  label: string;
  /** Catalogue tagline when present — shown under the title. */
  tagline?: string;
  isTrading: boolean;
  gameCode?: string;
  href: string;
  /**
   * Artwork from the game page catalogue (banner, then thumbnail), same source
   * as `/games` cards. Neon fallback only when the title has no admin art yet.
   */
  artSrc: string;
  contestsEntered: number;
  contestsCompleted: number;
  wins: number;
  bestRank: number;
  /**
   * Provider games: stored bestScore. Trading: totalPoints (no provider score).
   * Null only when both are absent/zero — UI shows a dash.
   */
  bestScore: number | null;
  /** Free-text unit for the activity count ("Trades" / "Races" / "Runs"). */
  activityLabel: string;
}

export interface OverviewMission {
  id: string;
  name: string;
  icon: string;
  xp: number;
  /** 0..target; when target is 0 the bar is empty. */
  current: number;
  target: number;
}

export interface OverviewActivityItem {
  id: string;
  title: string;
  detail: string;
  at: string;
  kind: "contest" | "trade" | "milestone";
}

export interface OverviewStanding {
  globalRank: OverviewRankBadge;
  totalUsers: number;
  /** Contest win rate across every game including trading contests; null if none completed. */
  contestWinRate: number | null;
  playCards: OverviewPlayCard[];
  missions: OverviewMission[];
  recentActivity: OverviewActivityItem[];
  streaks: {
    /** Consecutive top-3 finishes across every game including trading contests. */
    podiumStreak: number;
    /** Longest podium streak ever on `_overall`. */
    bestStreak: number;
    /** Contest wins (rank 1) across every game. */
    contestWins: number;
    /** Contests completed across every game. */
    contestsPlayed: number;
    /** Top-3 finishes across every game. */
    topThreeFinishes: number;
    /**
     * Coarse activity weeks hint from completed contests — not calendar weeks.
     * Agnostic: no trading-day / profitable-day metric.
     */
    weeksActive: number;
  };
}

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
 * Top N games this player has actually played, ranked by contests entered.
 *
 * Unplayed catalogue titles are NOT listed — more titles would crowd the row
 * forever. Zero-play players see an empty strip (GettingStarted / Games hub
 * cover discovery). Art always comes from the catalogue row when present.
 */
export function buildTopPlayCards(
  standing: PlayerGameProfile,
  catalogue: BrowsableGame[],
  limit: number = OVERVIEW_PLAY_CARD_LIMIT,
): OverviewPlayCard[] {
  const byKey = new Map(catalogue.map((g) => [g.gameKey, g]));

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
    .slice(0, Math.max(0, limit));

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
      bestScore: isTrading
        ? row.totalPoints > 0
          ? row.totalPoints
          : null
        : row.bestScore > 0
          ? row.bestScore
          : null,
      activityLabel: activityLabelFor({ isTrading, gameCode }),
    };
  });
}

async function loadMissions(userId: string): Promise<OverviewMission[]> {
  try {
    const progress = await UserJourneyProgress.findOne({ userId })
      .select("completedMilestones currentMapIndex")
      .lean();
    if (!progress) return [];

    const mapConfig = await JourneyMapConfig.findOne({
      isActive: true,
      sequenceOrder: (progress as { currentMapIndex?: number }).currentMapIndex || 1,
    })
      .select("mapId")
      .lean();
    if (!mapConfig) return [];

    const done = new Set(
      (
        (progress as { completedMilestones?: { milestoneId: string }[] })
          .completedMilestones ?? []
      ).map((m) => m.milestoneId),
    );

    const open = await JourneyMilestone.find({
      mapId: (mapConfig as { mapId: string }).mapId,
      isActive: true,
      id: { $nin: [...done] },
    })
      .select("id name icon rewards order")
      .sort({ order: 1 })
      .limit(2)
      .lean();

    return (open as Array<{
      id: string;
      name?: string;
      icon?: string;
      rewards?: { xp?: number };
    }>).map((m) => ({
      id: m.id,
      name: m.name || m.id,
      icon: m.icon || "🎯",
      xp: m.rewards?.xp ?? 0,
      // Journey milestones are binary for Overview — incomplete until claimed.
      current: 0,
      target: 1,
    }));
  } catch {
    return [];
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
      const rank = s.currentRank && s.currentRank > 0 ? `#${s.currentRank}` : "—";
      const prize =
        typeof s.prizeWon === "number" && s.prizeWon > 0
          ? ` · ${s.prizeWon} ⚡`
          : "";
      return {
        id: s._id.toString(),
        title: s.isWinner ? "Contest win" : "Contest finish",
        detail: `Rank ${rank}${prize}`,
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

  const [board, catalogue, missions, contestActivity] = await Promise.all([
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
    playCards: buildTopPlayCards(gameStanding, catalogue),
    missions,
    recentActivity: contestActivity,
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
