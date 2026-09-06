import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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
      expect(code).not.toMatch(/GameIcon|RankIcon/);
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
      "<TradingPrizeTable",
    ]) {
      const at = sidebar.indexOf(open);
      expect(at).toBeGreaterThan(-1);
      // Position, not presence: everything above the accordion is open by construction.
      expect(at).toBeLessThan(accordionAt);
    }
  });

  it("moves no money computation while restyling the prize table", () => {
    const table = readCode("components/trading/lobby/TradingPrizeTable.tsx");

    /*
      The prize table was extracted from the page in the same commit that restyled it, which is
      normally forbidden - an extraction's value is that green tests prove nothing moved. These
      four expressions are the whole calculation, asserted character for character, because they
      decide what a winner is paid and a restyle must not touch them.
    */
    expect(table).toContain(
      "competition.prizePool || competition.prizePoolCredits || 0",
    );
    expect(table).toContain(
      "(competition.platformFeePercentage || 0) / 100",
    );
    expect(table).toContain(
      "filledPositions > 0 ? unclaimedPercentage / filledPositions : 0",
    );
    expect(table).toContain("(1 - platformFeePercentage)");
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
