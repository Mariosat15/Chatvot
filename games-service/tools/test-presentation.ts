/**
 * The frame's pure half: the size it asks for and the words it prints.
 *
 * Run with `npx tsx tools/test-presentation.ts`.
 *
 * WHY THIS SUITE EXISTS AT ALL
 * ---------------------------
 * Two things about the play surface were wrong for as long as it has existed, and neither was
 * catchable by any test in this service. The board rendered at its minimum cell size on every
 * screen, because the frame reported its own height to a host that was sizing it from that report.
 * And the result screen told a Circuit Perfect player who had finished every board that their time
 * was up, because the heading was a lookup on a status word that covers two different endings.
 *
 * Both were in `app.js`, which reaches for `document` at module scope and therefore cannot be
 * imported by a test. Neither was visible in a typecheck: one is arithmetic that is correct in
 * isolation, the other is a string. `test-play.ts` drives the real HTTP surface and asserts the
 * page loads and its assets resolve - which they did, throughout.
 *
 * So the numbers and the wording moved into `presentation.js`, which has no imports and touches no
 * globals, and this file runs it in Node with no stub of any kind. The lesson is the general one:
 * **a module that cannot be imported is a module whose logic cannot be asserted**, and the fix is
 * to move the logic rather than to build a DOM.
 */

import assert from "node:assert/strict";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failed++;
    const message = (error as Error).message.split("\n").slice(0, 3).join(" | ");
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${message}`);
  }
}

interface Presentation {
  MIN_CELL_PX: number;
  MAX_CELL_PX: number;
  TARGET_CELL_PX: number;
  MIN_FRAME_HEIGHT: number;
  MAX_FRAME_HEIGHT: number;
  HEIGHT_REPORT_THRESHOLD_PX: number;
  boardCellPx(w: number, h: number, gw: number, gh: number): number;
  desiredFrameHeight(input: Record<string, unknown>): number;
  introCopy(input: Record<string, unknown>): {
    name: string;
    limit: string;
    startLabel: string;
    note: string;
  };
  formatDuration(seconds: number): string;
  resultCopy(input: Record<string, unknown>): {
    heading: string;
    statValue: string;
    statLabel: string;
    next: string;
    triumphant: boolean;
  };
  hintCopy(input: Record<string, unknown>): { text: string; tone: string };

  SOUND_PREFERENCE_KEY: string;
  SOUND_MAX_MS: number;
  BOARD_COMPLETE_MS: number;
  COUNT_UP_MAX_STEPS: number;
  COUNT_UP_STEP_MS: number;
  soundEnabledFrom(stored: string | null): boolean;
  soundPreferenceValue(enabled: boolean): string;
  soundControlCopy(enabled: boolean): { label: string; pressed: string; icon: string };
  pairNoteHz(pairId: number): number;
  pairNoteRecipe(pairId: number): Recipe;
  toneRecipe(name: string): Recipe | null;
  boardCompleteNotes(): Recipe[];
  newlyJoined(before: number[], after: number[]): number[];
  countUpSteps(target: number): number[];
  withCountUpValue(statValue: string, value: number): string;

  boardProgress(input: Record<string, unknown>): { fraction: number; percent: number };
  formatBoardTime(ms: number): string;
  bestBoardTime(previousMs: number | null, elapsedMs: number | null): number | null;
  roundHeaderCells(
    input: Record<string, unknown>,
  ): { key: string; label: string; value: string | null }[];
  playStatTiles(input: Record<string, unknown>): { key: string; label: string; value: string }[];
  undoState(input: Record<string, unknown>): { disabled: boolean; title: string };
}

/** One synthesised note, as `sound.js` consumes it. */
interface Recipe {
  type: string;
  fromHz: number;
  toHz: number;
  ms: number;
  gain: number;
  delayMs?: number;
}

/**
 * Loads the browser module.
 *
 * Both interop shapes are accepted for the same reason `test-board.ts` accepts both: the loader
 * decides which one appears, and pinning one would make this suite fail on a loader upgrade
 * rather than on a real defect.
 */
async function loadPresentation(): Promise<Presentation> {
  // @ts-expect-error - untyped browser module, deliberately. A hand-written `.d.ts` would be a
  // second copy of the interface above, drifting silently from the module it describes.
  const loaded = (await import("../public/play/presentation.js")) as Record<string, unknown>;
  const viaDefault = (loaded.default ?? loaded) as Record<string, unknown>;
  const merged = { ...viaDefault, ...loaded } as unknown as Presentation;
  assert.equal(typeof merged.desiredFrameHeight, "function", "no desiredFrameHeight export");
  assert.equal(typeof merged.resultCopy, "function", "no resultCopy export");
  return merged;
}

async function main(): Promise<void> {
  const p = await loadPresentation();

  console.log("");
  console.log("The height the frame asks its host for");

  test("the height asked for does not depend on the height we already have", () => {
    /*
     * THE REGRESSION TEST FOR THE DEFECT THIS MODULE WAS EXTRACTED TO FIX.
     *
     * The old code reported `document.documentElement.scrollHeight`, and the stylesheet sizes the
     * page to `100dvh` - inside an iframe, the iframe's own height. So the game measured the frame
     * and the platform sized the frame to the measurement: a fixed point at whatever the host
     * opened with. The board then hit its minimum cell size for ever.
     *
     * Asserted as a property rather than by inspecting the source, because the shape of the defect
     * is "somebody feeds the current height back in", and that is what this makes impossible: the
     * function ignores the field entirely, so a reintroduction has to add it to the signature and
     * this assertion turns red the moment it is read.
     */
    const base = { screen: "play", gridHeight: 6, chromeHeight: 160 };
    const answer = p.desiredFrameHeight(base);

    for (const currentHeight of [320, 1000, 0, -50]) {
      assert.equal(
        p.desiredFrameHeight({ ...base, currentHeight, scrollHeight: currentHeight }),
        answer,
        `the request moved when it was told the frame is currently ${currentHeight}px`,
      );
    }
  });

  test("a board always asks for more than a host's usual minimum, at every grid size", () => {
    // The player-visible half of the same defect. The platform clamps a frame to at least 320px
    // and opens there; a request that does not exceed it leaves the board at its floor. Every
    // grid this service generates is 5, 6 or 7 rows.
    for (const rows of [5, 6, 7]) {
      const height = p.desiredFrameHeight({ screen: "play", gridHeight: rows, chromeHeight: 160 });
      assert.ok(
        height > 320,
        `a ${rows}-row board asked for ${height}px, which a host would not have to grow to`,
      );
      assert.ok(
        height >= 160 + rows * p.TARGET_CELL_PX,
        `a ${rows}-row board asked for ${height}px, less than its chrome plus its own grid`,
      );
    }
  });

  test("a taller grid asks for a taller frame", () => {
    const five = p.desiredFrameHeight({ screen: "play", gridHeight: 5, chromeHeight: 160 });
    const seven = p.desiredFrameHeight({ screen: "play", gridHeight: 7, chromeHeight: 160 });
    assert.ok(seven > five, `7 rows asked for ${seven}px and 5 rows for ${five}px`);
    // Two rows at the target cell size, give or take the rounding.
    assert.ok(seven - five >= 2 * p.TARGET_CELL_PX - 2);
  });

  test("a panel screen asks for its measured content, and a board screen ignores it", () => {
    // The two branches answer different questions. A panel's height is whatever its own text
    // comes to, which no arithmetic here could know; a board's is the grid. Passing the wrong one
    // is silent, so both directions are asserted.
    const panel = p.desiredFrameHeight({ screen: "panel", contentHeight: 900 });
    assert.equal(panel, 900);

    const play = p.desiredFrameHeight({
      screen: "play",
      gridHeight: 6,
      chromeHeight: 160,
      contentHeight: 900,
    });
    assert.notEqual(play, 900, "the board screen used the measured content height");
  });

  test("a request is floored and capped, and nonsense falls back rather than propagating", () => {
    assert.equal(p.desiredFrameHeight({ screen: "panel", contentHeight: 10 }), p.MIN_FRAME_HEIGHT);
    assert.equal(
      p.desiredFrameHeight({ screen: "play", gridHeight: 400, chromeHeight: 160 }),
      p.MAX_FRAME_HEIGHT,
    );
    // Reason a missing grid falls back to a plausible size rather than to the floor: the floor is
    // the value the defect produced, so returning it on bad input would recreate the bug for any
    // round whose board had not arrived yet.
    const noGrid = p.desiredFrameHeight({ screen: "play", chromeHeight: 160 });
    assert.ok(noGrid > p.MIN_FRAME_HEIGHT, `a missing grid asked for ${noGrid}px`);
    for (const bad of [undefined, null, {}, { screen: "play", gridHeight: NaN }]) {
      const answer = p.desiredFrameHeight(bad as Record<string, unknown>);
      assert.ok(Number.isFinite(answer) && answer >= p.MIN_FRAME_HEIGHT, `bad input gave ${answer}`);
    }
  });

  console.log("");
  console.log("The cell size the board draws at");

  test("a cell takes the smaller of the two fits, because it is square", () => {
    // 600 wide and 300 tall over a 6x6 grid: 100 by width, 50 by height. Taking the larger would
    // draw a board twice the height of the space it was given, and the overflow is clipped by the
    // frame rather than scrolled - so the bottom row becomes undraggable.
    assert.equal(p.boardCellPx(600, 300, 6, 6), 50);
    assert.equal(p.boardCellPx(300, 600, 6, 6), 50);
  });

  test("a non-square grid is measured against its own width and height", () => {
    // 5 wide, 7 tall in a square space: the limit is the row count, not the column count.
    assert.equal(p.boardCellPx(490, 490, 5, 7), 70);
  });

  test("a cell is capped, so a very tall window does not draw a board nobody can span", () => {
    assert.equal(p.boardCellPx(4000, 4000, 5, 5), p.MAX_CELL_PX);
  });

  test("a cell is floored, and overflowing is the deliberate choice below it", () => {
    // A 12px cell is narrower than a fingertip, so the game stops being playable before it stops
    // being visible. Unreachable in the frame now that the height is requested rather than
    // measured; it only applies to a standalone window somebody has made tiny.
    assert.equal(p.boardCellPx(60, 60, 7, 7), p.MIN_CELL_PX);
  });

  test("a missing or nonsensical measurement does not produce a NaN board", () => {
    // `getBoundingClientRect` on a hidden element returns zeroes, and a render at `NaN` cell size
    // sets every SVG attribute to "NaN" - which draws nothing at all and looks exactly like the
    // game failing to load.
    for (const args of [
      [0, 0, 6, 6],
      [NaN, 400, 6, 6],
      [400, 400, 0, 6],
      [400, 400, 6, NaN],
    ] as const) {
      const answer = p.boardCellPx(...(args as [number, number, number, number]));
      assert.ok(Number.isFinite(answer) && answer > 0, `${args} gave ${answer}`);
    }
  });

  test("the report threshold is smaller than the smallest real change", () => {
    // The frame suppresses a height message under the threshold, so a threshold larger than the
    // step between two screens would pin the frame at one of them. The step from a panel to the
    // smallest board is the tightest one there is.
    const panel = p.MIN_FRAME_HEIGHT;
    const smallestBoard = p.desiredFrameHeight({
      screen: "play",
      gridHeight: 5,
      chromeHeight: 160,
    });
    assert.ok(
      Math.abs(smallestBoard - panel) > p.HEIGHT_REPORT_THRESHOLD_PX,
      `the step from a panel to a 5-row board is ${smallestBoard - panel}px, ` +
        `which the ${p.HEIGHT_REPORT_THRESHOLD_PX}px threshold would swallow`,
    );
  });

  console.log("");
  console.log("What the player is told at the end");

  test("finishing every board is not reported as running out of time", () => {
    /*
     * THE WORDING DEFECT. `completed` covers two genuinely different endings: a Sprint clock
     * reaching zero, and a Perfect player finishing the last of a fixed set. The heading was a
     * `Map` lookup on the status, so both said "Time!" - and Circuit Perfect has no clock in its
     * rules at all, so the one player who had done everything the game asked was congratulated
     * for running out of time.
     */
    const finished = p.resultCopy({ status: "completed", boardsSolved: 5, boardTarget: 5 });
    assert.equal(finished.heading, "Every board complete");
    assert.doesNotMatch(finished.heading, /time/i);

    const ranOut = p.resultCopy({ status: "completed", boardsSolved: 3, boardTarget: 5 });
    assert.equal(ranOut.heading, "Time's up");
  });

  test("a title with no board target is a clock, and completing it is time running out", () => {
    // Sprint's only ending. There is always another board, so `completed` can only mean the clock
    // reached zero - and saying "every board complete" to a player who solved four of an unlimited
    // set would be nonsense.
    const sprint = p.resultCopy({ status: "completed", boardsSolved: 4 });
    assert.equal(sprint.heading, "Time's up");
    assert.equal(sprint.statValue, "4");
  });

  test("each ending has its own heading, and an unknown one is not silently a good outcome", () => {
    assert.equal(p.resultCopy({ status: "abandoned", boardsSolved: 1 }).heading, "You left the round");
    assert.equal(
      p.resultCopy({ status: "expired", boardsSolved: 1 }).heading,
      "The contest window closed",
    );
    assert.equal(p.resultCopy({ status: "voided", boardsSolved: 1 }).heading, "Round cancelled");
    // A status nobody has defined yet, which is what a new terminal state looks like on the day it
    // is added. It must not fall into the congratulation branch.
    const unknown = p.resultCopy({ status: "something_new", boardsSolved: 9 });
    assert.equal(unknown.heading, "Round ended");
    assert.equal(unknown.triumphant, false);
  });

  test("a void says the attempt has been given back, because that is what a void does", () => {
    // Section 13: a voided round "is not scored, and we return the attempt to the player - no
    // money moves". A player not told that assumes they have lost a paid entry and opens a ticket.
    const voided = p.resultCopy({ status: "voided", boardsSolved: 2 });
    assert.match(voided.next, /given back/i);
    assert.match(voided.next, /not scored/i);
    assert.equal(voided.triumphant, false);
  });

  test("a round that finished nothing is told there is nothing to score", () => {
    // An unfinished board scores nothing under both titles' rules, so "your score is on its way"
    // would send the player looking for a result that is never going to appear.
    const empty = p.resultCopy({ status: "completed", boardsSolved: 0 });
    assert.match(empty.next, /nothing to score/i);
    assert.equal(empty.triumphant, false, "an empty round was given the winning artwork");
  });

  test("practice says it changes nothing, on every ending", () => {
    // A practice round is free, unranked and prize-less. A player who believes it counted plays
    // the paid one differently.
    for (const status of ["completed", "abandoned", "expired"]) {
      const copy = p.resultCopy({ status, boardsSolved: 2, mode: "practice" });
      assert.match(copy.next, /not scored/i, status);
      assert.doesNotMatch(copy.next, /leaderboard/i, status);
    }
  });

  test("the count is singular for one board and shows the target when there is one", () => {
    assert.equal(p.resultCopy({ status: "completed", boardsSolved: 1 }).statLabel, "board finished");
    assert.equal(p.resultCopy({ status: "completed", boardsSolved: 2 }).statLabel, "boards finished");
    assert.equal(
      p.resultCopy({ status: "completed", boardsSolved: 1, boardTarget: 5 }).statValue,
      "1 / 5",
    );
  });

  test("a score handed to the result panel cannot reach the screen", () => {
    /*
     * The specification's rule, held by construction rather than by discipline: "we will ignore
     * any score arriving from the browser. Scores decide real money and are accepted only from
     * your servers, signed." The panel destructures the four fields it uses, so a score added to
     * the play state later has nothing to render it - the same reason the platform's own frame
     * message type has no score field.
     *
     * Asserted over the WHOLE returned object, because a field nobody thought to check is the only
     * way to notice one nobody expected.
     */
    const copy = p.resultCopy({
      status: "completed",
      boardsSolved: 2,
      boardTarget: 5,
      score: 4321,
      rawScore: 4321,
      rank: 7,
      prize: 99.5,
      durationMs: 61234,
    });

    const printed = Object.values(copy).join(" | ");
    for (const leak of ["4321", "99.5", "61234", "7"]) {
      assert.ok(!printed.includes(leak), `the result screen printed ${leak}: ${printed}`);
    }
    assert.deepEqual(
      Object.keys(copy).sort(),
      ["heading", "next", "statLabel", "statValue", "triumphant"],
      "the result panel grew a field",
    );
  });

  console.log("");
  console.log("What the player is told at the start");

  test("the name comes from the state, and falls back rather than showing nothing", () => {
    // The frame used to keep its own map of display names, so a title added to the catalogue
    // appeared in the game as "Circuit" while the platform showed its real name.
    assert.equal(p.introCopy({ title: "Circuit Perfect" }).name, "Circuit Perfect");
    for (const missing of [undefined, "", "   "]) {
      assert.equal(p.introCopy({ title: missing }).name, "Circuit");
    }
  });

  test("a fixed set of boards is described as a race, and a clock as a count", () => {
    // The two titles score in opposite directions, and this sentence is the only place a player
    // learns which. Getting it backwards would have them playing to lose.
    const perfect = p.introCopy({ title: "Circuit Perfect", boardTarget: 5 });
    assert.match(perfect.limit, /5 boards/);
    assert.match(perfect.limit, /lowest time wins/i);

    const sprint = p.introCopy({ title: "Circuit Sprint", durationSeconds: 120 });
    assert.match(sprint.limit, /2 minutes/);
    assert.match(sprint.limit, /highest score wins/i);
  });

  test("the length stated is the one the player will get, not the title's own", () => {
    /*
     * THE OWNER'S REPORT, 10 September 2026. A player joining a contest with five minutes to run
     * was told in writing that they had ten, and then cut off mid-board.
     *
     * The worst part is that the platform's own pre-flight panel had already stated the shortened
     * figure moments before. Two screens, one round, two numbers - and this is the one in front of
     * the player when they press Start.
     */
    const short = p.introCopy({
      title: "Circuit Sprint",
      durationSeconds: 600,
      playableSeconds: 300,
    });
    assert.match(short.limit, /5 minutes/, `stated the wrong length: ${short.limit}`);
    assert.doesNotMatch(short.limit, /10 minutes/, `stated the title's length: ${short.limit}`);

    // And it says WHY. "You have five minutes" on a title the player knows is a ten-minute game
    // reads as a fault in the game rather than as the contest running out.
    assert.match(short.limit, /competition closes/i, `no reason given: ${short.limit}`);
  });

  test("a round that is not being cut short says nothing about the competition", () => {
    /*
     * The control. Without it, "always mention the competition" passes the test above while
     * telling every player of every full-length round that their time is being taken away.
     */
    const full = p.introCopy({
      title: "Circuit Sprint",
      durationSeconds: 120,
      playableSeconds: 120,
    });
    assert.match(full.limit, /2 minutes/);
    assert.doesNotMatch(full.limit, /competition/i, `an unshortened round blamed the contest`);
  });

  test("a promised length of zero is honoured rather than falling back", () => {
    /*
     * `playableSeconds` is authoritative WHENEVER THE SERVER SENT IT, including zero. Reaching for
     * the nominal length on a falsy value is the version that looks defensive and quietly
     * reinstates the promise the server cannot keep - and zero is reachable, because the contest
     * window can close between the state being read and the panel being drawn.
     */
    const none = p.introCopy({
      title: "Circuit Sprint",
      durationSeconds: 600,
      playableSeconds: 0,
    });
    assert.doesNotMatch(none.limit, /10 minutes/, `fell back to the title's length: ${none.limit}`);
    assert.equal(none.limit, "", `promised time it does not have: ${none.limit}`);
  });

  test("a fixed-set title is told about the contest separately, or not at all", () => {
    /*
     * Circuit Perfect leads on its board count and makes no claim about time, so a shortened
     * Perfect round cannot be corrected by changing a number - the sentence has to be added. A
     * player with two minutes left being told to finish three boards is the same defect wearing
     * different copy.
     */
    const short = p.introCopy({
      title: "Circuit Perfect",
      boardTarget: 3,
      durationSeconds: 300,
      playableSeconds: 120,
    });
    assert.match(short.limit, /3 boards/);
    assert.match(short.limit, /2 minutes/, `the shortening was not stated: ${short.limit}`);

    const full = p.introCopy({
      title: "Circuit Perfect",
      boardTarget: 3,
      durationSeconds: 300,
      playableSeconds: 300,
    });
    assert.match(full.limit, /3 boards/);
    assert.doesNotMatch(full.limit, /competition/i, "an unshortened round blamed the contest");
  });

  test("a state with no promised length still reads correctly", () => {
    // Backwards compatibility in the direction that matters: a browser holding an older
    // `presentation.js` is a solved problem, but a state from an older SERVER is not, and the
    // panel must not go blank.
    const legacy = p.introCopy({ title: "Circuit Sprint", durationSeconds: 120 });
    assert.match(legacy.limit, /2 minutes/);
    assert.doesNotMatch(legacy.limit, /competition/i);
  });

  test("a duration reads as a person would say it", () => {
    assert.equal(p.formatDuration(60), "1 minute");
    assert.equal(p.formatDuration(120), "2 minutes");
    assert.equal(p.formatDuration(300), "5 minutes");
    assert.equal(p.formatDuration(45), "45 seconds");
    assert.equal(p.formatDuration(95), "1:35");
    assert.equal(p.formatDuration(0), "");
  });

  test("practice is labelled as practice on the button and in the note", () => {
    const practice = p.introCopy({ title: "Circuit Sprint", durationSeconds: 120, mode: "practice" });
    assert.equal(practice.startLabel, "Start practice");
    assert.match(practice.note, /free and unranked/i);

    const ranked = p.introCopy({ title: "Circuit Sprint", durationSeconds: 120, mode: "ranked" });
    assert.equal(ranked.startLabel, "Start");
    assert.match(ranked.note, /time starts/i);
  });

  console.log("");
  console.log("The hint under the board");

  test("the hint names the rule that is not met, and only that one", () => {
    // A generic "not finished" on a grid the player believes is complete is the shape of complaint
    // that becomes a ticket about the game being broken. Coverage is the one they fail, and it is
    // the one the pips in `board.js` exist to make visible.
    const pairs = p.hintCopy({ joined: 2, pairs: 4, used: 8, cells: 36, complete: false });
    assert.match(pairs.text, /Join every pair: 2 of 4/);

    const coverage = p.hintCopy({ joined: 4, pairs: 4, used: 30, cells: 36, complete: false });
    assert.match(coverage.text, /Use every square: 30 of 36/);

    const ready = p.hintCopy({ joined: 4, pairs: 4, used: 36, cells: 36, complete: true });
    assert.equal(ready.tone, "ready");
    assert.match(ready.text, /submit/i);
  });

  console.log("");
  console.log("Whether the game makes a noise");

  test("an absent preference means sound is on, and only the stored word turns it off", () => {
    /*
     * THE DIRECTION OF THE DEFAULT, WHICH IS THE ONLY WAY THIS DECISION FAILS SILENTLY.
     *
     * Written as `stored === "on"` the game would be mute for every player who has never touched
     * the control, which is all of them - and a game that makes no noise is indistinguishable
     * from a game whose audio is broken, so nobody would report it as a preference bug.
     *
     * The unrecognised values matter for the same reason. A key left behind by an older build, or
     * one a host page wrote into the same origin, must not silently mute the game.
     */
    assert.equal(p.soundEnabledFrom(null), true);
    assert.equal(p.soundEnabledFrom(""), true);
    assert.equal(p.soundEnabledFrom("yes"), true);
    assert.equal(p.soundEnabledFrom("ON"), true);
    assert.equal(p.soundEnabledFrom("off"), false);
  });

  test("what is written back is what the reader recognises", () => {
    // The encode and the decode are two functions, so they can disagree - and if they do, the
    // control appears to work, the choice appears to save, and it is forgotten on every reload.
    assert.equal(p.soundEnabledFrom(p.soundPreferenceValue(true)), true);
    assert.equal(p.soundEnabledFrom(p.soundPreferenceValue(false)), false);
  });

  test("the control is pressed when MUTED, which is the opposite of sound being on", () => {
    /*
     * `aria-pressed` describes the button's own action, and the button mutes. Getting this
     * backwards changes nothing on screen and tells a screen-reader user the exact opposite of
     * the truth - the one failure of this control that no sighted reviewer can see.
     */
    const on = p.soundControlCopy(true);
    assert.equal(on.pressed, "false");
    assert.match(on.label, /^Mute/);

    const off = p.soundControlCopy(false);
    assert.equal(off.pressed, "true");
    assert.match(off.label, /^Unmute/);

    // Two states, two glyphs. One icon for both is a control that cannot be read at a glance.
    assert.notEqual(on.icon, off.icon);
  });

  test("a pair's note is stable, in range, and never NaN however odd the pair id", () => {
    // Stable because the note is the player's only cue that a wire landed: a pitch that moved
    // between two joins of the same pair would read as a different event.
    assert.equal(p.pairNoteHz(0), p.pairNoteHz(0));
    assert.notEqual(p.pairNoteHz(0), p.pairNoteHz(1));

    for (const id of [0, 1, 5, 7, 8, 40, -1, 2.7, Number.NaN, Number.POSITIVE_INFINITY]) {
      const hz = p.pairNoteHz(id);
      assert.ok(Number.isFinite(hz), `pair ${id} produced ${hz}`);
      // Inside the range a phone speaker actually reproduces. A note below this is a thud the
      // player feels rather than hears; above it, it is a whistle they will mute the game over.
      assert.ok(hz >= 180 && hz <= 1200, `pair ${id} produced ${hz}Hz`);
    }

    // A negative or fractional id is folded rather than refused: it is a pair number arriving
    // from a generator, and a silent join is worse than a note shared with another pair.
    assert.equal(p.pairNoteHz(-1), p.pairNoteHz(0));
    assert.equal(p.pairNoteHz(2.7), p.pairNoteHz(2));
  });

  test("every named tone is short and quiet, and an unknown name is silence", () => {
    /*
     * The budget is the constraint the owner set: this runs in an iframe on a phone, quite
     * possibly in public. A recipe that creeps past it is not a visible defect - it is a game
     * somebody mutes once and never unmutes, which shows up as nothing at all.
     */
    for (const name of ["press", "start", "refused", "clear", "tick"]) {
      const recipe = p.toneRecipe(name);
      assert.ok(recipe, `no recipe for ${name}`);
      assert.ok(recipe.ms > 0 && recipe.ms <= p.SOUND_MAX_MS, `${name} lasts ${recipe.ms}ms`);
      assert.ok(recipe.gain > 0 && recipe.gain <= 0.12, `${name} peaks at ${recipe.gain}`);
      assert.ok(Number.isFinite(recipe.fromHz) && Number.isFinite(recipe.toHz));
    }

    const joined = p.pairNoteRecipe(3);
    assert.ok(joined.ms <= p.SOUND_MAX_MS);
    assert.ok(joined.gain > 0 && joined.gain <= 0.12);
  });

  test("a tone name from the prototype chain is not a tone", () => {
    /*
     * `TONE_RECIPES` is a `Map` for this reason. An object lookup walks the prototype chain, so
     * `ACTIONS["constructor"]` returns something truthy that survives a `!recipe` test and fails
     * later somewhere unrelated. Nothing hands this a value from a request today, which is
     * precisely when a lookup like this gets reused for something that does.
     */
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty", "nope"]) {
      assert.equal(p.toneRecipe(name), null, `${name} resolved to a recipe`);
    }
  });

  test("the board flourish fits the window the sweep is drawn over", () => {
    const notes = p.boardCompleteNotes();
    assert.ok(notes.length >= 3, "a flourish of two notes is a beep");

    // The animation and the arpeggio are two independent numbers, so they can drift apart - and
    // the failure is a light sweeping over a board in silence, or a chord over a still board.
    for (const note of notes) {
      const ends = (note.delayMs ?? 0) + note.ms;
      assert.ok(ends <= p.BOARD_COMPLETE_MS, `a note ends at ${ends}ms of ${p.BOARD_COMPLETE_MS}`);
      assert.ok(note.gain > 0 && note.gain <= 0.12);
    }

    // Rising, because a falling flourish is what every piece of software plays when it has failed.
    const pitches = notes.map((note) => note.fromHz);
    assert.deepEqual(pitches, [...pitches].sort((a, b) => a - b));

    // Offsets, not four timers: `setTimeout` cannot place a note accurately enough for a chord.
    assert.ok(notes.some((note) => (note.delayMs ?? 0) > 0));
  });

  test("only a pair that was not joined a moment ago counts as newly joined", () => {
    /*
     * This is what stops a note sounding sixty times a second. A drag repaints on every pointer
     * move, so "which pairs are joined" is true for the whole rest of the drag - only the
     * transition is the event. Derived from the current state alone, the board would scream.
     */
    assert.deepEqual(p.newlyJoined([], [2]), [2]);
    assert.deepEqual(p.newlyJoined([2], [2]), []);
    assert.deepEqual(p.newlyJoined([2], [2, 5]), [5]);

    // Retracting and rejoining IS a new join - the wire genuinely landed again.
    assert.deepEqual(p.newlyJoined([], [2]), [2]);

    // A pair 0 must survive. Written with a truthiness filter anywhere in the chain, the first
    // pair on every board is the one that never makes a sound, which reads as a flaky game.
    assert.deepEqual(p.newlyJoined([], [0]), [0]);
  });

  test("the count-up stops short of being a wait, and refuses to count to one", () => {
    /*
     * CAPPED, because a Sprint player who solved forty boards would otherwise watch forty ticks
     * before being told the round is over - and this is a flourish, not information.
     *
     * EMPTY below two, because counting to one is a flicker and counting to zero is a round that
     * scored nothing being animated, which reads as the screen mocking the player.
     */
    assert.deepEqual(p.countUpSteps(0), []);
    assert.deepEqual(p.countUpSteps(1), []);
    assert.deepEqual(p.countUpSteps(Number.NaN), []);

    const five = p.countUpSteps(5);
    assert.equal(five.at(-1), 5, "the count must arrive at the value");
    assert.equal(five.length, 5);

    const many = p.countUpSteps(40);
    assert.ok(many.length <= p.COUNT_UP_MAX_STEPS, `${many.length} steps is a wait`);
    assert.equal(many.at(-1), 40);

    // Monotonic. A step that goes backwards is a number the player watches count DOWN.
    let previous = many[0];
    for (const step of many.slice(1)) {
      assert.ok(step >= previous, `${step} follows ${previous}, so the number counts down`);
      previous = step;
    }

    // The whole animation has to be over before a player looks away from it.
    assert.ok(many.length * p.COUNT_UP_STEP_MS <= 900);
  });

  test("the count-up rewrites the achievement and never the target beside it", () => {
    /*
     * `resultCopy` renders either "4" or "4 / 5". The 5 is what the contest asked for and never
     * changed, so animating it would count up a number that was already true - and on the last
     * step the two would briefly read the same, which is a player told they finished.
     */
    assert.equal(p.withCountUpValue("4 / 5", 2), "2 / 5");
    assert.equal(p.withCountUpValue("4", 2), "2");
    assert.equal(p.withCountUpValue("12 / 40", 3), "3 / 40");

    // A value with no leading figure passes through untouched rather than being replaced: the
    // result panel has endings whose figure is a dash, and "0" there is a claim, not a blank.
    assert.equal(p.withCountUpValue("-", 2), "-");
    assert.equal(p.withCountUpValue("4 / 5", Number.NaN), "4 / 5");
  });

  test("the storage key is namespaced, because the frame may share an origin with the host", () => {
    // Under the proxy deployment the play surface is served from the platform's own domain, so
    // `localStorage` is shared with it. A key called "sound" is a collision waiting to happen,
    // and the symptom would be a player's mute choice changing when they used something else.
    assert.match(p.SOUND_PREFERENCE_KEY, /circuit/i);
  });

  console.log("");
  console.log("The play screen's instruments");

  test("the header never states a score, and neither does anything beside the board", () => {
    /*
     * THE LOAD-BEARING TEST OF THIS WHOLE SECTION, and the reason it is an assertion rather than
     * a comment. The reference design puts a running SCORE in the round header. This client has
     * no honest source for one: `PlayState` carries no score, no rank and no prize, deliberately,
     * and `resultCopy` is asserted below to refuse them even when handed them.
     *
     * So a score cell could only be filled by computing one HERE - a second scoring authority,
     * which is the single thing the provider seam exists to prevent - or by changing the protocol,
     * which is an owner's decision. Every figure these functions return is something the client
     * can observe for itself: coverage, pairs joined, drags made, a board time.
     */
    const cells = p.roundHeaderCells({ boardsSolved: 2, boardTarget: 5, used: 18, cells: 36 });
    const tiles = p.playStatTiles({ boardsSolved: 2, joined: 3, pairs: 4, moves: 9, bestBoardMs: 4200 });
    const words = [...cells, ...tiles]
      .map((entry) => `${entry.label} ${entry.value ?? ""}`)
      .join(" ")
      .toLowerCase();

    for (const forbidden of ["score", "points", "rank", "prize"]) {
      assert.ok(!words.includes(forbidden), `the instruments mention "${forbidden}": ${words}`);
    }
  });

  test("a title with a fixed set of boards gets a denominator; one without does not", () => {
    // Circuit Perfect has a declared number of boards, so "3 / 5" is a true statement. Sprint has
    // no finishing line at all, and inventing one there would promise a player an end the title
    // does not have - so the first cell changes its question rather than its number.
    const perfect = p.roundHeaderCells({ boardsSolved: 2, boardTarget: 5, used: 0, cells: 36 });
    assert.equal(perfect[0].label, "Board");
    assert.equal(perfect[0].value, "3 / 5");

    const sprint = p.roundHeaderCells({ boardsSolved: 2, used: 0, cells: 36 });
    assert.equal(sprint[0].label, "Solved");
    assert.equal(sprint[0].value, "2");
  });

  test("the board cell never counts past the set it belongs to", () => {
    // The last board is solved before the round's own state turns terminal, so there is a moment
    // where `boardsSolved` equals the target. Unclamped this reads "6 / 5", which is the game
    // telling a player who has just finished everything that there is another board coming.
    const done = p.roundHeaderCells({ boardsSolved: 5, boardTarget: 5, used: 36, cells: 36 });
    assert.equal(done[0].value, "5 / 5");
  });

  test("the clock cell brings its caption and deliberately not its value", () => {
    // `renderClock` owns the figure, because it changes four times a second and carries the
    // urgent styling. If this returned a value too, the two writers would fight and the loser
    // would be whichever ran last - which is a clock that freezes on a board change.
    const clock = p.roundHeaderCells({ boardsSolved: 0, used: 0, cells: 36 }).find(
      (cell) => cell.key === "clock",
    );
    assert.ok(clock, "there is no clock cell");
    assert.equal(clock?.value, null, "the header wrote the clock's value");
    assert.match(String(clock?.label), /time/i);
  });

  test("progress is COVERAGE, not pairs joined", () => {
    /*
     * The two genuinely differ, and this is the one that matters: the puzzle is complete when
     * every pair is joined AND every square is used, so a board with all its pairs joined by
     * short routes can be a long way from finished.
     *
     * Driven by pairs, the bar would sit at 100% while the server refused the board with
     * `incomplete_coverage` - which reads to a player as the game being broken rather than as the
     * puzzle being unfinished.
     */
    assert.equal(p.boardProgress({ used: 18, cells: 36 }).percent, 50);
    assert.equal(p.boardProgress({ used: 36, cells: 36 }).percent, 100);
    assert.equal(p.boardProgress({ used: 0, cells: 36 }).fraction, 0);

    // No board yet, and a used count above the grid, both answer without throwing: the fill is a
    // CSS transform, and a fraction of `NaN` or 1.5 is a bar that vanishes or overflows its track.
    assert.equal(p.boardProgress({}).percent, 0);
    assert.equal(p.boardProgress({ used: 40, cells: 36 }).percent, 100);
  });

  test("the best board time keeps the quicker of the two, and survives a bad reading", () => {
    // The elapsed figure is the difference of two wall-clock readings, and a device that suspends
    // its timers can produce a negative or a zero. Taken literally, either becomes the player's
    // "best" for the rest of the round and can never be beaten.
    assert.equal(p.bestBoardTime(null, 4200), 4200);
    assert.equal(p.bestBoardTime(4200, 3100), 3100);
    assert.equal(p.bestBoardTime(3100, 4200), 3100);
    assert.equal(p.bestBoardTime(3100, -5), 3100);
    assert.equal(p.bestBoardTime(3100, 0), 3100);
    assert.equal(p.bestBoardTime(null, 0), null);
  });

  test("a board time keeps its minutes, so it cannot be read as a score", () => {
    assert.equal(p.formatBoardTime(4200), "0:04");
    assert.equal(p.formatBoardTime(73_000), "1:13");
    assert.equal(p.formatBoardTime(Number.NaN), "");
  });

  test("the best-board tile is omitted until there is one, never shown empty", () => {
    // A tile reading "-" beside three real figures reads as a number that failed to load, and the
    // first board of every round would show one. The column shrinks instead.
    const early = p.playStatTiles({ boardsSolved: 0, joined: 1, pairs: 4, moves: 3 });
    assert.ok(!early.some((tile) => tile.key === "best"), "an empty best-board tile was rendered");

    const later = p.playStatTiles({ boardsSolved: 1, joined: 1, pairs: 4, moves: 3, bestBoardMs: 4200 });
    assert.ok(later.some((tile) => tile.key === "best"), "the best-board tile never appears");
  });

  test("undo is offered only when there is something to remove, and never on a locked board", () => {
    // Locked is checked FIRST, because the round has ended: a board still holding paths would
    // otherwise offer an enabled control that `board.undo()` then refuses, which is the shape of
    // dead control this codebase keeps finding.
    assert.equal(p.undoState({ canUndo: true, locked: false }).disabled, false);
    assert.equal(p.undoState({ canUndo: false, locked: false }).disabled, true);
    assert.equal(p.undoState({ canUndo: true, locked: true }).disabled, true);
    assert.equal(p.undoState({}).disabled, true);
  });

  test("nothing here offers a hint, and that is the fairness rule rather than a gap", () => {
    /*
     * The reference design shows a Hint button with a count of three. It is not a styling omission
     * and must not be added as one: a hint tells a player something about the solution they had
     * not worked out, which improves a score in a paid contest, and a consumable count is the
     * marketplace mechanic the platform's fairness rule names explicitly.
     *
     * Asserted over the exported surface rather than left as a comment, so the day somebody adds
     * `hintState` beside `undoState` this goes red and they read the reason.
     */
    const surface = Object.keys(p).join(" ").toLowerCase();
    assert.ok(!surface.includes("hint" + "state"), "a hint control was added to the play surface");
    assert.ok(!surface.includes("hintsleft"), "a hint allowance was added to the play surface");
  });

  console.log("");
  console.log(`Presentation tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
