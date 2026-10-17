/**
 * Checking a player's attempt.
 *
 * THE MOST IMPORTANT DECISION IN THIS FILE: THE STORED SOLUTION IS NOT USED
 * ------------------------------------------------------------------------
 * An attempt is validated against the *rules*, not against the path list the generator
 * happened to build the puzzle from. A Circuit puzzle usually has more than one valid full
 * covering, so comparing against the generator's solution would reject correct answers - and
 * it would do so for the best players first, because a player who finds an unusual route is
 * more likely to have reasoned about it than copied it.
 *
 * The failure would also be almost impossible to diagnose from a support ticket: the player
 * sees a completed grid marked wrong, and the server logs agree with themselves.
 *
 * THE INPUT IS HOSTILE BY CONSTRUCTION
 * ------------------------------------
 * These paths arrive from a browser, and the player has a developer console. Every field is
 * validated - types, bounds, adjacency, reuse - before any of it is believed. Nothing here
 * trusts a length, an index or a coordinate.
 *
 * There is deliberately no "score" field anywhere in the submission. The score is derived on
 * this side from what was verified, because a score that arrives from the browser is a number
 * the player chose.
 */

import {
  Cell,
  Puzzle,
  adjacent,
  cellKey,
  inBounds,
  sameCell,
} from "./puzzle";

export type AttemptRefusal =
  | "malformed"
  | "wrong_pair_count"
  | "unknown_pair"
  | "duplicate_pair"
  | "endpoints_do_not_match"
  | "not_contiguous"
  | "revisits_a_cell"
  | "paths_overlap"
  | "out_of_bounds"
  | "incomplete_coverage";

export type VerifyResult =
  | { solved: true; cellsUsed: number }
  | { solved: false; reason: AttemptRefusal; detail?: string };

/** One path per pair, as submitted. Shape is not trusted. */
export type SubmittedPaths = unknown;

/*
 * Work bounds for a hostile payload - and note what they are deliberately NOT.
 *
 * These are absolute constants, generous enough that no legitimate submission and no ordinary
 * mistake can reach them. They exist so that a megabyte of crafted JSON cannot make us do a
 * megabyte of work, and for nothing else.
 *
 * THE FIRST VERSION SET THEM TO THE GRID SIZE, AND THAT WAS A BUG WORTH RECORDING.
 * The reasoning looked airtight: no cell may be reused, so a valid submission can never exceed
 * the grid size. The flaw is in the word *valid*. An INVALID submission exceeds it routinely -
 * two paths overlapping is precisely a submission with more cells than the grid has - so the
 * work bound fired before the overlap rule and the player was told their solution "could not
 * be read" when the truth was "two paths use the same cell".
 *
 * The general form: A GUARD SIZED TO WHAT A CORRECT INPUT LOOKS LIKE WILL PRE-EMPT THE RULES
 * THAT DIAGNOSE AN INCORRECT ONE, and it does it by returning a worse message rather than a
 * wrong answer - so nothing fails, and support inherits a mystery.
 */
const MAX_SUBMITTED_PATHS = 512;
const MAX_SUBMITTED_CELLS = 4096;

/**
 * Narrow untrusted JSON into a list of paths.
 *
 * Returns `null` rather than throwing, because a malformed body is an ordinary outcome here -
 * a player experimenting with the console is not an exceptional condition, and an exception
 * would be caught and turned into a 500 that reads like our bug.
 */
function parsePaths(
  input: SubmittedPaths,
): { pairId: number; cells: Cell[] }[] | null {
  if (!Array.isArray(input)) return null;
  if (input.length > MAX_SUBMITTED_PATHS) return null;

  const parsed: { pairId: number; cells: Cell[] }[] = [];
  let totalCells = 0;

  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;

    const pairId = record.pairId;
    const cells = record.cells;
    if (typeof pairId !== "number" || !Number.isInteger(pairId) || pairId < 0) {
      return null;
    }
    if (!Array.isArray(cells)) return null;

    // Checked as a running total, before the work rather than after, so a large payload cannot
    // make us do large work. Sized well above any real grid on purpose - see the note on the
    // constants.
    totalCells += cells.length;
    if (totalCells > MAX_SUBMITTED_CELLS) return null;

    const typedCells: Cell[] = [];
    for (const cell of cells) {
      if (!Array.isArray(cell) || cell.length !== 2) return null;
      const [x, y] = cell as unknown[];
      if (typeof x !== "number" || typeof y !== "number") return null;
      if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
      typedCells.push([x, y]);
    }

    parsed.push({ pairId, cells: typedCells });
  }

  return parsed;
}

export function verifyAttempt(
  puzzle: Puzzle,
  submitted: SubmittedPaths,
): VerifyResult {
  const { width, height, pairs } = puzzle;
  const gridCells = width * height;

  const paths = parsePaths(submitted);
  if (!paths) return { solved: false, reason: "malformed" };

  if (paths.length !== pairs.length) {
    return {
      solved: false,
      reason: "wrong_pair_count",
      detail: `expected ${pairs.length}, received ${paths.length}`,
    };
  }

  const occupied = new Map<string, number>();
  const seenPairs = new Set<number>();

  for (const path of paths) {
    const pair = pairs.find((p) => p.id === path.pairId);
    if (!pair) {
      return {
        solved: false,
        reason: "unknown_pair",
        detail: `pair ${path.pairId}`,
      };
    }
    if (seenPairs.has(path.pairId)) {
      return {
        solved: false,
        reason: "duplicate_pair",
        detail: `pair ${path.pairId}`,
      };
    }
    seenPairs.add(path.pairId);

    const cells = path.cells;
    if (cells.length < 2) {
      return {
        solved: false,
        reason: "endpoints_do_not_match",
        detail: `pair ${path.pairId} has ${cells.length} cell(s)`,
      };
    }

    for (const cell of cells) {
      if (!inBounds(cell, width, height)) {
        return {
          solved: false,
          reason: "out_of_bounds",
          detail: `pair ${path.pairId} at ${cellKey(cell)}`,
        };
      }
    }

    // Either orientation is fine - a player may draw from either terminal.
    const first = cells[0];
    const last = cells[cells.length - 1];
    const forwards = sameCell(first, pair.a) && sameCell(last, pair.b);
    const backwards = sameCell(first, pair.b) && sameCell(last, pair.a);
    if (!forwards && !backwards) {
      return {
        solved: false,
        reason: "endpoints_do_not_match",
        detail: `pair ${path.pairId}`,
      };
    }

    const withinPath = new Set<string>();
    for (let i = 0; i < cells.length; i++) {
      // The cell CONTENTS are hostile and every field of them has already been validated by
      // `parsePaths`. `i` is a loop counter, so the indexing itself is not a sink - hence a
      // silence rather than a change.
      // eslint-disable-next-line security/detect-object-injection
      const key = cellKey(cells[i]);

      if (withinPath.has(key)) {
        return {
          solved: false,
          reason: "revisits_a_cell",
          detail: `pair ${path.pairId} at ${key}`,
        };
      }
      withinPath.add(key);

      const owner = occupied.get(key);
      if (owner !== undefined) {
        return {
          solved: false,
          reason: "paths_overlap",
          detail: `pairs ${owner} and ${path.pairId} at ${key}`,
        };
      }
      occupied.set(key, path.pairId);

      // eslint-disable-next-line security/detect-object-injection
      if (i > 0 && !adjacent(cells[i - 1], cells[i])) {
        return {
          solved: false,
          reason: "not_contiguous",
          detail: `pair ${path.pairId} between ${cellKey(cells[i - 1])} and ${key}`,
        };
      }
    }
  }

  if (occupied.size !== gridCells) {
    return {
      solved: false,
      reason: "incomplete_coverage",
      detail: `${occupied.size} of ${gridCells} cells used`,
    };
  }

  return { solved: true, cellsUsed: occupied.size };
}

/**
 * A human-readable reason, for the player and for support.
 *
 * Kept beside the refusal codes rather than in the UI so that the API, the replay page and the
 * dispute response cannot describe the same refusal differently. A player who is told two
 * different things about one result stops believing either.
 */
export const REFUSAL_MESSAGES: Record<AttemptRefusal, string> = {
  malformed: "The submitted solution could not be read.",
  wrong_pair_count: "Every pair must have exactly one path.",
  unknown_pair: "A path referred to a pair that is not in this puzzle.",
  duplicate_pair: "A pair was given more than one path.",
  endpoints_do_not_match: "A path does not run between its own two terminals.",
  not_contiguous: "A path jumps between cells that are not next to each other.",
  revisits_a_cell: "A path crosses itself.",
  paths_overlap: "Two paths use the same cell.",
  out_of_bounds: "A path leaves the grid.",
  incomplete_coverage: "Every cell must be used.",
};
