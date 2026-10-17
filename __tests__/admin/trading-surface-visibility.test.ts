/**
 * Withholding trading's own admin screens once the platform has stopped trading - `12` s5's two
 * hide-when-trading-off rows and `12` s9's TRADING-group acceptance criterion.
 *
 * WHAT THE TWO PLAN ENTRIES ACTUALLY ASK FOR, because they read like three separate items and
 * are one. `12` s5 names `TradingHistorySection.tsx` and `PriceHealthWidget.tsx`; `12` s9 says
 * `tradingEnabled = false` hides the whole TRADING group. Both of those screens are reached
 * ONLY through that group - they have no other caller anywhere in `apps/admin` - so hiding the
 * group satisfies the two rows and four screens they did not name. Worth stating rather than
 * letting a summary imply two components learned a flag.
 *
 * THE RULE IS DELIBERATELY NOT `tradingEnabled` ALONE, which is what both entries literally say.
 * The reasoning is in `lib/admin/trading-surface.ts` and the tests for it are below: switching
 * trading off does not close the contests already running, and an operator whose price feed dies
 * mid-contest must not be looking at a page that removed the tile telling them so.
 *
 * MOSTLY BEHAVIOURAL. The rule itself is four lines of boolean logic and its resolver is a pair
 * of database reads, both of which are worth exercising against a real MongoDB. The structural
 * tests cover the three properties that are about code rather than data: that the two consumers
 * share one definition, that the default fails open, and - the load-bearing one - that the
 * withholding is confined to the sidebar and does NOT gate the render or the tab strip.
 *
 * WHICH COPY OF EACH MODEL THIS SEEDS IS NOT A FREE CHOICE. vitest maps `@` to the repository
 * root, so the admin service's `@/database/...` imports resolve to the MAIN app's models. This
 * file seeds those. Seeding the admin copies puts fixtures on a Mongoose instance the service
 * never touches, and every assertion fails on an empty collection - which reads exactly like a
 * logic bug.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const Competition = (
  await import("../../database/models/trading/competition.model")
).default;
const { WhiteLabel } = await import("../../database/models/whitelabel.model");

const {
  isTradingSurfaceRelevant,
  TRADING_SURFACE_VISIBLE_BY_DEFAULT,
} = await import("../../apps/admin/lib/admin/trading-surface");

const { getTradingSurfaceVisibility, shouldShowPriceFeed } = await import(
  "../../apps/admin/lib/services/games/live-contest-overview.service"
);

const { TRADING_MENU_ID } = await import(
  "../../apps/admin/lib/admin/game-sections"
);

const PROVIDER_KEY = "mock-provider";
const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${PROVIDER_KEY}:${GAME_CODE}`;

const ROOT = join(__dirname, "..", "..");

/** Comments are stripped first: these files explain the fail-open reasoning in prose, so a test
 *  that reads prose passes a broken file whose only mention of the right thing is a comment. */
function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SIDEBAR = "apps/admin/components/admin/AdminDashboard.tsx";
const DASHBOARD_PAGE = "apps/admin/app/dashboard/page.tsx";
const RULE = "apps/admin/lib/admin/trading-surface.ts";
const OVERVIEW_SERVICE =
  "apps/admin/lib/services/games/live-contest-overview.service.ts";

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections(["competitions", "whitelabels"]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

async function setEnabledGames(types: string[]): Promise<void> {
  await WhiteLabel.create({ enabledGameTypes: types });
}

interface ContestOptions {
  status: string;
  provider?: boolean;
  /**
   * Strips the contest's own label after saving, which is the shape the X1 backfill leaves
   * behind in production.
   *
   * Reason it cannot be seeded absent: `gameKey` is `required` on `Competition`, so the model
   * refuses it - which is why the field has to be removed with the raw driver afterwards. That
   * is not a fixture taking a liberty: the Game Master route inserts with the raw driver and so
   * has always been able to write a row this way (R7).
   */
  unlabelled?: boolean;
}

async function seedContest(options: ContestOptions) {
  const now = Date.now();
  const provider = options.provider ?? false;

  const contest = await Competition.create({
    name: provider ? "Puzzle Cup" : "Forex Cup",
    slug: `cup-${now}-${Math.random().toString(16).slice(2)}`,
    description: "A seeded contest",
    gameType: provider ? "provider" : "trading",
    gameKey: provider ? GAME_KEY : "trading",
    ...(provider
      ? {
          gameConfig: {
            providerKey: PROVIDER_KEY,
            gameCode: GAME_CODE,
            settings: {},
          },
          playWindowStart: new Date(now - 60_000),
          playWindowEnd: new Date(now + 3_600_000),
          resultGracePeriodSeconds: 600,
          attemptsPolicy: "single",
          unresolvedRoundPolicy: "score_zero",
        }
      : { startingCapital: 10_000 }),
    status: options.status,
    competitionType: "time_based",
    startTime: new Date(now - 120_000),
    endTime: new Date(now + 7_200_000),
    registrationDeadline: new Date(now - 120_000),
    entryFee: 5,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 0,
    prizePool: 100,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    createdBy: new mongoose.Types.ObjectId().toString(),
  });

  if (options.unlabelled) {
    await Competition.collection.updateOne(
      { _id: contest._id },
      { $unset: { gameKey: "" } },
    );
  }

  return contest;
}

describe("the rule itself", () => {
  it("shows the trading surfaces while trading is switched on", () => {
    expect(
      isTradingSurfaceRelevant({
        tradingEnabled: true,
        tradingHasLiveContests: false,
      }),
    ).toBe(true);
  });

  /**
   * The one case the plan's wording gets wrong, and the reason the rule is an OR.
   *
   * An operator can switch trading off while a contest is still being played - the flag gates
   * creation and entry, not the contests already open. Every position in one is still priced
   * from the same feed, so the six screens that operate it are needed for as long as it runs.
   */
  it("keeps them while a trading contest is still running, even with trading off", () => {
    expect(
      isTradingSurfaceRelevant({
        tradingEnabled: false,
        tradingHasLiveContests: true,
      }),
    ).toBe(true);
  });

  it("withholds them only once trading is off AND nothing is live", () => {
    expect(
      isTradingSurfaceRelevant({
        tradingEnabled: false,
        tradingHasLiveContests: false,
      }),
    ).toBe(false);
  });

  it("defaults to visible, because failing closed loses a live contest's screens", () => {
    expect(TRADING_SURFACE_VISIBLE_BY_DEFAULT).toBe(true);
  });

  /**
   * The one-rule-one-copy guard, and it is behavioural rather than an import check on purpose.
   *
   * The price-feed tile and the sidebar ask the same question, and two copies of it would
   * disagree only in the state nobody tests - trading off with a contest still running. An
   * assertion that `shouldShowPriceFeed` merely *imports* the rule is satisfied by a function
   * that imports it and then decides for itself; comparing the answers is not.
   */
  it("answers the price-feed tile and the sidebar identically, in every combination", () => {
    for (const tradingEnabled of [true, false]) {
      for (const tradingHasLiveContests of [true, false]) {
        const facts = { tradingEnabled, tradingHasLiveContests };
        expect(shouldShowPriceFeed(facts)).toBe(
          isTradingSurfaceRelevant(facts),
        );
      }
    }
  });
});

describe("resolving the facts from the database", () => {
  it("is visible when trading is enabled", async () => {
    await setEnabledGames(["trading", "provider"]);

    const visibility = await getTradingSurfaceVisibility();

    expect(visibility.tradingEnabled).toBe(true);
    expect(visibility.visible).toBe(true);
  });

  it("is hidden when trading is off and no trading contest is live", async () => {
    await setEnabledGames(["provider"]);
    await seedContest({ status: "active", provider: true });

    const visibility = await getTradingSurfaceVisibility();

    expect(visibility.tradingEnabled).toBe(false);
    expect(visibility.tradingHasLiveContests).toBe(false);
    expect(visibility.visible).toBe(false);
  });

  it("is visible when trading is off but a trading contest is still active", async () => {
    await setEnabledGames(["provider"]);
    await seedContest({ status: "active" });

    const visibility = await getTradingSurfaceVisibility();

    expect(visibility.tradingHasLiveContests).toBe(true);
    expect(visibility.visible).toBe(true);
  });

  /**
   * Invariant 5 through the liveness query, and it is why the query asks
   * `gameType: { $ne: "provider" }` rather than `gameKey: "trading"`.
   *
   * An absent label resolves to trading. Written the positive way, every contest predating X1 -
   * and any the backfill has not reached, since it has never been applied - reads as though it
   * were not a trading contest, and the six screens vanish while one is still being played.
   */
  it("counts an unlabelled contest as trading, because an absent label resolves to it", async () => {
    await setEnabledGames(["provider"]);
    await seedContest({ status: "active", unlabelled: true });

    const visibility = await getTradingSurfaceVisibility();

    expect(visibility.tradingHasLiveContests).toBe(true);
    expect(visibility.visible).toBe(true);
  });

  /**
   * A draft is not live, and this is the assertion that catches the tempting widening.
   *
   * Admitting `draft` would keep the trading screens on the menu for ever on any platform that
   * ever saved a trading draft - and a draft nobody can enter cannot need a price feed.
   */
  it("does not count a trading draft, or a finished one, as live", async () => {
    await setEnabledGames(["provider"]);
    await seedContest({ status: "draft" });
    await seedContest({ status: "completed" });
    await seedContest({ status: "cancelled" });

    const visibility = await getTradingSurfaceVisibility();

    expect(visibility.tradingHasLiveContests).toBe(false);
    expect(visibility.visible).toBe(false);
  });

  it("counts an upcoming trading contest, which has entrants but has not started", async () => {
    await setEnabledGames(["provider"]);
    await seedContest({ status: "upcoming" });

    const visibility = await getTradingSurfaceVisibility();

    expect(visibility.tradingHasLiveContests).toBe(true);
  });
});

describe("how the sidebar withholds the destination", () => {
  it("names the menu id from the shared module, never as a literal", () => {
    const code = readCode(SIDEBAR);

    expect(code).toMatch(
      /import\s*\{[^}]*TRADING_MENU_ID[^}]*\}\s*from\s*"@\/lib\/admin\/game-sections"/,
    );
    // Reason: the filter is the one place the id decides anything. A literal there survives a
    // rename of the menu entry and silently stops hiding it.
    expect(code).toMatch(
      /item\.id\s*===\s*TRADING_MENU_ID\s*&&\s*!tradingSurfaceVisible/,
    );
  });

  it("defaults the prop to the shared constant, not to a bare literal", () => {
    const code = readCode(SIDEBAR);

    expect(code).toMatch(
      /tradingSurfaceVisible\s*=\s*TRADING_SURFACE_VISIBLE_BY_DEFAULT/,
    );
    // A `= true` here would work today and stop tracking the rule the moment it is revisited.
    expect(code).not.toMatch(/tradingSurfaceVisible\s*=\s*(true|false)\b/);
  });

  /**
   * THE LOAD-BEARING ONE. Hiding is not revoking, and conflating the two is the whole risk of
   * this change.
   *
   * The six section grants are untouched, so `?activeTab=price-health` must still open the
   * screen and the tab strip inside it must still work. Gate the render on this flag as well and
   * an operator with a bookmark is locked out of the screens that run a contest which is still
   * being played - the exact harm the OR in the rule exists to prevent, reintroduced one layer
   * down. The negative assertion is the only half that can see it: the positive one above is
   * satisfied whether or not the render is also gated.
   */
  it("does not gate the rendered screen or the tab strip on the flag", () => {
    const code = readCode(SIDEBAR);

    const renders = [
      "<TradingHistorySection",
      "<PriceHealthWidget",
      "<TradingSectionTabs",
    ];

    for (const render of renders) {
      const at = code.indexOf(render);
      expect(at, `${render} should still be rendered`).toBeGreaterThan(-1);
    }

    // Reason it counts occurrences rather than asserting the flag is absent: the flag appears
    // legitimately in the prop, its default and the sidebar filter. Three uses is the whole of
    // its reach; a fourth is a gate somewhere it does not belong.
    const uses = code.match(/tradingSurfaceVisible/g) ?? [];
    expect(uses).toHaveLength(3);
  });

  it("is handed the flag by the page, resolved server-side", () => {
    const code = readCode(DASHBOARD_PAGE);

    expect(code).toMatch(/getTradingSurfaceVisibility\s*\(\s*\)/);
    expect(code).toMatch(
      /tradingSurfaceVisible=\{\s*tradingSurface\.visible\s*\}/,
    );
  });

  it("keeps the rule model-free, because the sidebar is a client component", () => {
    const code = readCode(RULE);

    // Reason: a module reaching for Mongoose cannot be imported anywhere near a `"use client"`
    // component. Same constraint behind `contest-control-copy.ts` and `play-state.ts`.
    expect(code).not.toMatch(/from\s*"[^"]*database\/models/);
    expect(code).not.toMatch(/mongoose/i);
  });

  it("fails open when the facts cannot be resolved", () => {
    const code = readCode(OVERVIEW_SERVICE);

    const at = code.indexOf("getTradingSurfaceVisibility");
    expect(at).toBeGreaterThan(-1);
    const body = code.slice(at);
    const catchAt = body.indexOf("catch");
    expect(catchAt).toBeGreaterThan(-1);

    // The recovery path must not invent `false`. Losing the screens because a settings read
    // timed out is silent and unactionable; an untidy menu is neither.
    const recovery = body.slice(catchAt, catchAt + 700);
    expect(recovery).toMatch(/visible:\s*TRADING_SURFACE_VISIBLE_BY_DEFAULT/);
    expect(recovery).not.toMatch(/visible:\s*false/);
  });

  it("withholds the parent, which is deliberately not a section grant", async () => {
    const { ADMIN_SECTIONS } = await import(
      "../../apps/admin/database/models/admin-employee.model"
    );

    // Reason: a grant that maps to no screen is where privilege widening starts, and the parent
    // renders nothing of its own. Its absence is also what makes hiding it safe - there is no
    // permission to accidentally revoke.
    expect(ADMIN_SECTIONS as readonly string[]).not.toContain(TRADING_MENU_ID);
  });
});
