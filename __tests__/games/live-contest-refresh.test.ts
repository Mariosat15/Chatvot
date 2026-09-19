import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards on the two things that keep a contest lobby from being a photograph.
 *
 * THE DEFECT THESE PIN, reported by the owner on 10 September 2026: "during the competition the
 * data are not updated live, we must refresh the page", and "while the user sees the time and
 * waits for the competition to start, he must refresh the page to see the play button".
 *
 * Both are one cause with two faces. `app/(root)/competitions/[id]/page.tsx` branches on the
 * game label and RETURNS THE WHOLE PAGE for a provider contest - which is right, and is argued
 * for at length in that file - but it means anything mounted above the trading markup is
 * silently not mounted for a game. `CompetitionStatusMonitor` was such a thing, so the game
 * lobby never learned that its contest had started. And the monitor only fires on a status
 * CHANGE, so neither lobby refreshed during a running contest, when the status does not move.
 *
 * WHY STRUCTURAL. The vitest environment is `node` with no jsdom and no react-testing-library,
 * so a component that renders `null` and schedules a timer cannot be exercised here. Adding a
 * renderer for this slice would land a test-stack change in the same commit as the fix. Every
 * claim below is structural and is written to say so.
 *
 * THE TWO RULES THIS FILE OBEYS, both learned by getting them wrong elsewhere in this codebase:
 * strip comments before matching, because these files discuss the anti-patterns they avoid; and
 * COUNT occurrences rather than asserting presence, because the whole defect was one branch
 * having the component and the other not - a test asserting the file contains it is green on
 * exactly that bug.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const LOBBY_PAGE = "app/(root)/competitions/[id]/page.tsx";
const PLAY_PAGE = "app/(root)/competitions/[id]/play/page.tsx";
const REFRESHER = "components/competitions/LiveContestRefresher.tsx";

function countOf(code: string, needle: string): number {
  return code.split(needle).length - 1;
}

/**
 * The provider return, sliced out by index so an assertion about it cannot be satisfied by the
 * trading markup several hundred lines below.
 *
 * Sliced rather than matched with a lazy regex: `[\s\S]*?` is leftmost-first, so a pattern
 * opening at the branch and closing at the lobby component can legitimately open somewhere
 * earlier and swallow code that belongs to nobody. The length assertion is not decoration - an
 * `indexOf` that returns -1 produces a slice that passes every question asked of it.
 */
function providerBranch(code: string): string {
  const opens = code.indexOf("hasProviderGameLabel(competition)");
  expect(opens).toBeGreaterThan(-1);

  const closes = code.indexOf("<ProviderContestLobby", opens);
  expect(closes).toBeGreaterThan(opens);

  const slice = code.slice(opens, closes);
  expect(slice.length).toBeGreaterThan(50);
  return slice;
}

describe("both lobbies notice that the contest has started", () => {
  /**
   * THE PROBE THAT MATTERS. Deleting either mount is the defect, and the count is the only
   * assertion that catches it - the file contained `<CompetitionStatusMonitor` throughout the
   * period the game lobby was broken.
   */
  it("the status monitor is mounted on both branches, not just trading", () => {
    const code = readCode(LOBBY_PAGE);
    expect(countOf(code, "<CompetitionStatusMonitor")).toBe(2);
  });

  it("the game branch mounts it, and mounts it before the lobby it is refreshing", () => {
    const branch = providerBranch(readCode(LOBBY_PAGE));
    expect(branch).toMatch(/<CompetitionStatusMonitor/);
  });

  it("the monitor is given the contest's own start time, so it can poll faster near it", () => {
    // Reason this is asserted rather than assumed: the monitor's adaptive interval is computed
    // from `startTime`, so a mount passing a constant, or the end time, silently leaves the
    // player on the slowest 30-second cadence at the one moment they are watching the clock.
    const branch = providerBranch(readCode(LOBBY_PAGE));
    expect(branch).toMatch(/startTime=\{competition\.startTime\}/);
  });
});

describe("both lobbies refresh while the contest is running", () => {
  it("the refresher is mounted on both branches", () => {
    const code = readCode(LOBBY_PAGE);
    expect(countOf(code, "<LiveContestRefresher")).toBe(2);
  });

  it("the game branch mounts it before the lobby", () => {
    const branch = providerBranch(readCode(LOBBY_PAGE));
    expect(branch).toMatch(/<LiveContestRefresher/);
  });

  /**
   * The status is read from the stored document, never derived from a clock in the browser.
   *
   * A contest whose end time has passed is still `active` until a cron finalizes it, so a client
   * deciding for itself would stop refreshing exactly while the last rounds are being scored -
   * and the board would freeze at the moment it matters most, with nothing in a log.
   */
  it("running is read from the stored status and never computed from a date", () => {
    const code = readCode(LOBBY_PAGE);
    expect(countOf(code, 'active={competition.status === "active"}')).toBe(2);

    for (const mount of code.split("<LiveContestRefresher").slice(1)) {
      const props = mount.slice(0, mount.indexOf("/>") + 2);
      expect(props).not.toMatch(/Date\.now\(\)|new Date\(/);
    }
  });
});

describe("the play screen is deliberately left alone", () => {
  /**
   * THE NEGATIVE ASSERTION, AND IT IS THE LOAD-BEARING HALF OF THIS FILE.
   *
   * The play page hosts the game in an iframe and owns a 20-second poll of `/rounds` that
   * updates the player's own state without re-rendering the frame. A timer calling
   * `router.refresh()` underneath a live round is a way to disturb an attempt somebody has paid
   * for, and it would fail intermittently and unreproducibly - the worst shape of bug this
   * codebase can ship, because the report would be "it sometimes breaks".
   *
   * Adding the refresher there is the obvious next step for anybody fixing the play screen's own
   * stale sidebar, which is a real and separately-recorded gap. This test is the thing that
   * stops it being fixed the easy and wrong way.
   */
  it("the refresher is not mounted on the play page", () => {
    const code = readCode(PLAY_PAGE);
    expect(code).not.toMatch(/LiveContestRefresher/);
  });

  it("the play page still owns its own poll rather than borrowing this one", () => {
    // Reason: if this ever fails, the poll has moved and the reasoning above needs re-checking
    // rather than the assertion above being relaxed.
    const host = readCode("components/games/ProviderRoundHost.tsx");
    expect(host).toMatch(/PREFLIGHT_REFRESH_MS/);
  });
});

describe("the refresher cannot leak a timer or refresh a tab nobody is reading", () => {
  it("it does nothing at all when the contest is not running", () => {
    const code = readCode(REFRESHER);
    expect(code).toMatch(/if\s*\(!active\)\s*return;/);
  });

  it("it tears its timer down when unmounted", () => {
    // Reason: a leaked interval calls `router.refresh()` for the rest of the session, on every
    // page the player navigates to afterwards. It costs a server render each time and there is
    // nothing on screen to suggest where it is coming from.
    const code = readCode(REFRESHER);
    expect(code).toMatch(/clearInterval\(/);
    expect(code).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]*clearTimer\(\)/);
  });

  /**
   * THE ASSERTIONS HERE NAME `addEventListener` AND `removeEventListener` SEPARATELY, and the
   * first version of this test did not - it matched a bare `visibilitychange`, which a probe
   * proved is satisfied by the TEARDOWN line alone. Deleting the registration left the handler
   * defined, the listener never attached, and the test green.
   *
   * Sixth instance in this codebase of one identifier defeating a structural test, after
   * `!expectedOrigin`, the fixed-character Edit guard, `canTransitionRound`, `MIN_REASON_LENGTH`
   * and the Image Optimizer's refusal count. The rule that keeps coming back: match the CALL
   * with its arguments, never the name of the thing being called.
   */
  it("it stops while the tab is hidden and refreshes on the way back", () => {
    const code = readCode(REFRESHER);

    expect(code).toMatch(/document\.addEventListener\("visibilitychange"/);
    expect(code).toMatch(/document\.removeEventListener\("visibilitychange"/);
    expect(code).toMatch(/document\.visibilityState === "visible"/);
  });

  /**
   * And the handler has to act in BOTH directions. One that refreshes on the way back without
   * stopping on the way out still does the server work it exists to avoid - and it reads as
   * correct, because the visible half is the half anybody testing by hand would notice.
   */
  it("becoming hidden actually stops the timer rather than only being observed", () => {
    const code = readCode(REFRESHER);

    const opens = code.indexOf("const handleVisibility");
    expect(opens).toBeGreaterThan(-1);

    const handler = code.slice(opens, code.indexOf("};", opens));
    expect(handler.length).toBeGreaterThan(50);

    expect(handler).toMatch(/\}\s*else\s*\{[\s\S]*clearTimer\(\)/);
  });

  /**
   * It re-reads the page rather than polling a leaderboard endpoint, and that is a decision
   * rather than an omission.
   *
   * `getCompetitionLeaderboard` is a server action and is where the whole ranking rule lives -
   * the score direction resolved from the catalogue, the eligibility gate, the tie handling.
   * `router.refresh()` re-runs the page that already calls it, so there is one answer to who is
   * winning, and a lobby page is cheap enough to re-render.
   *
   * THE REASON RECORDED HERE WAS ONCE "a JSON endpoint would be a second reader that can drift
   * from it", AND ONE EXISTS NOW - the arena's, added 11 September 2026, because that page hosts
   * a paid round in an iframe and cannot re-render. The corrected reason is narrower and is the
   * one to carry: an endpoint is a second reader only if it composes an answer of its own.
   */
  it("it refreshes the page rather than fetching a second answer of its own", () => {
    const code = readCode(REFRESHER);
    expect(code).toMatch(/router\.refresh\(\)/);
    expect(code).not.toMatch(/fetch\(/);
  });
});

/**
 * THE ARENA REFRESHES ITS STANDINGS WITHOUT REFRESHING THE PAGE, which is the only shape
 * available to it and is a different mechanism from everything above.
 *
 * The defect, reported by the owner on 11 September 2026 as the board "not showing live" what a
 * player had finished: the arena's standings and recent-players panels are server props rendered
 * once, so a round that landed while the player sat at the game appeared only after a reload.
 *
 * The obvious fix is forbidden - see the negative assertion higher up this file - so the rail
 * polls a JSON endpoint and swaps only its own two panels. Every claim here is structural, for
 * the reason in the file header: there is no DOM in this environment.
 */
describe("the arena's standings rail is live without the page being", () => {
  const LIVE_RAIL = "components/games/arena/ArenaLiveStandings.tsx";
  const ARENA_PANEL = "components/games/arena/ArenaLeaderboardPanel.tsx";
  const STANDINGS_ROUTE = "app/api/competitions/[id]/standings/route.ts";
  const STANDINGS_SERVICE = "lib/services/games/arena-standings.service.ts";

  /**
   * THE SAFETY PROPERTY THE WHOLE DESIGN TURNS ON, and it is a property of WHERE the state
   * lives rather than of what it contains.
   *
   * The provider takes the rest of the arena as `children`. A `children` element handed down
   * from a server component is the same object on every re-render, so React reconciles it by
   * identity and never descends into it - the iframe cannot remount. That guarantee is destroyed
   * the moment the round host reads this context instead of being a child of it, which is the
   * natural thing for somebody to do next, so it is asserted rather than commented.
   */
  it("the round host is a child of the live provider, never a consumer of it", () => {
    const rail = readCode(LIVE_RAIL);
    expect(rail).toMatch(/\{children\}/);
    expect(rail).not.toMatch(/ProviderRoundHost/);

    const page = readCode(PLAY_PAGE);
    const providerAt = page.indexOf("<ArenaLiveProvider");
    const hostAt = page.indexOf("<ProviderRoundHost");
    expect(providerAt).toBeGreaterThan(-1);
    expect(hostAt).toBeGreaterThan(providerAt);
  });

  /**
   * ONE FETCH, TWO CONSUMERS. The board and the recent-players feed show the same facts in two
   * different columns, so fetching in each is two polls of one endpoint and - worse - two
   * answers: the board could name a rival's finished round while the feed beside it had not
   * heard of it. The count pill is a third consumer for the same reason.
   */
  it("fetches once for every panel that shows it", () => {
    const rail = readCode(LIVE_RAIL);
    expect(countOf(rail, "fetch(")).toBe(1);

    /*
      Reason: the trailing semicolon matters. `useArenaLive()` on its own also matches the hook's
      own empty-parameter DECLARATION, so the count came out one too high and the first version
      of this assertion was written around the wrong number.

      COUNTED ACROSS BOTH FILES SINCE 11 SEPTEMBER 2026, AND THE CLAIM IS UNCHANGED. The board
      and the count moved into `ArenaLeaderboardPanel`, which is where the panel's own chrome
      now lives; the feed stayed. What is being asserted is still that every surface showing
      these facts reads the ONE fetch, so the sum is what matters rather than which file each
      consumer sits in - and the hook is exported for exactly that reason.
    */
    const panel = readCode(ARENA_PANEL);
    expect(countOf(rail, "useArenaLive();") + countOf(panel, "useArenaLive();")).toBe(4);

    // Reason: and the panel must not fetch for itself. A second poll here is the two-answers
    // failure the provider exists to prevent, one component further in.
    expect(countOf(panel, "fetch(")).toBe(0);
  });

  it("the page renders the consumers rather than the panels directly", () => {
    const page = readCode(PLAY_PAGE);

    expect(page).toMatch(/<ArenaLeaderboardPanel/);
    expect(page).toMatch(/<ArenaLiveFeed/);

    // Reason: rendering either panel directly here is how half the rail goes back to being a
    // photograph while every other assertion in this file stays green.
    expect(page).not.toMatch(/<ProviderLeaderboard/);
    expect(page).not.toMatch(/<ArenaActivityFeed/);
  });

  /**
   * ONE PRODUCER FOR THE FIRST RENDER AND FOR EVERY REFRESH.
   *
   * This is the `dashboard-live` rule in a new place: the property being engineered for is
   * AGREEMENT with what the player was first shown, not maximal liveness, because any field
   * where the poll and the server render differ reads as the value having changed. Two
   * compositions - one in the page, one in the route - is exactly how they come to differ.
   */
  it("the page and the route compose the board through the same service", () => {
    for (const file of [PLAY_PAGE, STANDINGS_ROUTE]) {
      expect(readCode(file)).toMatch(/getArenaStandings\(/);
    }

    // Reason: and neither of them reads the two halves itself, which is what the service is for.
    for (const file of [PLAY_PAGE, STANDINGS_ROUTE]) {
      const code = readCode(file);
      expect(code).not.toMatch(/getCompetitionLeaderboard\(/);
      expect(code).not.toMatch(/getContestActivity\(/);
    }

    const service = readCode(STANDINGS_SERVICE);
    expect(service).toMatch(/getCompetitionLeaderboard\(/);
    expect(service).toMatch(/getContestActivity\(/);
  });

  /**
   * Whether the contest is running is decided on the SERVER from the stored status.
   *
   * A contest whose end time has passed is still `active` until a cron finalizes it, so a client
   * comparing the end time against its own clock would freeze the board exactly while the last
   * rounds are being scored. That reads as *more* accurate, which is why it is pinned.
   */
  it("liveness comes from the stored status, not from a clock in the browser", () => {
    expect(readCode(PLAY_PAGE)).toMatch(
      /active=\{outcome\.state\.contestStatus === "active"\}/,
    );

    const rail = readCode(LIVE_RAIL);
    expect(rail).toMatch(/if\s*\(!active\)\s*return;/);
    expect(rail).not.toMatch(/Date\.now\(\)/);
    expect(rail).not.toMatch(/endTime/);
  });

  /**
   * A BAD RESPONSE LEAVES THE LAST GOOD BOARD ON SCREEN.
   *
   * An error payload spread into state empties the rail, and an empty rail on this screen reads
   * as "nobody has played" - a false statement about a contest in progress rather than a missing
   * one. Same class as an absent score rendering `-` instead of `0`.
   */
  it("ignores a response that is not a board", () => {
    const rail = readCode(LIVE_RAIL);
    expect(rail).toMatch(/if\s*\(!response\.ok\)\s*return;/);
    expect(rail).toMatch(/if\s*\(!Array\.isArray\(data\?\.rows\)\)\s*return;/);
  });

  /**
   * Its OWN mounted flag and its own teardown.
   *
   * Sharing the round poll's flag lets that effect's cleanup silence this one with no error and
   * nothing in a log; a leaked interval keeps fetching for the rest of the session.
   */
  it("tears its own timer and listener down", () => {
    const rail = readCode(LIVE_RAIL);
    expect(rail).toMatch(/let mounted = true;/);
    expect(rail).toMatch(/if\s*\(!mounted\)\s*return;/);
    expect(rail).toMatch(/mounted = false;/);
    expect(rail).toMatch(/clearInterval\(/);
    expect(rail).toMatch(/document\.addEventListener\("visibilitychange"/);
    expect(rail).toMatch(/document\.removeEventListener\("visibilitychange"/);
  });

  /**
   * The route refuses a junk id before reading the session, and refuses an anonymous caller
   * before reading the database. Two indexed reads per request against any guessable id is not
   * something to hand out unauthenticated, even though the board itself is public on the lobby.
   */
  it("the route is guarded and refuses a junk id first", () => {
    /*
      SLICED TO THE HANDLER BODY, and the first version of this test was not - it searched the
      whole file, so `connectToDatabase` matched its own IMPORT at the top and the ordering came
      out backwards against correct code. The same class as every other "locate the construct,
      do not scan towards it" lesson here, and the length assertion is what proves the slice
      found something.
    */
    const file = readCode(STANDINGS_ROUTE);
    const bodyAt = file.indexOf("export async function GET");
    expect(bodyAt).toBeGreaterThan(-1);
    const route = file.slice(bodyAt);
    expect(route.length).toBeGreaterThan(200);

    const shapeAt = route.indexOf("isCompetitionIdShaped");
    const sessionAt = route.indexOf("getSession");
    const dbAt = route.indexOf("connectToDatabase");

    expect(shapeAt).toBeGreaterThan(-1);
    expect(sessionAt).toBeGreaterThan(shapeAt);
    expect(dbAt).toBeGreaterThan(sessionAt);

    expect(route).toMatch(/status:\s*401/);
  });
});
