/**
 * Performance Analytics tab (6 Oct 2026) — model derivations plus structural
 * guards on components/dashboard/performance/.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ALL_GAMES,
  TRADING_KEY,
  buildChallengeSummary,
  buildGameCards,
  buildHighlights,
  buildTradingMetrics,
  buildTrend,
  gameOptions,
  percentChange,
  type PerfInput,
} from "@/components/dashboard/performance/performance-model";
import { allPerformanceAssets } from "@/components/dashboard/performance/performance-assets";

const ROOT = process.cwd();
const DIR = "components/dashboard/performance";
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 6, 12);

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function performanceFiles(dir = DIR): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(ROOT, dir))) {
    const rel = join(dir, name).replace(/\\/g, "/");
    if (statSync(resolve(ROOT, rel)).isDirectory()) out.push(...performanceFiles(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

function iso(daysAgo: number): string {
  return new Date(NOW - daysAgo * DAY).toISOString();
}

function fixture(overrides: Partial<PerfInput> = {}): PerfInput {
  return {
    now: NOW,
    showTrading: true,
    overview: {
      roi: 12.5,
      totalTrades: 0,
      winRate: 0,
      totalPnLPercentage: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
    },
    charts: { dailyPnL: [] },
    gamePerformance: [
      {
        gameKey: "provider:p1:g1",
        title: "Game One",
        inCatalogue: true,
        rounds: { started: 4, scored: 3, live: 0 },
        competitions: 2,
        challenges: 0,
        bestScore: null,
        averagePlaySeconds: null,
        lastPlayedAt: iso(2),
      },
    ],
    gameActivity: [{ gameKey: "provider:p1:g1", date: iso(2).slice(0, 10), rounds: 3 }],
    competitions: {
      completed: [
        { gameKey: "provider:p1:g1", endTime: iso(3), currentRank: 1, prizeWon: 40 },
        { gameKey: "trading", endTime: iso(4), currentRank: 5, prizeWon: 0 },
      ],
    },
    challenges: { completed: [{ endTime: iso(5), isWinner: true, prizeWon: 10 }] },
    overviewStanding: { playCards: [] },
    ...overrides,
  } as unknown as PerfInput;
}

describe("performance model", () => {
  it("renders absent values as a dash, never 0 (R45/R50)", () => {
    const h = buildHighlights(fixture(), "30d", ALL_GAMES);
    const byKey = new Map(h.map((x) => [x.key, x]));
    expect(byKey.get("bestScore")?.value).toBe("-");
    expect(byKey.get("playTime")?.value).toBe("-");
    const cards = buildGameCards(fixture(), "30d", ALL_GAMES);
    expect(cards[0].bestScore).toBe("-");
    expect(cards[0].avgPlayTime).toBe("-");
  });

  it("has no period comparison for All time", () => {
    for (const h of buildHighlights(fixture(), "all", ALL_GAMES)) {
      expect(h.delta, h.key).toBeNull();
    }
  });

  it("refuses a percentage change against nothing", () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(15, 10)).toBe(50);
  });

  it("counts 1v1s only under All games — they carry no game label", () => {
    const all = buildChallengeSummary(fixture(), "30d", ALL_GAMES);
    expect(all.played).toBe(1);
    const one = buildChallengeSummary(fixture(), "30d", "provider:p1:g1");
    expect(one.played).toBe(0);
    const h = new Map(buildHighlights(fixture(), "30d", "provider:p1:g1").map((x) => [x.key, x]));
    expect(h.get("challengeWins")?.value).toBe("-");
  });

  it("scopes competitions to the selected game", () => {
    const h = new Map(buildHighlights(fixture(), "30d", "provider:p1:g1").map((x) => [x.key, x]));
    expect(h.get("competitionsWon")?.value).toBe("1");
    expect(h.get("competitionsWon")?.hint).toBe("1 played");
  });

  it("offers Trading as a filter only when trading is shown (R21)", () => {
    expect(gameOptions(fixture()).map((o) => o.value)).toContain(TRADING_KEY);
    expect(gameOptions(fixture({ showTrading: false })).map((o) => o.value)).not.toContain(
      TRADING_KEY,
    );
  });

  it("dashes every trading money figure when there are no trades", () => {
    const m = new Map(buildTradingMetrics(fixture().overview).map((x) => [x.key, x.value]));
    expect(m.get("avgWin")).toBe("-");
    expect(m.get("largestLoss")).toBe("-");
    expect(m.get("totalTrades")).toBe("0");
  });

  it("puts scored rounds on the Games trend series", () => {
    expect(buildTrend(fixture(), "30d", ALL_GAMES).totals.games).toBe(3);
  });
});

describe("performance page structure", () => {
  it("orders desktop sections as the reference does", () => {
    const code = stripComments(read(`${DIR}/DesktopPerformance.tsx`));
    const order = [
      "<PerformanceHeader",
      "<PerformanceHighlights",
      "<GamePerformanceSection",
      "<PerformanceTrendSection",
      "<TradingPerformanceSection",
      'kind="challenges"',
      'kind="competitions"',
      "<MarketHolidaysSection",
    ].map((s) => code.indexOf(s));
    for (const i of order) expect(i).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("ends at the holidays row — no guide sidebar or component strip", () => {
    const code = stripComments(read(`${DIR}/DesktopPerformance.tsx`));
    expect(code.lastIndexOf("<MarketHolidaysSection")).toBeGreaterThan(
      code.lastIndexOf("<PerformanceSummaryPanel"),
    );
    expect(code).not.toMatch(/Guide|Reusable/);
  });

  it("names no game in code (R29)", () => {
    for (const rel of performanceFiles()) {
      expect(stripComments(read(rel)), rel).not.toMatch(
        /circuit-sprint|circuit-perfect|gameCode|providerKey/,
      );
    }
  });

  it("imports server modules as types only (R58)", () => {
    for (const rel of performanceFiles()) {
      const code = stripComments(read(rel));
      for (const statement of code.split(";")) {
        const spec = /from\s+"@\/([^"]+)"/.exec(statement)?.[1];
        if (!spec || !/^(lib\/actions|lib\/services|database)\//.test(spec)) continue;
        if (/^\s*import\s+type\s/.test(statement)) continue;
        const m = [statement, undefined, spec] as const;
        // Reason: judge a module by its imports, never its folder (R58) — a
        // value import is fine only when the target reaches no model or driver.
        const target = stripComments(read(`${m[2]}.ts`));
        expect(target, `${rel} -> ${m[2]}`).not.toMatch(
          /from\s+"(?:@\/database\/|mongoose|mongodb)/,
        );
        expect(target, `${rel} -> ${m[2]}`).not.toMatch(/"use server"/);
      }
    }
  });

  it("gives every carousel control an accessible name", () => {
    const code = stripComments(read(`${DIR}/GamePerformanceSection.tsx`));
    expect(code).toContain('aria-label="Previous games"');
    expect(code).toContain('aria-label="Next games"');
  });

  it("looks icons up in Maps, never by object index", () => {
    for (const rel of [
      `${DIR}/PerformanceHighlights.tsx`,
      `${DIR}/TradingPerformanceSection.tsx`,
      `${DIR}/PerformanceSummaryPanel.tsx`,
    ]) {
      expect(stripComments(read(rel)), rel).toMatch(/new Map/);
    }
  });

  it("uses the Radix select for the game filter (R60)", () => {
    const code = stripComments(read(`${DIR}/PerformanceHeader.tsx`));
    expect(code).toMatch(/from\s+"@\/components\/ui\/select"/);
    expect(code).not.toMatch(/<select\b/);
  });

  it("ships every neon icon it references", () => {
    for (const src of allPerformanceAssets()) {
      expect(existsSync(resolve(ROOT, "public", src.replace(/^\//, ""))), src).toBe(true);
    }
  });
});
