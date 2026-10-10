/**
 * R108 — Badge Simulator / evaluator parity for game_* and streak conditions.
 *
 * The Dev Zone Badge Simulator reported every Games badge as "not recognized"
 * while production already awarded them via the registry default door. Separately,
 * `consecutive_trading_days` was authored by the blueprint but missing from the
 * evaluator switch, so those badges could never earn.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { Badge } from "@/lib/constants/badges";
import {
  checkBadgeCondition,
  type UserStats,
} from "@/lib/services/badge-evaluation.service";
import { BADGE_CONDITION_DEFS } from "@/lib/services/games/badge-condition-registry";
import { thresholdFor } from "@/lib/services/games/badge-blueprint";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
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
    totalTrades: 50,
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
    averageLoss: 0,
    averageWin: 0,
    sharpeRatio: 0,
    profitVolatility: 0,
    averagePositionSize: 0,
    uniqueStrategiesUsed: 0,
    consecutiveProfitableDays: 0,
    globalRank: 0,
    comebackWins: 0,
    wireToWireWins: 0,
    perfectCompetitionTrades: 0,
    secondPlaceFinishes: 0,
    thirdPlaceFinishes: 0,
    top10Finishes: 0,
    top50PercentFinishes: 0,
    competitionPnl: 0,
    currentLevel: 0,
    currentXP: 0,
    xpEarnedToday: 0,
    xpEarnedThisWeek: 0,
    totalBadgesEarned: 0,
    slTriggeredCount: 0,
    tpTriggeredCount: 0,
    referralsMade: 0,
    referralsActive: 0,
    friendsAdded: 0,
    messagesSent: 0,
    loginStreak: 0,
    ...overrides,
  };
}

function badge(partial: {
  type: string;
  value?: number;
  comparison?: "gte" | "lte" | "eq";
  rarity?: Badge["rarity"];
  minTrades?: number;
  gameTypes?: string[];
}): Badge {
  return {
    id: "t",
    name: "T",
    description: "t",
    category: "Games",
    icon: "trophy",
    rarity: partial.rarity ?? "common",
    condition: {
      type: partial.type,
      value: partial.value,
      comparison: partial.comparison,
      minTrades: partial.minTrades,
    },
    gameTypes: partial.gameTypes,
  };
}

describe("R108 consecutive_trading_days", () => {
  it("awards when the streak meets the threshold", async () => {
    const result = await checkBadgeCondition(
      badge({
        type: "consecutive_trading_days",
        value: 3,
        comparison: "gte",
        rarity: "common",
        minTrades: 7,
      }),
      emptyStats({ consecutiveTradingDays: 5, totalTrades: 20 }),
    );
    expect(result).toBe(true);
  });

  it("is handled in both evaluator copies (not only the daily_ alias)", () => {
    for (const rel of [
      "lib/services/badge-evaluation.service.ts",
      "apps/admin/lib/services/badge-evaluation.service.ts",
    ]) {
      const code = stripComments(read(rel));
      expect(code).toMatch(/case\s+"consecutive_trading_days"/);
    }
  });
});

describe("R108 game_* missing value", () => {
  it("treats an absent target as gte 1 so boolean-authored rows remain earnable", async () => {
    const map = new Map([
      [
        "provider:cv:sprint",
        {
          contestsEntered: 0,
          contestsCompleted: 0,
          wins: 0,
          podiums: 0,
          totalPoints: 0,
          seasonPoints: 40,
          rating: 0,
          bestRank: 0,
          bestScore: 0,
          currentStreak: 0,
        },
      ],
    ]);
    const result = await checkBadgeCondition(
      badge({
        type: "game_season_points",
        comparison: "eq",
        gameTypes: ["provider:cv:sprint"],
      }),
      emptyStats({ totalTrades: 0, gameStats: map }),
    );
    expect(result).toBe(true);
  });
});

describe("R108 Badge Simulator recognition", () => {
  it("derives supported types from the registry rather than a frozen allow-list alone", () => {
    const code = stripComments(
      read("apps/admin/app/api/admin/badge-simulator/run/route.ts"),
    );
    expect(code).toContain("BADGE_CONDITION_DEFS");
    expect(code).toContain("isSupportedConditionType");
    expect(code).toContain("gameStats");
    expect(code).toContain("resolveGameStatsKey");
    // Reason: a bare SUPPORTED_CONDITION_TYPES.has in the unsupported check
    // is the defect — recognition must go through isSupportedConditionType.
    expect(code).toMatch(
      /if\s*\(\s*!isSupportedConditionType\(\s*cond\.type\s*\)\s*\)/,
    );
  });

  it("every registry game_* type is listed in BADGE_CONDITION_DEFS", () => {
    const gameTypes = BADGE_CONDITION_DEFS.filter((d) => d.scope === "game").map(
      (d) => d.type,
    );
    expect(gameTypes.length).toBeGreaterThanOrEqual(10);
    for (const t of [
      "game_contests_entered",
      "game_contests_completed",
      "game_wins",
      "game_podiums",
      "game_total_points",
      "game_season_points",
      "game_rating",
      "game_best_rank",
      "game_best_score",
      "game_current_streak",
    ]) {
      expect(gameTypes).toContain(t);
    }
  });
});

describe("R108 blueprint ladders", () => {
  it("authors thresholds for season points and best score (not boolean eq N/A)", () => {
    expect(thresholdFor("game_season_points", 0)).toBeGreaterThan(0);
    expect(thresholdFor("game_best_score", 0)).toBeGreaterThan(0);
  });
});

describe("R108 Dev Zone vitest runner", () => {
  it("writes vitest JSON to a file so the full suite cannot blow maxBuffer", () => {
    const code = stripComments(read("apps/admin/app/api/tests/run/route.ts"));
    expect(code).toContain("outputFile");
    expect(code).toContain("maxBuffer");
    expect(code).toMatch(/20\s*\*\s*1024\s*\*\s*1024/);
  });
});
