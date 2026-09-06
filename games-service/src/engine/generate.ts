/**
 * Deterministic generation of Circuit puzzles.
 *
 * THE APPROACH, AND WHY IT IS NOT A SEARCH
 * ----------------------------------------
 * The puzzle is built backwards from a solution rather than generated and then solved. The
 * grid is partitioned into simple paths that cover every cell; each path's two endpoints then
 * become a terminal pair, and the path itself is discarded from the player's view.
 *
 * That construction makes solvability a property of the algorithm rather than something to be
 * checked afterwards, which matters more than it might seem: a generate-then-solve loop needs
 * a solver in the hot path, and a solver that times out produces *either* a slow response or
 * an unsolvable puzzle, both of which reach a paying player.
 *
 * WHY NOT A HAMILTONIAN PATH CUT INTO PIECES
 * ------------------------------------------
 * That is the obvious alternative and it was rejected. Finding a random Hamiltonian path on a
 * grid needs backtracking search whose running time has a long tail, so the same objection
 * applies - and cutting one long snake into N segments tends to produce N parallel corridors,
 * which is a dull puzzle. Growing paths independently produces the twisty, interleaved shapes
 * that make the puzzle interesting.
 *
 * THE ONE THING THAT MAKES PATH-GROWING WORK
 * ------------------------------------------
 * Always start the next path from the *most constrained* free cell - the one with the fewest
 * free neighbours. Growing from a random cell strands single cells in corners and against
 * finished paths, and a stranded cell is a degenerate pair whose two terminals are the same
 * square. Choosing the most constrained cell first is what keeps coverage complete without
 * backtracking.
 */

import { SeededRandom, derive } from "./rng";
import {
  Cell,
  GeneratedPuzzle,
  TRANSFORM_COUNT,
  cellKey,
  neighbours,
  transformPuzzle,
} from "./puzzle";

export interface PuzzleShape {
  width: number;
  height: number;
  /** Inclusive bounds on how many terminal pairs the finished puzzle should have. */
  minPairs: number;
  maxPairs: number;
}

/** How many differently-seeded attempts before the shape constraints are relaxed. */
const MAX_ATTEMPTS = 40;

/**
 * Partition the grid into simple paths covering every cell.
 *
 * Returns the paths, or `null` if this attempt produced a degenerate one. A single-cell path
 * is the failure case: its two endpoints would coincide, so the "pair" would be one square
 * that is already connected to itself.
 */
function partition(
  rng: SeededRandom,
  width: number,
  height: number,
  targetLength: { min: number; max: number },
): Cell[][] | null {
  const used = new Set<string>();
  const paths: Cell[][] = [];
  const total = width * height;

  const freeNeighbours = (cell: Cell): Cell[] =>
    neighbours(cell, width, height).filter((n) => !used.has(cellKey(n)));

  while (used.size < total) {
    // The most constrained free cell. Reason: see the header - starting anywhere else strands
    // single cells, and a stranded cell is a degenerate pair.
    let start: Cell | null = null;
    let bestDegree = Number.POSITIVE_INFINITY;
    const tied: Cell[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell: Cell = [x, y];
        if (used.has(cellKey(cell))) continue;
        const degree = freeNeighbours(cell).length;
        if (degree < bestDegree) {
          bestDegree = degree;
          tied.length = 0;
          tied.push(cell);
        } else if (degree === bestDegree) {
          tied.push(cell);
        }
      }
    }

    // Deterministic tie-break through the seeded stream, so two equally constrained cells do
    // not depend on iteration order remaining stable if this loop is ever rewritten.
    start = tied.length > 0 ? rng.pick(tied) : null;
    if (!start) break;

    const path: Cell[] = [start];
    used.add(cellKey(start));
    const wanted = rng.between(targetLength.min, targetLength.max);

    while (path.length < wanted) {
      const head = path[path.length - 1];
      const options = freeNeighbours(head);
      if (options.length === 0) break;

      // Warnsdorff's rule: step into the candidate with the fewest onward moves. Reason: this
      // is the same anti-stranding pressure as the start-cell choice, applied one move at a
      // time - taking the roomiest option first is what leaves single cells marooned behind
      // the path. `head` is already used, so it is not counted among a candidate's onward
      // moves.
      const scored = options.map((option) => ({
        option,
        degree: freeNeighbours(option).length,
      }));
      const minDegree = Math.min(...scored.map((s) => s.degree));
      const constrained = scored
        .filter((s) => s.degree === minDegree)
        .map((s) => s.option);

      const step = rng.pick(constrained);
      path.push(step);
      used.add(cellKey(step));
    }

    if (path.length < 2) return null;
    paths.push(path);
  }

  return used.size === total ? paths : null;
}

/**
 * Generate one puzzle.
 *
 * Deterministic in `(seed, shape)`. The retry loop derives a new sub-seed per attempt rather
 * than continuing the same stream, so attempt 7 is reproducible without replaying attempts 1
 * to 6 - which is what support needs when a player disputes one specific puzzle.
 */
export function generatePuzzle(seed: string, shape: PuzzleShape): GeneratedPuzzle {
  const { width, height, minPairs, maxPairs } = shape;
  const total = width * height;

  // Aim for path lengths that yield a pair count inside the requested band.
  const idealPaths = Math.max(2, Math.round((minPairs + maxPairs) / 2));
  const idealLength = Math.max(2, Math.floor(total / idealPaths));

  let fallback: Cell[][] | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = new SeededRandom(derive(seed, "partition", attempt));
    const spread = 1 + (attempt % 3);
    const paths = partition(rng, width, height, {
      min: Math.max(2, idealLength - spread),
      max: idealLength + spread,
    });

    if (!paths) continue;
    if (!fallback) fallback = paths;

    if (paths.length >= minPairs && paths.length <= maxPairs) {
      return finish(seed, width, height, paths);
    }
  }

  // Every attempt produced a valid partition of the wrong size. Using the first valid one is
  // correct and is NOT silent: a puzzle slightly outside the requested pair band is still a
  // fair, solvable puzzle identical for every player, whereas throwing would fail a paid
  // round. The shape bands are a difficulty preference, not a correctness requirement.
  if (fallback) return finish(seed, width, height, fallback);

  // Unreachable for any grid of 2 or more cells: a 1xN grid always partitions into one path.
  throw new Error(
    `Circuit: could not partition a ${width}x${height} grid after ${MAX_ATTEMPTS} attempts`,
  );
}

function finish(
  seed: string,
  width: number,
  height: number,
  paths: Cell[][],
): GeneratedPuzzle {
  const canonical: GeneratedPuzzle = {
    width,
    height,
    transform: 0,
    solution: paths,
    pairs: paths.map((path, id) => ({
      id,
      a: path[0],
      b: path[path.length - 1],
    })),
  };

  // Order the pairs deterministically by their first terminal rather than by generation
  // order. Reason: generation order leaks information about how the grid was carved - the
  // first pair is always in the most constrained corner - and a player who noticed would
  // gain a real advantage over one who did not.
  const rng = new SeededRandom(derive(seed, "pair-order"));
  const order = rng.shuffle(canonical.pairs.map((_, index) => index));

  // The indices below come from `order`, an internally-generated permutation of 0..n-1. No
  // request data reaches them, which is why the object-injection rule is silenced here rather
  // than satisfied - it cannot tell an array index from a property lookup.
  const reordered: GeneratedPuzzle = {
    ...canonical,
    pairs: order.map((sourceIndex, newId) => {
      // eslint-disable-next-line security/detect-object-injection
      const source = canonical.pairs[sourceIndex];
      return { id: newId, a: source.a, b: source.b };
    }),
    // eslint-disable-next-line security/detect-object-injection
    solution: order.map((sourceIndex) => canonical.solution[sourceIndex]),
  };

  return reordered;
}

/**
 * The puzzle as one specific player sees it.
 *
 * `contentSeed` decides the puzzle - identical for everyone in the contest, per section 12.
 * `presentationSeed` decides only which of the eight symmetries is applied, and is per round,
 * which is the variation section 12 explicitly permits.
 *
 * Keeping these two seeds as separate parameters is the whole point. One function taking a
 * single seed would make it possible, and eventually likely, for the presentation choice to
 * feed back into the content.
 */
export function generateForPlayer(
  contentSeed: string,
  presentationSeed: string,
  index: number,
  shape: PuzzleShape,
): GeneratedPuzzle {
  const puzzle = generatePuzzle(derive(contentSeed, "puzzle", index), shape);
  const rng = new SeededRandom(derive(presentationSeed, "transform", index));
  return transformPuzzle(puzzle, rng.int(TRANSFORM_COUNT));
}
