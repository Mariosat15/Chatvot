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

import { boardCellPx, spaceForGrid } from "./presentation.js";

/** Eight pairs is the most any grid size produces (`large`: 5-8). */
const PAIR_COLOURS = [
  "#38bdf8", // sky
  "#f472b6", // pink
  "#4ade80", // green
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#fb7185", // rose
  "#2dd4bf", // teal
  "#facc15", // yellow
];

/**
 * The terminal artwork: one lit socket per pair number, `token-1.webp` to `token-8.webp`.
 *
 * ONE PER PAIR NUMBER, NOT ONE PER COLOUR, and the two lists must stay the same length. The file
 * has the numeral baked into it, so `token-3.webp` is only ever right for pair 3 - which is why
 * this is indexed by `pairId` with no modulo. A modulo here would draw a "1" on pair 9 and look
 * deliberate. There is no pair 9 today (`large` tops out at eight), and if a grid size ever
 * produces more, `terminalArt` returns null and the socket drawn underneath carries the numeral.
 *
 * WHY THE SOCKET IS DRAWN UNDERNEATH RATHER THAN THE ARTWORK BEING THE TERMINAL. A numeral in
 * every terminal is functional here rather than decorative - see the note on `colourFor`, it is
 * what makes the board playable for a colour-blind player and what makes it playable with no
 * language at all. An `<image>` that fails to arrive draws nothing and reports nothing, and this
 * platform has now had two production faults caused by an asset that 404ed from a stale cache. So
 * the vector socket, with its own numeral, is always drawn: the artwork is an enhancement laid
 * over a board that is already complete and legible without it.
 */
const TERMINAL_ART = [
  "/play/token-1.webp",
  "/play/token-2.webp",
  "/play/token-3.webp",
  "/play/token-4.webp",
  "/play/token-5.webp",
  "/play/token-6.webp",
  "/play/token-7.webp",
  "/play/token-8.webp",
];

/** The bezel around the grid. Drawn by the stylesheet, listed here so `app.js` can warm it. */
const FRAME_ART = "/play/board-frame.webp";

/**
 * Every image the board needs, for `app.js` to fetch while the player is still reading the rules.
 *
 * Reason this is worth doing at all: the round's clock starts on the server when Start is pressed,
 * so anything the board downloads AFTER that comes out of the player's score. It is only a few
 * kilobytes, but it is a few kilobytes the player would be paying for.
 */
export const BOARD_ART = [FRAME_ART, ...TERMINAL_ART];

function terminalArt(pairId) {
  return TERMINAL_ART[pairId] ?? null;
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
  cellFace.appendChild(element("stop", { offset: "0", "stop-color": "#183053" }));
  cellFace.appendChild(element("stop", { offset: "0.55", "stop-color": "#102340" }));
  cellFace.appendChild(element("stop", { offset: "1", "stop-color": "#0b1a31" }));
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
  /** @type {{cells:Node,traces:Node,marks:Node,sockets:Node}|null} Set by `build`. */
  let layers = null;

  function rebuildOwnership() {
    owner = new Map();
    for (const [pairId, cells] of paths) {
      for (const cell of cells) owner.set(key(cell), pairId);
    }
  }

  function pathOf(pairId) {
    return paths.get(pairId) || [];
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
    if (terminalOwner !== undefined && terminalOwner !== pairId) return false;
    return true;
  }

  function extendTo(pairId, cell) {
    const cells = pathOf(pairId);
    if (cells.length === 0) return false;

    const last = cells[cells.length - 1];
    if (same(last, cell)) return false;

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
      const step = dx !== 0 ? [last[0] + dx, last[1]] : [last[0], last[1] + dy];

      if (!extendTo(pairId, step)) return moved;
      moved = true;
    }
    return moved;
  }

  function cellAt(event) {
    if (!puzzle) return null;
    const box = svg.getBoundingClientRect();
    const x = Math.floor(((event.clientX - box.left) / box.width) * puzzle.width);
    const y = Math.floor(((event.clientY - box.top) / box.height) * puzzle.height);
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
    } else {
      const pathOwner = owner.get(cellKey);
      if (pathOwner === undefined) return;
      // Touching a cell part-way along a path rewinds it to there and carries on from that point.
      truncateBefore(pathOwner, cell);
      paths.set(pathOwner, pathOf(pathOwner).concat([cell]));
      rebuildOwnership();
      dragging = pathOwner;
    }

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
    // `paint`, never `render`: nothing a pointer does can move a cell or a terminal, and rebuilding
    // them mid-drag is what made the board stutter on a phone. See the note above `build`.
    paint();
    onChange();
  }

  function onPointerMove(event) {
    if (locked || dragging === null) return;
    const cell = cellAt(event);
    if (!cell) return;
    if (walkTowards(dragging, cell)) {
      paint();
      onChange();
    }
    event.preventDefault();
  }

  function onPointerUp() {
    if (dragging === null) return;
    dragging = null;
    paint();
    onChange();
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
    if (!puzzle) return;

    const width = puzzle.width * cellPx;
    const height = puzzle.height * cellPx;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    svg.appendChild(defs());

    const cells = element("g", { class: "layer-cells" });
    const traces = element("g", { class: "layer-traces" });
    const marks = element("g", { class: "layer-marks" });
    const sockets = element("g", { class: "layer-terminals" });
    svg.appendChild(cells);
    svg.appendChild(traces);
    svg.appendChild(marks);
    svg.appendChild(sockets);
    layers = { cells, traces, marks, sockets };

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

    for (const pair of puzzle.pairs) {
      for (const cell of [pair.a, pair.b]) {
        sockets.appendChild(socket(pair.id, centre(cell[0]), centre(cell[1])));
      }
    }
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
      group.appendChild(
        element("image", {
          href: art,
          x: cx - size / 2,
          y: cy - size / 2,
          width: size,
          height: size,
          class: "terminal-art",
        }),
      );
    }

    return group;
  }

  /** The two layers that change as the player draws: the wires, and the pips still to be covered. */
  function paint() {
    if (!layers) return;
    clear(layers.traces);
    clear(layers.marks);

    for (const pair of puzzle.pairs) {
      const cells = pathOf(pair.id);
      if (cells.length < 2) continue;
      const points = cells.map((cell) => centre(cell[0]) + "," + centre(cell[1])).join(" ");
      const colour = colourFor(pair.id);

      // Three strokes for one wire: a wide translucent bloom, the conductor, and a pale core down
      // the middle. Two of them read as a lit wire rather than a felt-tip line; the third is what
      // keeps two paths legible where they run side by side, since the bloom darkens the gap.
      layers.traces.appendChild(
        element("polyline", {
          points,
          fill: "none",
          stroke: colour,
          "stroke-width": Math.round(cellPx * 0.6),
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          class: "trace-halo",
        }),
      );
      layers.traces.appendChild(
        element("polyline", {
          points,
          fill: "none",
          stroke: colour,
          "stroke-width": Math.round(cellPx * 0.3),
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          class: "trace",
        }),
      );
      layers.traces.appendChild(
        element("polyline", {
          points,
          fill: "none",
          stroke: "#eaf6ff",
          "stroke-width": Math.max(1, Math.round(cellPx * 0.07)),
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          class: "trace-core",
        }),
      );
    }

    /*
     * A pip in every UNUSED square, and it is functional rather than decorative.
     *
     * Coverage is the rule players fail: every pair can be visibly joined with a square left over,
     * and the hint line then says "use every square: 30 of 36" without saying WHICH. Counting
     * squares on a 6x6 grid under a clock is not a puzzle anybody meant to set. The pips vanish as
     * cells are taken, so the remaining work is the remaining dots.
     */
    for (let y = 0; y < puzzle.height; y++) {
      for (let x = 0; x < puzzle.width; x++) {
        if (owner.has(key([x, y]))) continue;
        layers.marks.appendChild(
          element("circle", {
            cx: centre(x),
            cy: centre(y),
            r: Math.max(1.5, Math.round(cellPx * 0.055)),
            class: "pip",
          }),
        );
      }
    }
  }

  function render() {
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
   */
  function resize(availableWidth, availableHeight) {
    if (!puzzle) return;
    cellPx = boardCellPx(
      spaceForGrid(availableWidth),
      spaceForGrid(availableHeight),
      puzzle.width,
      puzzle.height,
    );
    render();
  }

  return {
    setPuzzle(next) {
      puzzle = next;
      paths = new Map();
      owner = new Map();
      terminals = new Map();
      dragging = null;
      locked = false;
      for (const pair of next.pairs) {
        terminals.set(key(pair.a), pair.id);
        terminals.set(key(pair.b), pair.id);
      }
      render();
    },
    clear() {
      if (!puzzle) return;
      paths = new Map();
      rebuildOwnership();
      dragging = null;
      paint();
      onChange();
    },
    lock() {
      locked = true;
      dragging = null;
    },
    resize,
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
