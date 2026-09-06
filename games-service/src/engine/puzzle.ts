/**
 * Circuit - the puzzle model, and the presentation transform.
 *
 * THE GAME
 * --------
 * A grid contains pairs of matching terminals. Draw a path between each pair so that no two
 * paths cross and every cell of the grid is used. Non-crossing path puzzles of this family
 * (Numberlink, and its full-coverage variant) are a good fit for a paid skill contest for
 * reasons that are all constraints rather than preferences - see the README table.
 *
 * WHY FULL COVERAGE IS PART OF THE RULES
 * --------------------------------------
 * Requiring every cell to be used does three useful things at once. It makes the puzzle
 * harder in an interesting way rather than a fiddly way; it makes a partially-correct
 * solution unambiguous to score; and it sharply reduces the number of valid solutions, which
 * matters because the contest ranks players against each other and a puzzle with thousands of
 * solutions is closer to a typing test than a reasoning one.
 */

export type Cell = readonly [number, number];

export interface TerminalPair {
  /** 0-based. Also the colour index in the UI. */
  id: number;
  a: Cell;
  b: Cell;
}

export interface Puzzle {
  width: number;
  height: number;
  pairs: TerminalPair[];
}

/**
 * A generated puzzle together with the solution the generator happened to build it from.
 *
 * The solution is kept for support and for generation-time sanity checks, and is deliberately
 * NOT what a player's attempt is checked against - see `verify.ts`.
 */
export interface GeneratedPuzzle extends Puzzle {
  /** One cell list per pair, in pair order. A valid solution, not necessarily the only one. */
  solution: Cell[][];
  /** Which of the eight symmetries was applied when presenting it. */
  transform: number;
}

/* ------------------------------------------------------------------------------------------
 * Presentation transform
 * ---------------------------------------------------------------------------------------- */

/**
 * The eight symmetries of a rectangle-preserving grid transform: four rotations, each
 * optionally mirrored.
 *
 * WHY THIS EXISTS
 * ---------------
 * Section 12 of the specification requires every player in a contest to face *identical
 * content*, and in the same breath permits - and asks for - the *presentation* to vary per
 * player, "so it stops players simply telling each other that the answer is B while keeping
 * the challenge identical". For a grid, the natural form of that is a rotation or a mirror:
 * the puzzle, its difficulty and its solution structure are unchanged, but a screenshot or a
 * described route does not transfer directly to another player's screen.
 *
 * IT IS A MITIGATION AND NOT A FIX, WHICH IS WORTH STATING PLAINLY.
 * Identical content is a fairness requirement and a collusion surface at the same time, and
 * eight variants is a speed bump for a determined pair of colluders, not a wall. The real
 * control is a short contest play window, which the platform already supports.
 *
 * Note rotations by 90 degrees swap width and height. That is correct and must be handled by
 * callers rather than avoided by restricting to square grids, because a non-square grid is a
 * legitimate difficulty knob.
 */
export const TRANSFORM_COUNT = 8;

interface Dimensions {
  width: number;
  height: number;
}

/** The grid dimensions after a transform. */
export function transformedDimensions(
  dims: Dimensions,
  transform: number,
): Dimensions {
  const rotation = transform % 4;
  const swaps = rotation === 1 || rotation === 3;
  return swaps
    ? { width: dims.height, height: dims.width }
    : { width: dims.width, height: dims.height };
}

/**
 * Map one cell through a transform.
 *
 * `dims` is the grid the cell currently belongs to, always the *pre-transform* grid.
 */
export function transformCell(
  cell: Cell,
  dims: Dimensions,
  transform: number,
): Cell {
  const rotation = transform % 4;
  const mirrored = transform >= 4;

  let [x, y] = cell;
  let { width, height } = dims;

  for (let i = 0; i < rotation; i++) {
    // Rotate 90 degrees clockwise: (x, y) -> (height - 1 - y, x)
    const nx = height - 1 - y;
    const ny = x;
    x = nx;
    y = ny;
    const w = width;
    width = height;
    height = w;
  }

  if (mirrored) {
    x = width - 1 - x;
  }

  return [x, y];
}

/** Apply a transform to a whole puzzle, including its solution. */
export function transformPuzzle(
  puzzle: GeneratedPuzzle,
  transform: number,
): GeneratedPuzzle {
  const dims = { width: puzzle.width, height: puzzle.height };
  const out = transformedDimensions(dims, transform);

  return {
    width: out.width,
    height: out.height,
    transform,
    pairs: puzzle.pairs.map((pair) => ({
      id: pair.id,
      a: transformCell(pair.a, dims, transform),
      b: transformCell(pair.b, dims, transform),
    })),
    solution: puzzle.solution.map((path) =>
      path.map((cell) => transformCell(cell, dims, transform)),
    ),
  };
}

/* ------------------------------------------------------------------------------------------
 * Small helpers shared by the generator and the verifier
 * ---------------------------------------------------------------------------------------- */

export function cellKey(cell: Cell): string {
  return `${cell[0]},${cell[1]}`;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Orthogonally adjacent. Diagonals are not moves. */
export function adjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

export function inBounds(cell: Cell, width: number, height: number): boolean {
  return (
    Number.isInteger(cell[0]) &&
    Number.isInteger(cell[1]) &&
    cell[0] >= 0 &&
    cell[1] >= 0 &&
    cell[0] < width &&
    cell[1] < height
  );
}

export function neighbours(cell: Cell, width: number, height: number): Cell[] {
  const [x, y] = cell;
  const candidates: Cell[] = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
  return candidates.filter((c) => inBounds(c, width, height));
}

/**
 * The puzzle as the player's browser receives it.
 *
 * Note what is absent: the solution, and the seed.
 *
 * Section 12 requires that the seed is "never exposed to the player, in the page, the URL or
 * any client-visible response", and there must be "no endpoint anywhere that returns the
 * content for a given seed". Leaking the seed would let a player generate the whole contest's
 * puzzle set in advance; leaking the solution needs no explanation.
 *
 * This type is the boundary that enforces both, which is why the client-facing serialiser
 * takes it rather than a `GeneratedPuzzle`.
 */
export interface ClientPuzzle {
  index: number;
  width: number;
  height: number;
  pairs: TerminalPair[];
}

export function toClientPuzzle(
  puzzle: Puzzle,
  index: number,
): ClientPuzzle {
  return {
    index,
    width: puzzle.width,
    height: puzzle.height,
    pairs: puzzle.pairs.map((p) => ({ id: p.id, a: p.a, b: p.b })),
  };
}
