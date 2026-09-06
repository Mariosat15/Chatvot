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
    render();
    onChange();
  }

  function onPointerMove(event) {
    if (locked || dragging === null) return;
    const cell = cellAt(event);
    if (!cell) return;
    if (walkTowards(dragging, cell)) {
      render();
      onChange();
    }
    event.preventDefault();
  }

  function onPointerUp() {
    if (dragging === null) return;
    dragging = null;
    render();
    onChange();
  }

  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!puzzle) return;

    const width = puzzle.width * cellPx;
    const height = puzzle.height * cellPx;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    const centre = (value) => value * cellPx + cellPx / 2;

    for (let y = 0; y < puzzle.height; y++) {
      for (let x = 0; x < puzzle.width; x++) {
        svg.appendChild(
          element("rect", {
            x: x * cellPx,
            y: y * cellPx,
            width: cellPx,
            height: cellPx,
            rx: Math.round(cellPx * 0.12),
            class: "cell",
          }),
        );
      }
    }

    for (const pair of puzzle.pairs) {
      const cells = pathOf(pair.id);
      if (cells.length < 2) continue;
      svg.appendChild(
        element("polyline", {
          points: cells.map((cell) => centre(cell[0]) + "," + centre(cell[1])).join(" "),
          fill: "none",
          stroke: colourFor(pair.id),
          "stroke-width": Math.round(cellPx * 0.34),
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          class: "trace",
        }),
      );
    }

    for (const pair of puzzle.pairs) {
      for (const cell of [pair.a, pair.b]) {
        svg.appendChild(
          element("circle", {
            cx: centre(cell[0]),
            cy: centre(cell[1]),
            r: Math.round(cellPx * 0.3),
            fill: colourFor(pair.id),
            class: "terminal",
          }),
        );
        const label = element("text", {
          x: centre(cell[0]),
          y: centre(cell[1]),
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-size": Math.round(cellPx * 0.34),
          class: "terminal-label",
        });
        label.textContent = String(pair.id + 1);
        svg.appendChild(label);
      }
    }
  }

  /** Fit the grid to the space the layout gives it, leaving a comfortable tap target. */
  function resize(availableWidth, availableHeight) {
    if (!puzzle) return;
    const byWidth = Math.floor(availableWidth / puzzle.width);
    const byHeight = Math.floor(availableHeight / puzzle.height);
    cellPx = Math.max(28, Math.min(84, Math.min(byWidth, byHeight)));
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
      render();
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
