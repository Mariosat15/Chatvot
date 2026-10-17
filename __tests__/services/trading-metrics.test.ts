/**
 * Tests for shared trading-metric math (lib/services/trading-metrics.ts).
 *
 * These lock the win-rate and profit-factor rules shown on the dashboard,
 * profile, and leaderboard so the numbers can never silently drift apart across
 * surfaces again.
 */
import { describe, it, expect } from "vitest";
import {
  PROFIT_FACTOR_NO_LOSS,
  PROFIT_FACTOR_SCORE_CAP,
  computeProfitFactor,
  clampProfitFactorForScore,
  computeWinRate,
  formatProfitFactor,
} from "@/lib/services/trading-metrics";

describe("computeProfitFactor", () => {
  it("returns grossProfit / grossLoss when there are losses", () => {
    expect(computeProfitFactor(200, 100)).toBe(2);
    expect(computeProfitFactor(50, 200)).toBe(0.25);
  });

  it("returns the no-loss sentinel for a flawless (no losing trades) profitable trader", () => {
    expect(computeProfitFactor(500, 0)).toBe(PROFIT_FACTOR_NO_LOSS);
  });

  it("returns 0 when there is neither profit nor loss", () => {
    expect(computeProfitFactor(0, 0)).toBe(0);
  });
});

describe("clampProfitFactorForScore", () => {
  it("caps the no-loss sentinel so it cannot dominate the leaderboard score", () => {
    expect(clampProfitFactorForScore(PROFIT_FACTOR_NO_LOSS)).toBe(
      PROFIT_FACTOR_SCORE_CAP,
    );
  });

  it("passes through values within range", () => {
    expect(clampProfitFactorForScore(3)).toBe(3);
    expect(clampProfitFactorForScore(PROFIT_FACTOR_SCORE_CAP)).toBe(
      PROFIT_FACTOR_SCORE_CAP,
    );
  });

  it("floors negative / non-finite values to 0", () => {
    expect(clampProfitFactorForScore(-1)).toBe(0);
    expect(clampProfitFactorForScore(Number.NaN)).toBe(0);
  });
});

describe("formatProfitFactor", () => {
  it("shows ∞ for the no-loss sentinel (infinite ratio)", () => {
    expect(formatProfitFactor(PROFIT_FACTOR_NO_LOSS)).toBe("∞");
    expect(formatProfitFactor(9999)).toBe("∞");
    expect(formatProfitFactor(Infinity)).toBe("∞");
  });

  it("shows real profit factors with 2 decimals by default", () => {
    expect(formatProfitFactor(1.73)).toBe("1.73");
    expect(formatProfitFactor(8.4)).toBe("8.40");
    expect(formatProfitFactor(0)).toBe("0.00");
  });

  it("respects a custom decimal count", () => {
    expect(formatProfitFactor(2.5, 1)).toBe("2.5");
  });

  it("treats null/undefined as 0", () => {
    expect(formatProfitFactor(null)).toBe("0.00");
    expect(formatProfitFactor(undefined)).toBe("0.00");
  });
});

describe("computeWinRate", () => {
  it("computes wins over decisive trades", () => {
    expect(computeWinRate(5, 5)).toBe(50);
    expect(computeWinRate(3, 1)).toBe(75);
  });

  it("excludes breakeven trades from the denominator", () => {
    // 5 wins, 5 losses, (breakevens are simply not passed in) → 50%
    // A caller that incorrectly folded 10 breakevens into losses would get
    // 5 / 15 = 33% — this asserts the decisive-only behaviour.
    expect(computeWinRate(5, 5)).toBe(50);
  });

  it("returns 0 when there are no decisive trades", () => {
    expect(computeWinRate(0, 0)).toBe(0);
  });

  it("returns 100 for an all-wins record", () => {
    expect(computeWinRate(8, 0)).toBe(100);
  });
});
