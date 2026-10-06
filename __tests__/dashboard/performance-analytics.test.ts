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
  buildHighlights,
  buildTradingMetrics,
  gameOptions,
  percentChange,
  type PerfInput,
} from "@/components/dashboard/performance/performance-model";
import { buildGameCards } from "@/components/dashboard/performance/performance-game-cards";
import { buildTrend } from "@/components/dashboard/performance/performance-trend";
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
    const game = cards.find((c) => c.gameKey === "provider:p1:g1");
    expect(game?.bestScore).toBe("-");
    expect(game?.avgPlayTime).toBe("-");
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

  it("counts 1v1s for the selected game, using trading when the label is missing", () => {
    const labelled = fixture({
      challenges: {
        completed: [{ endTime: iso(5), isWinner: true, prizeWon: 10, gameKey: "provider:p1:g1" }],
      },
    });
    expect(buildChallengeSummary(labelled, "30d", ALL_GAMES).played).toBe(1);
    expect(buildChallengeSummary(labelled, "30d", "provider:p1:g1").played).toBe(1);
    expect(buildChallengeSummary(labelled, "30d", TRADING_KEY).played).toBe(0);
    const unlabelled = buildChallengeSummary(fixture(), "30d", TRADING_KEY);
    expect(unlabelled.played).toBe(1);
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
    expect(m.get("tradeRoi")).toBe("-");
  });

  it("prints Trade ROI from trading PnL %, not the wallet credit ROI", () => {
    const m = new Map(
      buildTradingMetrics(
        fixture({
          overview: {
            roi: 12.5,
            totalTrades: 4,
            winRate: 50,
            totalPnLPercentage: 3.47,
            profitFactor: 1.2,
            averageWin: 10,
            averageLoss: 5,
            largestWin: 20,
            largestLoss: 8,
          },
        }).overview,
      ).map((x) => [x.key, x.value]),
    );
    expect(m.get("tradeRoi")).toBe("+3.47%");
    expect(m.get("tradeRoi")).not.toBe("+12.50%");
  });

  it("puts scored rounds on the Games trend series", () => {
    expect(buildTrend(fixture(), "30d", ALL_GAMES).totals.games).toBe(3);
  });

  it("puts Trading first in Game Performance when trading chrome is on", () => {
    const all = buildGameCards(fixture(), "30d", ALL_GAMES);
    expect(all.map((c) => c.gameKey)).toEqual([TRADING_KEY, "provider:p1:g1"]);
    expect(all[0].title).toBe("Trading");
    const onlyTrading = buildGameCards(fixture(), "30d", TRADING_KEY);
    expect(onlyTrading.map((c) => c.gameKey)).toEqual([TRADING_KEY]);
    const gamesOnly = buildGameCards(fixture({ showTrading: false }), "30d", ALL_GAMES);
    expect(gamesOnly.map((c) => c.gameKey)).toEqual(["provider:p1:g1"]);
  });

  it("shows Trade ROI on the Trading card Best score, never wallet credit ROI", () => {
    const empty = buildGameCards(fixture(), "30d", TRADING_KEY)[0];
    expect(empty.bestScore).toBe("-");
    expect(empty.activityLabel).toBe("Trades");
    const withTrades = buildGameCards(
      fixture({
        overview: {
          roi: 12.5,
          totalTrades: 4,
          winRate: 50,
          totalPnLPercentage: 3.47,
          profitFactor: 1.2,
          averageWin: 10,
          averageLoss: 5,
          largestWin: 20,
          largestLoss: 8,
        },
      }),
      "30d",
      TRADING_KEY,
    )[0];
    expect(withTrades.bestScore).toBe("+3.47%");
    expect(withTrades.bestScore).not.toBe("+12.5%");
    expect(withTrades.bestScore).not.toBe("12.5%");
  });

  it("pulls tagline and activity label from the overview play card, never invents game copy", () => {
    const cards = buildGameCards(
      fixture({
        overviewStanding: {
          playCards: [
            {
              gameKey: "provider:p1:g1",
              tagline: "Connect the paths, beat the clock!",
              activityLabel: "Races",
              href: "/games/circuit-sprint",
              artSrc: "/assets/neon/banner-circuit-sprint.webp",
            },
          ],
        },
      } as Partial<PerfInput>),
      "30d",
      ALL_GAMES,
    );
    const game = cards.find((c) => c.gameKey === "provider:p1:g1");
    expect(game?.tagline).toBe("Connect the paths, beat the clock!");
    expect(game?.activityLabel).toBe("Races");
    expect(game?.href).toBe("/games/circuit-sprint");
    const model = stripComments(read(`${DIR}/performance-game-cards.ts`));
    expect(model).not.toMatch(/Connect the paths/);
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

  it("uses the Play-by-game card shape: text left, cover art right, bigger two-up grid", () => {
    const code = stripComments(read(`${DIR}/GamePerformanceSection.tsx`));
    expect(code).toMatch(/object-cover object-center/);
    expect(code).toMatch(/lg:grid-cols-2/);
    expect(code).toMatch(/min-h-\[200px\]/);
    expect(code).toMatch(/Best score/);
    expect(code).toMatch(/card\.scoredRounds/);
    expect(code).toMatch(/card\.contests/);
    expect(code).toMatch(/card\.avgPlayTime/);
    expect(code).toMatch(/card\.activityLabel/);
    expect(code).toMatch(/href=\{card\.href\}/);
    expect(code).not.toMatch(/Sparkline/);
    expect(code).not.toMatch(/ChevronLeft|Previous games/);
  });

  it("uses the shared two-tone headline (magenta here, cyan on Wallet)", () => {
    const header = stripComments(read(`${DIR}/PerformanceHeader.tsx`));
    const wallet = stripComments(read("components/dashboard/wallet/WalletAnalyticsHeader.tsx"));
    const shared = stripComments(read("components/dashboard/AnalyticsPageHeadline.tsx"));
    expect(header).toMatch(/lead="Performance"/);
    expect(header).toMatch(/accent="magenta"/);
    expect(header).toMatch(/rounded-\[16px\]/);
    expect(header).toMatch(/border-\[#ff36ca\]\/30/);
    expect(wallet).toMatch(/lead="Wallet"/);
    expect(wallet).toMatch(/accent="cyan"/);
    expect(wallet).toMatch(/border-cyan-400\/30/);
    expect(shared).toMatch(/new Map/);
    expect(shared).toContain("#ff36ca");
    expect(shared).toContain("#00d9ff");
  });

  it("shares the mountain backdrop with Wallet and clips overflow-x without a second scrollbar", () => {
    const desktop = stripComments(read(`${DIR}/DesktopPerformance.tsx`));
    const mobile = stripComments(read(`${DIR}/mobile/MobilePerformance.tsx`));
    const layout = stripComments(read("components/dashboard/DashboardLayout.tsx"));
    expect(desktop).toMatch(/<DashboardBackdrop>/);
    expect(mobile).toMatch(/<DashboardBackdrop>/);
    expect(layout).toMatch(/overflow-x-clip/);
    expect(layout).not.toMatch(/overflow-x-hidden/);
    expect(layout).toMatch(/value="performance"[\s\S]*pb-10/);
    const backdrop = stripComments(read("components/dashboard/DashboardBackdrop.tsx"));
    expect(backdrop).toMatch(/pb-10/);
  });

  it("stamps challenge gameKey in the dashboard payload so a game filter can see 1v1s", () => {
    const process = stripComments(read("lib/actions/dashboard/process-challenges.ts"));
    const action = stripComments(read("lib/actions/comprehensive-dashboard.actions.ts"));
    expect(process).toMatch(/gameKey:/);
    expect(action).toMatch(/const challengeSelect = ".*gameKey/);
    expect(action).toMatch(/prizeByCompetitionId/);
  });

  it("does not invent $10k starting capital when computing Trade ROI", () => {
    const action = stripComments(read("lib/actions/comprehensive-dashboard.actions.ts"));
    expect(action).not.toMatch(/startingCapital \|\| 10000/);
    expect(action).toMatch(/cap > 0/);
  });

  it("ships every neon icon it references", () => {
    for (const src of allPerformanceAssets()) {
      expect(existsSync(resolve(ROOT, "public", src.replace(/^\//, ""))), src).toBe(true);
    }
  });
});
