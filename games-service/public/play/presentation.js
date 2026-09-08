/**
 * Circuit - the frame's pure half: the numbers it asks for and the words it prints.
 *
 * WHY THIS IS A SEPARATE FILE
 * ---------------------------
 * `app.js` reaches for `document` at module scope, so it cannot be imported by a test without a
 * DOM. Everything in here is arithmetic and strings, so it can - and the two things it decides are
 * exactly the two that were wrong: how big the board gets, and what the player is told at the end.
 * Keeping them here is what makes them provable rather than merely looked at.
 *
 * It has no imports, touches no globals, and returns plain values. `test-presentation.ts` runs it
 * in Node with no stub of any kind.
 *
 * AND WHAT IT MUST NEVER LEARN
 * ---------------------------
 * A score. `resultCopy` destructures the four fields it uses, so a score handed to it is ignored
 * by construction rather than by discipline - the same reason the platform's frame-message type
 * has no score field. The score is computed on our servers and travels to the platform over a
 * signed callback; the browser is not a link in that chain, and a number on this screen would be
 * one the player could argue with that nothing authoritative had agreed to.
 */

/* ------------------------------------------------------------------------------------------
 * How big the board gets
 * ---------------------------------------------------------------------------------------- */

/**
 * The cell size the board aims for when it has the room, and the two ends it will not pass.
 *
 * The floor is a deliberate choice to OVERFLOW rather than shrink further. A 12-pixel cell is
 * narrower than a fingertip, so the game stops being playable before it stops being visible; a
 * board that runs past the edge of a very short window is at least still draggable in the part
 * that shows. It is not reachable in the frame any more - see `desiredFrameHeight` - and only
 * ever applies to a standalone window somebody has made deliberately tiny.
 */
export const MIN_CELL_PX = 34;
export const MAX_CELL_PX = 104;
export const TARGET_CELL_PX = 72;

/**
 * What the frame asks its host for, and why it asks rather than measures.
 *
 * THE DEFECT THIS REPLACES, because it is the reason the board was the size of a postage stamp:
 * the frame used to report `document.documentElement.scrollHeight`, and the stylesheet sizes the
 * page to `100dvh`. Inside an iframe `dvh` is the iframe's own height, so the game measured the
 * frame, the platform sized the frame to the measurement, and the two agreed on whatever the
 * platform had opened with - 320 pixels, its own minimum. Nothing errored. The board then fitted
 * itself to what was left after the header and footer, hit its floor, and every player on every
 * screen size got the smallest board the code could draw.
 *
 * So the height is DERIVED FROM WHAT THE GAME NEEDS - rows of grid at a comfortable cell size,
 * plus the chrome around them - and never from what the game currently has. That is the property
 * a test can hold: feed the function a `currentHeight` and the answer must not move.
 *
 * The bounds are our own, not the host's. A host may clamp the request to anything it likes and
 * the board still fits whatever it is given, because `boardCellPx` measures the space that
 * actually arrived. Asking for a number no host would grant would not break the game; it would
 * just stop the request meaning anything.
 */
export const MIN_FRAME_HEIGHT = 400;
export const MAX_FRAME_HEIGHT = 1200;

/** Padding and rounding around the grid itself, inside the board's own panel. */
export const BOARD_FRAME_PX = 16;

/**
 * How far the board's bezel artwork reaches OUTSIDE the grid, as a fraction of the grid's size.
 *
 * WHY THE FRAME IS A SIBLING OF THE GRID RATHER THAN PART OF IT. The artwork is one square image
 * whose opening sits at about 6% of its own width, so the obvious implementation is to widen the
 * board's `viewBox` and draw the grid inset. That moves the grid inside the element the player
 * drags on, and `cellAt` in `board.js` maps a finger to a cell by proportion of the element's
 * box - so every hit test would silently be off by the frame, worst at the edges. Instead the
 * artwork is an absolutely-positioned element that overhangs the grid by this fraction, and the
 * grid's own coordinate space is untouched.
 *
 * IT IS DECLARED TWICE AND A TEST PINS THE PAIR. The other copy is `--board-art-overhang` in
 * `app.css`, because a stylesheet cannot import a number. If the two drift, the bezel's opening
 * stops landing on the grid's edge - either clipping the outer row of cells or leaving a gap of
 * page background inside the frame. Both read as "the artwork is slightly wrong" rather than as
 * a bug with a cause, which is exactly the kind of thing nobody files.
 */
export const BOARD_ART_OVERHANG = 0.072;

/** The grid size that leaves room for the bezel in `available` pixels of layout. */
export function spaceForGrid(available) {
  if (!positive(available)) return 0;
  return Math.floor(available / (1 + 2 * BOARD_ART_OVERHANG));
}

/** The space a grid of `px` occupies once its bezel is counted. */
export function framedGridPx(px) {
  if (!positive(px)) return 0;
  return Math.ceil(px * (1 + 2 * BOARD_ART_OVERHANG));
}

/**
 * The header-and-footer allowance used until the real one has been laid out.
 *
 * Only ever a first guess: `app.js` measures the bars and passes the real figure in on every
 * call after the first paint. A wrong guess costs one slightly-off request, which the next one
 * corrects.
 */
export const DEFAULT_CHROME_PX = 170;

/** Report a height change only when it is worth a reflow in the host's page. */
export const HEIGHT_REPORT_THRESHOLD_PX = 24;

function positive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * The cell size for a grid in the space the layout gave it.
 *
 * Takes the smaller of the two fits, because a cell is square and the grid may not be.
 */
export function boardCellPx(availableWidth, availableHeight, gridWidth, gridHeight) {
  if (!positive(gridWidth) || !positive(gridHeight)) return MIN_CELL_PX;
  if (!positive(availableWidth) || !positive(availableHeight)) return MIN_CELL_PX;

  const byWidth = Math.floor(availableWidth / gridWidth);
  const byHeight = Math.floor(availableHeight / gridHeight);
  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.min(byWidth, byHeight)));
}

function clampFrame(height) {
  if (!Number.isFinite(height)) return MIN_FRAME_HEIGHT;
  return Math.max(MIN_FRAME_HEIGHT, Math.min(MAX_FRAME_HEIGHT, Math.ceil(height)));
}

/**
 * The height to ask the host for.
 *
 * `screen` is `"play"` for the board and anything else for the panels either side of it. The
 * board's height is computed from the grid; a panel's is measured content, because its height is
 * whatever its own text comes to and no arithmetic here could know that.
 *
 * Note what is NOT in the parameter list: the height we currently have. See the header - taking
 * it is the defect, not an optimisation of it.
 */
export function desiredFrameHeight(input) {
  const { screen, gridHeight, chromeHeight, contentHeight } = input ?? {};

  if (screen === "play") {
    const rows = positive(gridHeight) ? Math.round(gridHeight) : 6;
    const chrome = positive(chromeHeight) ? chromeHeight : DEFAULT_CHROME_PX;
    // The bezel is counted here as well as in `spaceForGrid`, and leaving it out is the version
    // that looks correct: the board still fits, because `boardCellPx` measures what arrived - it
    // just fits a 13% smaller grid, on every screen, for ever. That is the postage-stamp defect
    // in a new disguise, so the height asked for is the height the framed board needs.
    return clampFrame(chrome + framedGridPx(rows * TARGET_CELL_PX) + BOARD_FRAME_PX);
  }

  return clampFrame(positive(contentHeight) ? contentHeight : 0);
}

/* ------------------------------------------------------------------------------------------
 * What the player is told
 * ---------------------------------------------------------------------------------------- */

/** The pre-round panel: the title's name and what the format asks of them. */
export function introCopy(input) {
  const { title, boardTarget, durationSeconds, mode } = input ?? {};

  const name = typeof title === "string" && title.trim() ? title.trim() : "Circuit";
  const practice = mode === "practice";

  let limit = "";
  if (positive(boardTarget)) {
    limit =
      `Finish ${boardTarget} ` +
      (boardTarget === 1 ? "board" : "boards") +
      ". Your total time is your score, and the lowest time wins.";
  } else if (positive(durationSeconds)) {
    limit =
      `You have ${formatDuration(durationSeconds)}. ` +
      "Solve as many boards as you can, and the highest score wins.";
  }

  return {
    name,
    limit,
    startLabel: practice ? "Start practice" : "Start",
    /*
     * Reason practice says something different: a practice round is free, unranked and prize-less,
     * and a player who thinks they are spending a paid attempt on it plays it differently. The
     * platform makes the same distinction on its own pre-flight panel.
     */
    note: practice
      ? "Practice is free and unranked. Nothing here affects the contest."
      : "Your time starts when you press Start.",
  };
}

/** `95` -> `"1:35"`, `120` -> `"2 minutes"`, `60` -> `"1 minute"`, `45` -> `"45 seconds"`. */
export function formatDuration(seconds) {
  if (!positive(seconds)) return "";
  const whole = Math.round(seconds);
  if (whole % 60 !== 0) {
    if (whole < 60) return `${whole} seconds`;
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }
  const minutes = whole / 60;
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/**
 * The result panel.
 *
 * THE HEADING IS NOT A LOOKUP ON THE STATUS, and it used to be. `completed` meant "Time!" for
 * both titles - but Circuit Perfect has no clock in its rules: it completes when the player
 * finishes the last of a fixed set of boards. So the one player who had done everything the game
 * asked was congratulated for running out of time. The same word covers two genuinely different
 * endings, and only the board count can tell them apart.
 *
 * Every branch says what happens next, because "your result is being confirmed" was the whole
 * explanation and it answers none of the questions a player actually has: does this count, do I
 * get my attempt back, where do I see the score. A void in particular returns the attempt, which
 * is the one outcome worth stating plainly.
 */
export function resultCopy(input) {
  const { status, boardsSolved, boardTarget, mode } = input ?? {};

  const solved = positive(boardsSolved) ? Math.round(boardsSolved) : 0;
  const target = positive(boardTarget) ? Math.round(boardTarget) : null;
  const practice = mode === "practice";
  const finishedEverything = target !== null && solved >= target;

  let heading;
  if (status === "completed") {
    heading = finishedEverything ? "Every board complete" : "Time's up";
  } else if (status === "abandoned") {
    heading = "You left the round";
  } else if (status === "expired") {
    heading = "The contest window closed";
  } else if (status === "voided") {
    heading = "Round cancelled";
  } else {
    heading = "Round ended";
  }

  let next;
  if (status === "voided") {
    // Section 13 of the specification: a voided round "is not scored, and we return the attempt
    // to the player - no money moves". Saying so is the difference between a player who tries
    // again and a player who opens a ticket.
    next = "This round was cancelled, so it was not scored. Your attempt has been given back.";
  } else if (practice) {
    next = "Practice rounds are not scored and change nothing in the contest.";
  } else if (solved === 0) {
    // Honest rather than encouraging. An unfinished board scores nothing under both titles'
    // rules, and a player told their result is "on its way" will go looking for it.
    next = "No board was finished, so there is nothing to score. You can see the contest standings on the contest page.";
  } else {
    next = "Your score is on its way to the contest. It will appear on the leaderboard in a moment.";
  }

  return {
    heading,
    statValue: target !== null ? `${solved} / ${target}` : String(solved),
    statLabel: solved === 1 && target === null ? "board finished" : "boards finished",
    next,
    /** Whether this ending is the good one, so the panel can pick its artwork. */
    triumphant: status === "completed" && (finishedEverything || solved > 0),
  };
}

/**
 * The live hint under the board.
 *
 * Names the rule that is not yet met, and only that one. A generic "not finished" on a grid the
 * player believes is complete is the shape of complaint that becomes a ticket about the game
 * being broken - which is the same reason the server's refusals are named rather than reduced to
 * "wrong".
 */
export function hintCopy(input) {
  const { joined, pairs, used, cells, complete } = input ?? {};

  if (complete) return { text: "Ready to submit.", tone: "ready" };
  if (positive(pairs) && joined < pairs) {
    return { text: `Join every pair: ${joined || 0} of ${pairs}.`, tone: "" };
  }
  return { text: `Use every square: ${used || 0} of ${cells || 0}.`, tone: "" };
}
