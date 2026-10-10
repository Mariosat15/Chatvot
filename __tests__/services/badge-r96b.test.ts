/**
 * R96b — game-scoped badge authoring.
 *
 * Pins: registry is the single source for scopes; game_* conditions read
 * UserGameStats via resolveGameStatsKey; trade floors skip game scope;
 * Games is a valid category; conditionAllowedOnBadge refuses mismatches.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { Badge } from "@/lib/constants/badges";
import {
  checkBadgeCondition,
  type UserStats,
} from "@/lib/services/badge-evaluation.service";
import {
  BADGE_CATEGORY_IDS,
  BADGE_CONDITION_DEFS,
  conditionAllowedOnBadge,
  conditionScope,
  conditionsAllowedForGameTypes,
  crossGameConditionTypes,
  noTradeFloorTypes,
  tradeExemptTypes,
} from "@/lib/services/games/badge-condition-registry";
import { resolveGameStatsKey } from "@/lib/services/games/game-badge-stats";
import { OVERALL_GAME_KEY } from "@/database/models/games/user-game-stats.model";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function emptyStats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    userId: "000000000000000000000001",
    competitionsEntered: 0,
    completedCompetitions: 0,
    completedCompetitionsWithTrades: 0,
    firstPlaceFinishes: 0,
    podiumFinishes: 0,
    totalWins: 0,
    totalTrades: 0,
    uniquePairsTraded: 0,
    totalPnl: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    averageRoi: 0,
    profitFactor: 0,
    bestSingleTrade: 0,
    currentWinStreak: 0,
    maxWinStreak: 0,
    liquidationCount: 0,
    maxDrawdown: 0,
    alwaysUsesSL: false,
    alwaysUsesTP: false,
    tradesWithSL: 0,
    tradesWithTP: 0,
    averageTradesDuration: 0,
    totalDeposited: 0,
    depositCount: 0,
    totalWithdrawn: 0,
    withdrawalCount: 0,
    kycVerified: false,
    accountAge: 0,
    consecutiveTradingDays: 0,
    weeklyTradingStreak: 0,
    monthlyTradingStreak: 0,
    averageTradeDuration: 0,
    tradesUnder1Minute: 0,
    tradesUnder5Minutes: 0,
    tradesOver1Day: 0,
    tradesOver7Days: 0,
    tradesAtMarketOpen: 0,
    tradesAtMarketClose: 0,
    tradesAtLateNight: 0,
    maxTradesInOneDay: 0,
    maxTradesInOneWeek: 0,
    maxTradesInOneMonth: 0,
    comebackWins: 0,
    wireToWireWins: 0,
    perfectCompetitionTrades: 0,
    averageLoss: 0,
    averageWin: 0,
    sharpeRatio: 0,
    profitVolatility: 0,
    averagePositionSize: 0,
    uniqueStrategiesUsed: 0,
    consecutiveProfitableDays: 0,
    slTriggeredCount: 0,
    tpTriggeredCount: 0,
    globalRank: 0,
    secondPlaceFinishes: 0,
    thirdPlaceFinishes: 0,
    top10Finishes: 0,
    top50PercentFinishes: 0,
    competitionPnl: 0,
    currentLevel: 1,
    currentXP: 0,
    xpEarnedToday: 0,
    xpEarnedThisWeek: 0,
    totalBadgesEarned: 0,
    referralsMade: 0,
    referralsActive: 0,
    friendsAdded: 0,
    messagesSent: 0,
    loginStreak: 0,
    gameStats: new Map(),
    ...overrides,
  };
}

function badge(partial: {
  type: string;
  rarity?: Badge["rarity"];
  value?: number;
  comparison?: "gte" | "lte" | "eq";
  gameTypes?: string[];
  minTrades?: number;
}): Badge {
  return {
    id: "test-badge",
    name: "Test",
    description: "Test",
    category: "Games",
    icon: "trophy" as Badge["icon"],
    rarity: partial.rarity || "common",
    gameTypes: partial.gameTypes,
    condition: {
      type: partial.type,
      value: partial.value,
      comparison: partial.comparison,
      minTrades: partial.minTrades,
    },
  };
}

describe("R96b - badge condition registry", () => {
  it("mirrors the registry into admin byte-identical", () => {
    expect(read("apps/admin/lib/services/games/badge-condition-registry.ts")).toBe(
      read("lib/services/games/badge-condition-registry.ts"),
    );
  });

  // Reason: the admin copy silently lagged the main one through R96a and R96b — it was
  // missing minLevel, gameTypes, the Volume category and every tightened trade floor —
  // and check:mirrors compares models, so it can never see this pair.
  it("mirrors the seeded badge catalogue into admin byte-identical", () => {
    expect(read("apps/admin/lib/constants/badges.ts")).toBe(
      read("lib/constants/badges.ts"),
    );
  });

  // Reason: these three carry the scope rules and the per-game stat reads. They are
  // mirrored for the admin app's AI routes, and check:mirrors compares models only,
  // so a text comparison is the only thing that can see them diverge.
  it.each([
    "lib/services/games/gamification-coverage.ts",
    "lib/services/games/game-badge-stats.ts",
    "lib/services/games/badge-game-scope.ts",
  ])("mirrors %s into admin byte-identical", (rel) => {
    expect(read(`apps/admin/${rel}`)).toBe(read(rel));
  });

  it("includes Games in the category list used by the model enum", () => {
    expect(BADGE_CATEGORY_IDS).toContain("Games");
    const main = read("database/models/badge-config.model.ts");
    const admin = read("apps/admin/database/models/badge-config.model.ts");
    expect(main).toMatch(/"Games"/);
    expect(admin).toMatch(/"Games"/);
  });

  it("derives trade-exempt and cross-game sets from scopes, not a fourth list", () => {
    expect(tradeExemptTypes().has("first_deposit")).toBe(true);
    expect(crossGameConditionTypes().has("first_place_finishes")).toBe(true);
    expect(noTradeFloorTypes().has("game_wins")).toBe(true);
    expect(conditionScope("total_trades")).toBe("trading");
    expect(conditionScope("totally_made_up")).toBe("trading");
  });

  it("refuses a trading condition on a provider-only badge", () => {
    expect(conditionAllowedOnBadge("total_trades", ["provider:cv:sprint"])).toBe(
      false,
    );
    expect(conditionAllowedOnBadge("game_wins", ["provider:cv:sprint"])).toBe(
      true,
    );
    expect(
      conditionsAllowedForGameTypes(["provider:cv:sprint"]).some(
        (d) => d.scope === "trading",
      ),
    ).toBe(false);
  });

  it("every game_* def declares a gameStat field", () => {
    const gameDefs = BADGE_CONDITION_DEFS.filter((d) => d.scope === "game");
    expect(gameDefs.length).toBeGreaterThanOrEqual(7);
    for (const d of gameDefs) {
      expect(d.gameStat).toBeTruthy();
    }
  });
});

describe("R96b - game stats key + evaluation", () => {
  it("resolveGameStatsKey picks provider, trading, or _overall", () => {
    expect(resolveGameStatsKey(["provider:cv:sprint"])).toBe(
      "provider:cv:sprint",
    );
    expect(resolveGameStatsKey(["trading"])).toBe("trading");
    expect(resolveGameStatsKey([])).toBe(OVERALL_GAME_KEY);
  });

  it("game_wins awards from UserGameStats with zero trades", async () => {
    const map = new Map([
      [
        "provider:cv:sprint",
        {
          contestsEntered: 3,
          contestsCompleted: 3,
          wins: 2,
          podiums: 2,
          totalPoints: 100,
          rating: 1200,
          bestRank: 1,
          currentStreak: 2,
        },
      ],
    ]);
    const result = await checkBadgeCondition(
      badge({
        type: "game_wins",
        value: 2,
        rarity: "legendary",
        minTrades: 100,
        gameTypes: ["provider:cv:sprint"],
      }),
      emptyStats({ totalTrades: 0, gameStats: map }),
    );
    expect(result).toBe(true);
  });

  it("game_best_rank fails when bestRank is the unset zero", async () => {
    const map = new Map([
      [
        "provider:cv:sprint",
        {
          contestsEntered: 1,
          contestsCompleted: 1,
          wins: 0,
          podiums: 0,
          totalPoints: 10,
          rating: 1000,
          bestRank: 0,
          currentStreak: 0,
        },
      ],
    ]);
    const result = await checkBadgeCondition(
      badge({
        type: "game_best_rank",
        value: 10,
        gameTypes: ["provider:cv:sprint"],
      }),
      emptyStats({ gameStats: map }),
    );
    expect(result).toBe(false);
  });

  it("evaluator imports the registry rather than a hard-coded CROSS_GAME list body", () => {
    const code = read("lib/services/badge-evaluation.service.ts");
    expect(code).toMatch(/crossGameConditionTypes/);
    expect(code).toMatch(/tradeExemptTypes/);
    expect(code).toMatch(/game_wins|conditionDef\.gameStat/);
  });
});
