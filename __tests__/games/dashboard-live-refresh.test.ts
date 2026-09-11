import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The dashboard's competition cards refresh themselves (chapter 13 section 5.1b).
 *
 * WHAT WAS WRONG. `/api/challenges/dashboard-live` has existed since long before games did,
 * and `ContestsSidebar` opens on the challenges tab by default - so the refreshing worked on
 * the path everybody tests and the competitions tab was a photograph of page load. Rank,
 * score, profit and loss, prize pool, player count and the countdown were all frozen. Same
 * shape as the game lobby never mounting the status monitor (R67): one branch of two got the
 * behaviour, and nothing errored on the other.
 *
 * THE PROPERTY THAT MATTERS MOST IS AGREEMENT, not liveness. A player reads a figure on load
 * and then reads this endpoint's figure in the same place fifteen seconds later. Every field
 * where the two disagree LOOKS to them like the value changed. So most of the guards below
 * are about the endpoint saying what the action says - the rank from one shared sort, the
 * stored profit and loss rather than a recomputed one, an absent score staying absent.
 *
 * WHY STRUCTURAL: the vitest environment is `node` with no jsdom, and adding a React testing
 * stack here would land a test-stack change in the same commit as a player-facing one. The
 * properties are structural anyway - which module computes the rank, which field the card
 * renders from, and whether a bad response can clear the list.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ROUTE = "app/api/competitions/dashboard-live/route.ts";
const ACTION = "lib/actions/comprehensive-dashboard.actions.ts";
const SIDEBAR = "components/dashboard/ContestsSidebar.tsx";
const INTERVALS = "lib/utils/performance.ts";

describe("the refresh endpoint agrees with the page it refreshes", () => {
  it("sorts the rank with the shared resolver and not a copy of its own", () => {
    const code = readCode(ROUTE);

    expect(code).toMatch(/createDashboardRankResolver\(\)/);
    expect(code).toMatch(/await\s+resolveRank\(\s*\{/);

    // THE LOAD-BEARING HALF. Calling the resolver is trivially satisfied by a route that
    // then sorts anyway and returns its own answer, which is the number the card shows.
    expect(code).not.toMatch(/aHasTrades/);
    expect(code).not.toMatch(/getRankingValue\(/);
    expect(code).not.toMatch(/["'](higher|lower)_is_better["']/);
  });

  it("reads the same participant fields the page ranks from", () => {
    /**
     * A TEXT COMPARISON BECAUSE NOTHING ELSE CAN SEE THIS. The rank is a position among all
     * the participants, so it depends on which of their fields were fetched. Drop `score`
     * here and every provider rank is computed from rows that have none - no error, no log
     * line, and a perfectly plausible rank on the card that simply disagrees with the one
     * the page rendered a moment ago.
     */
    const routeSelect = readCode(ROUTE).match(/"userId competitionId[^"]*"/);
    const actionSelect = readCode(ACTION).match(/"userId competitionId[^"]*"/);

    expect(routeSelect).not.toBeNull();
    expect(actionSelect).not.toBeNull();

    const tokens = (s: string) => s.replace(/"/g, "").trim().split(/\s+/).sort();
    expect(tokens(routeSelect![0])).toEqual(tokens(actionSelect![0]));
    expect(tokens(routeSelect![0])).toContain("score");
  });

  it("reports the STORED profit and loss rather than recomputing it from live prices", () => {
    /**
     * THE CHALLENGE ENDPOINT NEXT DOOR DOES RECOMPUTE, AND IS RIGHT TO - a 1v1 is two numbers
     * against each other, so a stale one decides who is leading. Here it would mean the
     * figure jumps the moment the first poll lands, on every trading contest, because the
     * page rendered the stored value. That is a defect dressed as an improvement.
     *
     * Making both live is a real change and a good one; it must touch the action and this
     * route in ONE commit, at which point this guard is what tells you the other half is
     * missing.
     */
    const code = readCode(ROUTE);
    expect(code).toMatch(/pnl:\s*mine\.pnl\s*\|\|\s*0/);
    expect(code).not.toMatch(/fetchRealForexPrices/);
    expect(code).not.toMatch(/calculateUnrealizedPnL/);
    expect(code).not.toMatch(/TradingPosition/);
  });

  it("does not coerce an absent score to zero", () => {
    // Reason: undefined means no round has reported yet; zero means the player scored
    // nothing. The read-side form of R50, and the card already renders the first as a dash.
    const code = readCode(ROUTE);
    expect(code).toMatch(/score:\s*mine\.score\s*,/);
    expect(code).not.toMatch(/score:\s*mine\.score\s*(\|\||\?\?)/);
  });

  it("refuses a caller with no session", () => {
    const code = readCode(ROUTE);
    expect(code).toMatch(/auth\.api\.getSession\(/);
    expect(code).toMatch(/status:\s*401/);
  });

  it("creates one resolver for the request, not one per contest", () => {
    // Reason: the memo is what makes the score direction one database read rather than one
    // per contest. Inside the loop it still returns the right answer, which is why no
    // assertion on the rank could catch it.
    const code = readCode(ROUTE);
    expect((code.match(/createDashboardRankResolver\(\)/g) || [])).toHaveLength(1);

    const createdAt = code.indexOf("createDashboardRankResolver()");
    const loopAt = code.indexOf("for (const competition of activeCompetitions");
    expect(loopAt).toBeGreaterThan(createdAt);
  });
});

describe("the sidebar actually shows the refreshed data", () => {
  it("polls the competitions endpoint, not only the challenges one", () => {
    const code = readCode(SIDEBAR);
    expect(code).toMatch(/fetch\(\s*["']\/api\/competitions\/dashboard-live["']\s*\)/);
    // Reason: the challenge poll is untouched and must stay. A probe that removes it should
    // fail here rather than silently halving the component's behaviour.
    expect(code).toMatch(/fetch\(\s*["']\/api\/challenges\/dashboard-live["']\s*\)/);
  });

  it("renders the live list rather than the props it was given", () => {
    /**
     * THE LOAD-BEARING ASSERTION OF THIS FILE. Fetching and then rendering `competitions.active`
     * satisfies every other check here, polls the server every fifteen seconds, and shows the
     * player exactly the frozen page they had before. It is the single most likely way for
     * this work to be half-done and look finished.
     */
    const code = readCode(SIDEBAR);
    expect(code).toMatch(/const\s+activeComps\s*=\s*liveComps\s*;/);
    expect(code).not.toMatch(/const\s+activeComps\s*=\s*competitions\.active/);
  });

  it("takes its interval from the shared constant", () => {
    const code = readCode(SIDEBAR);
    expect(code).toMatch(
      /PERFORMANCE_INTERVALS\.COMPETITION_LIVE_DATA/,
    );
    expect(readCode(INTERVALS)).toMatch(/COMPETITION_LIVE_DATA:\s*\d+/);
  });

  it("leaves the cards alone when the response is not a well-formed list", () => {
    /**
     * A 500, a rate-limit page or a truncated body must not clear the list. Dropping the
     * cards on a bad response makes a network blip look identical to every contest ending at
     * once - and the tab badge goes to zero with it.
     *
     * Asserted by POSITION: the guard has to sit above the setter, because a check written
     * after the state update is a check that runs too late while reading perfectly correctly.
     */
    const code = readCode(SIDEBAR);
    const guardAt = code.indexOf("if (!Array.isArray(data.competitions)) return;");
    expect(guardAt).toBeGreaterThan(-1);
    expect(code.indexOf("setLiveComps((prev)")).toBeGreaterThan(guardAt);
  });

  it("drops a contest the endpoint stops reporting", () => {
    // Reason: the endpoint answers with ACTIVE contests only, so one it no longer mentions
    // has finished. Left on the list it keeps a live rank on a settled contest and keeps the
    // tab's badge count wrong.
    const code = readCode(SIDEBAR);
    expect(code).toMatch(/\.filter\(\s*\(c\)\s*=>\s*liveMap\.has\(c\.id\)\s*\)/);
  });

  it("keeps its own mounted flag rather than sharing the challenge poll's", () => {
    // Reason: the challenge effect's cleanup sets `isMountedRef` false and re-runs whenever
    // its props change, so a shared flag couples two independent timers through a variable
    // neither one names - and the competition poll would go quiet for reasons nothing in its
    // own code mentions.
    const code = readCode(SIDEBAR);
    expect(code).toMatch(/isCompMountedRef/);
    expect(code).toMatch(/if\s*\(\s*!isCompMountedRef\.current\s*\)\s*return\s*;/);
  });
});

describe("the countdown on a card actually counts down", () => {
  it("re-reads the clock on a timer instead of once at render", () => {
    /**
     * AN ABSENCE, NOT A WRONG NUMBER. `Date.now()` was read during render and nothing ever
     * re-rendered this component, so the figure was right at page load and then froze - and
     * the "Ended" state never arrived at all.
     */
    const code = readCode(SIDEBAR);
    const fnAt = code.indexOf("function TimeLeft(");
    expect(fnAt).toBeGreaterThan(-1);
    const body = code.slice(fnAt, code.indexOf("function ChallengesList("));

    expect(body).toMatch(/setInterval\(/);
    expect(body).toMatch(/setNow\(Date\.now\(\)\)/);

    // The remaining time must be measured against the ticking value, not read fresh in the
    // render - the latter is green on `setInterval` alone while changing nothing.
    expect(body).toMatch(/const\s+ms\s*=\s*new Date\(endTime\)\.getTime\(\)\s*-\s*now\s*;/);
    expect(body).not.toMatch(/getTime\(\)\s*-\s*Date\.now\(\)/);
  });

  it("clears its timer", () => {
    const code = readCode(SIDEBAR);
    const fnAt = code.indexOf("function TimeLeft(");
    const body = code.slice(fnAt, code.indexOf("function ChallengesList("));
    expect(body).toMatch(/clearInterval\(\s*tick\s*\)/);
  });

  it("stays on the browser clock", () => {
    /**
     * DELIBERATE, AND THE OPPOSITE OF THE GAME LOBBY. That screen reads `useServerClock`
     * because every rule about when an attempt may start is enforced against server time, so
     * a visitor's wrong clock costs something. Nothing is gated on this figure - it is a
     * caption on a list - so switching its clock would be a behaviour change to a trading
     * surface nobody asked to touch. Adding the tick is additive; changing the clock is not.
     */
    const code = readCode(SIDEBAR);
    expect(code).not.toMatch(/useServerClock/);
  });
});
