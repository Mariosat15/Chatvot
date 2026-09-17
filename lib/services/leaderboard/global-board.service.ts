/**
 * The Global board — one ranking built from the seven components in
 * `global-score.ts` (owner instruction, 16 Sep 2026).
 *
 * This service is the ONE producer of a global row. The API, the table and the
 * viewer's own position all read what it returns, so a figure on screen and the
 * figure the rank was computed from cannot disagree.
 *
 * Three decisions are load-bearing:
 *
 *  - "Games performance" sums the STORED per-game rows and deliberately
 *    excludes `trading` and the `_overall` rollup. The rollup already contains
 *    trading contest finishes, so feeding it in would let trading decide two of
 *    the seven components while the published percentages say otherwise.
 *
 *  - Nothing is recomputed from the enabled game set. A disabled title's rows
 *    still count, because totals accumulate at settlement and a player must not
 *    lose points an operator switched a game off (R29 / invariant 9).
 *
 *  - Participation is read from a player's history, never inferred from a zero.
 *    Zero wins and never having entered are different facts, and only the
 *    second may have its weight redistributed.
 */

import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import UserLevel from "@/database/models/user-level.model";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import {
  getGlobalLeaderboard,
  GlobalLeaderboardEntry,
} from "@/lib/actions/leaderboard/global-leaderboard.actions";
import {
  buildComponentMap,
  computeGlobalScores,
  GlobalScoreComponentId,
  GlobalScoreRow,
  GlobalScoreWeights,
  weightsForDisplay,
} from "./global-score";
import { getLeaderboardWeights } from "./leaderboard-weights.service";

export interface GlobalBoardEntry {
  userId: string;
  email: string;
  username: string;
  profileImage?: string;
  rank: number;
  isTied: boolean;
  /** 0-100. */
  score: number;

  // The seven contributing figures, shown as columns.
  tradingScore: number;
  tradingTrades: number;
  gamePoints: number;
  gamesPlayed: number;
  competitionsWon: number;
  challengesWon: number;
  level: number;
  levelTitle?: string;
  totalBadges: number;
  milestones: number;

  /** Which components actually counted for this player, after redistribution. */
  applied: { id: GlobalScoreComponentId; weight: number; position: number }[];
}

export interface GlobalBoardPage {
  entries: GlobalBoardEntry[];
  totalCount: number;
  page: number;
  limit: number;
  weights: ReturnType<typeof weightsForDisplay>;
  myPosition: { rank: number; totalUsers: number; percentile: number };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function clampPage(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function clampLimit(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(10, Math.floor(n)));
}

interface GameTotals {
  points: number;
  gamesPlayed: number;
  entered: number;
}

/**
 * Stored per-game totals per user, trading and the rollup excluded.
 *
 * Reason: `$nin` on the stored key rather than a positive list of enabled
 * games — the positive spelling stops counting a title the moment an operator
 * disables it, which retroactively subtracts points a player earned (R29).
 */
async function readGameTotals(): Promise<Map<string, GameTotals>> {
  const rows = await UserGameStats.find({
    gameKey: { $nin: [OVERALL_GAME_KEY, TRADING_GAME_TYPE] },
  })
    .select("userId gameKey totalPoints contestsEntered")
    .lean<
      { userId: string; gameKey: string; totalPoints?: number; contestsEntered?: number }[]
    >();

  const totals = new Map<string, GameTotals>();
  for (const row of rows) {
    if (!row.userId) continue;
    const current = totals.get(row.userId) ?? { points: 0, gamesPlayed: 0, entered: 0 };
    current.points += Number(row.totalPoints) || 0;
    current.entered += Number(row.contestsEntered) || 0;
    current.gamesPlayed += 1;
    totals.set(row.userId, current);
  }
  return totals;
}

async function readLevels(): Promise<Map<string, { level: number; title?: string }>> {
  const rows = await UserLevel.find({})
    .select("userId currentLevel currentTitle")
    .lean<{ userId: string; currentLevel?: number; currentTitle?: string }[]>();

  return new Map(
    rows
      .filter((r) => Boolean(r.userId))
      .map((r) => [
        r.userId,
        { level: Number(r.currentLevel) || 1, title: r.currentTitle },
      ]),
  );
}

async function readMilestones(): Promise<Map<string, number>> {
  const rows = await UserJourneyProgress.find({})
    .select("userId totalMilestonesCompleted")
    .lean<{ userId: string; totalMilestonesCompleted?: number }[]>();

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.userId) continue;
    const value = Number(row.totalMilestonesCompleted) || 0;
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + value);
  }
  return totals;
}

function toScoreRow(
  trading: GlobalLeaderboardEntry,
  games: GameTotals | undefined,
  level: number,
  milestones: number,
): GlobalScoreRow {
  return {
    userId: trading.userId,
    components: buildComponentMap([
      [
        "trading",
        {
          value: trading.overallScore,
          participates: (trading.totalTrades ?? 0) > 0,
        },
      ],
      [
        "games",
        {
          value: games?.points ?? 0,
          participates: (games?.entered ?? 0) > 0,
        },
      ],
      [
        "competitions",
        {
          value: trading.competitionsWon ?? 0,
          participates: (trading.competitionsEntered ?? 0) > 0,
        },
      ],
      [
        "challenges",
        {
          value: trading.challengesWon ?? 0,
          participates: (trading.challengesEntered ?? 0) > 0,
        },
      ],
      // Level, badges and milestones are platform-wide: every signed-up player
      // takes part in them, so they are never redistributed away.
      ["level", { value: level, participates: true }],
      ["badges", { value: trading.totalBadges ?? 0, participates: true }],
      ["milestones", { value: milestones, participates: true }],
    ]),
  };
}

let boardCache: { rows: GlobalBoardEntry[]; timestamp: number } | null = null;
const CACHE_TTL = 300000; // 5 minutes, matching the trading board it reads.

export async function clearGlobalBoardCache(): Promise<void> {
  boardCache = null;
}

async function buildGlobalBoard(weights: GlobalScoreWeights): Promise<GlobalBoardEntry[]> {
  const [trading, gameTotals, levels, milestones] = await Promise.all([
    getGlobalLeaderboard(0),
    readGameTotals(),
    readLevels(),
    readMilestones(),
  ]);

  const scoreRows = trading.map((entry) =>
    toScoreRow(
      entry,
      gameTotals.get(entry.userId),
      levels.get(entry.userId)?.level ?? 1,
      milestones.get(entry.userId) ?? 0,
    ),
  );

  const scored = computeGlobalScores(scoreRows, weights);
  const scoreByUser = new Map(scored.map((s) => [s.userId, s]));

  const entries: GlobalBoardEntry[] = trading.map((entry) => {
    const result = scoreByUser.get(entry.userId);
    const games = gameTotals.get(entry.userId);
    const level = levels.get(entry.userId);
    return {
      userId: entry.userId,
      email: entry.email,
      username: entry.username,
      profileImage: entry.profileImage,
      rank: 0,
      isTied: false,
      score: result?.score ?? 0,
      tradingScore: entry.overallScore,
      tradingTrades: entry.totalTrades ?? 0,
      gamePoints: games?.points ?? 0,
      gamesPlayed: games?.gamesPlayed ?? 0,
      competitionsWon: entry.competitionsWon ?? 0,
      challengesWon: entry.challengesWon ?? 0,
      level: level?.level ?? 1,
      levelTitle: level?.title,
      totalBadges: entry.totalBadges ?? 0,
      milestones: milestones.get(entry.userId) ?? 0,
      applied:
        result?.breakdown
          .filter((b) => b.participates)
          .map((b) => ({ id: b.id, weight: b.appliedWeight, position: b.position })) ?? [],
    };
  });

  entries.sort((a, b) => b.score - a.score);

  // Ties share the better rank, exactly as the other two boards do.
  const epsilon = 0.0001;
  let lastScore = Number.NaN;
  let lastRank = 0;
  entries.forEach((entry, index) => {
    if (index > 0 && Math.abs(entry.score - lastScore) < epsilon) {
      entry.rank = lastRank;
      entry.isTied = true;
      const previous = entries.at(index - 1);
      if (previous) previous.isTied = true;
    } else {
      entry.rank = index + 1;
      lastRank = entry.rank;
    }
    lastScore = entry.score;
  });

  return entries;
}

export async function getGlobalBoard(opts: {
  page?: number;
  limit?: number;
  viewerUserId?: string;
  search?: string;
}): Promise<GlobalBoardPage> {
  const page = clampPage(opts.page ?? 1);
  const limit = clampLimit(opts.limit ?? DEFAULT_LIMIT);
  const weights = await getLeaderboardWeights();

  const cached =
    boardCache && Date.now() - boardCache.timestamp < CACHE_TTL ? boardCache.rows : null;
  const all = cached ?? (await buildGlobalBoard(weights));
  if (!cached) boardCache = { rows: all, timestamp: Date.now() };

  const term = (opts.search ?? "").trim().toLowerCase();
  const filtered = term
    ? all.filter(
        (e) =>
          e.username.toLowerCase().includes(term) ||
          e.email.toLowerCase().includes(term),
      )
    : all;

  const offset = (page - 1) * limit;
  const mine = opts.viewerUserId
    ? all.find((e) => e.userId === opts.viewerUserId)
    : undefined;

  return {
    entries: filtered.slice(offset, offset + limit),
    totalCount: filtered.length,
    page,
    limit,
    weights: weightsForDisplay(weights),
    myPosition: {
      rank: mine?.rank ?? 0,
      totalUsers: all.length,
      percentile:
        mine && all.length > 0 ? ((all.length - mine.rank + 1) / all.length) * 100 : 0,
    },
  };
}
