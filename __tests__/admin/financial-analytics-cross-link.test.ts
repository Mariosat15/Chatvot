import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * X6.5 leftover from `12` s5.1a — Financial dashboard points at Analytics for
 * by-game / by-provider contest revenue rather than duplicating the arithmetic.
 */

const FINANCIAL = join(
  process.cwd(),
  "apps/admin/components/admin/FinancialDashboard.tsx",
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("FinancialDashboard cross-links to Competition Analytics", () => {
  it("links to activeTab=analytics for by-game revenue", () => {
    const src = stripComments(readFileSync(FINANCIAL, "utf8"));
    expect(src).toMatch(/activeTab=analytics/);
    expect(src).toMatch(/by game/i);
  });

  it("does not import GameRevenueBreakdown (figures stay on one screen)", () => {
    // Reason: duplicating the breakdown here is how two screens disagree about
    // one game's revenue — the deviation s5.1a recorded rather than absorbing.
    const src = stripComments(readFileSync(FINANCIAL, "utf8"));
    expect(src).not.toMatch(/GameRevenueBreakdown/);
  });
});
