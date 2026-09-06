import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
