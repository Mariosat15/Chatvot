/**
 * Competition analytics, per game - `12` s5's reporting slice.
 *
 * BEHAVIOURAL where it can be, because the grouping arithmetic and every "absent is not zero"
 * rule can be checked by calling a pure function. The structural tests at the end cover the two
 * claims that live in the route and the component rather than in the module.
 *
 * The defects these pin are all one shape: a figure that renders perfectly and means something
 * other than what its caption says.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  resolveGameBadge,
  resolvePlayerMetric,
  resolveShareOfPool,
  summariseByGame,
  summariseByProvider,
  resolveGameFilterOptions,
  filterByGame,
  resolveScopeNote,
  ALL_GAMES,
  TRADING_GAME_KEY,
  type AnalyticsContestRow,
} from "../../apps/admin/lib/admin/contest-analytics-presentation";

const ADMIN = join(process.cwd(), "apps", "admin");

/** A contest row with only the fields a given test cares about set. */
function contest(overrides: Partial<AnalyticsContestRow> = {}): AnalyticsContestRow {
  return {
    status: "completed",
    participants: 0,
    totalCollected: 0,
    totalWinnersPaid: 0,
    platformFeeEarned: 0,
    totalRefunds: 0,
    unclaimedPool: 0,
    ...overrides,
  };
}

function providerContest(
  overrides: Partial<AnalyticsContestRow> = {},
): AnalyticsContestRow {
  return contest({
    gameType: "provider",
    gameKey: "provider:chartvolt-games:circuit-sprint",
    providerKey: "chartvolt-games",
    gameCode: "circuit-sprint",
    gameDisplayName: "Circuit Sprint",
    providerDisplayName: "ChartVolt Games",
    ...overrides,
  });
}

describe("a contest is labelled by its game, and grouped by the immutable key", () => {
  it("labels a trading contest, including one written before the label existed", () => {
    expect(resolveGameBadge(contest()).label).toBe("Trading");
    expect(resolveGameBadge(contest()).key).toBe(TRADING_GAME_KEY);
    // Invariant 5: an absent label resolves to trading. A contest predating X1 must group with
    // the trading rows rather than into a nameless bucket of its own.
    expect(resolveGameBadge(contest({ gameType: null, gameKey: null })).key).toBe(
      TRADING_GAME_KEY,
    );
  });

  it("labels a provider contest with the catalogue name and the provider", () => {
    const badge = resolveGameBadge(providerContest());
    expect(badge.label).toBe("Circuit Sprint");
    expect(badge.provider).toBe("ChartVolt Games");
    expect(badge.isProviderGame).toBe(true);
  });

  /**
   * GROUPING ON THE DISPLAY NAME IS THE DEFECT THIS PREVENTS. `gameKey` is immutable and is the
   * join key for every historical figure; a display name is catalogue content an operator can
   * edit. Group by the name and renaming a title splits one game's revenue into two rows that
   * each look complete - no error, no log line, and the totals still add up.
   */
  it("groups on the key, so renaming a title does not split its history", () => {
    const rows = [
      providerContest({ totalCollected: 100 }),
      providerContest({ gameDisplayName: "Circuit Sprint II", totalCollected: 50 }),
    ];

    const summary = summariseByGame(rows);
    expect(summary).toHaveLength(1);
    expect(summary[0].collected).toBe(150);
  });

  /**
   * A retired title still has settled contests, and `gameKey` is immutable precisely so its
   * history stays addressable (R29). A row captioned "Unknown game" holding real revenue is a
   * row an operator cannot investigate.
   */
  it("falls back through the code and the key, never to Unknown", () => {
    const noName = resolveGameBadge(
      providerContest({ gameDisplayName: null, providerDisplayName: null }),
    );
    expect(noName.label).toBe("circuit-sprint");
    expect(noName.provider).toBe("chartvolt-games");

    const noCode = resolveGameBadge(
      providerContest({ gameDisplayName: null, gameCode: null }),
    );
    expect(noCode.label).toBe("provider:chartvolt-games:circuit-sprint");
  });

  /**
   * The X1 backfill has not been applied to production, so unlabelled provider rows exist.
   * Collapsing them all under one constant would merge two different games' money into one
   * line, which is worse than keying on the provider and code the contest does carry.
   */
  it("composes a key for a provider contest whose gameKey never got written", () => {
    const badge = resolveGameBadge(providerContest({ gameKey: "" }));
    expect(badge.key).toBe("provider:chartvolt-games:circuit-sprint");
  });
});

describe("the player metric is the one the contest was actually ranked on", () => {
  /**
   * **R46 ONE SCREEN ALONG.** `prize-payout.service.ts` writes `finalScore` and deliberately no
   * `finalPnl` for a provider contest, and the schema-shaped default meant the column rendered
   * `+0.00` in green for every game winner while the ranking number sat unread in the same
   * document. An absent fact presented as a measured zero.
   */
  it("shows a score for a provider game and P&L for trading", () => {
    const game = resolvePlayerMetric({ finalScore: 8420 }, true);
    expect(game.label).toMatch(/score/i);
    expect(game.value).toContain("8,420");

    const trading = resolvePlayerMetric({ finalPnl: -12.5 }, false);
    expect(trading.label).toMatch(/p&l/i);
    expect(trading.value).toContain("12.5");
  });

  it("renders an absent score as a dash and never as zero", () => {
    const absent = resolvePlayerMetric({}, true);
    expect(absent.value).toBe("-");
    expect(absent.tone).toBe("neutral");
  });

  /**
   * The one deliberate difference from the contest view screen. A ledger row carries no
   * percentage, and the shared resolver's trading branch resolves an absent `pnlPercentage` to
   * `0` - correctly, because on a participant SEAT that zero is a stored fact. Passing it
   * through here would print `+0.00%` under a genuine profit, which is the exact confusion this
   * module exists to remove. The resolver is not changed to suit this caller, because its other
   * consumer reads a seat.
   */
  it("drops the percentage sub-line, which a ledger row cannot carry", () => {
    expect(resolvePlayerMetric({ finalPnl: 340.2 }, false).sub).toBeNull();
    expect(resolvePlayerMetric({ finalScore: 12 }, true).sub).toBeNull();
  });
});

describe("share of pool replaces a column that was always zero", () => {
  /**
   * Nothing writes `metadata.percentage` on a `competition_win` row - checked with `rg` across
   * both apps and both copies of the payout stage - so `metadata?.percentage || 0` rendered
   * `0%` against every winner of every competition ever settled. Deriving the share from the
   * amount and the pool is also the BETTER figure: after redistribution and ties, the share
   * actually paid at a rank is routinely not the share configured for it (R45).
   */
  it("derives the share from the amount paid and the pool", () => {
    expect(resolveShareOfPool(70, 100)).toBeCloseTo(70, 5);
    expect(resolveShareOfPool(33.5, 100)).toBeCloseTo(33.5, 5);
  });

  it("returns no share at all rather than zero when there is no pool", () => {
    // A rank paying nothing out of a pool of nothing is not "0% of the pool"; there is no
    // ratio, and printing one invites an operator to look for the other 100%.
    expect(resolveShareOfPool(0, 0)).toBeNull();
    expect(resolveShareOfPool(10, null)).toBeNull();
    expect(resolveShareOfPool(null, 100)).toBeNull();
    expect(resolveShareOfPool(Number.NaN, 100)).toBeNull();
  });

  it("does report a genuine zero share when the pool exists", () => {
    // The complement of the test above, and it must be a separate one: a guard returning null
    // for both cases collapses "no ratio" and "a ratio of zero" into one answer.
    expect(resolveShareOfPool(0, 500)).toBe(0);
  });
});

describe("the by-game and by-provider summaries are different questions", () => {
  const rows = [
    contest({ totalCollected: 400, totalWinnersPaid: 300, platformFeeEarned: 100, participants: 8 }),
    providerContest({ totalCollected: 200, totalWinnersPaid: 150, platformFeeEarned: 50, participants: 4 }),
    providerContest({
      gameKey: "provider:chartvolt-games:pattern-lock",
      gameCode: "pattern-lock",
      gameDisplayName: "Pattern Lock",
      totalCollected: 100,
      totalWinnersPaid: 60,
      platformFeeEarned: 40,
      participants: 2,
    }),
  ];

  /**
   * `12` s5 asks for both, and it is not redundancy: **provider cost is per-provider, not
   * per-title**, so a commercial decision is made against the provider figure while an operator
   * schedules against the title figure.
   */
  it("splits two titles from one provider by game and merges them by provider", () => {
    const byGame = summariseByGame(rows);
    expect(byGame.map((g) => g.label)).toEqual([
      "Trading",
      "Circuit Sprint",
      "Pattern Lock",
    ]);

    const byProvider = summariseByProvider(rows);
    expect(byProvider).toHaveLength(2);
    const games = byProvider.find((g) => g.isProviderGame);
    expect(games?.label).toBe("ChartVolt Games");
    expect(games?.collected).toBe(300);
    expect(games?.contests).toBe(2);
  });

  /**
   * Trading is a group rather than an exclusion. A comparison with one side missing is what
   * made every earlier version of this screen misleading - it is the "no aggregate may silently
   * mean trading only" rule read backwards, since a total silently meaning "all games added
   * together" is equally unusable when the economics differ.
   */
  it("includes trading in the provider comparison, labelled as ours", () => {
    const trading = summariseByProvider(rows).find((g) => !g.isProviderGame);
    expect(trading?.label).toBe("Trading");
    expect(trading?.provider).toBeNull();
    expect(trading?.collected).toBe(400);
  });

  it("computes the payout ratio and average pot, and nulls them when there is no basis", () => {
    const [trading] = summariseByGame(rows);
    expect(trading.payoutRatio).toBeCloseTo(75, 5);
    expect(trading.averagePot).toBeCloseTo(400, 5);

    const [empty] = summariseByGame([contest({ totalCollected: 0, status: "cancelled" })]);
    // Reason `null` and not `0`: a game that collected nothing has no payout ratio, and `0%`
    // reads as "we paid nothing out of what we took", which is a claim about generosity.
    expect(empty.payoutRatio).toBeNull();
    expect(empty.averagePot).toBeNull();
    expect(empty.cancelled).toBe(1);
  });

  /**
   * One bad figure in one contest would otherwise turn a whole game's revenue line into `NaN`,
   * and every derived ratio with it - a total that reads as a rendering bug rather than as a
   * data problem in one row, so the actual cause is invisible.
   */
  it("treats a non-finite figure as absent rather than poisoning the total", () => {
    const summary = summariseByGame([
      contest({ totalCollected: 100 }),
      contest({ totalCollected: Number.NaN }),
      contest({ totalCollected: Number.POSITIVE_INFINITY }),
    ]);
    expect(summary[0].collected).toBe(100);
    expect(summary[0].contests).toBe(3);
  });

  /**
   * A summary mixing recorded revenue with inferred revenue and saying so is usable; one that
   * does not is a number nobody can reconcile against the ledger.
   */
  it("counts how many fee figures were estimated rather than read from the ledger", () => {
    const summary = summariseByGame([
      contest({ platformFeeEarned: 10, platformFeeEstimated: true }),
      contest({ platformFeeEarned: 10 }),
    ]);
    expect(summary[0].estimatedFeeContests).toBe(1);
  });

  it("sorts by entry-fee volume and breaks ties on the label, so refreshes are stable", () => {
    const summary = summariseByGame([
      providerContest({ gameKey: "b", gameDisplayName: "Beta", totalCollected: 50 }),
      providerContest({ gameKey: "a", gameDisplayName: "Alpha", totalCollected: 50 }),
      contest({ totalCollected: 900 }),
    ]);
    expect(summary.map((g) => g.label)).toEqual(["Trading", "Alpha", "Beta"]);
  });
});

describe("the filter is built from the contests present, not from the catalogue", () => {
  /**
   * A retired or deleted title still has settled contests. A filter built from the catalogue
   * would leave those rows in the list and unreachable by any selection, which reads as data
   * loss rather than as a missing option.
   */
  it("offers an option for a game that is no longer in the catalogue", () => {
    const options = resolveGameFilterOptions([
      providerContest({ gameDisplayName: null, providerDisplayName: null }),
    ]);
    expect(options[0].key).toBe(ALL_GAMES);
    expect(options.map((o) => o.key)).toContain(
      "provider:chartvolt-games:circuit-sprint",
    );
  });

  it("filters to one game and treats all as the identity", () => {
    const rows = [contest(), providerContest()];
    expect(filterByGame(rows, ALL_GAMES)).toHaveLength(2);
    expect(filterByGame(rows, TRADING_GAME_KEY)).toHaveLength(1);
    expect(
      filterByGame(rows, "provider:chartvolt-games:circuit-sprint"),
    ).toHaveLength(1);
  });

  /**
   * The keys come from stored data, and an object lookup walks the prototype chain -
   * `__proto__` and `constructor` are truthy and survive a presence check. Third instance
   * after the round-inspector action map and the competition update allow-list.
   */
  it("is not confused by a prototype key arriving as a selection", () => {
    const rows = [contest(), providerContest()];
    for (const hostile of ["__proto__", "constructor", "toString"]) {
      expect(filterByGame(rows, hostile)).toHaveLength(0);
    }
  });
});

describe("the screen says what its figures actually cover", () => {
  /**
   * The route reads the 50 most recently finished competitions, and every headline card is a
   * reduction over that list - so "Platform Fees Earned" has always meant "of the last 50"
   * while being captioned as a total. That is the same binding rule failing along the window
   * axis rather than the game axis.
   *
   * The arithmetic is deliberately NOT widened here: a behaviour change in the same edit as a
   * labelling fix destroys the only evidence the labelling fix was safe.
   */
  it("names the window when the list is capped and the true count when it is not", () => {
    expect(resolveScopeNote(50, 50)).toMatch(/50 most recently finished/);
    expect(resolveScopeNote(50, 50)).toMatch(/not all time/i);
    expect(resolveScopeNote(12, 50)).toMatch(/all 12 finished/);
    expect(resolveScopeNote(12, 50)).not.toMatch(/not all time/i);
  });
});

describe("the route's guard and the shape it returns", () => {
  const route = readFileSync(
    join(ADMIN, "app", "api", "competition-analytics", "route.ts"),
    "utf8",
  );

  /** The file discusses the anti-patterns in prose, so a test that reads prose is useless. */
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  /**
   * **THIS WAS A LIVE AUTHORIZATION DEFECT.** The route authenticated with `verifyAdminToken`,
   * which is token validity and not section access, so any employee holding an admin token
   * could read every competition's revenue, fees and payouts regardless of their grants. Sixth
   * instance of that class after Prerequisite A, the internal-secret fallbacks, the
   * suspicion-score route, the provider admin routes and the competition update route.
   */
  it("guards on the analytics section grant, not merely on being an admin", () => {
    const code = stripComments(route);
    expect(code).toContain('guardSection("analytics")');
    expect(code).not.toContain("verifyAdminToken");
    expect(code).not.toContain("requireAdminAuth");
    // Counted, not merely found: a file whose GET is guarded and whose mutation is not passes
    // any mention-based check while leaving the mutation open.
    const handlers =
      code.match(/export async function (GET|POST|PATCH|PUT|DELETE)/g) ?? [];
    const guards = code.match(/guardSection\(/g) ?? [];
    expect(handlers.length).toBeGreaterThan(0);
    expect(guards.length).toBe(handlers.length);
  });

  /**
   * The screen cannot label a game it was never told about. Asserted on the route because the
   * component's fallbacks are good enough to hide the omission - every provider contest would
   * simply render its own key, which looks like a catalogue problem rather than a missing
   * projection.
   */
  it("sends the catalogue and provider names the labels need", () => {
    const code = stripComments(route);
    expect(code).toContain("gameDisplayName");
    expect(code).toContain("providerDisplayName");
    expect(code).toContain("ProviderGame");
    expect(code).toContain("GameProvider");
  });

  /** `finalScore` is what a provider contest's ledger row carries; without it the column is blank. */
  it("sends the score a provider contest was ranked on", () => {
    expect(stripComments(route)).toContain("finalScore");
  });

  /**
   * The limit is sent rather than duplicated in the component. Two copies of a window figure is
   * the "one rule, two copies" shape, and the failure is silent: raising the route's limit
   * leaves the caption naming the old one, which is a scope note that lies.
   */
  it("sends its own contest limit so the caption cannot drift from it", () => {
    expect(stripComments(route)).toMatch(/contestLimit:\s*CONTEST_LIMIT/);
  });
});

describe("the component consumes the shared rules rather than repeating them", () => {
  const component = readFileSync(
    join(ADMIN, "components", "admin", "CompetitionAnalytics.tsx"),
    "utf8",
  );

  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  /**
   * The rule that keeps the screen game-agnostic: a `switch` on game code, or an
   * `if (gameKey === ...)`, is the one failure mode a "works for any game" claim has. The next
   * game then silently fails to appear correctly while every existing test still passes.
   */
  it("branches on nothing game-specific", () => {
    const code = stripComments(component);
    expect(code).not.toMatch(/===\s*["']trading["']/);
    expect(code).not.toContain("circuit-sprint");
    expect(code).not.toContain("chartvolt-games");
  });

  /**
   * The metric column must come from the shared resolver. Two screens disagreeing about whether
   * an absent score is `0` or `-` is the defect rather than the styling.
   */
  it("resolves the metric and the share through the shared module", () => {
    const code = stripComments(component);
    expect(code).toMatch(/resolvePlayerMetric\(/);
    expect(code).toMatch(/resolveShareOfPool\(/);
    // The negative half is load-bearing: importing the resolver is trivially satisfied by a
    // component that then formats P&L the old way beside it.
    expect(code).not.toMatch(/finalPnl\s*\?\?\s*0/);
    expect(code).not.toMatch(/percentage\s*\|\|\s*0/);
  });

  it("renders the scope note, so no card is captioned as an all-time total", () => {
    expect(stripComments(component)).toMatch(/resolveScopeNote\(/);
  });
});
