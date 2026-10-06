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
import { heroObjectPosition } from "@/components/dashboard/performance/performance-hero-art";
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

  it("uses the Image-1 card: full-width hero, identity, 2x2 metrics, sparkline, two-up carousel", () => {
    const section = stripComments(read(`${DIR}/GamePerformanceSection.tsx`));
    const card = stripComments(read(`${DIR}/GamePerformanceCard.tsx`));
    expect(card).toMatch(/game-hero/);
    expect(card).toMatch(/h-\[132px\]/);
    expect(card).toMatch(/object-cover/);
    expect(card).toMatch(/heroObjectPosition/);
    expect(card).toMatch(/ResizeObserver/);
    expect(card).not.toMatch(/object-\[center_38%\]/);
    expect(section).not.toMatch(/controls=\{arrows\}/);
    expect(card).toMatch(/View Details/);
    expect(card).toMatch(/Best score/);
    expect(card).toMatch(/card\.scoredRounds/);
    expect(card).toMatch(/card\.contests/);
    expect(card).toMatch(/card\.avgPlayTime/);
    expect(card).toMatch(/GameSparkline/);
    expect(card).not.toMatch(/w-\[44%\]|w-\[42%\]/);
    expect(card).not.toMatch(/lg:grid-cols-2/);
    expect(section).toMatch(/sm:w-\[calc\(\(100%-1rem\)\/2\)\]/);
    expect(section).toMatch(/px-11/);
    expect(section).not.toMatch(/-translate-x-1\/2/);
    expect(section).toMatch(/Previous games/);
    expect(section).toMatch(/Next games/);
    expect(section).toMatch(/ChevronLeft/);
    expect(section).not.toMatch(/lg:grid-cols-2/);
    expect(section).toMatch(/Every game you have played, including trading\./);
    expect(section).not.toMatch(/artwork, metrics and trend/);
    const summary = stripComments(read(`${DIR}/PerformanceSummaryPanel.tsx`));
    expect(summary).toMatch(/Volts won/);
    expect(summary).not.toMatch(/Credits won/);
  });

  it("pins Game Performance heroes to the top of key art when the box is a wide strip", () => {
    // 16:9 art in a ~3.4:1 strip (132–148px hero) — same cut that hid Circuit Sprint's wordmark.
    expect(heroObjectPosition(1280, 720, 500, 148)).toBe("center top");
    expect(heroObjectPosition(1280, 720, 460, 318)).toBe("center center");
    expect(heroObjectPosition(0, 0, 100, 100)).toBe("center top");
  });

  it("Trading Game Performance card uses cyan; other titles never named (R29)", () => {
    const model = stripComments(read(`${DIR}/performance-game-cards.ts`));
    expect(model).toMatch(/if \(gameKey === TRADING_KEY\) return "cyan"/);
    expect(model).toMatch(/new Map/);
    expect(buildGameCards(fixture(), "30d", TRADING_KEY)[0].accent).toBe("cyan");
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

  it("rebuilds mobile as its own tree, not a shrink of desktop", () => {
    const mobile = stripComments(read(`${DIR}/mobile/MobilePerformance.tsx`));
    const order = [
      "<MobilePerformanceHeader",
      "<MobileOverallPerformanceCard",
      "<MobilePerformanceHighlights",
      "<MobileGamePerformanceCarousel",
      "<MobilePerformanceTrend",
      "<MobilePerformanceModeTabs",
      "<MobileTradingPerformance",
      'kind="challenges"',
      'kind="competitions"',
      "<MobileMarketHolidays",
    ].map((s) => mobile.indexOf(s));
    for (const i of order) expect(i).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(mobile).not.toMatch(/<PerformanceHeader/);
    expect(mobile).not.toMatch(/<GamePerformanceSection/);
    expect(mobile).not.toMatch(/<PerformanceTrendSection/);
    expect(mobile).not.toMatch(/<TradingPerformanceSection/);
    expect(mobile).not.toMatch(/<PerformanceSummaryPanel/);
    expect(mobile).not.toMatch(/<MarketHolidaysSection/);
    const highlights = stripComments(read(`${DIR}/mobile/MobilePerformanceHighlights.tsx`));
    expect(highlights).toMatch(/snap-x/);
    expect(highlights).toMatch(/58vw/);
    expect(highlights).not.toMatch(/grid-cols-8|2xl:grid-cols-8/);
    const games = stripComments(read(`${DIR}/mobile/MobileGamePerformanceCarousel.tsx`));
    expect(games).toMatch(/aria-label="Previous game"/);
    expect(games).toMatch(/aria-label="Next game"/);
    expect(games).toMatch(/snap-center/);
    const trading = stripComments(read(`${DIR}/mobile/MobileTradingPerformance.tsx`));
    expect(trading).toMatch(/grid-cols-2/);
    expect(trading).not.toMatch(/2xl:grid-cols-8/);
    const trend = stripComments(read(`${DIR}/mobile/MobilePerformanceTrend.tsx`));
    expect(trend).toMatch(/s\.key !== "overall"/);
    expect(trend).toMatch(/h-\[250px\]/);
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
