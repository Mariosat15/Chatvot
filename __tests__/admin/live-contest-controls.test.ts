/**
 * X6: the live-contest controls - pause, resume, cancel, emergency cancel, force finalize.
 *
 * TWO LIVE DEFECTS ARE PINNED HERE, AND NEITHER IS A PROVIDER-GAMES PROBLEM BY ORIGIN.
 *
 * 1. **`POST /api/finalize-old-competitions` had no authentication at all.** Not a weak
 *    credential - none. An anonymous POST closed every open position in every completed
 *    competition at live market prices and wrote a `TradeHistory` row carrying a
 *    `realizedPnl` for each. That collection is what finalization reads by `positionId` to
 *    rank participants, so an unauthenticated writer to it is an unauthenticated input to a
 *    ranking; it also loops the forex price API once per position, which is an unmetered
 *    third-party cost. Sixth instance of the auth class, and the most severe.
 *
 * 2. **Pausing a provider contest did nothing whatsoever.** `isPaused` has been honoured by
 *    `order.actions.ts` since long before this programme and was read nowhere in
 *    `round-launch.service.ts`. The route returned success, the admin screen showed a paused
 *    badge, every participant was notified - and players carried on starting rounds,
 *    spending paid attempts and running up per-round provider charges. The control appeared
 *    to work and did nothing.
 *
 * WHICH COPY OF EACH MODEL THIS FILE SEEDS IS NOT A FREE CHOICE. vitest maps `@` to the REPO
 * ROOT, so the services under test resolve `@/database/...` to the MAIN app's models. This
 * file seeds those. Seeding the `apps/admin` copies puts fixtures on a Mongoose instance the
 * code never touches and every assertion fails on an empty collection, which reads exactly
 * like a logic bug. Only ONE copy of each model is imported, because both register under the
 * same name via `models.X || model(...)`.
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
const CompetitionParticipant = (
  await import("../../database/models/trading/competition-participant.model")
).default;
const GameRound = (await import("../../database/models/games/game-round.model"))
  .default;
const GameProvider = (
  await import("../../database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const { WhiteLabel } = await import("../../database/models/whitelabel.model");
const { MOCK_PROVIDER_KEY, MockProviderAdapter } = await import(
  "../../lib/services/game-providers/adapters/mock.adapter"
);
const { registerProviderAdapter } = await import(
  "../../lib/services/game-providers/registry"
);
const { endLiveRoundsForContest } = await import(
  "../../lib/services/games/contest-round-cleanup"
);
const { launchContestRound } = await import(
  "../../lib/services/games/round-launch.service"
);
const { getPlayState } = await import(
  "../../lib/services/games/round-status.service"
);
// Relative, not `@/lib/admin/...`: the alias resolves to the MAIN app in this config, and an
// admin-only module reached through it fails as a missing file - which reads as the module not
// existing rather than as the wrong root.
const { contestControlCopy } = await import(
  "../../apps/admin/lib/admin/contest-control-copy"
);

const ROOT = process.cwd();
const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;
const HOUR = 60 * 60 * 1000;

const COLLECTIONS = [
  "competitions",
  "competitionparticipants",
  "game_provider",
  "provider_game",
  "game_round",
  "whitelabels",
];

/**
 * Comments stripped before matching.
 *
 * These routes explain in prose exactly the anti-patterns they avoid - "verifyAdminAuth is
 * token validity, not section access" appears in four of them - so a structural test that
 * reads prose fails in both directions: it flags a correct file for discussing the mistake,
 * and it passes a broken one whose only mention of the right helper is in a comment.
 */
function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const ADMIN = "apps/admin";
const LIST_ROUTE = `${ADMIN}/app/api/competitions/route.ts`;
const CRUD_ROUTE = `${ADMIN}/app/api/competitions/[id]/route.ts`;
const PAUSE_ROUTE = `${ADMIN}/app/api/competitions/[id]/pause/route.ts`;
const CANCEL_ROUTE = `${ADMIN}/app/api/competitions/[id]/cancel/route.ts`;
const EMERGENCY_ROUTE = `${ADMIN}/app/api/competitions/[id]/emergency-cancel/route.ts`;
const ADJUST_ROUTE = `${ADMIN}/app/api/competitions/[id]/adjust-results/route.ts`;
const FORCE_FINALIZE_ROUTE = `${ADMIN}/app/api/finalize-old-competitions/route.ts`;
const LAUNCH_SERVICE = "lib/services/games/round-launch.service.ts";
const PREFLIGHT = "components/games/RoundPreflight.tsx";
const ROUNDS_ROUTE = "app/api/competitions/[id]/rounds/route.ts";
const CANCEL_ACTION_ADMIN = `${ADMIN}/lib/actions/trading/competition-cancel.actions.ts`;
const CANCEL_ACTION_MAIN = "lib/actions/trading/competition-cancel.actions.ts";
const CONTROL_PANEL = `${ADMIN}/components/admin/CompetitionAdminActions.tsx`;
const CONTROL_COPY = `${ADMIN}/lib/admin/contest-control-copy.ts`;
const VIEW_PAGE = `${ADMIN}/app/competitions/view/[id]/page.tsx`;

/** Every lifecycle route, so a new one cannot be added outside the auth sweep unnoticed. */
const LIFECYCLE_ROUTES = [
  LIST_ROUTE,
  CRUD_ROUTE,
  PAUSE_ROUTE,
  CANCEL_ROUTE,
  EMERGENCY_ROUTE,
  ADJUST_ROUTE,
  FORCE_FINALIZE_ROUTE,
];

// =======================================================================================
// Authorization on every lifecycle route
// =======================================================================================

describe("every contest lifecycle route is guarded per SECTION", () => {
  it.each(LIFECYCLE_ROUTES)("%s calls guardSection(\"competitions\")", (path) => {
    const code = readCode(path);
    expect(code).toMatch(/guardSection\(\s*["']competitions["']\s*\)/);
  });

  it.each(LIFECYCLE_ROUTES)(
    "%s guards EVERY exported handler, not just the first",
    (path) => {
      /*
        COUNT THE HANDLERS AGAINST THE GUARDS.

        This is the assertion that matters, and "does the file mention guardSection" is not it.
        The pause route exported a POST and a GET; the CRUD route exports three. A file whose
        POST is guarded and whose GET is not passes any mention-based check while leaving a
        handler open - and for the CRUD route the open one was a DELETE.
      */
      const handlers =
        code(path).match(
          /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g,
        ) ?? [];
      const guards =
        code(path).match(/guardSection\(\s*["']competitions["']\s*\)/g) ?? [];

      expect(handlers.length).toBeGreaterThan(0);
      expect(guards.length).toBe(handlers.length);
    },
  );

  it.each(LIFECYCLE_ROUTES)(
    "%s no longer authenticates on token validity alone",
    (path) => {
      /*
        `verifyAdminToken`, `verifyAdminAuth` and `requireAdminAuth` all answer "is this an
        admin at all". None of them is an authorization check: an employee granted one
        unrelated section passes every one of them. `requireSectionAccess` - which
        `guardSection` wraps - is the grant.

        Sixth instance of this class after Prerequisite A, the internal-secret fallbacks, the
        unprotected suspicion-score route, the provider admin routes and PUT on this same
        CRUD file, so it is asserted across the whole set rather than case by case.
      */
      const source = code(path);
      expect(source).not.toMatch(/verifyAdminToken\s*\(/);
      expect(source).not.toMatch(/verifyAdminAuth\s*\(/);
      expect(source).not.toMatch(/requireAdminAuth\s*\(/);
    },
  );

  it("the list route no longer carries its own copy of the JWT verification", () => {
    /*
      Deleting the local helper is the point, not tidiness. A route with its own
      authentication helper is a route that will not receive the next fix to the shared one -
      and this copy read the cookie, called `jwt.verify` and asked nothing else.
    */
    const source = code(LIST_ROUTE);
    expect(source).not.toMatch(/jwt\.verify\s*\(/);
    expect(source).not.toMatch(/from\s+["']jsonwebtoken["']/);
    expect(source).not.toMatch(/getAdminJwtSecret/);
  });

  it("the force-finalize route had NO auth, so its guard is asserted by position", () => {
    /*
      The severe one. Every other route in this sweep had a weak check; this had none, and it
      is a money-adjacent write. The guard must run before `connectToDatabase`, so a refusal
      cannot open a connection or reach `Competition.find` - the same before-any-work ordering
      that `checkAccountStanding` follows so a refusal cannot leave one of two debits applied.
    */
    const source = code(FORCE_FINALIZE_ROUTE);
    const guardIndex = source.indexOf("guardSection(");
    const connectIndex = source.indexOf("connectToDatabase(");
    const findIndex = source.indexOf("Competition.find(");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(connectIndex).toBeGreaterThan(guardIndex);
    expect(findIndex).toBeGreaterThan(guardIndex);
  });
});

// A tiny indirection so the `it.each` cases above read cleanly. Named `code` rather than
// inlined because `it.each` receives the path as a string, not the source.
function code(path: string): string {
  return readCode(path);
}

// =======================================================================================
// Force finalize is trading-only and says so
// =======================================================================================

describe("force finalize dispatches on the game", () => {
  it("skips a provider contest explicitly rather than by accident", () => {
    /*
      The whole loop body closes `TradingPosition` rows at forex prices. A provider contest
      has none, so it was ALREADY a no-op - via the empty-positions branch, which reports
      "No open positions found".

      That accidental correctness is the thing being replaced. Reporting a healthy trading
      result about a puzzle contest is how a screen comes to be read as evidence, and the
      next person to add a step to this loop has no signal that a provider contest reaches
      it. The refusal is explicit and names the reason.
    */
    const source = code(FORCE_FINALIZE_ROUTE);
    expect(source).toMatch(/hasProviderGameLabel\(\s*comp\s*\)/);

    const guardIndex = source.indexOf("hasProviderGameLabel(comp)");
    const sessionIndex = source.indexOf("mongoose.startSession()");
    // Before the transaction opens: a skip must not start and abort a session per contest.
    expect(guardIndex).toBeGreaterThan(-1);
    expect(sessionIndex).toBeGreaterThan(guardIndex);
  });

  it("selects the fields the game check reads", () => {
    // `hasProviderGameLabel` reads `gameType`. A `.select()` that omits it makes the check
    // read `undefined` and resolve to trading for EVERY contest - a guard that compiles,
    // reviews correctly and never fires. Same shape as the leaderboard that never asked for
    // `score` (R37).
    expect(code(FORCE_FINALIZE_ROUTE)).toMatch(/\.select\([^)]*gameType/);
  });
});

// =======================================================================================
// The pause gate - structural
// =======================================================================================

describe("the pause gate sits where an attempt is spent", () => {
  it("the launch service reads isPaused", () => {
    expect(code(LAUNCH_SERVICE)).toMatch(/contest\.isPaused/);
  });

  it("refuses BEFORE the seat lookup and before any round is created", () => {
    /*
      Position, not presence. An attempt is consumed the moment `createRound` inserts, so a
      pause gate placed after it would refuse a player who has already been charged. Placing
      it before the seat lookup also means a paused contest costs no extra query.
    */
    const source = code(LAUNCH_SERVICE);
    const pauseIndex = source.indexOf("contest.isPaused");
    const seatIndex = source.indexOf("CompetitionParticipant.findOne(");
    const createIndex = source.indexOf("createRound(");

    expect(pauseIndex).toBeGreaterThan(-1);
    expect(seatIndex).toBeGreaterThan(pauseIndex);
    expect(createIndex).toBeGreaterThan(pauseIndex);
  });

  it("gives the pause its own refusal code rather than folding it into contest_not_open", () => {
    /*
      The contest IS open - the player will be able to play. A generic `contest_not_open`
      forces the UI to offer a dead end where it should offer "come back shortly", which is
      the exact mistake the first version of `LaunchRefusal` made with three other lifecycle
      refusals before they were split out.
    */
    const source = code(LAUNCH_SERVICE);
    expect(source).toMatch(/\|\s*"contest_paused"/);
    expect(source).toMatch(/refuse\(\s*\n?\s*"contest_paused"/);
  });

  it("maps contest_paused to 409, not 503", () => {
    // 409 because the request conflicts with the contest's state; nothing is unavailable.
    const source = code(ROUNDS_ROUTE);
    const pausedIndex = source.indexOf('case "contest_paused":');
    const notOpenIndex = source.indexOf('case "contest_not_open":');
    const unavailableIndex = source.indexOf('case "title_unavailable":');

    expect(pausedIndex).toBeGreaterThan(-1);
    // Grouped with the other lifecycle refusals, above the 503 block.
    expect(pausedIndex).toBeGreaterThan(notOpenIndex);
    expect(pausedIndex).toBeLessThan(unavailableIndex);
    // COUNT THE OCCURRENCES. `indexOf` finds the first, so a second label added lower down -
    // in the 503 group, say - leaves every assertion above green while the switch carries two
    // answers and the lower one is silently unreachable. Fourth instance of this class after
    // the fixed-character Edit guard, `canTransitionRound` and `!expectedOrigin`.
    expect((source.match(/case "contest_paused":/g) ?? []).length).toBe(1);
  });
});

// =======================================================================================
// The pre-flight reflects the pause
// =======================================================================================

describe("the pre-flight refuses a paused contest", () => {
  it("reads isPaused, which cannot be derived from the status", () => {
    // A paused contest is still `active`, so every existing status check passes it. Without
    // this the screen offers a fully enabled Play button the server now refuses - the same
    // mismatch fixed on 6 Sep 2026 for a contest that had not started, from the one direction
    // that fix did not cover.
    expect(code(PREFLIGHT)).toMatch(/state\.isPaused\s*===\s*true/);
  });

  it("blocks resume as well as play", () => {
    /*
      `blocked` must stay independent of `resuming`. Asserted by reading the expression rather
      than by checking `paused` appears somewhere: an operator pauses a contest to stop play,
      so letting a player continue inside a round they already have open defeats the control
      while appearing to honour it.
    */
    const source = code(PREFLIGHT);
    const blocked = source.match(/const blocked\s*=[\s\S]*?;/);
    expect(blocked).not.toBeNull();
    expect(blocked![0]).toMatch(/paused/);
    expect(blocked![0]).not.toMatch(/resuming/);
  });

  it("shows the operator's reason when there is one", () => {
    // A pause with no explanation is what makes players assume the platform is broken rather
    // than being worked on.
    expect(code(PREFLIGHT)).toMatch(/state\.pauseReason/);
    expect(code(PREFLIGHT)).toMatch(/attempts are safe/i);
  });

  it("does not colour a pause as an error", () => {
    // Same reasoning as the not-yet-started case: the red panel is for a rejected action, and
    // a pause is not one. Counting the red containers is what stops a second being added.
    const source = code(PREFLIGHT);
    expect((source.match(/border-red-500\/30/g) ?? []).length).toBe(1);
  });

  it("does not offer a free resume beside a disabled button", () => {
    // A live round plus a pause is exactly the combination where the resume panel and the
    // pause panel would both render and contradict each other.
    expect(code(PREFLIGHT)).toMatch(/resuming\s*&&\s*!blocked/);
  });
});

// =======================================================================================
// Resume compensates the window that actually gates play
// =======================================================================================

describe("resume extends the play window, not only the end time", () => {
  it("extends playWindowEnd by the pause duration", () => {
    /*
      THE DEFECT THIS PINS. `createRound` enforces `playWindowEnd`; the launch service
      enforces `playWindowStart`. `endTime` gates neither. So extending only `endTime` gave
      the fairness compensation to trading and silently withheld it from every provider game:
      the contest ran longer while the window players actually play inside stayed exactly as
      short, so a two-hour pause simply consumed two hours of their playing time.

      It reads as correct because the field the code extends is the one called "end".
    */
    const source = code(PAUSE_ROUTE);
    expect(source).toMatch(/competition\.playWindowEnd\s*=/);
    expect(source).toMatch(/playWindowEnd\)\.getTime\(\)\s*\+\s*pauseDuration/);
  });

  it("moves playWindowStart ONLY while it is still in the future", () => {
    // Shifting a window that has already opened would re-close it, refusing play that was
    // legitimately available a moment earlier - worse than not compensating at all.
    const source = code(PAUSE_ROUTE);
    const startBlock = source.match(
      /if\s*\(\s*\n?\s*competition\.playWindowStart\s*&&[\s\S]*?\n\s{6}\}/,
    );
    expect(startBlock).not.toBeNull();
    expect(startBlock![0]).toMatch(/>\s*now/);
  });

  it("returns both window fields, so an operator can see the compensation landed", () => {
    expect(code(PAUSE_ROUTE)).toMatch(/playWindowEnd:\s*competition\.playWindowEnd/);
  });
});

// =======================================================================================
// Wording: a game with no market is not told trading is suspended
// =======================================================================================

describe("the pause notification does not say trading for a game", () => {
  it("derives the noun from the stored label, never from caller input", () => {
    /*
      Derived through the same helper the list and edit paths use. A caller-supplied game type
      would be a way to change what a player is told about a contest, which is the same rule
      that stops the market-hours gate taking its deciding value from a request.
    */
    const source = code(PAUSE_ROUTE);
    expect(source).toMatch(/hasProviderGameLabel\(\s*competition\s*\)/);
    expect(source).toMatch(/isProviderGame\s*\?\s*"Play"\s*:\s*"Trading"/);
  });

  it("uses the noun in both the pause and the resume message", () => {
    const source = code(PAUSE_ROUTE);
    const uses = source.match(/\$\{activityNoun\}/g) ?? [];
    expect(uses.length).toBe(2);
  });

  it("has no remaining hard-coded 'Trading is' in a player-facing message", () => {
    expect(code(PAUSE_ROUTE)).not.toMatch(/Trading is (temporarily suspended|now active)/);
  });
});

// =======================================================================================
// Cancelling ends the rounds
// =======================================================================================

describe("both cancel paths end live provider rounds", () => {
  it.each([
    ["the mirrored cancel-and-refund", CANCEL_ACTION_MAIN],
    ["the admin copy", CANCEL_ACTION_ADMIN],
  ])("%s calls endLiveRoundsForContest inside the transaction", (_label, path) => {
    /*
      Inside the transaction on purpose: if the refund rolls back, the rounds must still be
      live. Asserted by position against the commit, because a call placed after it would
      still "call the function" and would void rounds for a refund that never happened.
    */
    const source = code(path);
    const callIndex = source.indexOf("endLiveRoundsForContest({");
    const commitIndex = source.indexOf("commitTransaction()");

    expect(callIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(callIndex);
    expect(source).toMatch(/session[,:]/);
  });

  it("emergency cancel voids rounds as well as closing positions", () => {
    // Step 2 closes trading POSITIONS, which is the whole of what a trading contest leaves
    // running. A provider contest leaves a live ROUND, and nothing was closing it.
    const source = code(CANCEL_ACTION_ADMIN);
    const calls = source.match(/endLiveRoundsForContest\(\{/g) ?? [];
    // One in each of the two exported cancel paths in this file.
    expect(calls.length).toBe(2);
  });

  it("reports the voided count rather than announcing it", () => {
    // A provider contest closes no positions, so "0 positions closed" alone reads as though
    // the action failed. Same reasoning as the round dialog reporting whether settlement was
    // actually released rather than asserting it.
    expect(code(CANCEL_ACTION_ADMIN)).toMatch(/voidedRounds/);
    expect(code(EMERGENCY_ROUTE)).toMatch(/voidedRounds:\s*result\.voidedRounds/);
  });
});

// =======================================================================================
// The operator's control panel does not promise trading things about a game
// =======================================================================================

describe("the live-contest control panel is game-aware", () => {
  /*
    THE DEFECT THIS PINS, and it is the worst-reading one in the slice. The panel an operator
    uses to pause or emergency-cancel a live contest said seven trading-shaped things. Above a
    confirm button on a puzzle contest it read "All positions will be closed at current
    prices" and listed "Immediately close ALL open positions at current market prices" and
    "Calculate and record all P&L" - none of which happens, because a provider contest has no
    position to close. Pausing reported "Trading is now frozen", which was doubly wrong: the
    pause was not enforced on a provider round at all until this slice.

    None of it errors. The panel renders, the action runs, and the operator has confirmed
    something on the strength of a description of a different game. Same class as the
    trading-shaped services in `matchmaking.service.ts` and the trading-shaped competitions
    list: the label agrees with the old world and keeps agreeing after it ends.
  */

  it("takes the flag from the server, never a game type it decides for itself", () => {
    // What an operator is told about a money-adjacent action must not be derivable inside a
    // client component - there would then be two answers in the admin app to "is this a
    // provider contest", and the one in the browser is the one nobody tests.
    const panel = code(CONTROL_PANEL);
    expect(panel).toMatch(/isProviderGame\?:\s*boolean/);
    expect(panel).not.toMatch(/===\s*["']provider["']/);
    expect(panel).not.toMatch(/gameType/);
  });

  it("derives that flag from the LABEL alone on the page that renders it", () => {
    /*
      `hasProviderGameLabel`, deliberately not the stricter `isProviderContest`. A provider
      contest missing its keys cannot launch a round, but its operator still must not be handed
      a dialog promising to close positions. Using the strict helper would compile, review
      correctly, and be wrong only for the half-built contest - which is the one an operator is
      most likely to be looking at.
    */
    const page = code(VIEW_PAGE);
    expect(page).toMatch(/hasProviderGameLabel\(\s*competition\s*\)/);
    expect(page).not.toMatch(/isProviderContest/);
    expect(page).toMatch(/isProviderGame=\{isProviderGame\}/);
  });

  it("has no UNCONDITIONAL trading wording left in the panel", () => {
    /*
      Asserted as an ABSENCE over the RENDERED markup, by vocabulary rather than by phrase.

      TWO THINGS WERE WRONG ON THE WAY TO THIS AND BOTH GENERALISE. The assertion was first
      written against the phrase "open positions", and restoring the real defect verbatim -
      "All positions will be closed at current prices" - left it green, because the dialog
      description says "All positions". A vocabulary guard has to match the WORD, never a
      phrase copied out of one of the sites it is policing.

      Then the word-level version failed on CORRECT code. The emergency toast keeps
      "N positions closed" in its trading branch, and it must: an operator running a trading
      contest still needs to be told what happened to their positions. So the claim "no trading
      wording anywhere in this file" is simply false, and the honest one is narrower - no
      trading wording that is not either sourced from the copy module or branched on the flag.
      Scoping to the JSX is what expresses that: the branched strings live in the handlers.
    */
    const panel = code(CONTROL_PANEL);
    // Anchored on the opening tag, not on `return (` - which first matched
    // `return () => clearInterval(interval);` inside the countdown effect and sliced away the
    // handlers instead of the markup. The length assertion below is what caught it: a slice
    // that has silently found the wrong thing is otherwise a test quietly examining nothing.
    const jsxStart = panel.search(/return \(\s*\n\s*<div/);
    expect(jsxStart).toBeGreaterThan(-1);
    const jsx = panel.slice(jsxStart);

    expect(jsx.length).toBeGreaterThan(500);
    expect(jsx).not.toMatch(/positions?/i);
    expect(jsx).not.toMatch(/\btrad(e|ing)\b/i);
    expect(jsx).not.toMatch(/P&L/);
    expect(jsx).not.toMatch(/\borders?\b/i);
  });

  it("branches the one place trading wording survives, rather than hiding it", () => {
    // The emergency toast. Both branches are asserted, because a ternary with the provider arm
    // missing reads exactly as correct as one with both - and the trading arm is the one that
    // was already there.
    const panel = code(CONTROL_PANEL);
    const toast = panel.match(/isProviderGame\s*\n?\s*\?[\s\S]*?voidedRounds[\s\S]*?\n\s*\);/);
    expect(toast, "the emergency toast is not branched on the flag").not.toBeNull();
    expect(toast![0]).toMatch(/rounds voided/);
    expect(toast![0]).toMatch(/positions closed/);
  });

  it("keeps the wording in a model-free module both sides can import", () => {
    // The constraint is real - the panel is `"use client"` and cannot pull a Mongoose model
    // into the browser - and the answer is a shared module, not a second copy. Four defects in
    // this codebase have had the "one rule, two copies" shape and `check:mirrors` sees none of
    // them, because it compares models.
    const copySource = code(CONTROL_COPY);
    expect(copySource).not.toMatch(/from\s+["']@\/database\//);
    expect(copySource).not.toMatch(/mongoose/i);
    expect(code(CONTROL_PANEL)).toMatch(
      /import\s*\{\s*contestControlCopy\s*\}\s*from\s*["']@\/lib\/admin\/contest-control-copy["']/,
    );
  });

  it("renders the consequence lists from the module, not from literals", () => {
    /*
      The negative half is the load-bearing one: importing the module is trivially satisfiable
      by a file that also hand-rolls its own <li> list beside it, which is precisely how the
      trading copy would survive a wording pass that looked complete.

      SCOPED TO THE TWO LISTS, and getting that wrong is instructive. Counting every `<li>` in
      the file failed on four in the PLAIN cancel dialog - which are correct and already
      game-agnostic, because cancelling an upcoming contest refunds and notifies whatever game
      it is. A guard aimed one level too wide flags correct code, which is the fastest way to
      have it deleted.
    */
    const panel = code(CONTROL_PANEL);

    for (const list of ["pauseConsequences", "emergencyConsequences"]) {
      const mapIndex = panel.indexOf(`copy.${list}.map`);
      expect(mapIndex, `${list} is not rendered from the module`).toBeGreaterThan(-1);

      // Sliced by index rather than matched with a regex, and the difference is not stylistic.
      // `<ul[^>]*>[\s\S]*?copy\.X\.map` matches LEFTMOST-first, so it opened at the plain
      // cancel dialog's <ul> several hundred characters earlier and swallowed its four
      // legitimate literal items - the guard then failed on correct code. Same class as the
      // fixed-character Edit guard that began mid-identifier: locate the construct, do not
      // scan towards it.
      const open = panel.lastIndexOf("<ul", mapIndex);
      const close = panel.indexOf("</ul>", mapIndex);
      const block = panel.slice(open, close);

      // A literal item smuggled into the same list. `<li key=` is the mapped one.
      expect(block).not.toMatch(/<li>/);
    }
  });

  it("gives a provider contest genuinely different consequences, not a renamed noun", () => {
    /*
      A wording pass that only swapped "trading" for "play" would leave an operator reading a
      list of things that do not happen. The lists differ in LENGTH and in content: a provider
      pause has to mention that a player cannot resume a round they already have open, and a
      provider emergency cancel voids rounds instead of closing positions and recording P&L.
    */
    const trading = contestControlCopy(false);
    const provider = contestControlCopy(true);

    expect(trading.activityNoun).toBe("Trading");
    expect(provider.activityNoun).toBe("Play");

    // No trading vocabulary anywhere in the provider copy, checked over every string at once
    // so a field added later is covered without the test being updated.
    const providerText = JSON.stringify(provider);
    expect(providerText).not.toMatch(/position/i);
    expect(providerText).not.toMatch(/P&L/);
    expect(providerText).not.toMatch(/order/i);
    expect(providerText).not.toMatch(/trading/i);

    // And the reverse, so the trading copy is not quietly generalised into vagueness while
    // nobody is looking. An operator running a trading contest must still be told about
    // positions.
    //
    // ASSERTED PER LIST, not over the whole object. `JSON.stringify(trading)` matching
    // /position/i stayed green when the pause list's "Prevent any positions from being closed"
    // was replaced with "Stop players acting in the contest", because the EMERGENCY list still
    // said "positions" - one list covering for the other. The two lists answer two different
    // questions and each has to answer its own.
    expect(trading.pauseConsequences.join(" ")).toMatch(/position/i);
    expect(trading.emergencyConsequences.join(" ")).toMatch(/position/i);
    expect(trading.emergencyConsequences.join(" ")).toMatch(/P&L/);
  });

  it("tells a provider operator that a mid-round player cannot resume", () => {
    // The question an operator will actually ask, and the honest answer is a refusal: the
    // pre-flight blocks a resume while paused, because letting a player continue inside a round
    // they already have open defeats the control while appearing to honour it.
    const provider = contestControlCopy(true);

    // The MID-ROUND case specifically, on its own line. A bare /resum/i stayed green when the
    // line was deleted, because the next item - "Extend the play window and the end time when
    // resumed" - contains "resumed" too. The same trap as matching a bare identifier when it
    // appears twice doing two different jobs; here it was one word doing two.
    const midRound = provider.pauseConsequences.filter((item) =>
      /resum\w* a round/i.test(item),
    );
    expect(midRound).toHaveLength(1);
    expect(provider.pauseConsequences.join(" ")).toMatch(/play window/i);
  });

  it("resolves an absent label to trading, like every other read of it", () => {
    // Invariant 5. The panel's prop defaults to false rather than to a game check, so a
    // contest stored before the label existed gets the trading wording - which is correct for
    // every such contest, since provider contests postdate the label.
    expect(code(CONTROL_PANEL)).toMatch(/isProviderGame\s*=\s*false/);
  });

  it("reports what the action did to THIS contest, not a zero", () => {
    // "0 positions closed" on a puzzle contest reads as though the action failed. Same
    // reasoning as the round dialog reporting whether settlement was actually released rather
    // than announcing that it was.
    const panel = code(CONTROL_PANEL);
    expect(panel).toMatch(/voidedRounds/);
    expect(panel).toMatch(/closedPositions/);
    // And the resume toast names the play window, because extending only `endTime` was the
    // defect and an operator had no way to see whether the compensation landed.
    expect(panel).toMatch(/Play window and end time extended/);
  });
});

// =======================================================================================
// Behavioural
// =======================================================================================

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  await ensureCollections(COLLECTIONS);
  // The launch service refuses everything without a usable callback base URL, and its
  // production guard against loopback is R36 and is proven separately.
  process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3999";
  registerProviderAdapter(new MockProviderAdapter());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await ensureCollections(COLLECTIONS);
  await seedCatalogue();
});

async function seedCatalogue() {
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: true,
  });
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Trivia",
    // Real enum values, checked against `provider-game.model.ts`. A guessed pair fails the
    // whole suite on one validation error in `beforeEach`, which reads as many broken tests
    // rather than one wrong fixture.
    family: "independent",
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    supportsOneVsOne: true,
    chartvoltEnabled: true,
    providerStatus: "active",
    configSchema: { type: "object", properties: {} },
    lastSuccessfulRoundAt: new Date(),
  });
  // BOTH switches. `resolveEnabledProvider` reads the runtime flag from
  // `WhiteLabel.gameProviders`, never from the `game_provider` collection - the collection is
  // the operator's register of companies, the settings array is the switch. Seeding only the
  // collection leaves the provider correctly registered and still unavailable, and the
  // refusal ("not configured in settings") is the only thing that points at it.
  await WhiteLabel.create({
    externalGamesEnabled: true,
    gameProviders: [{ providerKey: MOCK_PROVIDER_KEY, enabled: true }],
  });
}

/**
 * A complete, ACTIVE provider contest.
 *
 * Every field the schema demands, not just the ones a test reads: Mongoose validates the
 * document, and a fixture trimmed to what the test cares about is how 34 unrelated tests once
 * failed on one missing `slug`.
 */
async function seedActiveContest(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() - HOUR);
  const end = new Date(Date.now() + 6 * HOUR);
  return Competition.create({
    name: "Trivia Night",
    slug: `trivia-${Math.random().toString(36).slice(2, 10)}`,
    description: "A test contest",
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig: {
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      settings: {},
    },
    contentSeed: "aabbccdd",
    playWindowStart: start,
    playWindowEnd: end,
    resultGracePeriodSeconds: 900,
    attemptsPolicy: "best_of_n",
    attemptsAllowed: 3,
    unresolvedRoundPolicy: "score_zero",
    entryFee: 10,
    minParticipants: 2,
    maxParticipants: 50,
    currentParticipants: 1,
    startTime: start,
    endTime: end,
    registrationDeadline: start,
    status: "active",
    competitionType: "time_based",
    prizePool: 10,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    createdBy: "507f1f77bcf86cd799439011",
    ...overrides,
  });
}

async function seat(competitionId: mongoose.Types.ObjectId, userId: string) {
  // No trading capital fields: those three are required only when
  // `(this.gameKey || "trading") === "trading"`, and a provider seat carrying them asserts a
  // virtual trading account that does not exist.
  await CompetitionParticipant.create({
    competitionId,
    userId,
    username: "tester",
    email: "tester@e2e.test",
    gameKey: GAME_KEY,
    enteredAt: new Date(),
  });
}

describe("launchContestRound on a paused contest", () => {
  it("refuses with contest_paused and creates no round", async () => {
    const contest = await seedActiveContest({
      isPaused: true,
      pauseReason: "Provider incident.",
    });
    const userId = new mongoose.Types.ObjectId().toString();
    await seat(contest._id, userId);

    const outcome = await launchContestRound(String(contest._id), { userId });

    expect(outcome.success).toBe(false);
    if (outcome.success) return;
    expect(outcome.refusal).toBe("contest_paused");
    expect(outcome.error).toContain("Provider incident.");

    // THE ASSERTION THAT MAKES THIS ABOUT MONEY. An attempt is consumed when the round is
    // created, so a refusal that inserted anything would have charged a paying player for a
    // round they could not play.
    expect(await GameRound.countDocuments({ contestId: contest._id })).toBe(0);
  }, 60_000);

  it("succeeds on the same contest once the pause is lifted", async () => {
    /*
      THE CONTROL. Without it the refusal above could be caused by anything in the fixture -
      a missing seat, a closed window, a disabled title - and the test would pass while
      proving nothing about the pause. Same contest, same player, one field changed.
    */
    const contest = await seedActiveContest({ isPaused: false });
    const userId = new mongoose.Types.ObjectId().toString();
    await seat(contest._id, userId);

    const outcome = await launchContestRound(String(contest._id), { userId });

    // The refusal is included in the message so a fixture problem cannot be mistaken for the
    // gate firing - the first run of this test reported "expected true, got false" and said
    // nothing about which of nine gates had refused.
    expect(
      outcome.success,
      outcome.success ? "" : `${outcome.refusal}: ${outcome.error}`,
    ).toBe(true);
    expect(await GameRound.countDocuments({ contestId: contest._id })).toBe(1);
  }, 60_000);

  it("refuses to RESUME a live round while paused", async () => {
    /*
      The subtle half. `createRound` is idempotent on a live round, so resuming normally costs
      nothing and is offered freely - but the pause gate runs before that path, deliberately.
      An operator pausing a contest to stop play must actually stop it, including for players
      already inside a round.
    */
    const contest = await seedActiveContest();
    const userId = new mongoose.Types.ObjectId().toString();
    await seat(contest._id, userId);

    const first = await launchContestRound(String(contest._id), { userId });
    expect(first.success).toBe(true);

    await Competition.updateOne(
      { _id: contest._id },
      { $set: { isPaused: true, pauseReason: "Maintenance." } },
    );

    const resumed = await launchContestRound(String(contest._id), { userId });
    expect(resumed.success).toBe(false);
    if (resumed.success) return;
    expect(resumed.refusal).toBe("contest_paused");

    // Still exactly one round: the refusal neither created nor consumed a second attempt.
    expect(await GameRound.countDocuments({ contestId: contest._id })).toBe(1);
  }, 60_000);

  it("reports the pause on the play state the pre-flight renders", async () => {
    const contest = await seedActiveContest({
      isPaused: true,
      pauseReason: "Provider incident.",
    });
    const userId = new mongoose.Types.ObjectId().toString();
    await seat(contest._id, userId);

    const outcome = await getPlayState(String(contest._id), userId);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    // The status is unchanged, which is the whole reason the flag has to be carried
    // separately - a pre-flight deriving its answer from the status alone would show an
    // enabled Play button.
    expect(outcome.state.contestStatus).toBe("active");
    expect(outcome.state.isPaused).toBe(true);
    expect(outcome.state.pauseReason).toBe("Provider incident.");
  }, 60_000);

  it("reports isPaused as false, never undefined, on a contest never paused", async () => {
    // `undefined` is falsy, so the UI would happen to work - and the browser's copy of the
    // type declares `isPaused: boolean`. A field that is absent on the wire and required in
    // the type is how a later `state.isPaused.toString()` becomes a runtime crash.
    const contest = await seedActiveContest();
    const userId = new mongoose.Types.ObjectId().toString();
    await seat(contest._id, userId);

    const outcome = await getPlayState(String(contest._id), userId);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    expect(outcome.state.isPaused).toBe(false);
  }, 60_000);
});

describe("endLiveRoundsForContest", () => {
  async function seedRound(
    contestId: mongoose.Types.ObjectId,
    userId: string,
    status: string,
  ) {
    return GameRound.create({
      roundId: `round-${Math.random().toString(36).slice(2, 10)}`,
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId,
      contestType: "competition",
      contestId,
      attemptNumber: 1,
      // Required, and omitting it failed four tests on one validation error - the fixture
      // lesson for the fourth time. Mongoose validates the document, not the subset the test
      // reads, and `mode` is not a field any of these assertions touch.
      mode: "ranked",
      status,
      expiresAt: new Date(Date.now() + HOUR),
    });
  }

  it("voids every live round and leaves terminal ones alone", async () => {
    const contest = await seedActiveContest();
    const live = await seedRound(
      contest._id,
      new mongoose.Types.ObjectId().toString(),
      "launched",
    );
    const pending = await seedRound(
      contest._id,
      new mongoose.Types.ObjectId().toString(),
      "pending",
    );
    const done = await seedRound(
      contest._id,
      new mongoose.Types.ObjectId().toString(),
      "completed",
    );

    const result = await endLiveRoundsForContest({
      contestId: String(contest._id),
      reason: "Competition cancelled: test",
    });

    expect(result.ended).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.roundIds.sort()).toEqual(
      [live.roundId, pending.roundId].sort(),
    );

    // THE ASSERTION THAT MATTERS MOST: a completed round is untouched. It carries a score
    // that has already reached `participant.score`, and rewriting its status would make a
    // ranked number unexplainable. Same reasoning as the edit backfill test that seeds an
    // already-correct row and asserts it survives.
    //
    // AND THE THING THAT HOLDS IT IS THE QUERY FILTER, not the transition check inside the
    // loop. Deleting that check left this test green, because `LIVE_ROUND_STATUSES` never
    // hands it an illegal move - so the check is a tripwire for a future widening of that
    // list and nothing more. The probe is aimed at `status: { $in: LIVE_ROUND_STATUSES }`,
    // which is what a green result here would really mean was broken.
    const after = await GameRound.findOne({ roundId: done.roundId }).lean<{
      status?: string;
      resultSource?: string;
    } | null>();
    expect(after?.status).toBe("completed");
    expect(after?.resultSource).not.toBe("manual");
  }, 60_000);

  it("records the decision as manual, not as the net giving up", async () => {
    // Without `resultSource: "manual"` a voided round is indistinguishable from one the
    // reconciliation net abandoned, which is the difference between a decision and a failure.
    const contest = await seedActiveContest();
    const round = await seedRound(
      contest._id,
      new mongoose.Types.ObjectId().toString(),
      "launched",
    );

    await endLiveRoundsForContest({
      contestId: String(contest._id),
      reason: "Emergency cancellation: test",
    });

    const after = await GameRound.findOne({ roundId: round.roundId }).lean<{
      status?: string;
      resultSource?: string;
      resultReceivedAt?: Date;
    } | null>();
    expect(after?.status).toBe("voided");
    expect(after?.resultSource).toBe("manual");
    expect(after?.resultReceivedAt).toBeInstanceOf(Date);
  }, 60_000);

  it("is idempotent, so a retried cancellation costs nothing", async () => {
    const contest = await seedActiveContest();
    await seedRound(
      contest._id,
      new mongoose.Types.ObjectId().toString(),
      "launched",
    );

    const first = await endLiveRoundsForContest({
      contestId: String(contest._id),
      reason: "first",
    });
    const second = await endLiveRoundsForContest({
      contestId: String(contest._id),
      reason: "second",
    });

    expect(first.ended).toBe(1);
    // Zero and no refusal: a second call finds nothing live. A retried admin click or a
    // re-delivered cron must not report an error for having done nothing wrong.
    expect(second.ended).toBe(0);
    expect(second.skipped).toBe(0);
  }, 60_000);

  it("does not touch another contest's rounds", async () => {
    // The filter is the whole safety property, and a missing `contestId` clause would void
    // every live round on the platform while every assertion about THIS contest still passed.
    const mine = await seedActiveContest();
    const theirs = await seedActiveContest();
    await seedRound(
      mine._id,
      new mongoose.Types.ObjectId().toString(),
      "launched",
    );
    const other = await seedRound(
      theirs._id,
      new mongoose.Types.ObjectId().toString(),
      "launched",
    );

    const result = await endLiveRoundsForContest({
      contestId: String(mine._id),
      reason: "test",
    });

    expect(result.ended).toBe(1);
    const untouched = await GameRound.findOne({ roundId: other.roundId }).lean<{
      status?: string;
    } | null>();
    expect(untouched?.status).toBe("launched");
  }, 60_000);
});
