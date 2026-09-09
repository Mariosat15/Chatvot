import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural guards on the player play screen.
 *
 * WHY STRUCTURAL AND NOT RENDERED: the vitest environment is `node` and the repository has no
 * jsdom or react-testing-library. Adding them for this slice would be a test-stack change landing
 * in the same commit as a money-adjacent feature, which is exactly the sort of "small addition"
 * that destroys the value of a green suite. The properties asserted here are structural anyway -
 * where a POST may appear, which sandbox token is absent, which route a link points at.
 *
 * TWO RULES LEARNED BY GETTING THESE WRONG BEFORE, BOTH OBEYED HERE.
 *
 *   - **Strip comments before matching.** These files explain the anti-patterns they avoid in
 *     prose, so a test that reads prose flags a correct file for discussing the mistake and
 *     passes a broken one whose only mention of the right thing is in a comment.
 *   - **An import is not a use.** Matching a bare identifier finds it in the import line, so
 *     every assertion below matches a call with its arguments, or an operator with its operands.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PLAY_PAGE = "app/(root)/competitions/[id]/play/page.tsx";
const HOST = "components/games/ProviderRoundHost.tsx";
const FRAME = "components/games/ProviderGameFrame.tsx";
const PREFLIGHT = "components/games/RoundPreflight.tsx";
const RESULT = "components/games/RoundResultPanel.tsx";
const ENTRY_BUTTON = "components/trading/CompetitionEntryButton.tsx";
const TRADE_PAGE = "app/(root)/competitions/[id]/trade/page.tsx";
const ROUNDS_ROUTE = "app/api/competitions/[id]/rounds/route.ts";
const LOBBY_PAGE = "app/(root)/competitions/[id]/page.tsx";
const PROVIDER_LOBBY = "components/games/ProviderContestLobby.tsx";
const PROVIDER_BOARD = "components/games/ProviderLeaderboard.tsx";

describe("a page load never consumes an attempt", () => {
  /**
   * THE MOST EXPENSIVE MISTAKE THIS SLICE COULD MAKE.
   *
   * An attempt is consumed when a round is CREATED, deliberately, so that a player cannot
   * abandon a bad round and retry free for ever. Creating one from a server component would make
   * it a side effect of a GET - and Next.js prefetches `<Link>` targets on hover. A paying
   * player would lose their only attempt to a mouse movement, and nothing would error.
   */
  it("the play page does not launch a round while rendering", () => {
    const code = readCode(PLAY_PAGE);

    expect(code).not.toMatch(/launchContestRound\s*\(/);
    expect(code).not.toMatch(/method:\s*["']POST["']/);
    expect(code).not.toMatch(/createRound\s*\(/);
  });

  it("the play page reads state through the same function the API uses", () => {
    // Reason it matters that they share one function: if the page decided who may play and the
    // route decided separately, one would eventually allow what the other refused.
    const code = readCode(PLAY_PAGE);
    expect(code).toMatch(/await\s+getPlayState\(/);
  });

  it("only the client host issues the POST that creates a round", () => {
    const host = readCode(HOST);
    expect(host).toMatch(/method:\s*["']POST["']/);

    // And it is behind a callback, not an effect that fires on mount - an effect would relaunch
    // on every remount, which is a page refresh away.
    expect(host).not.toMatch(/useEffect\([^)]*\)\s*=>\s*\{\s*void\s+launch/);
  });

  it("the GET handler exists beside the POST and is the one the client polls", () => {
    const code = readCode(ROUNDS_ROUTE);
    expect(code).toMatch(/export\s+async\s+function\s+GET\s*\(/);
    expect(code).toMatch(/export\s+async\s+function\s+POST\s*\(/);
    // The GET must not reach the launch path, or polling would burn attempts.
    const getBody = code.slice(
      code.search(/export\s+async\s+function\s+GET\s*\(/),
      code.search(/export\s+async\s+function\s+POST\s*\(/),
    );
    expect(getBody).not.toMatch(/launchContestRound\(/);
    expect(getBody).toMatch(/getPlayState\(/);
  });
});

describe("the user id comes from the session, never from the request", () => {
  it("both handlers read the id off the session", () => {
    const code = readCode(ROUNDS_ROUTE);

    // Two handlers, two reads. Counting is the point: a file whose GET is scoped and whose POST
    // is not passes any assertion that merely looks for the pattern once.
    const sessionReads = code.match(/session\.user\.id/g) ?? [];
    expect(sessionReads.length).toBe(2);
  });

  it("neither handler takes a user id from the query string or the body", () => {
    const code = readCode(ROUNDS_ROUTE);
    expect(code).not.toMatch(/searchParams\.get\(\s*["'](userId|playerId)["']/);
    expect(code).not.toMatch(/body\.(userId|playerId)/);
  });
});

describe("nothing the browser says decides a score", () => {
  /**
   * The frame's messages are attacker-controlled: the player has a developer console. The
   * behavioural proof that a score cannot travel this way is in
   * `provider-frame-messages.test.ts`; this asserts the host component does not reach around it.
   */
  it("the host never reads a score out of a frame message", () => {
    const code = readCode(HOST);

    expect(code).not.toMatch(/event\.data\.\w*[Ss]core/);
    expect(code).not.toMatch(/message\.\w*[Ss]core/);
    expect(code).not.toMatch(/setScore\(/);
  });

  it("the host asks the server after the frame says it finished", () => {
    const code = readCode(HOST);
    // `finished` must lead to a fetch, not to a rendered result. The confirming phase is what
    // makes the difference visible in the UI.
    expect(code).toMatch(/confirmResult\(/);
    expect(code).toMatch(/name:\s*["']confirming["']/);
  });

  it("the result panel renders the score it was given by the server, not by the frame", () => {
    const code = readCode(RESULT);
    // It takes a `PlayerRoundView`, which only the API produces.
    expect(code).toMatch(/round:\s*PlayerRoundView\s*\|\s*null/);
    expect(code).not.toMatch(/addEventListener\(\s*["']message["']/);
  });
});

describe("waiting for a result is never a dead end", () => {
  /**
   * THE OWNER'S REPORT WAS "WHEN I TRY TO LEAVE GAME IS STUCK", AND IT WAS ACCURATE.
   *
   * `handleExit` moves to `confirming`, which polls for `POLL_ATTEMPTS * POLL_INTERVAL_MS` -
   * sixty seconds - before the amber panel with its Back button replaces it. For that minute the
   * confirming panel offered a spinner and no control of any kind, to a player who had just
   * pressed the one button meaning "get me out of here". Leaving early costs nothing: the result
   * arrives by signed callback into our own database and is settled by the unresolved-round
   * policy if it never does.
   */
  it("the confirming panel offers a way back to the contest", () => {
    const code = readCode(RESULT);

    // Locate the confirming branch by index rather than scanning towards it, and assert the link
    // sits INSIDE it - the panel has always had a Back link in its other two branches, so a bare
    // search for one is green on exactly the defect this pins.
    const start = code.indexOf("if (confirming)");
    expect(start).toBeGreaterThan(-1);
    const end = code.indexOf("if (!round)", start);
    expect(end).toBeGreaterThan(start);

    const branch = code.slice(start, end);
    expect(branch.length).toBeGreaterThan(120);
    expect(branch).toMatch(/<Link\s+href=\{`\/competitions\/\$\{competitionId\}`\}/);
  });

  it("the wait does not tell the player they have to stay", () => {
    // Both messages say so explicitly, because a spinner beside a Back button is ambiguous
    // about whether leaving abandons the result. It does not.
    const code = readCode(RESULT);
    const occurrences = code.match(/do not need to wait here/g) ?? [];
    expect(occurrences.length).toBe(2);
  });

  /**
   * WHY THE TWO ROUTES INTO THIS STATE NEED TWO MESSAGES.
   *
   * A game that ended has a score coming. A player who left mostly did so because the game never
   * started - "Leave the game" is the only affordance the stall panel offers - so "waiting for
   * the game to confirm your score" describes something that does not exist. The count is what
   * makes this fail: one shared message satisfies any assertion about either.
   */
  it("leaving and finishing are told apart, and worded apart", () => {
    const host = readCode(HOST);
    const result = readCode(RESULT);

    expect(host).toMatch(/reason:\s*["']left["']/);
    expect(host).toMatch(/reason:\s*["']finished["']/);
    // The host must PASS it on; computing the reason and then not handing it over is the shape
    // that leaves the panel unable to tell the two apart while every other assertion passes.
    expect(host).toMatch(/confirmReason=\{/);

    expect(result).toMatch(/reason\s*===\s*["']left["']/);
    // Only the finished branch may promise a score. Asserting the absence of the phrase from the
    // left branch is the load-bearing half - the file legitimately contains it once.
    const left = result.indexOf('reason === "left"');
    const ret = result.indexOf("return {", left);
    const leftBranch = result.slice(left, result.indexOf("}", ret));
    expect(leftBranch.length).toBeGreaterThan(80);
    expect(leftBranch).not.toMatch(/your score/);
  });
});

describe("the frame is hosted under supervision", () => {
  it("checks both the source window and the origin of every message", () => {
    const code = readCode(FRAME);

    // Source first: no unrelated window can forge `event.source`, which makes it the strongest
    // of the checks. Matching the comparison rather than the identifier, because
    // `contentWindow` alone would also appear in a ref declaration.
    expect(code).toMatch(/event\.source\s*!==\s*frameRef\.current\?\.contentWindow/);
    expect(code).toMatch(/event\.origin\s*!==\s*expectedOrigin/);
  });

  it("passes the payload through the shared narrowing function", () => {
    const code = readCode(FRAME);
    expect(code).toMatch(/parseProviderFrameMessage\(\s*event\.data\s*\)/);
  });

  /**
   * THE OMISSION IS THE FEATURE.
   *
   * `allow-top-navigation` would let a game navigate the player's entire page away from
   * ChartVolt. A provider bug or a compromised game doing that mid-contest looks to the player
   * like our site crashing. `allow-popups` is absent for the same class of reason, matching the
   * spec's "no external links out".
   */
  it("sandboxes the frame without top navigation or popups", () => {
    const code = readCode(FRAME);
    const sandbox = code.match(/sandbox="([^"]+)"/);

    expect(sandbox).not.toBeNull();
    const tokens = (sandbox?.[1] ?? "").split(/\s+/);

    expect(tokens).toContain("allow-scripts");
    expect(tokens).toContain("allow-same-origin");
    expect(tokens).not.toContain("allow-top-navigation");
    expect(tokens).not.toContain("allow-top-navigation-by-user-activation");
    expect(tokens).not.toContain("allow-popups");
  });

  it("refuses to render a frame whose launch URL has no verifiable origin", () => {
    const code = readCode(FRAME);

    // TWO SEPARATE GUARDS, AND THE FIRST VERSION OF THIS TEST COULD NOT TELL THEM APART.
    // `!expectedOrigin` appears twice: once to skip attaching the listener, once to refuse the
    // render. A probe that replaced the RENDER guard with `if (false)` left the suite green,
    // because the listener's copy still satisfied a bare `/if \(!expectedOrigin\)/`. The
    // difference matters - without the render guard an unverifiable frame is still shown, and
    // then hosted with no message supervision at all.
    const guards = code.match(/if\s*\(!expectedOrigin\)/g) ?? [];
    expect(guards.length).toBe(2);

    // The listener guard: no origin, no message handling.
    expect(code).toMatch(/if\s*\(!expectedOrigin\)\s*return;/);

    // The render guard: no origin, no frame - and it must return the refusal, not fall through.
    const renderGuard = code.search(/if\s*\(!expectedOrigin\)\s*\{/);
    const iframe = code.search(/<iframe/);
    expect(renderGuard).toBeGreaterThan(-1);
    expect(iframe).toBeGreaterThan(renderGuard);
    expect(code.slice(renderGuard, iframe)).toMatch(/return\s*\(/);
  });
});

/**
 * THE OWNER'S REPORT: starting a round showed "Loading Circuit Sprint..." and never stopped.
 *
 * Two independent defects produce that one symptom, and neither fix covers the other.
 *
 *   - The game rendered its own error panel and did not announce `ready`, so the platform's
 *     OPAQUE overlay stayed on top of the explanation for ever. Fixed in the service's
 *     `public/play/app.js` and pinned by its own `test-play.ts`.
 *   - The platform waited for `ready` with no bound at all. A frame refused by a
 *     `frame-ancestors` policy, 404'd by a proxy that is not routing `/play`, or served by a
 *     service that is down renders something and fires `load`, so there is no error event to
 *     catch - the wait simply never ended, nothing was logged, and the player had no way out,
 *     because the button that leaves a round is inside the frame that failed.
 */
describe("the wait for a frame that never starts is bounded", () => {
  it("stands the loading overlay down on a timer, not only on ready", () => {
    const code = readCode(FRAME);

    // The timer exists and is what sets the flag. Asserted as the call with its argument, since
    // the constant's name alone appears in its own declaration.
    expect(code).toMatch(/setTimeout\(\s*\(\)\s*=>\s*setStalled\(true\)\s*,\s*READY_TIMEOUT_MS\s*\)/);

    // And it is cleared, or a frame that reports ready normally still flips to the notice a few
    // seconds later - a working game accused of being broken.
    expect(code).toMatch(/return\s*\(\)\s*=>\s*clearTimeout\(timer\)/);
  });

  it("shows the spinner and the notice on complementary conditions", () => {
    const code = readCode(FRAME);

    /*
      The two must be exact complements of each other over `stalled`, and the reason is the whole
      point of the fix rather than a tidiness argument: the overlay is opaque and covers the
      frame, so leaving it up alongside the notice would keep hiding whatever the game rendered
      underneath - which is the more useful of the two messages, because it is the game's own.

      Asserted as the rendered conditions, and BOTH of them, because a version that adds the
      notice while leaving `!ready` on the overlay reviews as correct and reproduces the bug.
    */
    expect(code).toMatch(/\{!ready\s*&&\s*!stalled\s*&&\s*\(/);
    expect(code).toMatch(/\{!ready\s*&&\s*stalled\s*&&\s*\(/);

    // The overlay is the one that is absolutely positioned over the frame. If that ever moves to
    // the notice, the notice inherits the covering behaviour and the assertions above stop
    // meaning anything.
    const overlay = code.search(/\{!ready\s*&&\s*!stalled\s*&&\s*\(/);
    const notice = code.search(/\{!ready\s*&&\s*stalled\s*&&\s*\(/);
    expect(code.slice(overlay, notice)).toMatch(/absolute inset-0/);
  });

  it("tells a game that could not be reached apart from one that did not start", () => {
    const code = readCode(FRAME);

    /*
      `load` fires for a 404 page and for a policy refusal as readily as for the real thing, so
      it cannot mean "the game started". What it does separate is whether the browser got a
      document at all, and those are two different things to tell a player: one is a connection
      problem they might retry out of, the other is a game that is unavailable.

      Matched as the branch on the flag rather than the flag's name, which also appears in its
      own declaration and in the `onLoad` handler that sets it.
    */
    expect(code).toMatch(/onLoad=\{\(\)\s*=>\s*setDocumentLoaded\(true\)\}/);
    expect(code).toMatch(/\{documentLoaded\s*\n?\s*\?/);
  });

  it("offers a retry that remounts the frame, and an exit that is the real one", () => {
    const code = readCode(FRAME);

    /*
      The retry works by changing the iframe's `key`, which remounts it and re-requests the launch
      URL. That is only an honest button because `servePlayPage` reads no token and consumes
      nothing, and the session behind it resumes - so a retry costs the player no attempt.
    */
    expect(code).toMatch(/setAttempt\(\(n\)\s*=>\s*n\s*\+\s*1\)/);
    expect(code).toMatch(/key=\{attempt\}/);

    // The exit goes through the host's own handler, so leaving here does exactly what leaving
    // from inside the game does: the round stays open and the result is confirmed by polling.
    // A local "go back" would strand the round with the player believing they had left it.
    expect(code).toMatch(/onClick=\{onExit\}/);
  });

  it("logs the diagnosis it deliberately does not show the player", () => {
    const code = readCode(FRAME);

    // The copy names neither the origin nor the timeout, on purpose - neither means anything to
    // a player. This line is what lets support tell a routing fault from a game that crashed on
    // boot, and without it the whole class of failure is still invisible to us.
    const log = code.search(/console\.error\(/);
    expect(log).toBeGreaterThan(-1);
    const logged = code.slice(log, log + 400);
    expect(logged).toMatch(/expectedOrigin/);
    expect(logged).toMatch(/READY_TIMEOUT_MS/);
    expect(logged).toMatch(/documentLoaded/);
  });
});

describe("a provider contest is never sent to the trading workspace", () => {
  it("the trading page redirects a provider contest to the play route", () => {
    const code = readCode(TRADE_PAGE);

    expect(code).toMatch(/if\s*\(isProviderContest\(competition\)\)/);
    expect(code).toMatch(
      /redirect\(`\/competitions\/\$\{competitionId\}\/play`\)/,
    );
  });

  /**
   * The two routes redirect into each other, so their conditions must be exact complements.
   *
   * `/trade` bounces when `isProviderContest` is true; `/play` bounces only on the
   * `not_provider_contest` refusal, which is that same predicate being false. If a later change
   * made them overlap the result would not be a wrong screen - it would be an infinite redirect,
   * which in Next.js surfaces as a blank page or a browser error rather than anything that names
   * the cause.
   */
  it("cannot form a redirect loop with the play route", () => {
    const trade = readCode(TRADE_PAGE);
    const play = readCode(PLAY_PAGE);

    // The trading page bounces on the predicate being TRUE.
    expect(trade).toMatch(/if\s*\(isProviderContest\(competition\)\)\s*\{/);

    // The play page bounces on exactly one refusal, and it is the complement of that predicate.
    const playRedirects =
      play.match(/redirect\(`\/competitions\/\$\{competitionId\}\/trade`\)/g) ?? [];
    expect(playRedirects.length).toBe(1);
    expect(play).toMatch(
      /outcome\.refusal\s*===\s*["']not_provider_contest["']/,
    );

    // And it must not bounce on any other refusal, or a seatless player would ping-pong. Written
    // as literal patterns rather than built from a loop variable: `new RegExp` on a composed
    // string is what `security/detect-non-literal-regexp` flags, and the three cases are few
    // enough that spelling them out is clearer than justifying a suppression.
    expect(play).not.toMatch(
      /refusal\s*===\s*["']not_a_participant["'][\s\S]{0,140}?\/trade/,
    );
    expect(play).not.toMatch(
      /refusal\s*===\s*["']misconfigured["'][\s\S]{0,140}?\/trade/,
    );
    expect(play).not.toMatch(
      /refusal\s*===\s*["']failed["'][\s\S]{0,140}?\/trade/,
    );
  });

  it("the guard runs before the page does its trading work", () => {
    // A guard placed after the position and margin reads would still redirect, but it would have
    // spent the queries first - and more importantly it would be one refactor away from
    // rendering something before it bounces.
    const code = readCode(TRADE_PAGE);
    const guard = code.search(/isProviderContest\(competition\)/);
    const positions = code.search(/getUserPositions\(/);

    expect(guard).toBeGreaterThan(-1);
    expect(positions).toBeGreaterThan(guard);
  });

  it("the contest CTA sends a provider contest to play and a trading contest to trade", () => {
    const code = readCode(ENTRY_BUTTON);

    // The strict helper, deliberately: this decides a destination, and /play cannot work without
    // a provider key and a game code.
    expect(code).toMatch(/isProviderContest\(competition\)/);
    expect(code).toMatch(/competitions\/\$\{competition\._id\}\/play/);
    // Trading is untouched - the old destination must still be reachable for a trading contest.
    expect(code).toMatch(/competitions\/\$\{competition\._id\}\/trade/);
  });

  it("does not offer a trade-history button on a provider contest", () => {
    const code = readCode(ENTRY_BUTTON);

    // Both history links are guarded. Counting them is what stops a second, unguarded one
    // hiding behind the first.
    const historyLinks =
      code.match(/competitions\/\$\{competition\._id\}\/trade\?viewOnly=true/g) ?? [];
    expect(historyLinks.length).toBe(2);

    expect(code).toMatch(/!isProviderGame\s*&&/);
    expect(code).toMatch(/isCompleted\s*&&\s*!isProviderGame/);
  });
});

describe("the pre-flight tells a player what an attempt costs", () => {
  it("says starting uses an attempt", () => {
    const code = readCode(PREFLIGHT);
    expect(code).toMatch(/uses one attempt/i);
  });

  it("offers resume rather than play when a round is already live", () => {
    // Relaunching a live round returns the same round with a fresh launch URL and costs nothing,
    // so labelling it "Play" would tell the player they were spending an attempt they are not.
    const code = readCode(PREFLIGHT);
    expect(code).toMatch(/state\.liveRound\s*!==\s*null/);
    expect(code).toMatch(/Resume your round/);
    expect(code).toMatch(/does not use another attempt/i);
  });

  it("disables the control when there is nothing left to spend", () => {
    const code = readCode(PREFLIGHT);
    // `blocked` now carries the exhausted and window cases along with the contest's own state.
    // Asserting the aggregate rather than the list is deliberate: the next reason to refuse
    // should be added to `blocked`, not bolted onto this expression, and a test naming the
    // three original terms would quietly permit a fourth that the button ignores.
    expect(code).toMatch(/disabled=\{launching\s*\|\|\s*blocked\}/);
    expect(code).toMatch(/const blocked\s*=/);
    expect(code).toMatch(/exhausted/);
    expect(code).toMatch(/windowClosed/);
  });
});

/**
 * THE CONTEST'S OWN STATE, which this screen ignored until 6 September 2026.
 *
 * It read attempts and the play window and offered a fully enabled Play button on a contest
 * that had not started. Nothing was lost by pressing it - the launch service refuses anything
 * but `active` and consumes no attempt - but the player got a red error instead of an
 * explanation, on the very first screen a new entrant sees. A control that appears to work and
 * does nothing is the same failure as a provider enabled with no adapter.
 */
describe("the pre-flight refuses what the server would refuse", () => {
  it("reads the contest status, which is already on the state it is given", () => {
    const code = readCode(PREFLIGHT);
    expect(code).toMatch(/state\.contestStatus\s*===\s*"upcoming"/);
    expect(code).toMatch(/state\.contestStatus\s*!==\s*"active"/);
  });

  it("treats a draft contest as not started, because a URL reaches one before publish", () => {
    const code = readCode(PREFLIGHT);
    expect(code).toMatch(/state\.contestStatus\s*===\s*"draft"/);
  });

  it("blocks resume as well as play, because the status gate runs before the resume path", () => {
    const code = readCode(PREFLIGHT);

    // The subtle one. `exhausted` deliberately excludes a live round, so resume survives a
    // spent allowance. The contest's status must NOT be excluded that way: a round in a
    // finished contest cannot be reopened, so `blocked` has to be independent of `resuming`.
    // Asserting position is what catches a later `&& !resuming` being appended to it.
    const blocked = code.match(/const blocked\s*=[\s\S]*?;/);
    expect(blocked).not.toBeNull();
    expect(blocked![0]).not.toMatch(/resuming/);
  });

  it("gives every refusal its own wording rather than one generic message", () => {
    const code = readCode(PREFLIGHT);

    // Five distinct reasons, five distinct things a player can do about them. Collapsing them
    // was the first mistake made on `LaunchRefusal`, where "attempts exhausted", "a round is
    // already live" and "the provider is down" all became `contest_not_open` and the UI had to
    // guess which affordance to offer.
    expect(code).toMatch(/has not started yet/i);
    expect(code).toMatch(/no longer accepting rounds/i);
    expect(code).toMatch(/has not opened/i);
    expect(code).toMatch(/window .*has closed|has closed/i);
    expect(code).toMatch(/used all of your attempts/i);
  });

  it("does not colour a not-yet-started contest as an error", () => {
    const code = readCode(PREFLIGHT);

    // The red box is for a rejected action. Having just joined a contest that starts tomorrow
    // is the normal case, and rendering it in red teaches a player something is broken. Count
    // the red containers so a second one cannot be added for `blockedReason` unnoticed.
    const redPanels = code.match(/border-red-500\/30/g) ?? [];
    expect(redPanels.length).toBe(1);

    const refusalPanel = code.match(/\{refusal &&[\s\S]*?\)\}/);
    expect(refusalPanel).not.toBeNull();
    expect(refusalPanel![0]).toMatch(/border-red-500\/30/);
  });

  it("does not promise an attempt cost on a contest that cannot be played", () => {
    const code = readCode(PREFLIGHT);
    // "Starting uses one attempt" beside a disabled button reads as a warning about something
    // the player cannot do.
    expect(code).toMatch(/!resuming\s*&&\s*!blocked/);
  });
});

/**
 * THE LOBBY, which kept working and kept being wrong for longer than anything else here.
 *
 * `app/(root)/competitions/[id]/page.tsx` is the forex trading lobby: difficulty from leverage
 * and starting capital, an asset-class list, a margin explainer, "Enter Terminal", and a
 * leaderboard whose columns are profit and loss. It rendered all of that for a puzzle contest
 * without erroring, because the fields a provider contest lacks are either guarded or filled by
 * schema defaults - measured against a real MongoDB in
 * `__tests__/services/provider-contest-lobby-shape.test.ts`, not assumed.
 */
describe("a provider contest gets its own lobby, not the trading one", () => {
  it("branches on the label rather than on the strict helper", () => {
    const code = readCode(LOBBY_PAGE);

    // The case that separates them: a contest labelled provider but missing its provider key
    // cannot launch a round, so the strict helper refuses it - and it is still not a trading
    // contest, so handing it the trading lobby gives a puzzle player an Enter Terminal button.
    // Importing the strict helper here would compile and review as correct.
    expect(code).toMatch(/hasProviderGameLabel\(competition\)/);
    expect(code).not.toMatch(/isProviderContest\(/);
  });

  it("returns before any trading computation runs", () => {
    const code = readCode(LOBBY_PAGE);

    // Asserting POSITION, not presence. A branch placed after the difficulty calculation would
    // still render the right screen while computing leverage and starting capital for a contest
    // that has neither - and the test would pass on presence alone.
    const branch = code.search(/hasProviderGameLabel\(competition\)/);
    const difficulty = code.search(/getDifficultyData\(\)/);

    expect(branch).toBeGreaterThan(-1);
    expect(difficulty).toBeGreaterThan(branch);
  });

  it("does not duplicate the registration-deadline rule", () => {
    const code = readCode(LOBBY_PAGE);

    // The clamp against startTime exists for documents an old bug wrote with a deadline an hour
    // BEFORE the start. A second copy that forgot it would silently refuse entry to those
    // contests, with the contest visibly upcoming and the button saying registration had closed.
    expect(code).toMatch(/isRegistrationClosed\(competition\)/);
    const inlineCopies = code.match(/deadline < start \? start : deadline/g) ?? [];
    expect(inlineCopies.length).toBe(0);
  });

  it("shows the three things a provider lobby must answer", () => {
    const code = readCode(PROVIDER_LOBBY);

    // `13` s4: players hit all three, and the third is the one nobody thinks to show and the one
    // that costs money when it happens.
    expect(code).toMatch(/Play window/);
    expect(code).toMatch(/Your attempts/);
    expect(code).toMatch(/If a round does not finish/);
  });

  it("refuses Play with a reason when the contest cannot launch a round", () => {
    const code = readCode(PROVIDER_LOBBY);

    // A disabled control teaches nothing. Third instance of the rule after a provider enabled
    // with no adapter and Edit withheld from a provider contest.
    expect(code).toMatch(/const canLaunch = isProviderContest\(competition\)/);
    expect(code).toMatch(/isUserIn && !canLaunch/);

    /*
      The restyle rewrote this copy, and the assertion was widened rather than pinned to the new
      sentence, because the exact phrasing is not the property - naming the missing thing is.
      Two clauses are load-bearing and both are asserted: it says the GAME DETAILS are what is
      missing, so an operator reading a player's screenshot knows where to look, and it says
      NOTHING WAS CHARGED, because a player shown a dead Play button on a paid contest otherwise
      has no way to know whether their attempt was spent.
    */
    expect(code).toMatch(/game details[\s\S]{0,60}missing/i);
    expect(code).toMatch(/nothing has been charged/i);
  });

  it("reads only fields the catalogue model actually declares", () => {
    const code = readCode(PROVIDER_LOBBY);

    // `tagline` was in the first draft and `provider-game.model.ts` does not have it, so it
    // would have rendered nothing for ever while looking correct. A hand-written `.lean<{...}>()`
    // generic is exactly where an invented field name survives a typecheck.
    expect(code).toMatch(/\.select\("displayName scoreType"\)/);
    expect(code).not.toMatch(/tagline/);
  });

  it("takes the game's name from the catalogue, never from the keys", () => {
    const code = readCode(PROVIDER_LOBBY);

    // `gameKey` is an internal join key that happens to read like English, and `providerKey` is
    // the supplier's brand - `13` s4 requires provider-neutral labels.
    expect(code).toMatch(/title\?\.displayName/);
    expect(code).not.toMatch(/gameName = .*gameKey/);
    expect(code).not.toMatch(/gameName = .*providerKey/);
  });
});

describe("the provider leaderboard shows a score and nothing it does not have", () => {
  it("is not the trading leaderboard", () => {
    const lobby = readCode(PROVIDER_LOBBY);

    // `CompetitionLeaderboard`'s row type declares currentCapital, pnl, pnlPercentage and the
    // trade counts, and its props demand a prizeDistribution and a minimumTrades. Rendering it
    // here would put zeroed profit and loss, and a "minimum trades" qualification note, in front
    // of a player who has never traded - `05` s10's binding rule broken in the most visible
    // place available.
    expect(lobby).not.toMatch(/CompetitionLeaderboard/);
    expect(lobby).toMatch(/<ProviderLeaderboard/);
  });

  it("renders no trading figure at all", () => {
    const code = readCode(PROVIDER_BOARD);
    for (const field of [
      "currentCapital",
      "startingCapital",
      "pnlPercentage",
      "totalTrades",
      "winningTrades",
      "minimumTrades",
    ]) {
      expect(code).not.toContain(field);
    }
    // `pnl` on its own, checked separately so `pnlPercentage` cannot satisfy it.
    expect(code).not.toMatch(/\bpnl\b/);
  });

  it("distinguishes an absent score from a score of zero", () => {
    const code = readCode(PROVIDER_BOARD);

    // A player who has not finished a round has no score. Rendering that as 0 puts them level
    // with someone who genuinely scored nothing - the read-side form of the `score ?? 0` that
    // made every provider participant tie in R37.
    expect(code).toMatch(/row\.score === undefined \|\| row\.score === null/);
    expect(code).not.toMatch(/score \?\? 0/);
  });

  it("does not decide the ranking direction a second time", () => {
    const code = readCode(PROVIDER_BOARD);

    // Rows arrive already ordered by `calculateRankings`, which resolves the direction once from
    // the catalogue. Sorting or negating here is a second place for the direction to be decided,
    // which is precisely the defect R37 closed.
    expect(code).not.toMatch(/scoreDirection/);
    expect(code).not.toMatch(/\.sort\(/);
  });
});

/**
 * THE TWO LOBBIES MUST LOOK LIKE ONE PRODUCT (owner requirement, 6 Sep 2026), while sharing
 * none of the trading content.
 *
 * HOW THIS BLOCK CHANGED, AND WHY, because the previous version was the recommended approach in
 * this very file one day earlier. It kept the two screens consistent by asserting that specific
 * class strings appeared in BOTH lobby files - a genuine comparison, which survived the trading
 * page being edited. What killed it was the owner's decision to restyle the trading lobby too,
 * and the four further screens in the same style sheet: pairwise class-string comparison
 * between five screens is twenty comparisons, and the first one somebody forgets to add is
 * silent. **The property is now that there is one definition and neither screen has chrome of
 * its own**, which is a stronger claim and does not grow with the number of screens.
 *
 * THE TEST THAT MATTERS MOST IS THE NEGATIVE ONE. Asserting both lobbies import the kit is easy
 * to satisfy and easy to defeat - a file can import the kit and still hand-roll a panel beside
 * it, which is exactly how the drift starts. So the panel shell's literal value is asserted to
 * appear in the token file and in NO other file: re-introducing a bespoke panel to either lobby
 * turns this red and names the file.
 *
 * The reason it matters more than it sounds: a player reaches both screens from the same
 * competitions list. A different corner radius, border tone or heading size is read as a
 * different website, not as a different game.
 */
describe("the two lobbies are built from one design kit", () => {
  const KIT_TOKENS = "components/neon/tokens.ts";
  const KIT_CARDS = "components/neon/Cards.tsx";
  const TRADING_HERO = "components/trading/lobby/TradingLobbyHero.tsx";
  const TRADING_SIDEBAR = "components/trading/lobby/TradingLobbySidebar.tsx";
  const TRADING_BOARD = "components/trading/CompetitionLeaderboard.tsx";

  /** The literal values the kit owns. Nothing outside the kit may spell these out. */
  const KIT_ONLY_LITERALS = [
    // The panel shell - the single most repeated surface in both lobbies.
    "border-[#1B2540] bg-[#0A0F1F]/80",
    // The leaderboard row shell and its "this is you" variant.
    "border-[#161E36] bg-[#080C18]/80",
    "border-sky-500/40 bg-sky-500/10",
  ];

  it.each(KIT_ONLY_LITERALS)(
    "defines %s in the kit and nowhere else",
    (literal) => {
      // Reading the kit first is what makes this a comparison rather than a snapshot: if the
      // design changes, the literal moves and this test tells you where it went.
      const kit = readCode(KIT_TOKENS) + readCode(KIT_CARDS);
      expect(kit).toContain(literal);

      for (const consumer of [
        PROVIDER_LOBBY,
        PROVIDER_BOARD,
        LOBBY_PAGE,
        TRADING_HERO,
        TRADING_SIDEBAR,
      ]) {
        expect(readCode(consumer)).not.toContain(literal);
      }
    },
  );

  it("dresses both heroes with the same component", () => {
    /*
      Not "both files contain a hero" - the SAME component, so a change to the banner treatment,
      the scrim or the h1 size cannot reach one screen and miss the other.

      THE TRAILING CHARACTER CLASS IS THE WHOLE TEST. Written `/<NeonHero/` this passed while a
      probe swapped the tag for `<NeonHeroReplacement`, because a prefix match cannot tell a
      component from one whose name merely starts the same way. Fifth instance of that family
      here, after the fixed-character Edit guard, `canTransitionRound`, `MIN_REASON_LENGTH` and
      the duplicated `!expectedOrigin`.
    */
    expect(readCode(PROVIDER_LOBBY)).toMatch(/<NeonHero[\s>]/);
    expect(readCode(TRADING_HERO)).toMatch(/<NeonHero[\s>]/);

    for (const hero of [PROVIDER_LOBBY, TRADING_HERO]) {
      expect(readCode(hero)).toMatch(
        /from "@\/components\/neon\/Hero"/,
      );
    }
  });

  it("draws every figure with the same stat card, four across", () => {
    /*
      The first version of this test counted `<StatCard` occurrences and required exactly four.
      It failed on correct code: the game lobby's fourth tile is a ternary - "Your score" for a
      player with a seat, a countdown for one without - so five occurrences render four tiles.
      **Counting source occurrences of a branch is not counting what renders**, and the honest
      property is the grid: the sheet puts four figures across, and a fifth would need either a
      five-column grid or a wrap, both of which show up here.
    */
    for (const consumer of [PROVIDER_LOBBY, TRADING_HERO]) {
      const code = readCode(consumer);
      expect(code).toMatch(/<StatCard/);
      expect(code).toMatch(/grid-cols-2[^"]*(md|lg):grid-cols-4/);
      const grids = code.match(/grid-cols-4/g) ?? [];
      expect(grids.length).toBe(1);
    }
  });

  it("gives both leaderboards the same row shell and column headings", () => {
    for (const board of [PROVIDER_BOARD, TRADING_BOARD]) {
      const code = readCode(board);
      // The call WITH its argument, not the identifier: both files also name it on an import
      // line, and an import is not a use.
      expect(code).toMatch(/neonRowClasses\([\s\S]{0,80}rank:/);
      expect(code).toMatch(/NEON_TABLE_HEAD/);
    }
  });

  it("uses the flat icon set from the sheet, not the 3D game icons", () => {
    /*
      THIS IS A DELIBERATE REVERSAL of the rule that stood here yesterday, which required the 3D
      `GameIcon` PNGs and banned lucide glyphs. That was right while the trading lobby used
      them - consistency was the instruction, and the trading lobby was the thing to be
      consistent with. The owner's style sheet specifies flat line glyphs in tinted tiles, and
      the trading lobby now follows it too, so the whole platform moved rather than one screen
      diverging. Recorded in `13` s4.1d rather than quietly swapped.
    */
    for (const consumer of [PROVIDER_LOBBY, PROVIDER_BOARD, TRADING_HERO]) {
      const code = readCode(consumer);
      expect(code).toMatch(/from "lucide-react"/);

      // Rank medals are chrome outright - the kit draws ranks with `NeonRankBadge`.
      expect(code).not.toMatch(/RankIcon/);

      /*
        NARROWED FROM A BLANKET BAN ON `GameIcon`, which was over-broad and had started
        failing correct code. The rule is about the screen's OWN iconography, and the
        distinction that carries it is the `name` prop: a literal (`name="trophy"`) is the
        screen choosing a glyph, which the sheet now specifies as a flat lucide glyph in a
        tinted `IconTile`; a bound one (`name={row.userTitleIcon}`) is rendering a piece of
        USER DATA, no more chrome than the avatar or the username beside it.

        Left as a blanket ban it forbade the provider board the level badge that
        `CompetitionLeaderboard` - the trading board this kit exists to match - has always
        rendered, so the guard would have enforced exactly the inconsistency it was written
        to prevent. And a guard that fails on correct code is the fastest way to have it
        deleted wholesale, which would have cost the rank-medal half too.
      */
      expect(code).not.toMatch(/<GameIcon\s+name="/);
    }

    // And the tiles are drawn in one place, so their size and tint cannot drift per screen.
    expect(readCode(KIT_CARDS)).toMatch(/export function IconTile/);
  });

  it("reuses the trading lobby's time components instead of formatting time itself", () => {
    const code = readCode(PROVIDER_LOBBY);

    // A game lobby that renders "2d 4h" differently from the trading lobby is the same
    // inconsistency as a different card radius - and it would be a second place for the
    // "Started"/"Ended" wording to drift.
    expect(code).toMatch(/<UTCClock\s*\/>/);
    expect(readCode(TRADING_HERO)).toMatch(/<InlineCountdown/);
    expect(code).toMatch(/<InlineCountdown[\s\S]{0,200}targetDate=/);
    expect(code).not.toMatch(/1000 \* 60 \* 60/);
  });

  it("says players, never traders", () => {
    const code = readCode(PROVIDER_LOBBY);

    // The trading lobby's equivalent count pill says "traders". Copying it wholesale is the
    // trading-shaped-label problem in the one place on the page a player is certain to read.
    expect(code).toMatch(/leaderboard\.length\}\s*players/);
    expect(code).not.toMatch(/traders/);
  });

  it("builds no Tailwind class by interpolation", () => {
    /*
      Tailwind compiles the classes it can SEE in the source, so `border-\${accent}-500/30` is a
      class that exists in the TypeScript and in no stylesheet. It renders completely unstyled
      and reads as a broken CSS build rather than as a bug in this file - which is why the
      accents are lookup tables. Conditional whole class strings are fine; a partial is not.

      The kit is included in the sweep on purpose: it is the file with the most accents in it and
      therefore the most tempting place to write one.
    */
    for (const consumer of [
      KIT_TOKENS,
      KIT_CARDS,
      "components/neon/Hero.tsx",
      "components/neon/Buttons.tsx",
      "components/neon/LeaderboardRow.tsx",
      PROVIDER_LOBBY,
      PROVIDER_BOARD,
      TRADING_HERO,
      TRADING_SIDEBAR,
      "components/trading/lobby/trading-lobby-accordions.tsx",
    ]) {
      expect(readCode(consumer)).not.toMatch(
        /(bg|text|border|from|to|via)-\$\{/,
      );
    }
  });

  it("hands the one client component data, never components", () => {
    /*
      THIS IS THE GUARD FOR A BUG THAT REACHED THE OWNER'S SCREEN, and the way it got there is
      the part worth keeping. `NeonAccordion` is the only `"use client"` file in the kit, so it
      is the only server/client boundary on either lobby. Its first version took
      `icon: LucideIcon` and built the tile itself - and a React component is a *function*,
      which cannot cross that boundary. Every request to the trading lobby threw "Functions
      cannot be passed directly to Client Components", naming `{$$typeof, render, displayName}`
      rather than anything a reader would recognise as an icon.

      **Nothing in the pipeline could have caught it.** The typecheck is happy: `LucideIcon` is
      a perfectly good prop type, and the rule it breaks is a React runtime rule, not a type
      rule. `next build` is happy: the lobby is a dynamic route, so it is never prerendered, and
      **a green build is not evidence that a dynamic page renders**. And every other test in
      this block reads source rather than rendering. So this test reads the boundary itself.
    */
    const accordion = readCode("components/neon/Accordion.tsx");

    expect(accordion).toMatch(/^"use client"/);
    // Not "no LucideIcon prop" - no reference at all, so the import cannot come back first.
    expect(accordion).not.toMatch(/LucideIcon/);
    expect(accordion).toMatch(/icon: React\.ReactNode/);

    /*
      And the enumeration, so a SECOND client component in the kit cannot be added without
      someone reading the paragraph above. If this fails, the new file needs the same treatment,
      not an addition to the list.
    */
    const clientFiles = readdirSync(join(ROOT, "components", "neon")).filter(
      (name) =>
        /\.tsx?$/.test(name) &&
        readCode(join("components", "neon", name)).includes('"use client"'),
    );
    expect(clientFiles).toEqual(["Accordion.tsx"]);
  });

  it("pre-renders every accordion icon on the server", async () => {
    /*
      The behavioural half of the guard above. The structural test proves the component does not
      *accept* a function; this proves the caller does not *pass* one, which is a different
      claim and is the one that actually broke.

      **`isValidElement` is the check, and the obvious alternatives both pass the bug.** A lucide
      icon is a `forwardRef` object, so `typeof` is `"object"`, not `"function"` - and it carries
      a `$$typeof` of its own, `Symbol.for("react.forward_ref")`. The original error message said
      as much, printing `{$$typeof: ..., render: function, displayName: ...}`. A first draft of
      this test asserted exactly those two things and **stayed green when the bug was
      reintroduced**, which is how it was found: the assertion was satisfied by the very value it
      existed to reject. Safe by accident is not safe.
    */
    const { isValidElement } = await import("react");
    const { buildTradingLobbySections } = await import(
      "../../components/trading/lobby/trading-lobby-accordions"
    );

    const sections = buildTradingLobbySections({
      competition: {
        rules: {
          allowedAssets: ["forex"],
          minimumTrades: 3,
          maxLeverage: 100,
          maxPositionsOpen: 5,
          rankingMethod: "highest_pnl",
        },
        startingCapital: 10000,
        prizePool: 500,
        maxParticipants: 50,
        prizeDistribution: [{ position: 1, percentage: 100 }],
      },
      riskSettings: {
        marginCallLevel: 80,
        stopOutLevel: 50,
        maxLeverage: 100,
      } as never,
      creditSymbol: "⚡",
    });

    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      expect(isValidElement(section.icon)).toBe(true);
      expect(isValidElement(section.content)).toBe(true);
      expect(typeof section.title).toBe("string");
      expect(typeof section.id).toBe("string");
    }
  });

  it("points every hero banner at a file that exists", async () => {
    const { allNeonBanners, providerBanner } = await import(
      "../../components/neon/banners"
    );

    /*
      A banner whose file is missing renders as a broken image: no error, no log line, and the
      page is otherwise perfect. This caught a real mistake within a minute of being written -
      the artwork was committed to `public/assets/arena/` while the kit lived in
      `components/neon/`, so every lobby on the platform would have shipped with no banner.

      `allNeonBanners()` exists for this, so the map is exhausted rather than sampled: a fifth
      banner added without its file cannot slip past.
    */
    const banners = allNeonBanners();
    expect(banners.length).toBeGreaterThanOrEqual(4);

    for (const banner of banners) {
      expect(banner.src.startsWith("/assets/")).toBe(true);
      expect(existsSync(join(ROOT, "public", banner.src))).toBe(true);
      // Alt text, not a filename: these are decorative-but-labelled hero images.
      expect(banner.alt.length).toBeGreaterThan(10);
    }

    // And an unknown game falls back rather than resolving to nothing, because a new provider
    // title arrives before its artwork does.
    expect(providerBanner("a-game-nobody-has-drawn-yet").src).toBe(
      providerBanner(null).src,
    );
  });

  it("renders no trading panel on the game lobby", () => {
    const code = readCode(PROVIDER_LOBBY);

    // The reason the lobby is a branch rather than a set of guards is that none of this belongs
    // on a game screen. Sharing the chrome must not become sharing the content.
    for (const panel of [
      "CompetitionDashboard",
      "CompetitionLeaderboard",
      "getDifficultyData",
      "riskSettings",
      "marginCall",
      "leverage",
      "startingCapital",
    ]) {
      expect(code).not.toContain(panel);
    }
  });

  it("keeps the trading sidebar's decisions open and only its reference material collapsed", () => {
    const sidebar = readCode(TRADING_SIDEBAR);

    /*
      Collapsing the sidebar is the one behaviour change in the restyle, so what stayed open is
      pinned rather than left to a comment. The entry control, the countdown, the schedule and
      the prize table are what a trader decides on; burying any of them would be the same class
      of error as an aggregate that quietly means trading only - correct-looking, and wrong
      exactly where it matters.
    */
    const accordionAt = sidebar.indexOf("<NeonAccordion");
    expect(accordionAt).toBeGreaterThan(-1);

    for (const open of [
      "<CompetitionEntryButton",
      "<LiveCountdown",
      "Schedule (UTC)",
      "<PrizeTable",
    ]) {
      const at = sidebar.indexOf(open);
      expect(at).toBeGreaterThan(-1);
      // Position, not presence: everything above the accordion is open by construction.
      expect(at).toBeLessThan(accordionAt);
    }
  });

  it("shows the prize breakdown on BOTH lobbies, from one component", () => {
    /*
      The game lobby showed a prize pool and an entry fee and never said what second place was
      worth. Pinned as the SAME import rather than "both files show prizes", because the point
      of the move is that a change to the redistribution reaches both screens - a second copy
      is the shape behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||`.

      The trailing character class matters: written `/<PrizeTable/` this passes against
      `<PrizeTableOld`, which is the prefix-match trap that has now defeated a structural test
      here five times.
    */
    for (const lobby of [PROVIDER_LOBBY, TRADING_SIDEBAR]) {
      const code = readCode(lobby);
      expect(code).toMatch(/<PrizeTable[\s>]/);
      expect(code).toContain('from "@/components/competitions/PrizeTable"');
    }
  });

  it("hides the prize panel on a contest with no configured shares", () => {
    // A free or practice contest has no distribution, and an empty panel headed "Prize
    // distribution" reads as data that failed to load rather than as a contest without prizes.
    const code = readCode(PROVIDER_LOBBY);
    const guard = code.indexOf("competition.prizeDistribution?.length");
    const panel = code.indexOf('title="Prize distribution"');

    expect(guard).toBeGreaterThan(-1);
    expect(panel).toBeGreaterThan(guard);
  });

  it("tells the player the configured shares are a floor", () => {
    /*
      The table redistributes an unfilled POSITION, which is about how many people entered. It
      cannot see a player who entered and recorded no result - that is settled at finalization
      by `hasResult` (R45) - so the figures can be exceeded. Saying so is the honest fix;
      teaching the table to predict a result is not possible before the contest ends.
    */
    const table = readCode("components/competitions/PrizeTable.tsx");
    expect(table).toContain("no result");
  });

  it("moves no money computation while restyling or relocating the prize table", () => {
    /*
      THREE OF THE FOUR ASSERTIONS HAVE NOW SURVIVED TWO MOVES CHARACTER FOR CHARACTER, and the
      fourth was broken deliberately on 9 September 2026. Saying which is which is the whole
      value of this test, so it is spelled out rather than quietly re-pinned.

      The moves: first out of `components/trading/lobby/` on 7 Sep 2026 so the game lobby
      renders one component rather than a second copy; then out of the component into
      `lib/utils/prize-projection.ts` later the same day, so the ADMIN prize sidebar computes
      the same answer instead of showing the bare configured share. Both were pure relocations,
      and an extraction's whole value is that a green suite proves nothing moved - which it only
      does if nothing else changed in the same edit. The module's parameter is named
      `competition` for exactly this reason: renaming it would have broken the match and thrown
      away the proof.

      WHAT CHANGED, AND WHY THE PROOF IT CARRIED IS GONE RATHER THAN WEAKENED. The fourth
      expression was `filledPositions > 0 ? unclaimedPercentage / filledPositions : 0` - the
      equal-share bonus, which handed every filled rank the same slice of a vacated one. Task
      document 6 specifies proportional normalisation with worked arithmetic (50/30/20 with the
      third rank vacated pays 62.5 and 37.5, not 60/40), so the expression is now a call to the
      shared `normalisePrizeShares`. That is a BEHAVIOUR change to what a winner is paid, and a
      verbatim assertion cannot survive one; re-pinning it to the new text would look identical
      to this test still working while proving something entirely different.

      SO THE GUARANTEE FOR REDISTRIBUTION MOVED TO THREE OTHER PLACES, and it is stronger than
      a text match: the golden ranking regression, which was regenerated with the changed
      payouts recorded and shows the totals unmoved in all 18 scenarios; the byte-for-byte
      mirror test on `prize-shares.ts`, since `check:mirrors` compares models and has no opinion
      about a util; and the settlement payout suites, which assert real credits out of a real
      database. This test keeps the assertions the change did NOT touch - the pool, the fee and
      the net conversion - because those still decide what a winner is paid and are still
      unproven by anything else.
    */
    const projection = readCode("lib/utils/prize-projection.ts");

    expect(projection).toContain(
      "competition.prizePool || competition.prizePoolCredits || 0",
    );
    expect(projection).toContain("(competition.platformFeePercentage || 0) / 100");
    expect(projection).toContain("(1 - platformFeePercentage)");

    /*
      And the redistribution is DELEGATED, not restated. This pair is the load-bearing half:
      the positive assertion alone is trivially satisfied by a module that imports the shared
      rule and then works the shares out again five lines later, which is precisely the
      "one rule, two copies" shape this replaced - and here the two copies would be a lobby
      promising one figure and a payout delivering another.
    */
    expect(projection).toContain("normalisePrizeShares(");
    expect(projection).not.toContain("unclaimedPercentage / filledPositions");

    // And the component is now layout only, so a future restyle cannot reach the money at all.
    const table = readCode("components/competitions/PrizeTable.tsx");
    expect(table).toContain("projectPrizeDistribution(competition)");
    expect(table).not.toContain("unclaimedPercentage / filledPositions");
  });
});

describe("the two questions about a provider contest are different questions", () => {
  it("the label alone decides the screen", async () => {
    const { hasProviderGameLabel, isProviderContest } = await import(
      "../../lib/services/games/contest-config"
    );

    // The case that separates them. Both helpers must exist and must disagree here, or the pair
    // has collapsed into one and the weaker name is decoration.
    const keyless = { gameType: "provider" };
    expect(hasProviderGameLabel(keyless)).toBe(true);
    expect(isProviderContest(keyless)).toBe(false);

    const whole = {
      gameType: "provider",
      gameConfig: { providerKey: "chartvolt-games", gameCode: "grid-logic" },
    };
    expect(hasProviderGameLabel(whole)).toBe(true);
    expect(isProviderContest(whole)).toBe(true);

    expect(hasProviderGameLabel({ gameType: "trading" })).toBe(false);
    expect(hasProviderGameLabel(undefined)).toBe(false);
  });
});

describe("the registration deadline keeps its legacy clamp", () => {
  it("treats a deadline earlier than the start as the start", async () => {
    const { isRegistrationClosed } = await import(
      "../../lib/utils/registration-deadline"
    );

    // An old bug wrote a deadline one hour BEFORE the start. Those documents are still in the
    // database, and without the clamp they are unjoinable from the moment they are created -
    // silently, with the contest visibly upcoming.
    const startTime = new Date(Date.now() + 60 * 60 * 1000);
    const registrationDeadline = new Date(startTime.getTime() - 60 * 60 * 1000);

    expect(isRegistrationClosed({ startTime, registrationDeadline })).toBe(false);
  });

  it("closes once the real deadline has passed", async () => {
    const { isRegistrationClosed } = await import(
      "../../lib/utils/registration-deadline"
    );

    const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const registrationDeadline = new Date(Date.now() - 60 * 60 * 1000);

    expect(isRegistrationClosed({ startTime, registrationDeadline })).toBe(true);
  });

  it("is open when no deadline is set, and does not throw on an unparseable one", async () => {
    const { isRegistrationClosed } = await import(
      "../../lib/utils/registration-deadline"
    );

    expect(isRegistrationClosed({})).toBe(false);
    // Reason: a lobby must render. Throwing here would take out the whole page over a bad date,
    // which is a worse outcome than treating registration as open and letting the entry path -
    // which holds the real guards and the money - refuse.
    expect(
      isRegistrationClosed({ registrationDeadline: "not a date" }),
    ).toBe(false);
  });
});

describe("the browser's copy of the play state matches the server's", () => {
  /**
   * THE "ONE RULE, TWO COPIES" PIN.
   *
   * `components/games/play-state.ts` re-declares the service's `PlayState` because the service
   * imports Mongoose models and a client component must not pull those into the browser bundle.
   * That is a real constraint with a real cost: a field renamed on one side and not the other
   * makes the browser read `undefined` from something that looks present. Four defects in this
   * codebase have had this shape, and `check:mirrors` sees none of them because it compares
   * models.
   */
  it("declares the same fields on both sides of the wire", () => {
    const client = readFileSync(
      join(ROOT, "components/games/play-state.ts"),
      "utf8",
    );
    const server = readFileSync(
      join(ROOT, "lib/services/games/round-status.service.ts"),
      "utf8",
    );

    const fieldsOf = (source: string, interfaceName: string): string[] => {
      const start = source.indexOf(`interface ${interfaceName} {`);
      expect(start).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf("\n}", start));
      return [...body.matchAll(/^\s{2}(\w+)\??:/gm)]
        .map((match) => match[1])
        .sort();
    };

    expect(fieldsOf(client, "PlayState")).toEqual(
      fieldsOf(server, "PlayState"),
    );
    expect(fieldsOf(client, "PlayerRoundView")).toEqual(
      fieldsOf(server, "PlayerRoundView"),
    );
  });
});

describe("the play screen counts down on the server's clock", () => {
  const CLOCK = "hooks/useServerClock.ts";

  it("formats a remaining duration the way a player reads one", async () => {
    const { formatRemaining } = await import("../../hooks/useServerClock");

    expect(formatRemaining(9_000)).toBe("9s");
    // Seconds are zero-padded below the hour so the number does not jump width every tick.
    expect(formatRemaining(11 * 60_000 + 3_000)).toBe("11m 03s");
    expect(formatRemaining(2 * 3_600_000 + 5 * 60_000 + 7_000)).toBe("2h 5m 7s");
    expect(formatRemaining(2 * 86_400_000 + 4 * 3_600_000)).toBe("2d 4h 0m");

    /*
      A PAST TARGET IS "0s", NEVER A NEGATIVE. This is the assertion that matters, because the
      screen renders the difference between the window's end and now, and the two can cross
      between a render and the next tick. Left unclamped a player watching the last second sees
      "-1s", which reads as a broken page rather than as a closed window.
    */
    expect(formatRemaining(0)).toBe("0s");
    expect(formatRemaining(-5_000)).toBe("0s");
  });

  it("anchors to the server's timestamp and fails closed on a bad one", () => {
    const code = readCode(CLOCK);

    /*
      The offset is the whole hook: `serverNow - Date.now()`, applied to every tick. Asserting
      the expression rather than the identifier, because `serverNowIso` appears in the signature
      and in the dependency array, and neither is the calculation.
    */
    expect(code).toMatch(/parsed\s*-\s*Date\.now\(\)/);
    expect(code).toMatch(/return\s+now\s*\+\s*offsetMs/);

    /*
      AN UNPARSEABLE ANCHOR MUST FALL BACK TO THE BROWSER'S CLOCK, not propagate. An offset of
      `NaN` makes every comparison on the pre-flight false - so the countdown freezes and every
      gate silently OPENS, which is the wrong direction for a screen that spends attempts.
    */
    expect(code).toMatch(/Number\.isNaN\(parsed\)/);
  });

  it("uses that clock for every gate rather than the browser's", () => {
    const code = readCode(PREFLIGHT);

    expect(code).toMatch(/useServerClock\(state\.serverNow\)/);

    /*
      THE NEGATIVE HALF IS THE LOAD-BEARING ONE. Importing the hook is trivially satisfied by a
      file that then compares against `Date.now()` anyway - which is exactly what this component
      did before, and the failure is silent in both directions: a Play button offered against a
      closed window produces a refusal the player cannot act on, and one withheld against an
      open window hides a paid attempt.

      `new Date()` with no argument is banned for the same reason; the parameterised form is
      what parses the window's own timestamps and must stay allowed.
    */
    expect(code).not.toMatch(/Date\.now\(\)/);
    expect(code).not.toMatch(/new Date\(\s*\)/);
  });

  it("blocks Play when a round can no longer finish inside the window", () => {
    const code = readCode(PREFLIGHT);

    /*
      Mirrors `createRound`'s refusal. What was wrong was WHERE the player met it: a red box
      after the click, beside a fully enabled button.

      Asserting the comparison, not the flag's name: `tooLateToStart` appears in the blocked
      list, the reason chain and the button label, so a name-only match survives the arithmetic
      being deleted.

      RE-AIMED 7 September 2026, when the arithmetic moved into `round-window.ts` so the lobby
      could count down to the same instant. It is still the comparison rather than the name, one
      indirection along: `cutoffMs` comes from the shared producer and `now > cutoffMs` is the
      refusal. Left pointed at the old inline expression, this test fails on correct code, which
      is the fastest way to have a guard deleted.
    */
    expect(code).toMatch(/cutoffMs !== null && !windowClosed && now > cutoffMs/);

    // And it must not fire on a resume, which reopens the round the player already has and so
    // needs no fresh room in the window.
    //
    // Asserted on `fullRoundNoLongerFits`, which is where the arithmetic and the `!resuming`
    // guard now live. `tooLateToStart` is that AND the contest's start policy, since 7 Sep
    // 2026 - see the test below. Reading `!resuming` off the derived flag instead would go
    // green on a version that dropped it from the arithmetic and reintroduced it later.
    expect(code).toMatch(/fullRoundNoLongerFits\s*=\s*\n?\s*!resuming/);
    expect(code).toMatch(/tooLateToStart\s*=\s*fullRoundNoLongerFits/);

    // An unknown round length applies NO gate rather than guessing. A guess that disables the
    // button is worse than letting the server name the real reason.
    expect(code).toMatch(/typeof state\.maxRoundSeconds === "number"/);

    // It reaches the disabled state and the label, not just a paragraph.
    const blockedList = code.slice(
      code.indexOf("const blocked ="),
      code.indexOf("const blockedReason"),
    );
    expect(blockedList.length).toBeGreaterThan(40);
    expect(blockedList).toMatch(/tooLateToStart/);
  });

  it("shows a countdown beside the absolute time, not instead of it", () => {
    const code = readCode(PREFLIGHT);

    // The remaining figure is what decides whether to press Play now; the absolute time is what
    // a player planning to come back needs. The report was that only the second was shown.
    expect(code).toMatch(/formatRemaining\(windowEndMs\s*-\s*now\)/);
    expect(code).toMatch(/formatRemaining\(windowStartMs\s*-\s*now\)/);
    expect(code).toMatch(/toUTCString\(\)/);
  });

  it("refreshes the pre-flight for the facts a clock cannot know", () => {
    const code = readCode(HOST);

    /*
      A ticking clock closes half the owner's report. The other half is not time at all - the
      contest's status moving to `active`, an operator pausing or resuming, a round resolved by
      the reconciliation net. None of those reach an open page, so the screen stayed wrong until
      somebody pressed F5.
    */
    expect(code).toMatch(/setInterval\([\s\S]{0,320}PREFLIGHT_REFRESH_MS/);
    expect(code).toMatch(/clearInterval/);

    /*
      SCOPED TO THE PRE-FLIGHT, asserted by the guard rather than by the constant's presence.
      During `confirming` the result poll is already running against this same endpoint, and a
      second timer would double the load and race it.
    */
    const effect = code.slice(
      code.indexOf('if (phase.name !== "preflight") return;'),
    );
    expect(effect.length).toBeGreaterThan(40);
    expect(effect).toMatch(/setInterval/);
  });

  it("carries the server's clock and the round length across the wire", () => {
    const service = readCode("lib/services/games/round-status.service.ts");

    // `serverNow` is generated per response on purpose: re-anchoring on every poll bounds the
    // clock's error to one round trip instead of letting it accumulate over an hour-long wait.
    expect(service).toMatch(/serverNow:\s*new Date\(\)\.toISOString\(\)/);

    /*
      `maxRoundSeconds` comes from the catalogue title, never from the caller. A client-supplied
      round length would let a player claim a one-second round and be offered a button the
      server refuses - and it is the same rule that keeps the market-hours gate off caller input.
    */
    expect(service).toMatch(/maxDurationSeconds/);
  });
});

describe("the game lobby shows a joined player the clock", () => {
  it("counts down in the play-window panel, using the shared component", () => {
    const code = readCode(PROVIDER_LOBBY);

    /*
      THE PLAYER WITH THE MOST REASON TO WATCH THE CLOCK WAS SHOWN NO CLOCK. The hero's fourth
      tile counts down only for someone who has NOT entered - once they do, it is replaced by
      their score. So the countdown vanished at exactly the moment it started to matter.

      Asserting the COUNT rather than the presence, because the hero's has been there all along
      and a bare `<InlineCountdown` match is green on the bug.

      THREE since 7 September 2026: the hero tile, the window's close, and the last moment a new
      attempt may start. The third is a different clock from the second and is the one players
      miss - see "the last moment to start an attempt has one producer" below. If this number
      falls, one of the three has been removed; if it rises, a fourth clock has appeared on a
      screen that already shows three, which is its own problem.
    */
    const countdowns = code.match(/<InlineCountdown/g) ?? [];
    expect(countdowns.length).toBe(3);

    // Reused, not re-implemented. A third place that formats "2d 4h" is a third place for the
    // wording to drift, which is the shape behind several defects here.
    expect(code).toMatch(/from "@\/components\/trading\/InlineCountdown"/);
  });

  it("no longer tells players the play window can be narrower than the contest", () => {
    const code = readCode(PROVIDER_LOBBY);

    /*
      TRUE UNTIL THE WINDOW BECAME DERIVED, and false the moment it did (`12` s2.3). A
      player-facing caution that has become false is worse than none: it sends somebody looking
      for a second pair of times that no longer exists, and it reads as though someone checked.

      Same duty as rewriting the operator's `exclude`-refund warning once the refund became
      automatic - and note the comments are stripped before matching, so the paragraph in the
      component explaining WHY the note changed does not satisfy or break this.
    */
    expect(code).not.toMatch(/narrower than the/);

    // Replaced rather than deleted: the fact players actually need is what happens to a round
    // still open when the clock runs out, which is the owner's question about the universal cut-off.
    expect(code).toMatch(/Every player gets the same window/);
  });
});

describe("the round-start policy reaches the player", () => {
  /*
    THE REFUSAL THE OWNER SAW, and it was not a wording problem. `tooLateToStart` reserved the
    catalogue ceiling, so a contest shorter than that ceiling withheld Play from the moment it
    opened - "there is not enough time left in this competition" above a countdown reading
    fifty-nine minutes. Circuit Sprint's ceiling is 300 seconds, so every contest under five
    minutes was unplayable no matter how it was configured.
  */

  it("offers a shortened round instead of refusing, when the contest allows it", () => {
    const code = readCode(PREFLIGHT);

    // The arithmetic is unchanged and the POLICY is a separate term, so the two facts stay
    // separable: whether a full round still fits, and whether this contest insists on one.
    //
    // The comparison itself moved into `round-window.ts` on 7 September 2026, when the lobby
    // began counting down to the same cut-off. What is asserted here is that this screen ASKS
    // rather than deciding - see the suite below for why a second answer would be worse than
    // no answer at all.
    expect(code).toMatch(
      /reservesFullRound = contestReservesFullRound\(state\.roundStartPolicy\)/,
    );
    expect(code).toMatch(
      /tooLateToStart = fullRoundNoLongerFits && reservesFullRound/,
    );
  });

  it("tells the player how long they will actually get before they spend the attempt", () => {
    const code = readCode(PREFLIGHT);

    /*
      THE DISCLOSURE IS WHAT MAKES THE PERMISSIVE BRANCH DEFENSIBLE, so it is not decoration.
      An attempt is consumed on creation and cannot be handed back; a player who starts a
      four-minute game with ninety seconds left and is not told has been charged for a game
      they could never finish.

      Derived from the WINDOW, not from the round length, because `resolveExpiry` clamps
      `expiresAt` to `playWindowEnd` - so this is the length the server will grant rather than
      an estimate of it. A figure computed the other way drifts from the clamp the first time
      either side changes.
    */
    expect(code).toMatch(/shortenedMs\s*=\s*\n?\s*fullRoundNoLongerFits && !reservesFullRound/);
    expect(code).toMatch(/windowEndMs - now/);

    /*
      It must reach the BUTTON, not only a paragraph. The button is the thing being pressed,
      and a player who has skimmed the panel should still not be able to spend an attempt
      without having seen that this round is a short one.
    */
    const label = code.slice(
      code.indexOf("const buttonLabel ="),
      code.indexOf("return ("),
    );
    expect(label.length).toBeGreaterThan(200);
    expect(label).toMatch(/shortenedMs !== null/);
  });

  it("takes the policy from the server's normalised config, never from the contest field", () => {
    const service = readCode("lib/services/games/round-status.service.ts");

    /*
      The same rule as `maxRoundSeconds` and the market-hours gate: the value the screen shows
      must come from the place the gate reads. `contest-config.ts` normalises an unrecognised
      or absent value to `reserve_full_round`; reading `contest.roundStartPolicy` straight off
      the document would let a bad stored value offer a button `round.service.ts` refuses.
    */
    expect(service).toMatch(/config\.config\.roundStartPolicy \?\? "reserve_full_round"/);
    expect(service).not.toMatch(/contest\.roundStartPolicy/);
  });

  it("is a field on the client's own PlayState, pinned to the service's", () => {
    // `components/games/play-state.ts` is a deliberate second copy - the service imports
    // Mongoose models and cannot be pulled into the browser - so the two field lists are held
    // together by a test rather than by the compiler.
    expect(readCode("components/games/play-state.ts")).toMatch(
      /roundStartPolicy: "reserve_full_round" \| "until_window_closes"/,
    );
  });

  it("gates the server on the same policy, and permits the round rather than shortening it", () => {
    const service = readCode("lib/services/games/round.service.ts");

    /*
      The gate returns early, so the round is created and `resolveExpiry` clamps it. That
      ordering matters: shortening the requested duration here instead would tell the provider
      a round is 90 seconds long while the platform still expects the title's own result
      shape, and the two would disagree about what a finished round looks like.
    */
    expect(service).toMatch(
      /if \(config\.roundStartPolicy === "until_window_closes"\) return true/,
    );
  });
});

describe("the last moment to start an attempt has one producer", () => {
  const ROUND_WINDOW = "components/games/round-window.ts";

  /*
    THE LOBBY IS READ BEFORE THE PLAY SCREEN IS VISITED, which is why this matters more than an
    ordinary duplication. A player decides whether to travel to `/play` based on what the lobby
    tells them about the clock; a lobby promising time that the pre-flight then refuses is worse
    than a lobby that says nothing, because it converts a plannable deadline into a broken
    button.
  */

  it("computes the cut-off in one place, and does not know the policy", async () => {
    const { fullRoundCutoffMs, contestReservesFullRound } = await import(
      "../../components/games/round-window"
    );

    const windowEnd = new Date("2026-09-08T14:00:00Z").getTime();
    expect(fullRoundCutoffMs(windowEnd, 300)).toBe(
      new Date("2026-09-08T13:55:00Z").getTime(),
    );

    /*
      IT MUST ANSWER THE SAME NUMBER UNDER BOTH POLICIES, and folding the policy in is the
      tempting simplification. It would return `null` for `until_window_closes` - exactly the
      case where the play screen still needs the figure, in order to say how much time a
      shortened attempt will get. The arithmetic is one fact; what each screen does with it is
      two.
    */
    expect(contestReservesFullRound("until_window_closes")).toBe(false);
    expect(contestReservesFullRound("reserve_full_round")).toBe(true);
    // Fails closed on anything unrecognised, matching both `contest-config.ts` copies.
    expect(contestReservesFullRound(undefined)).toBe(true);
    expect(contestReservesFullRound("")).toBe(true);
    expect(contestReservesFullRound("until_window_close")).toBe(true);
  });

  it("produces no cut-off when the round length is unknown, rather than guessing one", async () => {
    const { fullRoundCutoffMs } = await import(
      "../../components/games/round-window"
    );

    // A guessed deadline that disables Play is worse than letting the server name the real
    // reason - the server applies no gate it cannot compute either.
    expect(fullRoundCutoffMs(Date.now(), undefined)).toBeNull();
    expect(fullRoundCutoffMs(Date.now(), Number.NaN)).toBeNull();
    expect(fullRoundCutoffMs(null, 300)).toBeNull();
  });

  it("is read by both screens and recomputed by neither", () => {
    const preflight = readCode(PREFLIGHT);
    const lobby = readCode(PROVIDER_LOBBY);

    expect(preflight).toMatch(
      /fullRoundCutoffMs\(windowEndMs, state\.maxRoundSeconds\)/,
    );
    expect(lobby).toMatch(
      /fullRoundCutoffMs\(playWindowEndMs, state\.maxRoundSeconds\)/,
    );

    /*
      THE NEGATIVE ASSERTION IS THE LOAD-BEARING HALF. Importing the module is trivially
      satisfied by a screen that imports it and then does the subtraction itself anyway, which
      is exactly what the pre-flight did before the extraction.

      SCOPED TO THE CUT-OFF, NOT TO THE ROUND LENGTH, and the distinction is why the first
      version of this failed on correct code. `roundNeedsMs = maxRoundSeconds * 1000` stays in
      the pre-flight legitimately - it is how the screen says "a round needs up to 5 min", which
      is the round's own length and not a deadline derived from the window. What must not be
      recomputed is the subtraction that produces the moment.
    */
    for (const code of [preflight, lobby]) {
      expect(code).not.toMatch(/now\s*\+\s*roundNeedsMs\s*>\s*windowEndMs/);
      expect(code).not.toMatch(/windowEndMs\s*-\s*roundNeedsMs/);
      expect(code).not.toMatch(/windowEndMs\s*-\s*state\.maxRoundSeconds/);
    }

    // The lobby has no honest use for the raw round length at all - it states no round duration
    // - so there the multiplication itself is the tell.
    expect(lobby).not.toMatch(/maxRoundSeconds \* 1000/);

    /*
      AND THE PRODUCER MUST STAY IMPORTABLE BY BOTH. `RoundPreflight` is `"use client"` and the
      lobby is a server component, so the moment this module imports a model - or declares
      itself client-only - one of its two consumers stops building. Same requirement as
      `components/games/play-state.ts` and `apps/admin/lib/admin/contest-control-copy.ts`, both
      of which were first written as a second copy for exactly this reason.
    */
    const producer = readCode(ROUND_WINDOW);
    expect(producer).not.toMatch(/"use client"/);

    /*
      NARROWED 8 September 2026, and the reason is worth keeping. This asserted the file had
      no imports AT ALL, which held while it owned the subtraction and stopped holding the
      moment it started forwarding to `lib/services/games/entry-deadline` - the shared producer
      the two admin writers also read, so that the deadline a player is shown and the deadline
      stored on the contest cannot disagree.

      "No imports" was only ever a proxy for the real requirement, so state that instead: this
      file may reach for pure modules and must never reach for a model or for Mongoose. A
      blanket ban is the wrong guard here - it forbids exactly the de-duplication that removes
      a second copy of the rule, which is the failure shape behind `referenceId`,
      `failedReason`, `challengeId` and the Game Master `||`.
    */
    const imports = [...producer.matchAll(/^import[^;]+from\s+"([^"]+)"/gm)].map(
      (m) => m[1],
    );
    expect(imports).toEqual(["@/lib/services/games/entry-deadline"]);
    for (const specifier of imports) {
      expect(specifier).not.toMatch(/mongoose|database\/models/);
    }
  });

  it("shows the lobby countdown only where a cut-off really exists", () => {
    const lobby = readCode(PROVIDER_LOBBY);

    /*
      SLICED BY INDEX, NOT SCANNED TOWARDS. A leftmost-first regex over the whole file opens at
      an unrelated construct hundreds of characters earlier and swallows legitimate markup, and
      the guard then fails on correct code - which is the fastest way to have it deleted. The
      length assertions exist because a slice that found nothing passes every match against it.
    */
    const labelAt = lobby.indexOf("Last attempt can start in");
    expect(labelAt).toBeGreaterThan(-1);
    const guardAt = lobby.lastIndexOf("{isActive &&", labelAt);
    expect(guardAt).toBeGreaterThan(-1);

    const guard = lobby.slice(guardAt, labelAt);
    const row = lobby.slice(labelAt, labelAt + 400);
    expect(guard.length).toBeGreaterThan(60);

    /*
      Three conditions, and dropping any one of them states something false. Without
      `reservesFullRound` a permissive contest is given a deadline it does not have, and a
      player leaves believing they have missed it. Without `isActive` the row appears on an
      upcoming contest, where the countdown is to a moment inside a window that has not
      opened. Without the null check there is no cut-off to count down to.
    */
    expect(guard).toMatch(/reservesFullRound/);
    expect(guard).toMatch(/attemptCutoffMs !== null/);

    /*
      "Passed", not "Ended". The contest has not ended - only the chance to open a new round
      has, and a player already inside a round may still finish it. This is the same class of
      correction as the play-window note that had become false: a word that is right about one
      clock and wrong about the one it is attached to.
    */
    expect(row).toMatch(/zeroLabel="Passed"/);
  });

  it("tells a joined player what happens to a round still running at the close, per policy", () => {
    const lobby = readCode(PROVIDER_LOBBY);

    /*
      THE SENTENCE HAS TO GO BOTH WAYS. Under `reserve_full_round` a round CANNOT still be
      running at the close - that is what holding time back achieves - so promising it would be
      closed and scored describes an impossibility, and a player reading it concludes they may
      start whenever they like. Under `until_window_closes` the opposite is true and is exactly
      what makes a shortened attempt worth taking.
    */
    const noteStart = lobby.indexOf("Every player gets the same window.");
    expect(noteStart).toBeGreaterThan(-1);
    const note = lobby.slice(noteStart, lobby.indexOf("</NeonNote>", noteStart));
    expect(note.length).toBeGreaterThan(200);
    expect(note).toMatch(/reservesFullRound/);
    expect(note).toMatch(/finish inside it/);
    expect(note).toMatch(/still running then is\s*\n?\s*closed/);
  });
});

describe("a player is told how long they have left to join", () => {
  /*
    THE OWNER'S REPORT: a player could see that a competition started in four minutes and had no
    way to know that four minutes was also all the time they had to enter. The panel said
    "Registration Closed" only once the door had already shut - the one moment the fact is of no
    use to them.
  */

  it("counts down to the same instant the gate compares against", () => {
    const code = readCode(ENTRY_BUTTON);

    /*
      `resolveRegistrationDeadline` was split out of `isRegistrationClosed` for this. The clamp
      against `startTime` inside it is not hypothetical - an old bug wrote deadlines an hour
      BEFORE the start - so a copy of the rule here that forgot it would tell those players
      entry had closed before it opened, while the button stayed open. One instant, two readers.
    */
    expect(code).toMatch(/resolveRegistrationDeadline\(competition\)/);
    expect(code).not.toMatch(/registrationDeadline\s*<\s*start/);
    expect(code).not.toMatch(/competition\.registrationDeadline/);
  });

  it("says something different when no deadline is set, rather than nothing", () => {
    const code = readCode(ENTRY_BUTTON);

    /*
      A contest with no deadline is a real configuration, not a missing value - entry stays open
      while it runs. Substituting `startTime` would refuse to say so and count down to a door
      that does not shut then; saying nothing at all would leave a player who saw a countdown on
      another competition assuming this one hides a deadline too.
    */
    const block = code.slice(
      code.indexOf("{showEntryCountdown &&"),
      code.indexOf("{/* Entry Button */}"),
    );
    expect(block.length).toBeGreaterThan(400);
    expect(block).toMatch(/entryDeadline \?/);
    expect(block).toMatch(/Entry closes in/);
    expect(block).toMatch(/Entry stays open/);
  });

  it("is withheld from someone who has already joined or already missed it", () => {
    const code = readCode(ENTRY_BUTTON);

    /*
      A countdown to a door you are already through is noise, and one shown beside the red
      "Registration for this competition has closed" panel contradicts it. The status terms
      matter too: a completed or cancelled contest has no entry deadline worth counting to.
    */
    expect(code).toMatch(
      /showEntryCountdown =\s*\n?\s*!isUserIn && !registrationClosed && \(isActive \|\| isUpcoming\)/,
    );
  });

  it("names the moment as well as the remaining time", () => {
    const code = readCode(ENTRY_BUTTON);
    const block = code.slice(
      code.indexOf("{showEntryCountdown &&"),
      code.indexOf("{/* Entry Button */}"),
    );

    /*
      The pairing the play screen already uses. A bare countdown cannot be written down, and a
      bare timestamp asks the player to subtract two times in their head - one of them in a zone
      they do not live in.
    */
    expect(block).toMatch(/toUTCString\(\)/);

    /*
      `zeroLabel` is not cosmetic here. The page is server-rendered, so an open tab cannot learn
      that `registrationClosed` has flipped; without it the countdown reaches zero and reads
      "Started", which is wrong twice over - the competition may not have started, and what
      happened is that entry closed.
    */
    expect(block).toMatch(/zeroLabel="Closed"/);
  });

  it("keeps the countdown component's default wording for every existing caller", async () => {
    const code = readCode("components/trading/InlineCountdown.tsx");

    // Additive: `zeroLabel` overrides, and absent it the two words the trading lobby and the
    // hero tile have always shown are unchanged. Also in the effect's dependencies, or the
    // first render's word would stick.
    expect(code).toMatch(
      /zeroLabel \?\? \(type === "start" \? "Started" : "Ended"\)/,
    );
    expect(code).toMatch(/\[targetDate, type, zeroLabel\]/);
  });

  it("resolves the deadline as a shared instant, with the clamp intact", async () => {
    const { resolveRegistrationDeadline, isRegistrationClosed } = await import(
      "../../lib/utils/registration-deadline"
    );

    const startTime = new Date("2026-09-08T13:00:00Z");
    const early = new Date("2026-09-08T12:00:00Z");

    // Clamped up to the start, which is what keeps the legacy documents joinable.
    expect(
      resolveRegistrationDeadline({ startTime, registrationDeadline: early })!.getTime(),
    ).toBe(startTime.getTime());

    // A later deadline is its own instant.
    const late = new Date("2026-09-08T13:30:00Z");
    expect(
      resolveRegistrationDeadline({ startTime, registrationDeadline: late })!.getTime(),
    ).toBe(late.getTime());

    /*
      `null` rather than a substituted `startTime`, so the caller has to decide what an absent
      deadline means. Returning the start here would have silently given every deadline-free
      contest a door, and `isRegistrationClosed` would then have closed it.
    */
    expect(resolveRegistrationDeadline({ startTime })).toBeNull();
    expect(resolveRegistrationDeadline({ registrationDeadline: "not a date" })).toBeNull();
    expect(isRegistrationClosed({ startTime })).toBe(false);
  });
});

const ARENA_LAYOUT = "components/games/arena/GameArenaLayout.tsx";
const ARENA_CONTEST_PANEL = "components/games/arena/ArenaContestPanel.tsx";

describe("the arena puts the board first at every width", () => {
  /*
    Grid auto-placement follows ORDER-MODIFIED document order, so an `order` rule that only fires
    at one breakpoint leaves every narrower layout arranged by DOM order alone. That is what went
    wrong: the standings were first in the DOM with `xl:order-1`, so on a phone they came first
    and pushed the board below the fold - the exact thing the ordering was written to prevent -
    and at `lg`, where the grid is two columns, the standings took the wide one and the BOARD was
    placed in the 320px sidebar column.

    Counting is the load-bearing part. A test that merely finds `order-1` somewhere is green on a
    file where two of the three children still rely on DOM order, which is the state that caused
    this. Three children, three orders, at all three widths.
  */
  const code = readCode(ARENA_LAYOUT);

  it("gives all three columns an order at every breakpoint", () => {
    // The base class only, so `lg:order-3` is not counted twice.
    const base = code.match(/(?:^|["\s])order-\d/g) ?? [];
    const lg = code.match(/lg:order-\d/g) ?? [];
    const xl = code.match(/xl:order-\d/g) ?? [];

    expect(base).toHaveLength(3);
    expect(lg).toHaveLength(3);
    expect(xl).toHaveLength(3);
  });

  it("puts the board first on a phone and on a laptop", () => {
    /*
      Position within the construct, not presence in the file: `order-1` appears three times
      across the three breakpoints, so asserting the file contains it says nothing about which
      child carries it. Slice back from `{stage}` to the tag that renders it.
    */
    const stageAt = code.indexOf("{stage}");
    expect(stageAt).toBeGreaterThan(0);

    const tag = code.slice(code.lastIndexOf("<div", stageAt), stageAt);
    expect(tag.length).toBeGreaterThan(0);
    expect(tag).toMatch(/(?:^|["\s])order-1\b/);
    expect(tag).toMatch(/lg:order-1\b/);
  });

  it("keeps the standings rail wide enough for the board it holds", () => {
    /*
      The rail and the board's own minimum have to agree, and they did not: a 260px rail around
      a board that demanded 320px is a horizontal scrollbar by construction. This pins the rail;
      the test below pins the board's side of the bargain.
    */
    const rail = code.match(/xl:grid-cols-\[(\d+)px_/);
    expect(rail).not.toBeNull();
    expect(Number(rail![1])).toBeGreaterThanOrEqual(280);
  });
});

describe("the standings board fits the column it is given", () => {
  /*
    It is rendered in two places whose widths are nothing like each other - the lobby's main
    column and the arena's standings rail - and it used to force a fixed minimum width inside a
    horizontal scroller. On the rail that pushed the score column out of sight, so the one number
    the board exists to show was the one thing a player could not see without dragging sideways.
  */
  const board = readCode(PROVIDER_BOARD);

  it("declares no fixed width and no sideways scroll", () => {
    expect(board).not.toMatch(/min-w-\[\d+px\]/);
    expect(board).not.toMatch(/overflow-x-auto/);
  });

  it("truncates the name rather than wrapping the row", () => {
    /*
      `minmax(0,1fr)` and not `1fr`: a bare `1fr` is floored by its content's minimum size, so a
      long name widens the grid instead of truncating inside it and the row overflows again -
      with no `min-w-` anywhere, which is why the assertion above cannot see it.

      COUNTED, not merely found. The column template is written twice, once for the heading row
      and once for the player rows, so `toMatch` is satisfied by either - a probe restoring the
      bare `1fr` on the heading alone came back green until this counted them.
    */
    const template = board.match(/grid-cols-\[auto_minmax\(0,1fr\)_auto\]/g) ?? [];
    expect(template).toHaveLength(2);
    expect(board).not.toMatch(/grid-cols-\[auto_1fr_auto\]/);
    expect(board).not.toMatch(/\bflex-wrap\b/);
  });
});

describe("the stage is dressed in the same kit as the frame around it", () => {
  /*
    THE DEFECT THIS PINS, because it is the one the owner reported as "the graphics are basic"
    and it is not a matter of taste. The arena - the header, the standings rail, the contest
    panel - was built on the neon kit. The three components INSIDE it were not: the pre-flight,
    the frame and the result panel were still wearing `border-gray-700 bg-gray-800/50`, the
    application's neutral shell, which is a flat charcoal card with a grey hairline.

    So the biggest element on the screen, the one the player is actually looking at, was the
    only unstyled thing on it. Every test in this file passed, because none of them had an
    opinion about appearance, and a screenshot is what found it.

    THE RULE IS A NEGATIVE ONE AND THAT IS DELIBERATE. Asserting the stage imports the kit is
    trivially satisfied by a file that imports it and hand-rolls a grey card beside it - which
    is precisely the state that shipped, since `RoundResultPanel` already imported kit colours
    for its amber panel. Naming the shell that must NOT appear is the assertion that can fail.

    IT IS SCOPED TO THE SHELL, NOT TO THE WORD "gray". Grey TEXT is correct and used
    throughout - `text-gray-400` for secondary copy is the kit's own choice. What must not
    appear is a neutral SURFACE or BORDER, so the pattern names those three prefixes.
  */
  const NEUTRAL_SURFACE = /\b(?:bg|border)-gray-(?:700|800|900)\b/g;

  const STAGE = [PREFLIGHT, FRAME, RESULT, HOST];

  it.each(STAGE)("%s wears no neutral surface", (file) => {
    const found = readCode(file).match(NEUTRAL_SURFACE) ?? [];
    expect(found).toEqual([]);
  });

  it("gives the board itself the one lit frame", () => {
    /*
      One frame, on the board. The reference lights the playing area and leaves everything else
      quiet, which is what makes the board the thing the eye lands on; a second lit frame
      anywhere on the arena defeats it, so this counts rather than merely finding.
    */
    const arena = [FRAME, PREFLIGHT, RESULT, ARENA_LAYOUT, ARENA_CONTEST_PANEL]
      .map(readCode)
      .join("\n");

    expect(arena.match(/NEON_STAGE_FRAME/g) ?? []).toHaveLength(2); // the import and the use
  });

  it("borrows the act-now button rather than restating it", () => {
    /*
      Play, Resume and Play again are one control in three phases, and a gradient written out
      at each site is how they end up three different colours. `neonButtonClasses` is the one
      definition; the negative half is what stops a screen importing it and then styling the
      button itself anyway.
    */
    for (const file of [PREFLIGHT, RESULT]) {
      const code = readCode(file);
      expect(code).toMatch(/neonButtonClasses\(["']action["']\)/);
      expect(code).not.toMatch(/bg-gradient-to-r from-/);
    }
  });
});
