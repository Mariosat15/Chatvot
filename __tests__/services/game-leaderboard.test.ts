/**
 * X7 step 2 — UserGameStats-backed leaderboard + R14 top-100 parallel diff.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureCollections,
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";
import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import {
  getGameLeaderboard,
  listLeaderboardTabs,
  labelForGameKey,
  diffTop100WithLegacy,
  CROSS_GAME_SCORING_STARTED_CAPTION,
} from "@/lib/services/games/game-leaderboard.service";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/lib/services/user-restriction.service", () => ({
  getHiddenUserIds: async () => new Set<string>(),
}));

vi.mock("@/lib/actions/leaderboard/global-leaderboard.actions", () => ({
  getGlobalLeaderboard: async (limit: number) => {
    const ids = ["legacy-a", "legacy-b", "shared-1"];
    return ids.slice(0, limit || ids.length).map((userId, i) => ({
      userId,
      email: `${userId}@example.com`,
      username: userId,
      rank: i + 1,
      totalPnl: 0,
      totalPnlPercentage: 0,
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      competitionsEntered: 0,
      competitionsWon: 0,
      podiumFinishes: 0,
      totalBadges: 0,
      legendaryBadges: 0,
      overallScore: 100 - i,
    }));
  },
}));

vi.mock("@/lib/utils/user-lookup", () => ({
  getUsersByIds: async (ids: string[]) => {
    const map = new Map();
    for (const id of ids) {
      map.set(id, {
        id,
        email: `${id}@example.com`,
        name: `Name ${id}`,
        profileImage: undefined,
      });
    }
    return map;
  },
}));

vi.mock("@/database/models/games/provider-game.model", () => ({
  default: {
    findOne: () => ({
      select: () => ({
        lean: async () => null,
      }),
    }),
  },
}));

describe("game-leaderboard.service (X7 step 2)", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["user_game_stats"]);
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("ranks by totalPoints descending with dense ties", async () => {
    await UserGameStats.create([
      {
        userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
        gameKey: OVERALL_GAME_KEY,
        totalPoints: 100,
        contestsEntered: 2,
        contestsCompleted: 2,
        wins: 1,
        podiums: 1,
      },
      {
        userId: "bbbbbbbbbbbbbbbbbbbbbbbb",
        gameKey: OVERALL_GAME_KEY,
        totalPoints: 100,
        contestsEntered: 1,
        contestsCompleted: 1,
        wins: 0,
        podiums: 1,
      },
      {
        userId: "cccccccccccccccccccccccc",
        gameKey: OVERALL_GAME_KEY,
        totalPoints: 50,
        contestsEntered: 1,
        contestsCompleted: 1,
        wins: 0,
        podiums: 0,
      },
    ]);

    const page = await getGameLeaderboard({
      gameKey: OVERALL_GAME_KEY,
      page: 1,
      limit: 50,
    });

    expect(page.entries).toHaveLength(3);
    expect(page.entries[0].rank).toBe(1);
    expect(page.entries[1].rank).toBe(1);
    expect(page.entries[0].isTied).toBe(true);
    expect(page.entries[1].isTied).toBe(true);
    expect(page.entries[2].rank).toBe(3);
    expect(page.entries[2].isTied).toBe(false);
    expect(page.startsFromCaption).toBe(CROSS_GAME_SCORING_STARTED_CAPTION);
  });

  it("omits rating on the overall board and includes it per game", async () => {
    const uid = "dddddddddddddddddddddddd";
    await UserGameStats.create([
      {
        userId: uid,
        gameKey: OVERALL_GAME_KEY,
        totalPoints: 10,
        rating: 1200,
      },
      {
        userId: uid,
        gameKey: TRADING_GAME_TYPE,
        totalPoints: 10,
        rating: 1305,
      },
    ]);

    const overall = await getGameLeaderboard({ gameKey: OVERALL_GAME_KEY });
    expect(overall.entries[0].rating).toBeUndefined();

    const trading = await getGameLeaderboard({ gameKey: TRADING_GAME_TYPE });
    expect(trading.entries[0].rating).toBe(1305);
  });

  it("lists Overall plus distinct gameKeys without using enabled flags", async () => {
    await UserGameStats.create([
      {
        userId: "eeeeeeeeeeeeeeeeeeeeeeee",
        gameKey: OVERALL_GAME_KEY,
        totalPoints: 1,
      },
      {
        userId: "eeeeeeeeeeeeeeeeeeeeeeee",
        gameKey: "provider:chartvolt:circuit-sprint",
        totalPoints: 1,
      },
      {
        userId: "ffffffffffffffffffffffff",
        gameKey: TRADING_GAME_TYPE,
        totalPoints: 2,
      },
    ]);

    const tabs = await listLeaderboardTabs();
    expect(tabs[0]).toEqual({
      gameKey: OVERALL_GAME_KEY,
      label: "Overall",
      isOverall: true,
    });
    const keys = tabs.map((t) => t.gameKey);
    expect(keys).toContain(TRADING_GAME_TYPE);
    expect(keys).toContain("provider:chartvolt:circuit-sprint");
    expect(keys.filter((k) => k === OVERALL_GAME_KEY)).toHaveLength(1);
  });

  it("labelForGameKey falls back to the key, never Unknown", async () => {
    expect(await labelForGameKey(OVERALL_GAME_KEY)).toBe("Overall");
    expect(await labelForGameKey(TRADING_GAME_TYPE)).toBe("Trading");
    expect(await labelForGameKey("provider:x:y")).toBe("provider:x:y");
  });

  it("diffTop100WithLegacy reports divergence without mutating either board", async () => {
    await UserGameStats.create([
      {
        userId: "shared-1",
        gameKey: OVERALL_GAME_KEY,
        totalPoints: 99,
      },
      {
        userId: "stats-only",
        gameKey: OVERALL_GAME_KEY,
        totalPoints: 50,
      },
    ]);

    const before = await UserGameStats.countDocuments();
    const diff = await diffTop100WithLegacy(3);
    const after = await UserGameStats.countDocuments();

    expect(after).toBe(before);
    expect(diff.identical).toBe(false);
    expect(diff.onlyInLegacy.length).toBeGreaterThan(0);
    expect(diff.statsTop).toContain("shared-1");
    expect(diff.legacyTop[0]).toBe("legacy-a");
  });

  it("service file must not call getEnabledGameTypes", () => {
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "lib/services/games/game-leaderboard.service.ts",
      ),
      "utf8",
    );
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/getEnabledGameTypes/);
  });

  it("client defaults to the global board, never an empty or trading-only view", () => {
    // Reason: R14's `source=legacy|stats` parallel period ended. The live client picks among
    // global / trading / games and must open on Overall (`GLOBAL_BOARD`), not Trading, or a
    // games-only player lands on an empty board.
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/leaderboard/LeaderboardClient.tsx",
      ),
      "utf8",
    );
    expect(src).toMatch(/GLOBAL_BOARD\s*=\s*"global"/);
    expect(src).toMatch(/useState<string>\(\s*GLOBAL_BOARD\s*\)/);
    expect(src).not.toMatch(/useState[^;]*"legacy"/);
    expect(src).not.toMatch(/useState[^;]*"stats"/);
  });

  it("API defaults board to global when none is requested", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/leaderboard/route.ts"),
      "utf8",
    );
    // Reason: resolveBoardId is the one answer; a missing/blank board must become "global",
    // never "legacy" (gone) and never trading (would hide games-only players on first load).
    expect(src).toMatch(/function\s+resolveBoardId/);
    expect(src).toMatch(/return\s+"global"/);
    expect(src).not.toMatch(
      /searchParams\.get\("source"\)\s*\|\|\s*"legacy"/,
    );
  });
});
