/**
 * R96a — game-aware badge gate.
 *
 * Before 16 Sep 2026 every non-TRADE_EXEMPT badge hit RARITY_MIN_REQUIREMENTS
 * trade floors and `completedCompetitionsWithTrades`, so a games-only player
 * could reach five of 128 badges. R96a classifies by condition TYPE: cross-game
 * types ignore trade floors and count any completed contest; trading types keep
 * the old floors; unknown types fail closed to trading.
 *
 * R96b (authoring game badges) is a separate content pass. This suite pins the
 * gate alone, and keeps R100's byte-identical claim green after the rewrite.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { Badge } from "@/lib/constants/badges";
import {
  checkBadgeCondition,
  type UserStats,
} from "@/lib/services/badge-evaluation.service";

const ROOT = process.cwd();
const MAIN = "lib/services/badge-evaluation.service.ts";
const ADMIN = "apps/admin/lib/services/badge-evaluation.service.ts";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
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
    ...overrides,
  };
}

function badge(partial: {
  type: string;
  rarity?: Badge["rarity"];
  value?: number;
  comparison?: "gte" | "lte" | "eq";
  minTrades?: number;
  minCompletedCompetitions?: number;
}): Badge {
  return {
    id: `r96a_${partial.type}`,
    name: "R96a probe",
    description: "test",
    category: "Competition",
    icon: "trophy",
    rarity: partial.rarity ?? "rare",
    condition: {
      type: partial.type,
      value: partial.value,
      comparison: partial.comparison ?? "gte",
      minTrades: partial.minTrades,
      minCompletedCompetitions: partial.minCompletedCompetitions,
    },
  };
}

describe("R96a - game-aware badge gate", () => {
  it("both evaluators stay byte-identical after the gate rewrite", () => {
    // Reason: R100's only evidence. A gate edit on one side reopens which-app-awards.
    expect(read(ADMIN)).toBe(read(MAIN));
  });

  it("declares CROSS_GAME_CONDITION_TYPES and zeros trade floors for them", () => {
    const code = stripComments(read(MAIN));
    expect(code).toMatch(/CROSS_GAME_CONDITION_TYPES\s*=\s*new\s+Set/);
    // Reason: assert the CALL inside the isCrossGame arm, never a bare `= 0`
    // that trade-exempt already has for a different reason.
    expect(code).toMatch(
      /else\s+if\s*\(\s*isCrossGame\s*\)\s*\{[\s\S]*?effectiveMinTrades\s*=\s*0/,
    );
    expect(code).toMatch(
      /else\s+if\s*\(\s*isCrossGame\s*\)\s*\{[\s\S]*?compsStat\s*=\s*stats\.completedCompetitions\b/,
    );
  });

  it("trading-typed badges still take the stricter rarity trade floor", () => {
    const code = stripComments(read(MAIN));
    // Reason: the else arm is fail-closed for unknown types. Pin Math.max with
    // tierReqs.trades so a tidy-up that drops rarity floors turns this red.
    expect(code).toMatch(
      /effectiveMinTrades\s*=\s*Math\.max\(\s*minTrades\s*\|\|\s*0\s*,\s*tierReqs\.trades\s*\)/,
    );
    expect(code).toMatch(
      /compsStat\s*=\s*stats\.completedCompetitionsWithTrades/,
    );
  });

  it("a games-only player clears a rare cross-game badge with contests and no trades", async () => {
    /*
      // Reason: behavioural — a service that declares CROSS_GAME and then still
      // applies tierReqs.trades is green on every structural assertion above.
      // Rare floor is 25 trades / 1 competition; games-only has 0 trades and
      // 3 completedCompetitions (any game), 0 with trades.
    */
    const result = await checkBadgeCondition(
      badge({
        type: "first_place_finishes",
        rarity: "rare",
        value: 1,
        minTrades: 25,
        minCompletedCompetitions: 1,
      }),
      emptyStats({
        totalTrades: 0,
        completedCompetitions: 3,
        completedCompetitionsWithTrades: 0,
        firstPlaceFinishes: 1,
      }),
    );
    expect(result).toBe(true);
  });

  it("cross-game competition floor reads completedCompetitions, not WithTrades", async () => {
    // Reason: if compsStat still points at WithTrades, three any-game finishes
    // with zero traded comps are refused even when trade floors are zeroed.
    const result = await checkBadgeCondition(
      badge({
        type: "competitions_completed",
        rarity: "rare",
        value: 1,
        minCompletedCompetitions: 1,
      }),
      emptyStats({
        totalTrades: 0,
        completedCompetitions: 2,
        completedCompetitionsWithTrades: 0,
      }),
    );
    expect(result).toBe(true);
  });

  it("ignores a stored minTrades on a cross-game condition", async () => {
    // Reason: operator-tuned JSON rows carry minTrades; rewriting them is R96b.
    // The gate must ignore the stored floor, not demand a catalogue edit.
    const result = await checkBadgeCondition(
      badge({
        type: "podium_finishes",
        rarity: "epic",
        value: 1,
        minTrades: 50,
        minCompletedCompetitions: 0,
      }),
      emptyStats({
        totalTrades: 0,
        completedCompetitions: 5,
        completedCompetitionsWithTrades: 0,
        podiumFinishes: 1,
      }),
    );
    expect(result).toBe(true);
  });

  it("a trading-typed badge still refuses a games-only player", async () => {
    // Reason: totalTrades: 4 satisfies the condition (value 1) but not the common
    // rarity floor of 5 — so a probe that classifies every type as cross-game
    // turns this green. totalTrades: 0 cannot distinguish gate from condition.
    const result = await checkBadgeCondition(
      badge({
        type: "total_trades",
        rarity: "common",
        value: 1,
      }),
      emptyStats({
        totalTrades: 4,
        completedCompetitions: 50,
        completedCompetitionsWithTrades: 0,
      }),
    );
    expect(result).toBe(false);
  });

  it("an unknown condition type fails closed to the trading floors", async () => {
    // Reason: inventing a type must not silently become cross-game. The switch
    // default returns false either way, so this assertion is structural: the
    // type must NOT appear in CROSS_GAME_CONDITION_TYPES, and isCrossGame must
    // come only from that set. Behavioural half covered by the trading-typed
    // refusal above (probe: isCrossGame = true).
    const code = stripComments(read(MAIN));
    expect(code).toMatch(
      /const\s+isCrossGame\s*=\s*CROSS_GAME_CONDITION_TYPES\.has\(\s*type\s*\)/,
    );
    expect(code).not.toMatch(/"totally_made_up_condition"/);
  });

  it("trade-exempt types still bypass rarity trade floors", async () => {
    const result = await checkBadgeCondition(
      badge({
        type: "friends_added",
        rarity: "legendary",
        value: 1,
      }),
      emptyStats({
        totalTrades: 0,
        friendsAdded: 1,
      }),
    );
    expect(result).toBe(true);
  });
});
