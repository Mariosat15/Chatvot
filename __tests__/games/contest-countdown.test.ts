import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  splitDuration,
  COUNTDOWN_WARNING_MS,
} from "@/components/competitions/CountdownPanel";

/**
 * THE LARGE FOUR-CELL CONTEST COUNTDOWN, shared between the trading lobby and the game lobby.
 *
 * The owner's report: "the timer must be the same graphics as the counter in trading
 * competition countdown". The game lobby had three lines of small text where the trading lobby
 * has a panel of four large cells, so the panel was lifted into
 * `components/competitions/CountdownPanel.tsx` and both screens now render it.
 *
 * What these tests exist to hold, in order of how quietly each would break:
 *
 *   1. ONE DEFINITION. The negative assertion is the load-bearing half - importing the shared
 *      panel is trivially satisfied by a screen that imports it and hand-rolls its own cells
 *      beside it, which is how "the same graphics" becomes two panels that drift apart on the
 *      first edit. So every consumer is checked for the panel's own literals.
 *
 *   2. THE TWO CLOCKS STAY DIFFERENT. Trading reads the browser's clock; the game screens read
 *      the server's. Sharing the appearance is the whole point and sharing the clock would be a
 *      behaviour change to trading smuggled in behind a refactor.
 *
 *   3. `LiveCountdown`'s `status` GATE SURVIVES. It renders nothing for any pair it does not
 *      recognise. That is a silent no-render and it is deliberately untouched, because changing
 *      it in the same edit as the move would destroy the only evidence nothing moved.
 */

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const PANEL = "components/competitions/CountdownPanel.tsx";
const LIVE_COUNTDOWN = "components/trading/LiveCountdown.tsx";
const GAME_COUNTDOWN = "components/games/ContestCountdown.tsx";
const GAME_LOBBY = "components/games/ProviderContestLobby.tsx";
const GAME_SIDEBAR = "components/games/lobby/GameLobbySidebar.tsx";
const TRADING_SIDEBAR = "components/trading/lobby/TradingLobbySidebar.tsx";
const TRADING_SUMMARY = "components/trading/lobby/TradingLobbySummary.tsx";
const CHALLENGE_PAGE = "app/(root)/challenges/[id]/page.tsx";

/**
 * Reason comments are stripped before matching: every file in this fix explains the
 * anti-patterns it avoids in prose - `Date.now()`, `LiveCountdown`, "ENDING SOON". A structural
 * test that reads prose fails in both directions, flagging a correct file for discussing the
 * mistake and passing a broken one whose only mention of the right thing is in a comment.
 */
function readCode(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

/** Every literal that belongs to the panel and must appear nowhere else. */
const PANEL_MARKERS: Array<[string, RegExp]> = [
  ["the four-cell grid", /grid-cols-4 gap-2/],
  ["the large digits", /text-3xl font-black/],
  ["the minutes caption", /\bMins\b/],
  ["the seconds caption", /\bSecs\b/],
  ["the ending-soon badge", /ENDING SOON/],
  ["the upcoming gradient", /from-yellow-500\/20 to-orange-500\/20/],
  ["the running gradient", /from-blue-500\/20 to-purple-500\/20/],
];

describe("the four-cell contest countdown", () => {
  it("is defined in exactly one place", () => {
    const panel = readCode(PANEL);

    for (const [what, marker] of PANEL_MARKERS) {
      expect(panel, `the panel should own ${what}`).toMatch(marker);
    }
  });

  it("is hand-rolled by no screen that renders it", () => {
    /*
      The positive half of this pair - "the consumer imports the panel" - is satisfied by a file
      that imports it and then draws its own cells anyway. Only the absence of the literals can
      fail on that.
    */
    for (const consumer of [
      LIVE_COUNTDOWN,
      GAME_COUNTDOWN,
      GAME_LOBBY,
      GAME_SIDEBAR,
      TRADING_SIDEBAR,
      TRADING_SUMMARY,
      CHALLENGE_PAGE,
    ]) {
      const code = readCode(consumer);

      for (const [what, marker] of PANEL_MARKERS) {
        expect(code, `${consumer} should not carry ${what}`).not.toMatch(marker);
      }
    }
  });

  it("is reached by both lobbies through the shared module", () => {
    expect(readCode(LIVE_COUNTDOWN)).toMatch(
      /import CountdownPanel from "@\/components\/competitions\/CountdownPanel"/,
    );
    expect(readCode(GAME_COUNTDOWN)).toMatch(
      /import CountdownPanel from "@\/components\/competitions\/CountdownPanel"/,
    );
  });

  it("renders the schedule slot in every one of its four states", () => {
    const panel = readCode(PANEL);

    /*
      The panel has four returns - upcoming, started, running, ended - and the schedule now lives
      inside it. A branch that forgets the slot is a card that sheds half its content at the exact
      moment it changes state, with no error: the clock reaches zero, the layout jumps, and the
      window's open and close disappear. A player concludes the page is broken.

      Counting rather than matching, because three of the four satisfy a presence check on their
      own - and the branch most likely to be forgotten is `ended`, which is the one a player is
      looking at when the jump happens.
    */
    const slots = panel.match(/\{details && <PanelDetails>/g) ?? [];
    expect(slots).toHaveLength(4);

    // And the slot is optional, so the trading lobby - which has its own schedule accordion -
    // gets exactly the card it had before.
    expect(panel).toMatch(/details\?: React\.ReactNode/);
  });

  it("keeps both finished messages, one per direction", () => {
    const panel = readCode(PANEL);

    // A contest that has opened and one that has closed are different facts, and the panel is
    // the only thing that says either out loud.
    expect(panel).toMatch(/Competition has started!/);
    expect(panel).toMatch(/Competition has ended!/);
  });
});

describe("splitDuration", () => {
  it("decomposes a duration into the four cells", () => {
    const ms =
      2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 4 * 60 * 1000 + 5 * 1000;

    expect(splitDuration(ms)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      total: ms,
    });
  });

  it("carries nothing across the unit boundaries", () => {
    // 59:59 must not round up into the next unit, which is what an off-by-one in the modulo
    // arithmetic produces - and it reads correctly for every duration except the one second
    // before a boundary.
    expect(splitDuration(59 * 60 * 1000 + 59 * 1000)).toMatchObject({
      days: 0,
      hours: 0,
      minutes: 59,
      seconds: 59,
    });
  });

  it("treats a past target as the finished state, never as a negative cell", () => {
    /*
      Reason this matters: the cells render whatever number they are given, so a negative
      duration would print "-1" under a caption reading "Days". Clamping to zero is what makes
      the panel's own `total <= 0` branch the single answer to "has this finished".
    */
    expect(splitDuration(-5000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      total: 0,
    });
  });

  it("treats an unusable duration as finished rather than as a wall of NaN", () => {
    expect(splitDuration(Number.NaN).total).toBe(0);
    expect(splitDuration(Number.POSITIVE_INFINITY).total).toBe(0);
  });

  it("has one definition of when a contest is ending soon", () => {
    expect(COUNTDOWN_WARNING_MS).toBe(60 * 60 * 1000);

    /*
      A threshold defined twice is a screen that turns red at a different moment from the one
      beside it. The panel is the only place the hour may be spelled out.
    */
    for (const consumer of [LIVE_COUNTDOWN, GAME_COUNTDOWN, GAME_LOBBY]) {
      expect(readCode(consumer)).not.toMatch(/60 \* 60 \* 1000/);
    }
  });
});

describe("the game lobby's contest clock", () => {
  it("sits where the trading lobby's sits - under the entry control", () => {
    // Flipped 16 Oct 2026 (layout parity): four-cell clock lives in GameLobbySidebar
    // after LobbyLiveEntryButton — same order as TradingLobbySidebar.
    const lobby = readCode(GAME_LOBBY);
    const sidebar = readCode(GAME_SIDEBAR);

    expect(lobby).toContain("<DesktopGameLobby");
    expect(lobby).toContain("scheduleNote");
    expect(sidebar).toContain("<LobbyLiveEntryButton");
    expect(sidebar).toContain("<ContestCountdown");
    expect(sidebar).toContain("<LobbyLivePrizePanel");

    const entryAt = sidebar.indexOf("<LobbyLiveEntryButton");
    const countdownAt = sidebar.indexOf("<ContestCountdown");
    expect(entryAt).toBeGreaterThan(-1);
    expect(countdownAt).toBeGreaterThan(entryAt);
  });

  it("keeps contest start/end on the Schedule card beside the clock", () => {
    // Flipped 16 Oct 2026: trading-parity Schedule (UTC) card with Start/End rows.
    // Play-window Opens/Closes stay in the Rules tabs (buildGameEventSections), not a
    // second countdown to the same contest close.
    const lobby = readCode(GAME_LOBBY);
    const sidebar = readCode(GAME_SIDEBAR);
    const sections = readCode("components/games/lobby/game-lobby-sections.tsx");

    expect(sidebar).toContain('title="Schedule (UTC)"');
    expect(sidebar).toContain('label="Start"');
    expect(sidebar).toContain('label="End"');
    expect(lobby).toMatch(/startLabel/);
    expect(lobby).toMatch(/endLabel/);
    expect(sections).toContain('label: "Opens"');
    expect(sections).toContain('label: "Closes"');
  });

  it("no longer counts down twice to the same moment", () => {
    const code = readCode(GAME_LOBBY);

    /*
      The removed row was `label={isActive ? "Closes in" : "Opens in"}` counting down to
      `countdownTarget` - the very expression the cells above it are given. A screen cannot
      disagree with itself about a clock it renders twice, but it can look careless, and the next
      edit to one copy is where it starts disagreeing.
    */
    expect(code).not.toMatch(/label=\{isActive \? "Closes in"/);
  });

  it("is rendered once, not once per contest state", () => {
    const lobby = readCode(GAME_LOBBY);
    const sidebar = readCode(GAME_SIDEBAR);

    /*
      Two blocks - one for upcoming, one for active - is the obvious way to write this and is
      how the trading sidebar does it. Here a single block switches on `isActive`, because the
      target is already resolved once as `countdownTarget`; a second copy is a second chance for
      this screen to count down to a different moment from its own hero tile.
    */
    expect(sidebar.match(/<ContestCountdown/g) ?? []).toHaveLength(1);
    expect(lobby).toMatch(/countdownTarget/);
    expect(lobby).toContain("<DesktopGameLobby");
  });

  it("hands the countdown the server's time rather than letting it guess", () => {
    /*
      A component that accepts `serverNow` and a caller that never passes it is the silent
      half-fix: every assertion about the component passes while every player is back on their
      own computer's clock.
    */
    expect(readCode(GAME_LOBBY)).toMatch(/serverNow: state\?\.serverNow/);
  });

  it("is withheld from a contest that has finished or been called off", () => {
    const lobby = readCode(GAME_LOBBY);
    const sidebar = readCode(GAME_SIDEBAR);

    /*
      RE-AIMED AT THE NAMED CONSTANT, and the reason generalises: this used to scan the 200
      characters before `<ContestCountdown` for the two clauses. That worked only while the
      condition was written inline, and it is the same fixed-character scan that once reported a
      present Edit guard as missing - a slice that begins mid-identifier is a test whose result
      depends on the length of the code above it.

      The condition now has a name, because two hosts have to agree about whether there is a
      clock to show. So the property moved: the DEFINITION carries the two clauses, and the
      render is gated on the definition.

      A clock on a cancelled contest counts down to a start that will never happen.
    */
    const definition = lobby.match(/const showCountdown = [^;]+;/);
    expect(definition).not.toBeNull();
    expect(definition![0]).toMatch(/!isCompleted/);
    expect(definition![0]).toMatch(/!isCancelled/);
    expect(definition![0]).toMatch(/countdownTarget/);
    expect(lobby).toMatch(/showCountdown/);
    expect(sidebar).toMatch(/showCountdown && countdownTarget/);
    expect(sidebar).toContain("<ContestCountdown");
  });
});

describe("the two clocks stay different on purpose", () => {
  it("runs the game countdown on the server's clock", () => {
    const code = readCode(GAME_COUNTDOWN);

    expect(code).toMatch(
      /import \{ useServerClock \} from "@\/hooks\/useServerClock"/,
    );
    expect(code).toMatch(/useServerClock\(serverNow\)/);

    /*
      THE NEGATIVE HALF, and the one that fails when somebody "simplifies" this component:
      importing the hook is satisfied by a file that calls it and then compares against
      `Date.now()` five lines later, which is exactly what the play screen did before its own
      clock was fixed. `new Date(target)` is parsing, not reading a clock, so only the
      no-argument forms are banned.
    */
    expect(code).not.toMatch(/Date\.now\(\)/);
    expect(code).not.toMatch(/new Date\(\s*\)/);
  });

  it("leaves the trading countdown on the browser's clock", () => {
    const code = readCode(LIVE_COUNTDOWN);

    // Trading has always read the player's own clock. Moving it onto the server's would be a
    // behaviour change to the trading lobby dressed up as a shared component.
    expect(code).toMatch(/const now = new Date\(\)/);
    expect(code).not.toMatch(/useServerClock/);
  });

  it("refuses an unparseable target rather than reporting a finished contest", () => {
    const code = readCode(GAME_COUNTDOWN);

    /*
      `splitDuration` clamps anything unusable to zero, and zero is the FINISHED state - so
      without this guard a bad stored date renders "Competition has ended!" over a contest that
      is running. A missing clock is recoverable by reading the schedule panel; a confident
      wrong one is not.
    */
    expect(code).toMatch(/Number\.isNaN\(targetMs\)/);
    expect(code).toMatch(/Number\.isNaN\(targetMs\)\)\s*return null/);
  });
});

describe("LiveCountdown's own behaviour", () => {
  it("still renders nothing for a type and status that do not match", () => {
    const code = readCode(LIVE_COUNTDOWN);

    /*
      This is the reason the game lobby does not simply render `LiveCountdown`: a pair it does
      not recognise - including `status: "completed"`, which the props admit and nothing handles
      - produces an empty space and no error. It is pinned rather than fixed, so that a later
      reader can see it was left deliberately.
    */
    expect(code).toMatch(/type === "start" && status === "upcoming"/);
    expect(code).toMatch(/type === "end" && status === "active"/);
    expect(code).toMatch(/return null;/);
  });

  it("still shows a skeleton before its first tick", () => {
    // The first render has no measurement yet. Rendering a zeroed clock instead would flash
    // "Competition has ended!" on every page load.
    expect(readCode(LIVE_COUNTDOWN)).toMatch(/remainingMs === null/);
  });
});
