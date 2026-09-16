/**
 * Cross-game / per-game leaderboard backed by `UserGameStats` (X7 step 2).
 *
 * Reads only. Totals were materialised at settlement — never recompute from
 * enabled games (R29 / invariant 9). Tabs are discovered from stored rows, not
 * from `getEnabledGameTypes()`.
 *
 * Main-app only: the player `/leaderboard` surface lives here. Admin matchmaking
 * still uses the trading-shaped rebuild (X13) until that path is rewritten.
 */

import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import { getUsersByIds } from "@/lib/utils/user-lookup";
import { getHiddenUserIds } from "@/lib/services/user-restriction.service";
import { getGlobalLeaderboard } from "@/lib/actions/leaderboard/global-leaderboard.actions";

export interface GameLeaderboardEntry {
  userId: string;
  email: string;
  username: string;
  profileImage?: string;
  rank: number;
  isTied: boolean;
  gameKey: string;
  totalPoints: number;
  seasonPoints: number;
  contestsEntered: number;
  contestsCompleted: number;
  wins: number;
  podiums: number;
  /** Present on per-game boards only — never on `_overall` (05 s4). */
  rating?: number;
  bestRank: number;
  currentStreak: number;
  lastPlayedAt?: string;
}

export interface LeaderboardTab {
  gameKey: string;
  label: string;
  /** True for the stored cross-game rollup. */
  isOverall: boolean;
}

export interface GameLeaderboardPage {
  entries: GameLeaderboardEntry[];
  totalCount: number;
  page: number;
  limit: number;
  gameKey: string;
  tabs: LeaderboardTab[];
  /** Question 14 — caption that the rollup starts when cross-game scoring began. */
  startsFromCaption: string;
  myPosition: {
    rank: number;
    totalUsers: number;
    percentile: number;
  };
}

export const CROSS_GAME_SCORING_STARTED_CAPTION =
  "Cross-game standing counts from the day cross-game scoring began. Earlier trading history stays on your Trading card.";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DIFF_TOP = 100;

function clampPage(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function clampLimit(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(10, Math.floor(n)));
}

/** Resolve a human label without enumerating games in code. */
export async function labelForGameKey(gameKey: string): Promise<string> {
  if (gameKey === OVERALL_GAME_KEY) return "Overall";
  if (gameKey === TRADING_GAME_TYPE) return "Trading";

  const row = await ProviderGame.findOne({ gameKey })
    .select("displayName")
    .lean<{ displayName?: string }>();
  // Reason: fall back to the immutable key, never "Unknown" — a key with real
  // points must stay investigable (same rule as analytics grouping).
  return row?.displayName?.trim() || gameKey;
}

/**
 * Tabs = Overall (always) + every distinct gameKey that has at least one row.
 * Disabled titles keep their tab while anyone still holds points (R29).
 */
export async function listLeaderboardTabs(): Promise<LeaderboardTab[]> {
  const keys = await UserGameStats.distinct("gameKey", {
    gameKey: { $ne: OVERALL_GAME_KEY },
  });

  const sorted = (keys as string[])
    .filter((k) => typeof k === "string" && k.length > 0)
    .sort((a, b) => {
      if (a === TRADING_GAME_TYPE) return -1;
      if (b === TRADING_GAME_TYPE) return 1;
      return a.localeCompare(b);
    });

  const tabs: LeaderboardTab[] = [
    {
      gameKey: OVERALL_GAME_KEY,
      label: "Overall",
      isOverall: true,
    },
  ];

  for (const gameKey of sorted) {
    tabs.push({
      gameKey,
      label: await labelForGameKey(gameKey),
      isOverall: false,
    });
  }

  return tabs;
}

interface StatsRow {
  userId: string;
  gameKey: string;
  totalPoints: number;
  seasonPoints: number;
  contestsEntered: number;
  contestsCompleted: number;
  wins: number;
  podiums: number;
  rating: number;
  bestRank: number;
  currentStreak: number;
  lastPlayedAt?: Date;
}

function assignRanks(rows: StatsRow[]): { row: StatsRow; rank: number; isTied: boolean }[] {
  const ranked: { row: StatsRow; rank: number; isTied: boolean }[] = [];
  let i = 0;
  while (i < rows.length) {
    const points = rows[i].totalPoints;
    let j = i + 1;
    while (j < rows.length && rows[j].totalPoints === points) j += 1;
    const isTied = j - i > 1;
    const rank = i + 1;
    for (let k = i; k < j; k++) {
      ranked.push({ row: rows[k], rank, isTied });
    }
    i = j;
  }
  return ranked;
}

export async function getGameLeaderboard(opts: {
  gameKey?: string;
  page?: number;
  limit?: number;
  viewerUserId?: string;
}): Promise<GameLeaderboardPage> {
  const gameKey =
    typeof opts.gameKey === "string" && opts.gameKey.length > 0
      ? opts.gameKey
      : OVERALL_GAME_KEY;
  const page = clampPage(opts.page ?? 1);
  const limit = clampLimit(opts.limit ?? DEFAULT_LIMIT);
  const isOverall = gameKey === OVERALL_GAME_KEY;

  const hiddenIds = await getHiddenUserIds();
  const tabs = await listLeaderboardTabs();

  const raw = (await UserGameStats.find({ gameKey })
    .sort({ totalPoints: -1, updatedAt: 1 })
    .select(
      "userId gameKey totalPoints seasonPoints contestsEntered contestsCompleted wins podiums rating bestRank currentStreak lastPlayedAt",
    )
    .lean()) as StatsRow[];

  const visible = raw.filter(
    (r) => r.userId && !hiddenIds.has(r.userId),
  );
  const ranked = assignRanks(visible);
  const totalCount = ranked.length;
  const offset = (page - 1) * limit;
  const pageSlice = ranked.slice(offset, offset + limit);

  const users = await getUsersByIds(pageSlice.map((r) => r.row.userId));

  const entries: GameLeaderboardEntry[] = pageSlice.map(({ row, rank, isTied }) => {
    const user = users.get(row.userId);
    const email = user?.email ?? "";
    const username =
      user?.name ||
      (email.includes("@") ? email.split("@")[0] : "") ||
      "Player";
    const entry: GameLeaderboardEntry = {
      userId: row.userId,
      email,
      username,
      rank,
      isTied,
      gameKey: row.gameKey,
      totalPoints: row.totalPoints ?? 0,
      seasonPoints: row.seasonPoints ?? 0,
      contestsEntered: row.contestsEntered ?? 0,
      contestsCompleted: row.contestsCompleted ?? 0,
      wins: row.wins ?? 0,
      podiums: row.podiums ?? 0,
      bestRank: row.bestRank ?? 0,
      currentStreak: row.currentStreak ?? 0,
      lastPlayedAt: row.lastPlayedAt
        ? new Date(row.lastPlayedAt).toISOString()
        : undefined,
    };
    if (user?.profileImage) entry.profileImage = user.profileImage;
    // Reason: rating is per-game only — never publish it on the overall tab.
    if (!isOverall) entry.rating = row.rating ?? 1200;
    return entry;
  });

  let myRank = 0;
  if (opts.viewerUserId) {
    const mine = ranked.find((r) => r.row.userId === opts.viewerUserId);
    myRank = mine?.rank ?? 0;
  }

  return {
    entries,
    totalCount,
    page,
    limit,
    gameKey,
    tabs,
    startsFromCaption: CROSS_GAME_SCORING_STARTED_CAPTION,
    myPosition: {
      rank: myRank,
      totalUsers: totalCount,
      percentile:
        myRank > 0 && totalCount > 0
          ? ((totalCount - myRank + 1) / totalCount) * 100
          : 0,
    },
  };
}

export interface LeaderboardDiffResult {
  legacyTop: string[];
  statsTop: string[];
  onlyInLegacy: string[];
  onlyInStats: string[];
  sharedInOrder: number;
  /** True when both top-N userId sequences are identical. */
  identical: boolean;
}

/**
 * R14 — run old and new in parallel and compare the top 100 user ids before
 * treating the migration as switched. Does not mutate either board.
 */
export async function diffTop100WithLegacy(
  topN: number = DIFF_TOP,
): Promise<LeaderboardDiffResult> {
  const n = Number.isFinite(topN) && topN > 0 ? Math.min(500, Math.floor(topN)) : DIFF_TOP;

  const [legacy, statsPage] = await Promise.all([
    getGlobalLeaderboard(n),
    getGameLeaderboard({
      gameKey: OVERALL_GAME_KEY,
      page: 1,
      limit: Math.min(MAX_LIMIT, n),
    }),
  ]);

  // Stats board may need a second page if n > MAX_LIMIT — keep simple for top 100.
  let statsTop = statsPage.entries.map((e) => e.userId);
  if (n > statsTop.length && statsPage.totalCount > statsTop.length) {
    const more = await UserGameStats.find({ gameKey: OVERALL_GAME_KEY })
      .sort({ totalPoints: -1, updatedAt: 1 })
      .limit(n)
      .select("userId")
      .lean<{ userId: string }[]>();
    const hiddenIds = await getHiddenUserIds();
    statsTop = more
      .map((r) => r.userId)
      .filter((id) => id && !hiddenIds.has(id))
      .slice(0, n);
  }

  const legacyTop = legacy.map((e) => e.userId).slice(0, n);
  const legacySet = new Set(legacyTop);
  const statsSet = new Set(statsTop);

  let sharedInOrder = 0;
  const len = Math.min(legacyTop.length, statsTop.length);
  for (let i = 0; i < len; i++) {
    if (legacyTop[i] === statsTop[i]) sharedInOrder += 1;
    else break;
  }

  return {
    legacyTop,
    statsTop,
    onlyInLegacy: legacyTop.filter((id) => !statsSet.has(id)),
    onlyInStats: statsTop.filter((id) => !legacySet.has(id)),
    sharedInOrder,
    identical:
      legacyTop.length === statsTop.length &&
      legacyTop.every((id, i) => id === statsTop[i]),
  };
}
