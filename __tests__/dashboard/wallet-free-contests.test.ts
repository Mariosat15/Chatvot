import { describe, it, expect } from "vitest";
import { buildChartData } from "@/lib/actions/dashboard/charts";
import { categoryByKey } from "@/components/dashboard/wallet/wallet-categories";

/**
 * Free private contests in the Credit Breakdown.
 *
 * Reason: owner 6 Oct 2026 — "Other" showed 2,368 credits. Reserve and release rows
 * were both summed by absolute size into "Other", so a fully returned reserve read as
 * twice its value SPENT, and a sponsored player's +fee/-fee pair (balance unchanged)
 * appeared as a contest entry plus an "Other" credit. Behavioural on purpose: the bug
 * was in the arithmetic, which no structural check can see.
 */

const today = new Date().toISOString();

function tx(transactionType: string, amount: number) {
  return { transactionType, amount, createdAt: today, balanceAfter: 0 };
}

function breakdownTotals(rows: ReturnType<typeof tx>[]) {
  const charts = buildChartData("u", [], rows, 0) as unknown as Promise<{
    dailyCreditBreakdown: Record<string, number | string>[];
    dailyCreditFlow: { inflow: number; outflow: number; transactions: number }[];
  }>;
  return charts;
}

function sum(rows: Record<string, number | string>[], key: string): number {
  return rows.reduce((s, r) => s + (Number(new Map(Object.entries(r)).get(key)) || 0), 0);
}

describe("free contest funding", () => {
  it("nets a reserve against its return and leaves Other empty", async () => {
    const { dailyCreditBreakdown } = await breakdownTotals([
      tx("free_private_reserve", -1000),
      tx("free_private_reserve_release", 600),
      tx("free_private_gm_refund", 150),
    ]);
    expect(sum(dailyCreditBreakdown, "freeContests")).toBe(250);
    expect(sum(dailyCreditBreakdown, "other")).toBe(0);
  });

  it("a fully returned reserve counts as zero, not twice its size", async () => {
    const { dailyCreditBreakdown } = await breakdownTotals([
      tx("free_private_reserve", -1000),
      tx("free_private_reserve_release", 1000),
    ]);
    expect(sum(dailyCreditBreakdown, "freeContests")).toBe(0);
  });

  it("a sponsored seat moves nothing for the player", async () => {
    const { dailyCreditBreakdown, dailyCreditFlow } = await breakdownTotals([
      tx("free_private_entry_sponsor", 50),
      tx("free_private_entry_payment", -50),
    ]);
    expect(sum(dailyCreditBreakdown, "contestEntries")).toBe(0);
    expect(sum(dailyCreditBreakdown, "entries")).toBe(0);
    expect(sum(dailyCreditBreakdown, "other")).toBe(0);
    const flow = dailyCreditFlow.reduce((s, d) => s + d.inflow + d.outflow + d.transactions, 0);
    expect(flow).toBe(0);
  });

  it("platform fees still land in Other", async () => {
    const { dailyCreditBreakdown } = await breakdownTotals([tx("platform_fee", -20)]);
    expect(sum(dailyCreditBreakdown, "other")).toBe(20);
  });

  it("is neither spending nor earnings, and is not stacked on the chart", () => {
    const def = categoryByKey("freeContests");
    expect(def).toBeDefined();
    expect(def?.spendMetric).toBe(false);
    expect(def?.earnMetric).toBe(false);
    expect(def?.chart).toBe(false);
    expect(def?.summary).toBe(true);
  });
});
