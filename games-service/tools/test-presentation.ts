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
