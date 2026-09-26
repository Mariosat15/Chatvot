/**
 * Circuit - the board: drawing it, and reading the player's finger.
 *
 * WHAT THIS FILE IS ALLOWED TO DECIDE, AND WHAT IT IS NOT
 * ------------------------------------------------------
 * It decides what the player sees and which drags it will accept. It does NOT decide whether a
 * board is solved. The rules live in `src/engine/verify.ts` on the server, and the server's
 * verdict is the only one that scores.
 *
 * That distinction matters because the checks in here look like a second copy of the rules, and
 * "one rule, two copies" is the failure this codebase has already hit five times. The difference
 * is that these copies cannot be *authoritative*: the worst a wrong check here can do is offer the
 * Submit button a moment early or late, and the server then answers with a named refusal which is
 * shown verbatim. A wrong check here can never make a wrong board count as solved.
 *
 * WHY THE PATHS ARE KEPT AS CELL LISTS AND NOT AS A PICTURE
 * --------------------------------------------------------
 * The submission is a list of cells per pair - the same thing the verifier walks. Keeping the
 * drawing derived from that list, rather than the list derived from the drawing, means there is
 * nothing the player can see that the server will not check.
 */

import {
  boardCellPx,
  DRAWN_BOARD_FRAMES,
  frameOverhang,
  newlyJoined,
  skinFrameFor,
  spaceForGrid,
} from "./presentation.js";

/**
 * Ten pairs is the most any grid size produces (`large`: 6-10 since 25 Sep 2026).
 *
 * The first five are the reference sheet's orb colours (11 Sep 2026), in its order; the next
 * three are ours; nine and ten were added when large boards grew to ten pairs. Every hue here is
 * paired with a numeral on the terminal, so the palette is decoration and never the only way to
 * tell two wires apart.
 */
const PAIR_COLOURS = [
  "#0bbdff", // blue
  "#ff2f9b", // pink
  "#1ee58f", // green
  "#ff9800", // orange
  "#9a44ff", // purple
  "#ff4d6d", // rose
  "#2dd4bf", // teal
  "#ffe14d", // yellow
  // Nine and ten follow their tokens (25 Sep 2026): the light blue and light pink they had
  // were too close to pairs 1 and 2 to tell apart under time pressure.
  "#e2e8f0", // ice white
  "#a3e635", // lime
];

/**
 * The terminal artwork: one lit socket per pair number, `token-1.webp` to `token-10.webp`.
 *
 * BACK TO THE ORIGINAL TOKENS (owner, 25 September 2026: "I don't like the new numbers on the
 * board, use the old ones"). The four-state `num-{n}-{state}.webp` pack was wired for one day and
 * is no longer referenced for play. Tokens 9 and 10 were first taken from that pack's idle frames
 * and did not match; the same day they were redrawn in the old set's own style (dark gunmetal
 * bezel, one neon ring, white blocky numeral), so all ten now read as one set.
 *
 * The states survive as a `data-state` attribute on the token image (`idle`, `select`, `connect`,
 * `error`) which `app.css` lights, so the refusal flash still shows without a second picture per
 * number.
 *
 * ONE PER PAIR NUMBER, NOT ONE PER COLOUR. The file has the numeral baked into it, so `token-3` is
 * only ever right for pair 3 - which is why this is indexed by `pairId` with no modulo. A modulo
 * here would draw a "1" on pair 11 and look deliberate. Past ten, `terminalArt` returns null and
 * the socket drawn underneath carries the numeral.
 *
 * WHY THE SOCKET IS DRAWN UNDERNEATH RATHER THAN THE ARTWORK BEING THE TERMINAL. A numeral in
 * every terminal is functional here rather than decorative - see the note on `colourFor`, it is
 * what makes the board playable for a colour-blind player and what makes it playable with no
 * language at all. An `<image>` that fails to arrive draws nothing and reports nothing, and this
 * platform has now had two production faults caused by an asset that 404ed from a stale cache. So
 * the vector socket, with its own numeral, is always drawn: the artwork is an enhancement laid
 * over a board that is already complete and legible without it.
 */
export const TOKEN_STATES = ["idle", "select", "connect", "error"];
const TOKEN_NUMBERS = 10;

const TERMINAL_ART = Array.from(
  { length: TOKEN_NUMBERS },
  (_, index) => "/play/token-" + (index + 1) + ".webp",
);

/** How long a refused terminal wears its error sprite. */
export const TOKEN_ERROR_MS = 700;

/**
 * The generic bezel around the grid, for any shape without a drawn board of its own. Set by
 * `app.js` on the `.board-art` element; listed here so it can be warmed with the rest.
 */
export const FRAME_ART = "/play/board-frame.webp";

/**
 * Every image the board needs, for `app.js` to fetch while the player is still reading the rules.
 *
 * Reason this is worth doing at all: the round's clock starts on the server when Start is pressed,
 * so anything the board downloads AFTER that comes out of the player's score. It is only a few
 * kilobytes, but it is a few kilobytes the player would be paying for.
 *
 * The three drawn boards are read from `presentation.js` rather than listed again, so a fourth
 * size gets warmed and served-tested by existing.
 */
export const BOARD_ART = [
  FRAME_ART,
  ...DRAWN_BOARD_FRAMES.map((frame) => frame.file),
  ...TERMINAL_ART,
];

/**
 * Feedback overlays warmed with the board. Kept OUT of `BOARD_ART` so the serve/warm tests that
 * assert one entry per grid size stay about bezels and tokens, not celebration chrome.
 *
 * Trimmed 26 Sep 2026: invalid flash, complete burst, and intro howto are unused (owner removed
 * the messy error/complete overlays). Warm only what paint still references.
 */
export const FX_ART = [
  "/play/fx-lock-on.webp",
  "/play/fx-lock-on-pulse.webp",
  "/play/fx-lock-on-hit.webp",
  "/play/fx-board-flash.webp",
  "/play/fx-board-complete.webp",
  "/play/fx-board-complete-soft.svg",
  "/play/fx-timer-urgent.webp",
  "/play/fx-circuit-sealed.webp",
];

/** The token image for one pair's terminal, or null past the tenth number. */
export function terminalArt(pairId) {
  return Number.isInteger(pairId) && pairId >= 0 ? (TERMINAL_ART.at(pairId) ?? null) : null;
}

/**
 * Colour-blind second cue on the wire: dash/hatch patterns indexed by pair.
 * Colour stays the primary read; the dash is a backup under time pressure on 8×8.
 */
const WIRE_DASH = [
  null, // solid
  "10 7",
  "3 6",
  "14 4 3 4",
  "7 4 2 4",
  "4 3 1 3 1 3",
  "18 5",
  "5 3 5 8",
  "12 3 2 3",
  "2 4 2 4 8 4",
];

function dashFor(pairId) {
  return WIRE_DASH[pairId % WIRE_DASH.length];
}

/** Medium (6) and large (8) get thicker conductors so dense routes stay readable. */
function denseGrid(puzzle) {
  return Boolean(puzzle && puzzle.width >= 6);
}

/*
 * A numeral inside every terminal, and it is not decoration.
 *
 * Two independent reasons, either of which alone would justify it. Colour-blind players cannot be
 * asked to tell sky from teal under time pressure - and this is a paid contest, so "mostly
 * distinguishable" is not good enough. And section 12 of the specification requires the game to be
 * playable with no language: a digit is the one label that needs no translation.
 */
function colourFor(pairId) {
  return PAIR_COLOURS[pairId % PAIR_COLOURS.length];
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * How long a join pulse lives before it is taken out of the document.
 *
 * It must be at least as long as the `join-pulse` animation in `app.css`, or the ring is removed
 * mid-flight and the pulse looks like a rendering glitch. It is not much longer either: these are
 * the only nodes on the board that accumulate, and a Sprint round joins a pair every few seconds.
 */
const JOIN_PULSE_MS = 520;

function key(cell) {
  return cell[0] + "," + cell[1];
}

function same(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function adjacent(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

function element(name, attributes) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    node.setAttribute(attribute, String(value));
  }
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * The gradients the stylesheet paints the grid with.
 *
 * In the document rather than in CSS because a gradient FILL cannot be expressed in CSS alone -
 * `fill: url(#cell-face)` needs something with that id to exist. They are rebuilt with the static
 * layer, which happens once per board, so their cost is not on the drag path.
 */
function defs() {
  const node = element("defs", {});

  const cellFace = element("linearGradient", {
    id: "cell-face",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
  });
  // The reference's cell face, `#0b274b` to `#061a37`, with a lit top stop.
  cellFace.appendChild(element("stop", { offset: "0", "stop-color": "#123a6b" }));
  cellFace.appendChild(element("stop", { offset: "0.55", "stop-color": "#0b274b" }));
  cellFace.appendChild(element("stop", { offset: "1", "stop-color": "#061a37" }));
  node.appendChild(cellFace);

  const socketFace = element("radialGradient", {
    id: "socket-face",
    cx: "0.5",
    cy: "0.34",
    r: "0.72",
  });
  socketFace.appendChild(element("stop", { offset: "0", "stop-color": "#16233c" }));
  socketFace.appendChild(element("stop", { offset: "1", "stop-color": "#05090f" }));
  node.appendChild(socketFace);

  return node;
}

/**
 * Creates a board bound to an `<svg>` element.
 *
 * `onChange` fires after any change the player made, so the caller can re-render its own controls
 * without this file knowing anything about them.
 */
export function createBoard(svg, onChange) {
  /** @type {{index:number,width:number,height:number,pairs:{id:number,a:number[],b:number[]}[]}|null} */
  let puzzle = null;
  /** @type {Map<number, number[][]>} pairId -> cells */
  let paths = new Map();
  /** @type {Map<string, number>} cell key -> pairId */
  let owner = new Map();
  /** @type {Map<string, number>} cell key -> pairId, for terminals only. Never overwritable. */
  let terminals = new Map();

  let cellPx = 48;
  let dragging = null;
  let locked = false;
  /**
   * @type {number[]} pair ids, oldest first, each appearing once.
   *
   * WHY THE ORDER IS THE ORDER PAIRS WERE DRAWN AND NOT THE ORDER THEY WERE JOINED. Undo says it
   * removes the path drawn last, and a player who starts a route, abandons it half way and moves
   * on has still drawn it - so keying on "joined" would silently skip their most recent work and
   * remove something from several moves ago instead. A control that undoes the wrong thing is
   * worse than no control, because the player then has to repair it.
   */
  let drawOrder = [];
  /** @type {{cells:Node,traces:Node,marks:Node,sockets:Node,flashes:Node}|null} Set by `build`. */
  let layers = null;
  /** @type {Map<number, number[][]>} pairId -> the two terminal centres, for the join pulse. */
  let terminalCentres = new Map();
  /** @type {Map<number, {node: Element, state: string}[]>} pairId -> its two token images, rebuilt by `build`. */
  let tokenFaces = new Map();
  /** @type {Map<number, number>} pairId -> time its error sprite ends. */
  let errorUntil = new Map();
  let errorTimer = null;
  /**
   * Wire SVG nodes keyed by pair, so a drag UPDATES `points` instead of destroying every
   * polyline on the board. Four strokes: halo / casing / filament / pill segments (neon tube).
   * @type {Map<number, {halo: Element, wire: Element, core: Element, segments: Element}>}
   */
  let wireNodes = new Map();
  /** @type {Map<string, Element>} unused-cell pips, added/removed one at a time. */
  let pipNodes = new Map();
  /** Soft coloured wash under a path cell (shows over drawn board art). */
  /** @type {Map<string, Element>} */
  let pathGlowNodes = new Map();
  /**
   * Cached inverse of `getScreenCTM()`. Calling getScreenCTM every pointermove forces a layout
   * pass; caching until the next `build` keeps cell lookup in arithmetic only.
   * @type {{a:number,b:number,c:number,d:number,e:number,f:number}|null}
   */
  let inverseCtm = null;
  let paintRaf = 0;
  /** @type {number[]} */
  let queuedArrived = [];
  /** @type {Record<string, unknown>|null} */
  let queuedChange = null;
  /** Local board-complete burst fires once per puzzle, until clear/undo breaks completeness. */
  let celebratedComplete = false;

  /** Which of the four sprites a pair's terminals wear right now. Error outranks everything. */
  function tokenState(pairId, now) {
    const until = errorUntil.get(pairId);
    if (until !== undefined && until > now) return "error";
    if (dragging === pairId) return "select";
    const pair = puzzle ? puzzle.pairs.find((entry) => entry.id === pairId) : null;
    return pair && isJoined(pair) ? "connect" : "idle";
  }

  /**
   * Mark each token with its state for `app.css` to light. Only a `data-state` attribute changes,
   * and only when it differs, so this is cheap enough to run on every pointer move.
   */
  function paintTokens() {
    const now = Date.now();
    for (const [pairId, faces] of tokenFaces) {
      const state = tokenState(pairId, now);
      for (const face of faces) {
        if (face.state === state) continue;
        face.state = state;
        face.node.setAttribute("data-state", state);
      }
    }
  }

  /** Show the error sprite on these pairs for a moment, then settle back. */
  function flashError(pairIds) {
    if (!puzzle) return;
    const ids = pairIds ?? puzzle.pairs.map((pair) => pair.id);
    const until = Date.now() + TOKEN_ERROR_MS;
    for (const id of ids) errorUntil.set(id, until);
    paintTokens();
    if (errorTimer !== null) clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
      errorTimer = null;
      errorUntil = new Map();
      paintTokens();
    }, TOKEN_ERROR_MS);
  }

  /**
   * Soft token shake when a drag is refused — no red tip polyline, no HUD flash image.
   * Those read as “messy error lines” on screen (owner, 26 Sep 2026). Sound still fires via
   * `onChange({ invalid: true })`.
   */
  function flashInvalidAt(_pairId, _cell) {
    onChange({ invalid: true });
  }

  /** Soft lock-on pulse on the terminal the player just pressed to start a route. */
  function showLockOn(pairId, cell) {
    if (!layers || !cellPx) return;
    const cx = centre(cell[0]);
    const cy = centre(cell[1]);
    // Reason: reference lock-on is larger than the cell; 1.35 sat under the token art.
    const size = cellPx * 1.65;
    const pulse = element("image", {
      href: "/play/fx-lock-on-pulse.webp",
      x: cx - size / 2,
      y: cy - size / 2,
      width: size,
      height: size,
      class: "fx-lock-on",
      "pointer-events": "none",
    });
    const hit = element("image", {
      href: "/play/fx-lock-on-hit.webp",
      x: cx - size * 0.42,
      y: cy - size * 0.42,
      width: size * 0.84,
      height: size * 0.84,
      class: "fx-lock-on-hit",
      "pointer-events": "none",
    });
    layers.flashes.appendChild(pulse);
    layers.flashes.appendChild(hit);
    setTimeout(() => {
      try {
        layers.flashes.removeChild(pulse);
        layers.flashes.removeChild(hit);
      } catch {
        /* board rebuilt */
      }
    }, JOIN_PULSE_MS + 80);
  }

  /** Local board-complete burst removed 26 Sep 2026 — owner disliked the checkmark wash. */

  /** Tiny tip that follows the finger while a wire is being drawn (Phase J trail). */
  let trailTip = null;

  function showTrailAt(cell) {
    if (!motionFxOn() || !layers || !cellPx || !cell) return;
    const cx = centre(cell[0]);
    const cy = centre(cell[1]);
    const r = Math.max(2.5, cellPx * 0.12);
    if (!trailTip || !trailTip.parentNode) {
      trailTip = element("circle", {
        cx,
        cy,
        r,
        class: "fx-trail-tip",
        "pointer-events": "none",
      });
      layers.flashes.appendChild(trailTip);
    } else {
      trailTip.setAttribute("cx", String(cx));
      trailTip.setAttribute("cy", String(cy));
      trailTip.setAttribute("r", String(r));
    }
  }

  function hideTrail() {
    if (!trailTip || !layers) return;
    try {
      layers.flashes.removeChild(trailTip);
    } catch {
      /* already gone */
    }
    trailTip = null;
  }

  /** Ghost polyline that rewinds when Undo fires (Phase J). */
  function spawnUndoRewind(pairId, cells) {
    if (!layers || !cellPx || cells.length < 2) return;
    const points = cells.map((cell) => centre(cell[0]) + "," + centre(cell[1])).join(" ");
    const ghost = element("polyline", {
      points,
      fill: "none",
      stroke: colourFor(pairId),
      "stroke-width": Math.max(3, Math.round(cellPx * 0.28)),
      "stroke-dasharray": "8 6",
      class: "fx-undo-rewind",
      "pointer-events": "none",
    });
    layers.flashes.appendChild(ghost);
    setTimeout(() => {
      try {
        layers.flashes.removeChild(ghost);
      } catch {
        /* board rebuilt */
      }
    }, 300);
  }

  /**
   * Lite FX / reduced-motion: skip wake, spark, ripple, trail tip. Lock-on stays — it is the
   * only cue that says "this terminal is armed". Gameplay paths never branch on this flag.
   */
  let fxMotion = true;
  function motionFxOn() {
    if (!fxMotion) return false;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    } catch {
      /* browsers without matchMedia keep motion */
    }
    return true;
  }

  /** Soft wake rings when a new board enters (Phase J charge — CSS circles, not a WebP wash). */
  function playBoardEnter() {
    if (!motionFxOn() || !layers || !puzzle || !cellPx) return;
    for (const pair of puzzle.pairs) {
      for (const [cx, cy] of terminalCentres.get(pair.id) || []) {
        const wake = element("circle", {
          cx,
          cy,
          r: cellPx * 0.2,
          class: "fx-board-wake",
          "pointer-events": "none",
        });
        layers.flashes.appendChild(wake);
        setTimeout(() => {
          try {
            layers.flashes.removeChild(wake);
          } catch {
            /* board rebuilt */
          }
        }, 420);
      }
    }
  }

  /** One-frame pip pop when a cell fills (Phase J coverage ripple). */
  function spawnCoverageRipple(x, y) {
    if (!motionFxOn() || !layers || !cellPx) return;
    const ripple = element("circle", {
      cx: centre(x),
      cy: centre(y),
      r: Math.max(3, cellPx * 0.16),
      class: "fx-cell-ripple",
      "pointer-events": "none",
    });
    layers.flashes.appendChild(ripple);
    setTimeout(() => {
      try {
        layers.flashes.removeChild(ripple);
      } catch {
        /* board rebuilt */
      }
    }, 220);
  }

  /** Sparks travel both terminals → midpoint when a pair locks (Phase J, on top of join pulse). */
  function spawnJoinSparks(pairId) {
    if (!motionFxOn() || !layers || !cellPx) return;
    const centres = terminalCentres.get(pairId);
    if (!centres || centres.length < 2) return;
    const [a, b] = centres;
    const midX = (a[0] + b[0]) / 2;
    const midY = (a[1] + b[1]) / 2;
    for (const [sx, sy] of [a, b]) {
      const spark = element("circle", {
        cx: sx,
        cy: sy,
        r: Math.max(2.5, cellPx * 0.1),
        class: "fx-join-spark",
        "pointer-events": "none",
        // Reason: setAttribute, not `.style.setProperty` — the board test harness builds
        // minimal SVG nodes without a CSSStyleDeclaration, and setProperty would throw mid-join.
        style: `--spark-dx: ${midX - sx}px; --spark-dy: ${midY - sy}px`,
      });
      layers.flashes.appendChild(spark);
      setTimeout(() => {
        try {
          layers.flashes.removeChild(spark);
        } catch {
          /* board rebuilt */
        }
      }, 340);
    }
  }

  function rebuildOwnership() {
    owner = new Map();
    for (const [pairId, cells] of paths) {
      for (const cell of cells) owner.set(key(cell), pairId);
    }
  }

  function pathOf(pairId) {
    return paths.get(pairId) || [];
  }

  /** Record that `pairId` is the pair most recently drawn, keeping one entry per pair. */
  function noteDrawn(pairId) {
    drawOrder = drawOrder.filter((entry) => entry !== pairId);
    drawOrder.push(pairId);
  }

  /**
   * The most recently drawn pair, or `null` when nothing has been drawn.
   *
   * THE LAST ENTRY AND NOTHING CLEVERER, which is only correct because every writer of `drawOrder`
   * keeps it honest: `noteDrawn` is the one place a pair is added, and the three places a path
   * disappears - undo, clear, a new board - each remove the matching entry in the same breath. So
   * an entry here always names a pair with a real path.
   *
   * The first version walked backwards skipping entries whose paths had gone. It read as careful
   * and it was unreachable - nothing can empty one path without also removing its entry - and it
   * made the resets in `clear` and `setPuzzle` unprobeable, because each guard silently covered
   * for the other. Deleting it is what lets a test see whether those resets actually happen.
   */
  function lastDrawn() {
    return drawOrder.length > 0 ? drawOrder.at(-1) : null;
  }

  /** A pair is joined when its path runs terminal to terminal, in either direction. */
  function isJoined(pair) {
    const cells = pathOf(pair.id);
    if (cells.length < 2) return false;
    const first = cells[0];
    const last = cells[cells.length - 1];
    return (
      (same(first, pair.a) && same(last, pair.b)) ||
      (same(first, pair.b) && same(last, pair.a))
    );
  }

  function joinedCount() {
    if (!puzzle) return 0;
    return puzzle.pairs.filter(isJoined).length;
  }

  /** Which pairs are joined right now, so a caller can compare two moments. */
  function joinedIds() {
    if (!puzzle) return [];
    return puzzle.pairs.filter(isJoined).map((pair) => pair.id);
  }

  /**
   * Whether the board is worth submitting.
   *
   * Both halves of the win condition, because full coverage is a rule of this puzzle rather than a
   * bonus: every pair joined AND every cell used. Offering Submit on "all joined" alone would send
   * boards the server refuses with `incomplete_coverage`, which reads to the player as the game
   * being broken rather than as the puzzle being unfinished.
   */
  function isComplete() {
    if (!puzzle) return false;
    if (joinedCount() !== puzzle.pairs.length) return false;
    return owner.size === puzzle.width * puzzle.height;
  }

  /** Truncate a path so that `cell` and everything drawn after it is released. */
  function truncateBefore(pairId, cell) {
    const cells = pathOf(pairId);
    const at = cells.findIndex((entry) => same(entry, cell));
    if (at < 0) return;
    paths.set(pairId, cells.slice(0, at));
    rebuildOwnership();
  }

  /**
   * Can the pair being dragged move into this cell?
   *
   * A terminal belonging to another pair is the one hard refusal - it is that pair's fixed anchor,
   * so routing through it would make their board unsolvable in a way they did not do and cannot
   * see. Another pair's ordinary path cell is fine and takes it over, which is what makes the
   * puzzle playable: without it, every mistake would need a manual clear first.
   */
  function canEnter(pairId, cell) {
    const cellKey = key(cell);
    const terminalOwner = terminals.get(cellKey);
    if (terminalOwner !== undefined && terminalOwner !== pairId) {
      flashError([pairId, terminalOwner]);
      flashInvalidAt(pairId, cell);
      return false;
    }
    return true;
  }

  function extendTo(pairId, cell) {
    const cells = pathOf(pairId);
    if (cells.length === 0) return false;

    const last = cells[cells.length - 1];
    if (same(last, cell)) return false;

    // Once the wire has reached the other number, do not grow past it. A finger that
    // overshoots the token used to draw the line out the far side of the pair.
    const goal = oppositeTerminal(pairId, cells);
    const retracting = cells.length >= 2 && same(cells[cells.length - 2], cell);
    if (goal && same(last, goal) && !retracting) return false;

    // Dragging back over the cell before last retracts, which is how a mistake is undone without
    // starting the path again. Checked before the reuse rule below, or a retraction would be
    // refused as revisiting a cell.
    if (cells.length >= 2 && same(cells[cells.length - 2], cell)) {
      cells.pop();
      paths.set(pairId, cells);
      rebuildOwnership();
      return true;
    }

    if (!adjacent(last, cell)) return false;
    if (!canEnter(pairId, cell)) return false;
    if (cells.some((entry) => same(entry, cell))) return false;

    const existing = owner.get(key(cell));
    if (existing !== undefined && existing !== pairId) truncateBefore(existing, cell);

    cells.push(cell);
    paths.set(pairId, cells);
    rebuildOwnership();
    return true;
  }

  /**
   * Walk from the current end towards `cell` one step at a time.
   *
   * A fast drag on a phone reports pointer positions several cells apart - the browser coalesces
   * moves, and nothing about the gap says the player meant to skip. Refusing a non-adjacent move
   * would make the game feel unresponsive exactly when the player is trying to be quick, which on
   * a timed title is the difference between skill and input lag. Stepping x first then y keeps it
   * predictable, and every step still goes through the same rules as a slow drag.
   */
  function walkTowards(pairId, cell) {
    let moved = false;
    for (let guard = 0; guard < 64; guard++) {
      const cells = pathOf(pairId);
      if (cells.length === 0) return moved;
      const last = cells[cells.length - 1];
      if (same(last, cell)) return moved;

      const dx = Math.sign(cell[0] - last[0]);
      const dy = Math.sign(cell[1] - last[1]);
      // Step on the axis the finger has moved further along. Always stepping sideways
      // first sent the wire onto the neighbouring column when the drag was mostly vertical.
      const step =
        Math.abs(cell[0] - last[0]) >= Math.abs(cell[1] - last[1]) && dx !== 0
          ? [last[0] + dx, last[1]]
          : [last[0], last[1] + dy];

      if (!extendTo(pairId, step)) return moved;
      moved = true;
    }
    return moved;
  }

  function oppositeTerminal(pairId, cells) {
    if (!puzzle || cells.length === 0) return null;
    const pair = puzzle.pairs.find((entry) => entry.id === pairId);
    if (!pair) return null;
    if (same(cells[0], pair.a)) return pair.b;
    if (same(cells[0], pair.b)) return pair.a;
    return null;
  }

  function refreshInverseCtm() {
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      inverseCtm = null;
      return;
    }
    try {
      const inv = ctm.inverse();
      inverseCtm = {
        a: Number(inv.a) || 0,
        b: Number(inv.b) || 0,
        c: Number(inv.c) || 0,
        d: Number(inv.d) || 0,
        e: Number(inv.e) || 0,
        f: Number(inv.f) || 0,
      };
      // Fake / degenerate CTMs may only expose `a` (uniform scale). Treat missing `d` as `a`.
      if (!inv.d && inv.a) inverseCtm.d = Number(inv.a) || 0;
    } catch {
      inverseCtm = null;
    }
  }

  function cellAt(event) {
    if (!puzzle || !cellPx) return null;
    // Map through the SVG's own transform. Measuring the element's border box against
    // the grid counted the bezel and the art overhang, so a drag on one side of a token
    // landed on the cell on the other side.
    if (!inverseCtm) refreshInverseCtm();
    if (!inverseCtm) return null;
    const m = inverseCtm;
    const localX = m.a * event.clientX + m.c * event.clientY + m.e;
    const localY = m.b * event.clientX + m.d * event.clientY + m.f;
    const x = Math.floor(localX / cellPx);
    const y = Math.floor(localY / cellPx);
    if (x < 0 || y < 0 || x >= puzzle.width || y >= puzzle.height) return null;
    return [x, y];
  }

  function onPointerDown(event) {
    if (locked || !puzzle) return;
    const cell = cellAt(event);
    if (!cell) return;

    const cellKey = key(cell);
    const terminalOwner = terminals.get(cellKey);

    if (terminalOwner !== undefined) {
      // Starting from a terminal always restarts that pair's path. The alternative - continuing an
      // existing one - is ambiguous when the path already reaches the other terminal, and a player
      // who touches a terminal is telling us they want to redraw it.
      paths.set(terminalOwner, [cell]);
      rebuildOwnership();
      dragging = terminalOwner;
      showLockOn(terminalOwner, cell);
    } else {
      const pathOwner = owner.get(cellKey);
      if (pathOwner === undefined) return;
      // Touching a cell part-way along a path rewinds it to there and carries on from that point.
      truncateBefore(pathOwner, cell);
      paths.set(pathOwner, pathOf(pathOwner).concat([cell]));
      rebuildOwnership();
      dragging = pathOwner;
    }

    noteDrawn(dragging);

    // Pointer capture, so a drag that leaves the grid - which happens constantly on a phone, where
    // the finger is wider than a cell - keeps being tracked instead of silently ending.
    if (event.pointerId !== undefined && svg.setPointerCapture) {
      try {
        svg.setPointerCapture(event.pointerId);
      } catch {
        /* Safari refuses capture for some pointer types; tracking still works without it. */
      }
    }
    event.preventDefault();
    // Sync paint on press so the first cell lights immediately; moves coalesce below.
    flushPaint();
    paint();
    onChange();
  }

  /*
   * The one handler that can newly join a pair, which is why the transition is only computed here.
   *
   * Pressing cannot: starting on a terminal sets the path to that single cell, and pressing part
   * way along a path truncates it. Releasing mutates nothing. So a "which pairs just landed"
   * check in the other three would be dead code that reads as thoroughness.
   */
  function onPointerMove(event) {
    if (locked || dragging === null) return;
    const cell = cellAt(event);
    if (!cell) return;
    const before = joinedIds();
    if (walkTowards(dragging, cell)) {
      const arrived = newlyJoined(before, joinedIds());
      showTrailAt(cell);
      // Coalesce paint + chrome updates to one animation frame. Without this, a fast finger
      // rebuilds every wire and every unused pip dozens of times per second and the drag feels
      // heavy even though the rules work (owner, 25 Sep 2026).
      schedulePaint(arrived, {
        justJoined: arrived,
        complete: isComplete(),
      });
    }
    event.preventDefault();
  }

  function onPointerUp() {
    if (dragging === null) return;
    dragging = null;
    hideTrail();
    // Fold `settled` into any pending join so streak / pair notes are not wiped by a second
    // onChange that only carries settled.
    queuedChange = { ...(queuedChange || {}), settled: true };
    flushPaint();
  }

  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);

  const centre = (value) => value * cellPx + cellPx / 2;

  /**
   * Everything that cannot change while the player drags: the cells, the junction stars and the
   * terminals with their artwork. Built once per board and once per resize.
   *
   * WHY THIS IS SPLIT FROM `paint` AT ALL, since the old single `render` was correct. A drag emits
   * a pointer move for every few pixels of finger travel, and each one used to rebuild the entire
   * board - on a 6x6 that is 36 cells plus up to 16 terminal nodes destroyed and recreated, plus
   * eight `<image>` elements whose `href` the browser must resolve again, all to move one line by
   * one square. It survived because the cache made the images cheap, so the cost was invisible on
   * a fast machine and only showed as stutter on a phone, which is where this game is played and
   * where the clock is the score. The static half now outlives the drag; only the wires are
   * redrawn.
   */
  function build() {
    clear(svg);
    layers = null;
    wireNodes = new Map();
    pipNodes = new Map();
    pathGlowNodes = new Map();
    inverseCtm = null;
    if (!puzzle) return;

    const width = puzzle.width * cellPx;
    const height = puzzle.height * cellPx;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    svg.appendChild(defs());

    const cells = element("g", {
      class: "layer-cells" + (denseGrid(puzzle) ? " dense" : ""),
    });
    const traces = element("g", { class: "layer-traces" });
    const marks = element("g", { class: "layer-marks" });
    const sockets = element("g", { class: "layer-terminals" });
    /*
     * A fifth layer for the join pulses, and it is the only one `paint` does not clear.
     *
     * That is the whole reason it exists. A pulse appended to the traces layer would be wiped by
     * the very next pointer move - about sixteen milliseconds later if the finger is still
     * travelling - so the confirmation that a wire landed would appear only to a player who
     * happened to stop. Put here it plays out, and it is removed by its own timer.
     */
    const flashes = element("g", { class: "layer-flashes" });
    svg.appendChild(cells);
    svg.appendChild(traces);
    svg.appendChild(marks);
    svg.appendChild(flashes);
    svg.appendChild(sockets);
    layers = { cells, traces, marks, sockets, flashes };

    /*
     * Two rects per cell: a face carrying a wide soft edge, and a thin bright outline over it.
     *
     * Two rather than one because a lit panel needs a glow, and the honest way to draw a glow is
     * an SVG filter - which would be a per-cell blur, re-rasterised whenever the layer is
     * composited. On a phone under a clock that is the wrong trade. A wide translucent stroke
     * under a narrow opaque one produces the same read for the cost of one extra node in a layer
     * that is built once and never touched during a drag.
     */
    const inset = Math.max(1, cellPx * 0.045);
    const radius = Math.round(cellPx * 0.2);
    for (let y = 0; y < puzzle.height; y++) {
      for (let x = 0; x < puzzle.width; x++) {
        const at = {
          x: x * cellPx + inset,
          y: y * cellPx + inset,
          width: cellPx - inset * 2,
          height: cellPx - inset * 2,
          rx: radius,
        };
        cells.appendChild(
          element("rect", { ...at, "stroke-width": Math.max(2, cellPx * 0.09), class: "cell" }),
        );
        cells.appendChild(
          element("rect", { ...at, "stroke-width": Math.max(1, cellPx * 0.03), class: "cell-lip" }),
        );
      }
    }

    /*
     * The four-point stars where the grid lines cross, in ONE path node rather than one per
     * junction. A 6x6 grid has 25 of them and an 8x8 has 49, redrawn on every resize; as separate
     * nodes they would be the largest thing in the static layer for something the player never
     * touches. A compound `d` costs one element whatever the grid size.
     */
    const spike = Math.max(2, cellPx * 0.075);
    let stars = "";
    for (let y = 1; y < puzzle.height; y++) {
      for (let x = 1; x < puzzle.width; x++) {
        const cx = x * cellPx;
        const cy = y * cellPx;
        stars +=
          "M" +
          cx +
          " " +
          (cy - spike) +
          "L" +
          (cx + spike * 0.34) +
          " " +
          cy +
          "L" +
          cx +
          " " +
          (cy + spike) +
          "L" +
          (cx - spike * 0.34) +
          " " +
          cy +
          "Z";
      }
    }
    if (stars) cells.appendChild(element("path", { d: stars, class: "junction" }));

    terminalCentres = new Map();
    tokenFaces = new Map();
    for (const pair of puzzle.pairs) {
      const centres = [];
      for (const cell of [pair.a, pair.b]) {
        const cx = centre(cell[0]);
        const cy = centre(cell[1]);
        centres.push([cx, cy]);
        sockets.appendChild(socket(pair.id, cx, cy));
      }
      // Recorded here rather than recomputed on a join: `cellPx` moves with a resize, so a pulse
      // drawn from a stale figure would appear beside the terminal instead of on it.
      terminalCentres.set(pair.id, centres);
    }

    // After the SVG has width/height and is in the tree - getScreenCTM needs that.
    refreshInverseCtm();
  }

  /**
   * A ring expanding out of each end of a pair that has just been joined.
   *
   * WHY THESE ARE FRESH NODES RATHER THAN A CLASS ON THE SOCKET. Re-triggering a CSS animation on
   * an element that already carries the class needs the class removed, a layout read to flush it,
   * and the class added again - and that layout read would land in the middle of a drag, which is
   * the one thing the layer split exists to keep cheap. A node created with the class on it
   * animates once, on its own, with nothing forced.
   *
   * Under `prefers-reduced-motion` the stylesheet hides them outright: the sound and the wire's
   * own colour already say the pair is connected, so nothing is lost but the movement.
   */
  function pulseTerminals(pairId) {
    if (!layers) return;
    const layer = layers.flashes;
    for (const [cx, cy] of terminalCentres.get(pairId) || []) {
      const ring = element("circle", {
        cx,
        cy,
        r: cellPx * 0.32,
        fill: "none",
        stroke: colourFor(pairId),
        "stroke-width": Math.max(2, cellPx * 0.07),
        class: "join-pulse",
      });
      layer.appendChild(ring);
      setTimeout(() => {
        try {
          layer.removeChild(ring);
        } catch {
          /*
           * The board was rebuilt between the pulse starting and this firing - the next board
           * arrived, or the window was resized - so the ring went with its layer. The real DOM
           * throws when asked to remove a node that is no longer a child, and a rebuild is a
           * completely ordinary thing to happen inside half a second.
           */
        }
      }, JOIN_PULSE_MS);
    }
    spawnJoinSparks(pairId);
  }

  /** One terminal: a lit socket, its numeral, and the artwork laid over both. */
  function socket(pairId, cx, cy) {
    const colour = colourFor(pairId);
    const group = element("g", { class: "terminal" });

    group.appendChild(
      element("circle", { cx, cy, r: cellPx * 0.46, fill: colour, class: "socket-bloom" }),
    );
    group.appendChild(
      element("circle", {
        cx,
        cy,
        r: cellPx * 0.37,
        fill: "url(#socket-face)",
        stroke: colour,
        "stroke-width": Math.max(2, cellPx * 0.06),
        class: "socket-rim",
      }),
    );
    group.appendChild(
      element("circle", {
        cx,
        cy,
        r: cellPx * 0.28,
        fill: "none",
        stroke: colour,
        "stroke-width": Math.max(1, cellPx * 0.03),
        class: "socket-ring",
      }),
    );

    const label = element("text", {
      x: cx,
      y: cy,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": Math.round(cellPx * 0.38),
      class: "terminal-label",
    });
    label.textContent = String(pairId + 1);
    group.appendChild(label);

    const art = terminalArt(pairId);
    if (art) {
      const size = cellPx * 0.94;
      const state = tokenState(pairId, Date.now());
      const face = element("image", {
        href: art,
        x: cx - size / 2,
        y: cy - size / 2,
        width: size,
        height: size,
        class: "terminal-art token-face",
        "data-state": state,
      });
      group.appendChild(face);
      const faces = tokenFaces.get(pairId) ?? [];
      faces.push({ node: face, state });
      tokenFaces.set(pairId, faces);
    }

    return group;
  }

  /**
   * Ensure the three stroke nodes for one pair exist, then set their `points`.
   *
   * WHY UPDATE RATHER THAN RECREATE. The previous `paint` cleared the whole traces layer and
   * rebuilt every wire on every cell of a drag. On an 8x8 with ten pairs that is thirty polylines
   * destroyed and recreated per pointer event - cheap on a desktop, heavy on a phone under a
   * clock. Mutating `points` keeps the same nodes and lets the browser redraw only the path.
   */
  function syncWire(pairId, cells, flash) {
    if (!layers) return;
    if (cells.length < 2) {
      const stale = wireNodes.get(pairId);
      if (!stale) return;
      layers.traces.removeChild(stale.halo);
      layers.traces.removeChild(stale.wire);
      layers.traces.removeChild(stale.core);
      layers.traces.removeChild(stale.segments);
      wireNodes.delete(pairId);
      return;
    }

    const points = cells.map((cell) => centre(cell[0]) + "," + centre(cell[1])).join(" ");
    const colour = colourFor(pairId);
    const thick = denseGrid(puzzle);
    // Reason: owner ref (26 Sep) — neon tubes with a wide glow, thick casing, bright filament,
    // and short pill segments along the wire. Wider than the prior 0.6/0.3/0.07 set.
    const haloW = Math.round(cellPx * (thick ? 0.92 : 0.8));
    const wireW = Math.round(cellPx * (thick ? 0.5 : 0.42));
    const coreW = Math.max(2, Math.round(cellPx * (thick ? 0.16 : 0.13)));
    const segW = Math.max(1, Math.round(cellPx * (thick ? 0.07 : 0.055)));
    const segDash =
      Math.round(cellPx * 0.2) + " " + Math.round(cellPx * 0.16);
    // Colour-blind dash stays on the coloured casing only — segments keep their own rhythm.
    const dash = dashFor(pairId);
    const pair = puzzle && puzzle.pairs ? puzzle.pairs.find((entry) => entry.id === pairId) : null;
    // Reason: complete pulse is flourish only — Lite FX / reduced-motion skip the class so the
    // wire stays visible without animating (display:none on .complete would hide the tube).
    const complete = Boolean(pair && isJoined(pair) && motionFxOn());
    let nodes = wireNodes.get(pairId);
    if (!nodes) {
      const halo = element("polyline", {
        points,
        fill: "none",
        stroke: colour,
        "stroke-width": haloW,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "trace-halo",
      });
      const wireAttrs = {
        points,
        fill: "none",
        stroke: colour,
        "stroke-width": wireW,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "trace",
      };
      if (dash) wireAttrs["stroke-dasharray"] = dash;
      const wire = element("polyline", wireAttrs);
      const core = element("polyline", {
        points,
        fill: "none",
        stroke: "#f4fbff",
        "stroke-width": coreW,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "trace-core",
      });
      const segments = element("polyline", {
        points,
        fill: "none",
        stroke: "#ffffff",
        "stroke-width": segW,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-dasharray": segDash,
        class: "trace-segments",
      });
      layers.traces.appendChild(halo);
      layers.traces.appendChild(wire);
      layers.traces.appendChild(core);
      layers.traces.appendChild(segments);
      nodes = { halo, wire, core, segments };
      wireNodes.set(pairId, nodes);
    } else {
      nodes.halo.setAttribute("points", points);
      nodes.halo.setAttribute("stroke", colour);
      nodes.halo.setAttribute("stroke-width", String(haloW));
      nodes.wire.setAttribute("points", points);
      nodes.wire.setAttribute("stroke", colour);
      nodes.wire.setAttribute("stroke-width", String(wireW));
      if (dash) nodes.wire.setAttribute("stroke-dasharray", dash);
      else nodes.wire.removeAttribute("stroke-dasharray");
      nodes.core.setAttribute("points", points);
      nodes.core.setAttribute("stroke-width", String(coreW));
      nodes.segments.setAttribute("points", points);
      nodes.segments.setAttribute("stroke-width", String(segW));
      nodes.segments.setAttribute("stroke-dasharray", segDash);
    }

    const surge = flash ? " arrived" : "";
    const done = complete ? " complete" : "";
    nodes.halo.setAttribute("class", "trace-halo" + surge + done);
    nodes.wire.setAttribute("class", "trace" + done);
    nodes.core.setAttribute("class", "trace-core" + surge + done);
    nodes.segments.setAttribute("class", "trace-segments" + done);
  }

  /** Add or remove unused-cell pips without clearing the whole marks layer. */
  function syncPips() {
    if (!layers || !puzzle) return;
    const want = new Set();
    for (let y = 0; y < puzzle.height; y++) {
      for (let x = 0; x < puzzle.width; x++) {
        const cellKey = key([x, y]);
        if (owner.has(cellKey)) continue;
        want.add(cellKey);
        if (pipNodes.has(cellKey)) continue;
        // Reason: owner ref cyan guide dots — slightly larger + brighter than 0.055.
        const pip = element("circle", {
          cx: centre(x),
          cy: centre(y),
          r: Math.max(2, Math.round(cellPx * 0.07)),
          class: "pip",
        });
        layers.marks.appendChild(pip);
        pipNodes.set(cellKey, pip);
      }
    }
    for (const [cellKey, pip] of [...pipNodes]) {
      if (want.has(cellKey)) continue;
      const [px, py] = cellKey.split(",").map(Number);
      if (Number.isFinite(px) && Number.isFinite(py)) spawnCoverageRipple(px, py);
      layers.marks.removeChild(pip);
      pipNodes.delete(cellKey);
    }
  }

  /**
   * Coloured wash on cells the wire occupies — shows over drawn board art (vector cells are
   * transparent there). Soft only: the wire itself is the read, this is the tile glow from the ref.
   */
  function syncPathGlows() {
    if (!layers || !puzzle) return;
    const want = new Set();
    const inset = Math.max(1, cellPx * 0.08);
    const radius = Math.round(cellPx * 0.18);
    for (const [cellKey, pairId] of owner) {
      want.add(cellKey);
      const colour = colourFor(pairId);
      let glow = pathGlowNodes.get(cellKey);
      if (!glow) {
        const [x, y] = cellKey.split(",").map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        glow = element("rect", {
          x: x * cellPx + inset,
          y: y * cellPx + inset,
          width: cellPx - inset * 2,
          height: cellPx - inset * 2,
          rx: radius,
          fill: colour,
          class: "path-glow",
          "pointer-events": "none",
        });
        layers.marks.insertBefore(glow, layers.marks.firstChild);
        pathGlowNodes.set(cellKey, glow);
      } else {
        glow.setAttribute("fill", colour);
      }
    }
    for (const [cellKey, glow] of [...pathGlowNodes]) {
      if (want.has(cellKey)) continue;
      layers.marks.removeChild(glow);
      pathGlowNodes.delete(cellKey);
    }
  }

  function flushPaint() {
    if (paintRaf && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(paintRaf);
    }
    paintRaf = 0;
    const arrived = queuedArrived;
    const change = queuedChange;
    queuedArrived = [];
    queuedChange = null;
    paint(arrived.length > 0 ? arrived : undefined);
    if (change) {
      const done = Boolean(change.complete);
      if (done && !celebratedComplete) {
        celebratedComplete = true;
        // Burst overlay removed — keep the flag so app.js can play a quiet win cue if wanted.
        change.completeCelebration = true;
      } else if (!done) {
        celebratedComplete = false;
      }
      onChange(change);
    }
  }

  function schedulePaint(arrived, change) {
    if (Array.isArray(arrived) && arrived.length > 0) {
      for (const id of arrived) {
        if (!queuedArrived.includes(id)) queuedArrived.push(id);
      }
    }
    if (change) {
      const prev = queuedChange || {};
      const joined = [
        ...new Set([...((prev.justJoined) || []), ...((change.justJoined) || [])]),
      ];
      queuedChange = {
        ...prev,
        ...change,
        justJoined: joined,
        complete: change.complete === true || prev.complete === true,
      };
    }
    if (paintRaf) return;
    if (typeof requestAnimationFrame !== "function") {
      flushPaint();
      return;
    }
    paintRaf = requestAnimationFrame(() => {
      paintRaf = 0;
      flushPaint();
    });
  }

  /**
   * The two layers that change as the player draws: the wires, and the pips still to be covered.
   *
   * `arrived` is the pairs that landed on THIS repaint, and it decides one thing: whether their
   * wire is drawn carrying the class that makes it surge once. It defaults to empty so that
   * `render` - a resize, or the next board - redraws a finished wire without re-celebrating it.
   *
   * SINCE 25 SEPTEMBER 2026 this UPDATES existing wire/pip nodes rather than clearing the layers.
   * The surge class is still interruptible on the next frame if the finger keeps moving.
   */
  function paint(arrived) {
    if (!layers || !puzzle) return;

    const landed = new Set(Array.isArray(arrived) ? arrived : []);
    const active = new Set();

    for (const pair of puzzle.pairs) {
      const cells = pathOf(pair.id);
      if (cells.length < 2) {
        syncWire(pair.id, cells, false);
        continue;
      }
      active.add(pair.id);
      syncWire(pair.id, cells, landed.has(pair.id));
    }
    for (const pairId of [...wireNodes.keys()]) {
      if (!active.has(pairId)) syncWire(pairId, [], false);
    }

    for (const pairId of landed) pulseTerminals(pairId);
    paintTokens();
    syncPips();
    syncPathGlows();
  }

  function render() {
    flushPaint();
    build();
    paint();
  }

  /**
   * Fit the grid to the space the layout gives it, leaving a comfortable tap target.
   *
   * The arithmetic is in `presentation.js` so it can be tested without a DOM, which is where the
   * cap and the floor are explained. Before 7 September 2026 the floor was what every player got,
   * because the frame never grew past its host's minimum.
   *
   * `spaceForGrid` takes the bezel off first. The artwork overhangs the grid on all four sides, so
   * a grid measured against the raw box would push its own frame off the edge of the viewport - and
   * the frame is the part that gets clipped, so the symptom is decorative and the cause is not.
   *
   * It is THIS board's frame that is taken off, per axis. The drawn 4x4 board's bezel is three
   * times as deep as the generic one, and reserving the generic share for it clips the artwork
   * top and bottom while the grid inside still fits and still works.
   */
  function resize(availableWidth, availableHeight) {
    if (!puzzle) return;
    const overhang = frameOverhang(frame());
    cellPx = boardCellPx(
      spaceForGrid(availableWidth, overhang.horizontal),
      spaceForGrid(availableHeight, overhang.vertical),
      puzzle.width,
      puzzle.height,
    );
    render();
  }

  /**
   * The drawn board for the current puzzle, or null for the generic bezel.
   *
   * The skin's own measured geometry when it has one, so the space reserved around the grid and
   * the place the artwork is pinned are the same numbers - otherwise a skin with a deep frame is
   * clipped and the numbers sit off its drawn cells.
   */
  function frame() {
    return puzzle ? skinFrameFor(puzzle.skin, puzzle.width, puzzle.height) : null;
  }

  return {
    frame,
    setPuzzle(next) {
      puzzle = next;
      paths = new Map();
      owner = new Map();
      terminals = new Map();
      dragging = null;
      locked = false;
      drawOrder = [];
      errorUntil = new Map();
      celebratedComplete = false;
      hideTrail();
      for (const pair of next.pairs) {
        terminals.set(key(pair.a), pair.id);
        terminals.set(key(pair.b), pair.id);
      }
      render();
      playBoardEnter();
    },
    clear() {
      if (!puzzle) return;
      paths = new Map();
      rebuildOwnership();
      dragging = null;
      drawOrder = [];
      celebratedComplete = false;
      hideTrail();
      paint();
      onChange();
    },
    /**
     * Remove the path drawn last. Reports whether anything was removed.
     *
     * `paint`, never `render`: nothing here moves a cell or a terminal, and rebuilding them is
     * what made the board stutter on a phone. Same reason as the drag handlers.
     */
    undo() {
      if (locked || !puzzle) return false;
      const pairId = lastDrawn();
      if (pairId === null) return false;
      spawnUndoRewind(pairId, pathOf(pairId));
      paths.delete(pairId);
      drawOrder = drawOrder.filter((entry) => entry !== pairId);
      rebuildOwnership();
      dragging = null;
      hideTrail();
      paint();
      onChange();
      return true;
    },
    canUndo() {
      return !locked && puzzle !== null && lastDrawn() !== null;
    },
    lock() {
      locked = true;
      dragging = null;
    },
    /**
     * Owner Lite FX toggle (26 Sep 2026). When false, Phase J wake/spark/ripple/trail are skipped.
     * Reduced-motion is still read live inside `motionFxOn` — this flag is the manual override.
     */
    setMotionFx(enabled) {
      fxMotion = enabled !== false;
      if (!fxMotion) hideTrail();
    },
    resize,
    flashError,
    isComplete,
    joinedCount,
    pairCount() {
      return puzzle ? puzzle.pairs.length : 0;
    },
    cellsUsed() {
      return owner.size;
    },
    cellCount() {
      return puzzle ? puzzle.width * puzzle.height : 0;
    },
    /** The submission: one path per pair, in the shape `verifyAttempt` walks. */
    submission() {
      if (!puzzle) return [];
      return puzzle.pairs.map((pair) => ({ pairId: pair.id, cells: pathOf(pair.id) }));
    },
  };
}
