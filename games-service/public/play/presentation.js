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

/**
 * THE THREE DRAWN BOARDS, one per grid size the game offers, with their cells painted in.
 *
 * The owner supplied one piece of artwork per size on 11 September 2026 - a full bezel with the
 * blue cell grid already drawn inside it - so for these three shapes the picture IS the board and
 * the vector cells underneath are made transparent (see `.board-stage.drawn` in `app.css`). The
 * wires, the terminals and the numerals are still drawn by `board.js` on top, because those are
 * the game; the artwork is what it looks like.
 *
 * THE FOUR INSETS ARE MEASURED OFF THE FILE, NOT CHOSEN, and they are per side because the frames
 * are not symmetric: the 4x4 art's grid sits lower than it sits left, and its cells are 190 by 178
 * pixels rather than square. Each figure is the distance from the grid's outer line to the edge of
 * the image, as a fraction of the grid's own extent on that axis - so `top: 0.2166` means the
 * artwork reaches 21.66% of the grid's height above the grid. `.board-art` is then positioned
 * with those four negative insets and stretched to fill (`background-size: 100% 100%`), which
 * maps the drawn grid exactly onto the `<svg>` grid whatever pixel size the layout chose. The
 * non-square 4x4 art is stretched 6.7% taller by that mapping; on a bezel it does not show, and
 * the alternative - drawing our square cells over its rectangular ones - shows on every cell.
 *
 * Measured with the white intersection dots along the centre row and column of each 1024x1024
 * file (`sharp`, raw pixels, threshold 215 on all three channels). Re-measure if the artwork is
 * replaced; a guess here puts the wires a few pixels off the drawn cells on every board.
 *
 * ANY OTHER SHAPE - a rectangular grid, a size added later - falls back to the generic bezel with
 * its vector cells showing, so a new size is playable on the day it is added and merely looks
 * plainer until it has artwork. `boardFrameFor` returns null for that case on purpose.
 */
export const DRAWN_BOARD_FRAMES = [
  { cells: 4, file: "/play/board-4.webp", top: 0.2166, right: 0.1737, bottom: 0.2236, left: 0.1737 },
  { cells: 6, file: "/play/board-6.webp", top: 0.1438, right: 0.1323, bottom: 0.1363, left: 0.1335 },
  { cells: 8, file: "/play/board-8.webp", top: 0.1184, right: 0.1258, bottom: 0.1319, left: 0.1245 },
];

/** The drawn frame for a square grid of this size, or null when it has to make do with the bezel. */
export function boardFrameFor(gridWidth, gridHeight) {
  if (!positive(gridWidth) || gridWidth !== gridHeight) return null;
  return DRAWN_BOARD_FRAMES.find((frame) => frame.cells === gridWidth) ?? null;
}

/** How far the artwork reaches past the grid on each axis, as a total fraction of the grid. */
export function frameOverhang(frame) {
  if (!frame) return { horizontal: 2 * BOARD_ART_OVERHANG, vertical: 2 * BOARD_ART_OVERHANG };
  return { horizontal: frame.left + frame.right, vertical: frame.top + frame.bottom };
}

/**
 * The CSS `inset` that positions the artwork around the grid: negative, one figure per side, as
 * percentages so they scale with whatever pixel size the grid ends up at. Percent insets resolve
 * against the containing block's own dimension on that axis, which is exactly how the fractions
 * above were measured.
 */
export function frameInsetCss(frame) {
  const f = frame ?? {
    top: BOARD_ART_OVERHANG,
    right: BOARD_ART_OVERHANG,
    bottom: BOARD_ART_OVERHANG,
    left: BOARD_ART_OVERHANG,
  };
  const pct = (value) => "-" + (value * 100).toFixed(2) + "%";
  return [pct(f.top), pct(f.right), pct(f.bottom), pct(f.left)].join(" ");
}

/**
 * The grid size that leaves room for the bezel in `available` pixels of layout.
 *
 * `overhang` is the total fraction the artwork adds on that axis - both sides together - and it
 * defaults to the generic bezel's. A drawn frame passes its own, because reserving the generic
 * 14% for a frame that needs 39% clips the top and bottom of the 4x4 board's bezel off.
 */
export function spaceForGrid(available, overhang) {
  if (!positive(available)) return 0;
  const total = positive(overhang) ? overhang : 2 * BOARD_ART_OVERHANG;
  return Math.floor(available / (1 + total));
}

/** The space a grid of `px` occupies once its bezel is counted. Same `overhang` as above. */
export function framedGridPx(px, overhang) {
  if (!positive(px)) return 0;
  const total = positive(overhang) ? overhang : 2 * BOARD_ART_OVERHANG;
  return Math.ceil(px * (1 + total));
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

/**
 * The cell size the AVAILABLE WIDTH permits, which is the size the board will actually draw at.
 *
 * WHY THIS EXISTS, and it is the owner's report of 11 September 2026 - *"this is the large board,
 * when we choose medium and large the system makes the board smaller"*. The board is width-bound
 * in the platform's arena and always has been: the frame is a middle column of 450 to 650 pixels,
 * and a cell is square, so `boardCellPx` takes the width's answer. A 4x4 got a comfortable cell
 * out of that and an 8x8 got the floor - the same board, drawn small, with nothing errored.
 *
 * Two things follow, and only the second is arithmetic. The rails beside the board had to go
 * (see `.arena` in `app.css`), because they were taking a third of the width the grid divides up.
 * And the height asked for has to be derived from the width rather than from `TARGET_CELL_PX`,
 * or the frame is granted room for a 72-pixel cell while the width only permits 49 and the
 * difference shows as the empty band above and below the board that the owner drew arrows across.
 *
 * IT IS SAFE TO READ THE CURRENT WIDTH AND IT IS NOT SAFE TO READ THE CURRENT HEIGHT, which reads
 * like an inconsistency and is the whole reason this is sound. Nothing we report changes our
 * width: it is the width of the host's column, decided by the host's layout. The height IS what
 * we report, so a height derived from the height we have is a fixed point at whatever the host
 * opened with - the postage-stamp defect, and the reason `desiredFrameHeight` takes no such
 * field. A width that moves because the host gained a scrollbar moves the answer by a pixel or
 * two of cell, which `HEIGHT_REPORT_THRESHOLD_PX` swallows rather than reporting.
 */
export function widthBoundCellPx(availableWidth, gridWidth, gridHeight) {
  const cols = positive(gridWidth) ? Math.round(gridWidth) : 0;
  /*
   * THE `cols` HALF DECIDES SOMETHING AND THE WIDTH HALF IS CLARITY, and saying so is the honest
   * version. Without the first, `grid / 0` is `Infinity` and the clamp below answers
   * `MAX_CELL_PX` - a 104-pixel cell for a board with no columns, which is a request for a frame
   * a third taller than it needs. The width half changes no answer: `spaceForGrid` reports 0 for
   * anything that is not a positive number, and the `!positive(grid)` line four below then
   * returns the target. It stays because a reader looking for "what happens before the first
   * paint" looks at the top of the function, and its probe is recorded as unprobed for exactly
   * this reason rather than shipped green.
   */
  if (!cols || !positive(availableWidth)) return TARGET_CELL_PX;

  const rows = positive(gridHeight) ? Math.round(gridHeight) : cols;
  const { horizontal } = frameOverhang(boardFrameFor(cols, rows));
  const grid = spaceForGrid(availableWidth, horizontal);
  if (!positive(grid)) return TARGET_CELL_PX;

  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(grid / cols)));
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
 * it is the defect, not an optimisation of it. `availableWidth` IS in the list, and
 * `widthBoundCellPx` explains at length why one is safe and the other is not.
 */
export function desiredFrameHeight(input) {
  const { screen, gridWidth, gridHeight, chromeHeight, contentHeight, availableWidth } = input ?? {};

  if (screen === "play") {
    const rows = positive(gridHeight) ? Math.round(gridHeight) : 6;
    const cols = positive(gridWidth) ? Math.round(gridWidth) : rows;
    const chrome = positive(chromeHeight) ? chromeHeight : DEFAULT_CHROME_PX;
    // The bezel is counted here as well as in `spaceForGrid`, and leaving it out is the version
    // that looks correct: the board still fits, because `boardCellPx` measures what arrived - it
    // just fits a 13% smaller grid, on every screen, for ever. That is the postage-stamp defect
    // in a new disguise, so the height asked for is the height the framed board needs - and it
    // is THIS board's frame, because the drawn 4x4 bezel is nearly three times as deep as the
    // generic one.
    const frame = boardFrameFor(cols, rows);
    const { vertical } = frameOverhang(frame);
    // The cell the width permits when the width is known, and the target otherwise. Asking for
    // the target's height on a narrow frame is what left the empty band above and below the
    // board: the grid can only ever be as big as the narrower axis allows, so a request based on
    // the other one is a request for space the board cannot use.
    const cell = positive(availableWidth)
      ? widthBoundCellPx(availableWidth, cols, rows)
      : TARGET_CELL_PX;
    return clampFrame(chrome + framedGridPx(rows * cell, vertical) + BOARD_FRAME_PX);
  }

  return clampFrame(positive(contentHeight) ? contentHeight : 0);
}

/* ------------------------------------------------------------------------------------------
 * What the player is told
 * ---------------------------------------------------------------------------------------- */

/** The pre-round panel: the title's name and what the format asks of them. */
export function introCopy(input) {
  const { title, boardTarget, durationSeconds, playableSeconds, mode } = input ?? {};

  const name = typeof title === "string" && title.trim() ? title.trim() : "Circuit";
  const practice = mode === "practice";

  /*
   * THE LENGTH TO STATE IS THE ONE THE PLAYER WILL GET, NEVER THE TITLE'S OWN.
   *
   * This panel used to read `durationSeconds` alone, so a player joining a contest with five
   * minutes to run was told they had ten - and then cut off, mid-board, by a clock that still
   * showed time remaining. The platform's own pre-flight screen had already told them the truth
   * moments earlier, which made it worse rather than better: two screens, one round, two numbers,
   * and this is the one they are looking at when they press Start.
   *
   * `playableSeconds` is authoritative whenever the server sent it, INCLUDING WHEN IT IS ZERO.
   * Falling back to the nominal length on a falsy value is the version that looks defensive and
   * reinstates the promise the server cannot keep.
   */
  const nominal = positive(durationSeconds) ? Math.floor(durationSeconds) : null;
  const granted =
    typeof playableSeconds === "number" &&
    Number.isFinite(playableSeconds) &&
    playableSeconds >= 0
      ? Math.floor(playableSeconds)
      : nominal;
  // Both known and the contest is the tighter of the two. Said out loud, because "you have five
  // minutes" on a title the player knows is a ten-minute game reads as a fault in the game.
  const cutShort = granted !== null && nominal !== null && granted < nominal;

  let limit = "";
  if (positive(boardTarget)) {
    limit =
      `Finish ${boardTarget} ` +
      (boardTarget === 1 ? "board" : "boards") +
      ". Your total time is your score, and the lowest time wins.";
    // Perfect leads on its board count and makes no claim about time, so the shortening has to be
    // stated separately or a player with two minutes left is told to finish three boards.
    if (cutShort && positive(granted)) {
      limit +=
        ` The competition closes in ${formatDuration(granted)}, ` +
        "so that is all the time this round has.";
    }
  } else if (positive(granted)) {
    limit =
      `You have ${formatDuration(granted)}` +
      (cutShort ? ", which is all that is left before the competition closes" : "") +
      ". Solve as many boards as you can, and the highest score wins.";
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

/* ------------------------------------------------------------------------------------------
 * Sound: every number about it, and none of the plumbing
 * ---------------------------------------------------------------------------------------- */

/**
 * WHY THE SOUNDS ARE SYNTHESISED AND THERE ARE NO AUDIO FILES.
 *
 * Three independent reasons, any one of which would decide it.
 *
 * The play surface is served from a directory listing filtered by an extension allowlist in
 * `src/http/play-page.ts`, on an unauthenticated route, and a test asserts that table is the whole
 * of the remaining protection there. Adding `.mp3` to it widens the only guard that route has, for
 * decoration.
 *
 * The round's clock starts on the SERVER when Start is pressed, so every byte fetched after that
 * comes out of the player's paid time - the same reason the board's artwork is warmed at boot.
 *
 * And a sound file that 404s is silent AND invisible: nothing errors, nothing logs, and the game
 * looks exactly like a game somebody muted. This platform has lost days to that class twice
 * already (R52, R54). An oscillator cannot 404.
 *
 * So every sound is an `OscillatorNode` shaped by a `GainNode`, and everything deciding what it
 * sounds like is here, where it can be asserted. `sound.js` holds only the Web Audio calls.
 */

/** The `localStorage` key holding the player's mute choice. */
export const SOUND_PREFERENCE_KEY = "circuit-sound";

/** The longest an ordinary sound may last. The board-complete flourish is the one exception. */
export const SOUND_MAX_MS = 300;

/** The flourish's budget, and the window the celebratory sweep on the board is drawn over. */
export const BOARD_COMPLETE_MS = 520;

/**
 * Decode the stored mute preference.
 *
 * ONLY THE EXACT STRING FOR "OFF" MUTES. An absent value, a corrupt one, or one written by some
 * future version all read as sound on - which is the opposite reading to `entryBlockThreshold`
 * on the platform, and deliberately so. The question to ask is which way the failure falls: a
 * bad write here would otherwise take the feature away permanently and silently, and a player
 * who never turned sound off has no reason to look for a control that would give it back. A
 * wrongly-unmuted game is audible, and the player can mute it in one tap.
 */
export function soundEnabledFrom(stored) {
  return stored !== soundPreferenceValue(false);
}

/** The value written back, so the decode and the encode cannot drift apart. */
export function soundPreferenceValue(enabled) {
  return enabled ? "on" : "off";
}

/**
 * The mute control's label and `aria-pressed`.
 *
 * `pressed` describes MUTED, not "sound is on", because the button is named for the action it
 * performs. Getting that backwards is invisible on screen and tells a screen-reader user the
 * opposite of the truth, which is the one failure mode of this control that nobody would file.
 */
export function soundControlCopy(enabled) {
  return enabled
    ? { label: "Mute sound", pressed: "false", icon: "\u{1F50A}" }
    : { label: "Unmute sound", pressed: "true", icon: "\u{1F507}" };
}

/**
 * A pair's note, so a finished board is a chord rather than a list of beeps.
 *
 * Major pentatonic degrees over A3: any combination of them is consonant, so the board stays
 * musical whatever order the player joins the pairs in and however many a grid size produces.
 *
 * EIGHT DEGREES, WHICH IS THE MOST PAIRS ANY GRID PRODUCES (`large`: 5-8), for the same reason
 * `TERMINAL_ART` has eight entries. The modulo is the fallback if a ninth ever appears - and
 * unlike the artwork, where a modulo would paint a "1" on pair 9 and look deliberate, a repeated
 * note costs nothing.
 */
const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16];
const NOTE_BASE_HZ = 220;

export function pairNoteHz(pairId) {
  const at =
    Number.isFinite(pairId) && pairId >= 0
      ? Math.floor(pairId) % PENTATONIC_SEMITONES.length
      : 0;
  return Math.round(NOTE_BASE_HZ * Math.pow(2, PENTATONIC_SEMITONES.at(at) / 12));
}

/** The whole sound a joined pair makes: its own note, sliding up a fifth as the wire lands. */
export function pairNoteRecipe(pairId) {
  const hz = pairNoteHz(pairId);
  return { type: "triangle", fromHz: hz, toHz: Math.round(hz * 1.5), ms: 170, gain: 0.075 };
}

/*
 * A `Map` rather than an object literal, and the reason is the same one that put a `Map` behind
 * the round-inspector's action list and the contest edit's field list: an object lookup walks the
 * prototype chain, so `toneRecipe("constructor")` would return something truthy. Nothing hands
 * this a value from a request today, which is exactly when a lookup like this gets reused.
 *
 * Quiet on purpose. This plays inside an iframe on somebody's phone, very possibly in public, and
 * a game that announces itself at the volume of a notification is a game the player mutes once
 * and never unmutes.
 */
const TONE_RECIPES = new Map([
  ["press", { type: "triangle", fromHz: 320, toHz: 240, ms: 70, gain: 0.05 }],
  ["start", { type: "triangle", fromHz: 330, toHz: 660, ms: 180, gain: 0.07 }],
  ["refused", { type: "sawtooth", fromHz: 150, toHz: 90, ms: 190, gain: 0.05 }],
  ["clear", { type: "triangle", fromHz: 220, toHz: 130, ms: 130, gain: 0.045 }],
  ["tick", { type: "square", fromHz: 760, toHz: 700, ms: 45, gain: 0.035 }],
]);

/**
 * One of the fixed sounds, or `null`.
 *
 * FAILS CLOSED TO SILENCE. An unknown name is a typo or a sound somebody removed, and inventing
 * a default tone for it would mean the wrong noise in the right place - which reads as the game
 * being broken rather than as a missing case. Silence reads as a sound nobody added yet.
 */
export function toneRecipe(name) {
  return TONE_RECIPES.get(name) ?? null;
}

/**
 * The board-complete flourish: the tonic, the third, the fifth and the octave, close together.
 *
 * `delayMs` is carried on the recipe rather than being scheduled by four timers, because Web
 * Audio can start a note at a time in the future far more accurately than `setTimeout` can - and
 * an arpeggio whose notes wobble is worse than a chord.
 */
const ARPEGGIO_SEMITONES = [0, 4, 7, 12];
const ARPEGGIO_GAP_MS = 70;

export function boardCompleteNotes() {
  return ARPEGGIO_SEMITONES.map((semitones, at) => {
    const hz = Math.round(NOTE_BASE_HZ * 2 * Math.pow(2, semitones / 12));
    return {
      type: "triangle",
      fromHz: hz,
      toHz: hz,
      ms: 200,
      gain: 0.06,
      delayMs: at * ARPEGGIO_GAP_MS,
    };
  });
}

/* ------------------------------------------------------------------------------------------
 * Motion: the two decisions that are arithmetic rather than CSS
 * ---------------------------------------------------------------------------------------- */

/**
 * Which pairs are joined now that were not a moment ago.
 *
 * The transition is the event, not the state: a pair that is already joined must not re-light and
 * re-sound on every pointer move while the finger travels back along a finished wire, which is
 * both the obvious implementation and a machine gun.
 */
export function newlyJoined(before, after) {
  const had = new Set(Array.isArray(before) ? before : []);
  return (Array.isArray(after) ? after : []).filter((id) => !had.has(id));
}

/** How many ticks the result screen's figure counts through, and how long each one holds. */
export const COUNT_UP_MAX_STEPS = 14;
export const COUNT_UP_STEP_MS = 45;

/**
 * The figures to show on the way to `target`, or nothing at all.
 *
 * CAPPED, because a Sprint player who solved forty boards would otherwise sit through forty ticks
 * before being told their round is over - and the count-up is a flourish, not information. It is
 * also EMPTY for a target of one or less: counting to one is a flicker, and counting to zero on
 * the screen that tells a player they scored nothing is tactless as well as pointless.
 */
export function countUpSteps(target) {
  if (!Number.isFinite(target) || target <= 1) return [];
  const whole = Math.floor(target);
  const count = Math.min(whole, COUNT_UP_MAX_STEPS);
  const steps = [];
  for (let step = 1; step <= count; step++) steps.push(Math.round((whole * step) / count));
  return steps;
}

/**
 * `("4 / 5", 2)` -> `"2 / 5"`. The leading figure only.
 *
 * `resultCopy` renders either `"4"` or `"4 / 5"`, and the target is not the player's achievement -
 * counting it up too would animate the number of boards the contest asked for, which never
 * changed. A value with no leading figure passes through untouched rather than being replaced,
 * so a future wording is left alone instead of being mangled.
 */
export function withCountUpValue(statValue, value) {
  if (typeof statValue !== "string") return "";
  if (!Number.isFinite(value)) return statValue;
  return statValue.replace(/^\d+/, String(Math.max(0, Math.round(value))));
}

/* ------------------------------------------------------------------------------------------
 * The play screen's instruments
 *
 * WHAT MAY BE SHOWN HERE, AND THE ONE THING THAT MAY NOT.
 *
 * Every figure below is something this client can observe for itself and state truthfully: how
 * much of the grid is covered, how many pairs are joined, how many drags the player has made,
 * how long their quickest board took. None of them is a score, none of them is sent anywhere,
 * and none of them changes what the server pays.
 *
 * A SCORE IS DELIBERATELY ABSENT AND MUST STAY ABSENT. `PlayState` carries no score, no rank and
 * no prize, and a test asserts that `resultCopy` refuses to print them even when handed them.
 * The client is an input device. A score cell in this header would either have to be invented
 * here - a second scoring authority, which is the single thing this whole architecture exists to
 * prevent - or be sent down from the server, which is a protocol change and a decision for the
 * owner rather than a styling one.
 * ---------------------------------------------------------------------------------------- */

/**
 * How far through the current board the player is, as a fraction between 0 and 1.
 *
 * COVERAGE, NOT PAIRS JOINED, and the two genuinely differ: this puzzle is only complete when
 * every square is used as well as every pair joined, so a board with all its pairs joined by
 * short routes can be a long way from finished. A bar driven by pairs would sit at full while the
 * board was refused, which is the shape of complaint that becomes a ticket about the game being
 * broken.
 */
export function boardProgress(input) {
  const { used, cells } = input ?? {};
  if (!positive(cells)) return { fraction: 0, percent: 0 };
  const filled = positive(used) ? Math.min(used, cells) : 0;
  const fraction = filled / cells;
  return { fraction, percent: Math.round(fraction * 100) };
}

/**
 * `4200` -> `"0:04"`. A board time, which is always short.
 *
 * Minutes are kept rather than dropped once a board runs past sixty seconds, because a bare
 * `"73"` beside a label reading "best board" is read as a score.
 */
export function formatBoardTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The quicker of a running best and a board that has just been solved.
 *
 * A REDUCER RATHER THAN A RUNNING VARIABLE IN `app.js`, so the one comparison that decides what a
 * player is told about their own pace can be asserted. It refuses a non-finite or negative
 * elapsed time by keeping the previous best: the elapsed figure is derived from two wall-clock
 * readings, and a device that suspends its timers can produce either.
 */
export function bestBoardTime(previousMs, elapsedMs) {
  const previous = Number.isFinite(previousMs) && previousMs > 0 ? previousMs : null;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return previous;
  if (previous === null) return elapsedMs;
  return Math.min(previous, elapsedMs);
}

/**
 * The three cells of the round header, left to right.
 *
 * TWO OF THEM ARE ALWAYS THE SAME QUESTION - how far am I, how long have I got - and the third is
 * the board's own coverage, which is the only other fact this client holds that a player under a
 * clock acts on. The labels are returned with the values so a caption can never end up over the
 * wrong figure, which is how a "boards" count gets read as a time.
 *
 * `boardTarget` is absent for Circuit Sprint, which has no fixed set, so the first cell answers
 * "how many have I finished" rather than "which one am I on". Inventing a denominator there would
 * be inventing a finishing line the title does not have.
 */
export function roundHeaderCells(input) {
  const { boardsSolved, boardTarget, used, cells } = input ?? {};
  const solved = positive(boardsSolved) ? Math.round(boardsSolved) : 0;
  const target = positive(boardTarget) ? Math.round(boardTarget) : null;
  const coverage = boardProgress({ used, cells });

  return [
    target === null
      ? { key: "board", label: "Solved", value: String(solved) }
      : { key: "board", label: "Board", value: `${Math.min(solved + 1, target)} / ${target}` },
    { key: "clock", label: "Time left", value: null },
    { key: "coverage", label: "Filled", value: `${coverage.percent}%` },
  ];
}

/**
 * The stat tiles beside the board.
 *
 * A TILE IS OMITTED RATHER THAN SHOWN EMPTY. Best board has no value until a board has been
 * solved, and a tile reading "-" next to three real figures reads as a number that failed to
 * load. The caller renders whatever comes back, so the column shrinks honestly.
 */
export function playStatTiles(input) {
  const { boardsSolved, joined, pairs, moves, bestBoardMs } = input ?? {};
  const tiles = [
    {
      key: "paths",
      label: "Paths",
      value: `${positive(joined) ? Math.round(joined) : 0} / ${positive(pairs) ? Math.round(pairs) : 0}`,
    },
    { key: "moves", label: "Moves", value: String(positive(moves) ? Math.round(moves) : 0) },
    {
      key: "solved",
      label: "Boards done",
      value: String(positive(boardsSolved) ? Math.round(boardsSolved) : 0),
    },
  ];

  const best = formatBoardTime(bestBoardTime(null, bestBoardMs));
  if (best) tiles.push({ key: "best", label: "Best board", value: best });
  return tiles;
}

/**
 * Whether Undo is offered, and what it says it will do.
 *
 * WHY THERE IS AN UNDO AND DELIBERATELY NO HINT. Undo removes the path the player drew last. It
 * is strictly weaker than the Clear button that has always been here - the same result is already
 * reachable by touching that pair's terminal and drawing it again - so it changes no rule, gives
 * no information the player did not have, and cannot improve a score. It is an input convenience.
 *
 * A hint is the opposite, and is forbidden outright: it would tell a player something about the
 * solution they had not worked out, which improves a score in a paid contest. The reference
 * design shows it as a consumable with a count, which is the marketplace mechanic the platform's
 * fairness rule names explicitly - "extra time, retries, hints, skips and easier content are
 * not [permitted]". It is not a styling omission and must not be added as one.
 */
export function undoState(input) {
  const { canUndo, locked } = input ?? {};
  if (locked) return { disabled: true, title: "The board is locked." };
  if (!canUndo) return { disabled: true, title: "Nothing to undo yet." };
  return { disabled: false, title: "Remove the path you drew last" };
}
