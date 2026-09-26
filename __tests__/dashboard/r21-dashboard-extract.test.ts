/**
 * R21 dashboard extract --- structural guards (no DB).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("R21 dashboard extract (structural)", () => {
  const megaActionPath = "lib/actions/comprehensive-dashboard.actions.ts";
  const chartsPath = "lib/actions/dashboard/charts.ts";
  const processCompetitionsPath = "lib/actions/dashboard/process-competitions.ts";
  const processChallengesPath = "lib/actions/dashboard/process-challenges.ts";

  it("mega-action imports dashboard process and chart helpers", () => {
    const source = stripComments(read(megaActionPath));
    expect(source).toMatch(
      /from\s+["']\.\/dashboard\/process-competitions["']/,
    );
    expect(source).toMatch(
      /from\s+["']\.\/dashboard\/process-challenges["']/,
    );
    expect(source).toMatch(/from\s+["']\.\/dashboard\/charts["']/);
    expect(source).toMatch(/processCompetitionParticipations\s*\(/);
    expect(source).toMatch(/processChallengeParticipations\s*\(/);
    expect(source).toMatch(/buildChartData\s*\(/);
    expect(source).toMatch(/calculateStreaks\s*\(/);
  });

  it("mega-action still exports getComprehensiveDashboardData", () => {
    const source = stripComments(read(megaActionPath));
    expect(source).toMatch(
      /export\s+async\s+function\s+getComprehensiveDashboardData\s*\(/,
    );
  });

  it("mega-action re-exports ComprehensiveDashboardData", () => {
    const source = stripComments(read(megaActionPath));
    expect(source).toMatch(
      /export\s+type\s+\{\s*ComprehensiveDashboardData\s*\}\s+from\s+["']\.\/dashboard\/types["']/,
    );
  });

  it("mega-action no longer defines moved helpers or CompetitionData interface", () => {
    const source = stripComments(read(megaActionPath));
    expect(source).not.toMatch(/async\s+function\s+buildChartData\s*\(/);
    expect(source).not.toMatch(/function\s+calculateStreaks\s*\(/);
    expect(source).not.toMatch(/interface\s+CompetitionData\b/);
  });

  it("process-competitions calls createDashboardRankResolver", () => {
    const source = stripComments(read(processCompetitionsPath));
    expect(source).toMatch(/createDashboardRankResolver\s*\(\s*\)/);
  });

  it("process-challenges uses getDashboardRankingValue", () => {
    const source = stripComments(read(processChallengesPath));
    expect(source).toMatch(/getDashboardRankingValue\s*\(/);
  });

  it("charts.ts exports buildChartData and calculateStreaks", () => {
    const source = stripComments(read(chartsPath));
    expect(source).toMatch(/export\s+async\s+function\s+buildChartData\s*\(/);
    expect(source).toMatch(/export\s+function\s+calculateStreaks\s*\(/);
  });

  it("gates TradeHistory and open positions behind needsTradeHistory (R21)", () => {
    const source = stripComments(read(megaActionPath));
    expect(source).toMatch(/const\s+needsTradeHistory\s*=/);
    expect(source).toMatch(/TradeHistory\.exists\s*\(/);
    // Reason: both finds and the aggregate must sit behind the gate — a bare
    // presence check on TradeHistory.find would still pass if only one path gated.
    const findMatches = [
      ...source.matchAll(/needsTradeHistory\s*\?\s*TradeHistory\.find/g),
    ];
    expect(findMatches.length).toBeGreaterThanOrEqual(2);
    expect(source).toMatch(
      /needsTradeHistory\s*\?\s*await\s+TradeHistory\.aggregate/,
    );
    expect(source).toMatch(
      /needsTradeHistory\s*\?\s*await\s+TradingPosition\.find/,
    );
  });

  it("DashboardLayout withholds trading chrome when games-only (R21)", () => {
    const source = stripComments(
      read("components/dashboard/DashboardLayout.tsx"),
    );
    expect(source).toMatch(/showTradingChrome/);
    expect(source).toMatch(
      /tradingEnabled\s*\|\|\s*overview\.totalTrades\s*>\s*0/,
    );
    // Reason: count PerformanceRings mounts — must be inside the gate, not beside it.
    const ringsIdx = source.indexOf("<PerformanceRings");
    const gateIdx = source.lastIndexOf("showTradingChrome", ringsIdx);
    expect(ringsIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(ringsIdx);
  });
});
