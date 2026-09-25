/**
 * Size-locked board art, served as a shuffled deck.
 *
 * The puzzle itself is already a pure function of `(contentSeed, index, gridSize)` in
 * `generate.ts`. This file only chooses which supplied picture that puzzle wears.
 *
 * Rules:
 * - A size never reads another size's files.
 * - The whole pool is shuffled, then dealt one by one.
 * - A picture is not repeated until that shuffle is exhausted.
 * - The last picture of a cycle is never the first of the next.
 * - The shuffle uses `SeededRandom`, never `Math.random()`, so one competition seed and one
 *   size always deal the same order.
 */

import { SeededRandom, derive } from "./rng";
import type { GridSize } from "../games/titles";

function files(prefix: "s" | "m" | "l", count: number): readonly string[] {
  return Array.from(
    { length: count },
    (_, index) => `/play/board-${prefix}-${String(index + 1).padStart(2, "0")}.webp`,
  );
}

/** Packed from Small / Medium / large. Counts are the folder sizes on 25 Sep 2026. */
const BOARD_SKIN_POOLS = new Map<GridSize, readonly string[]>([
  ["small", files("s", 18)],
  ["medium", files("m", 12)],
  ["large", files("l", 15)],
]);

export function poolFor(size: GridSize): readonly string[] {
  const pool = BOARD_SKIN_POOLS.get(size);
  if (!pool) throw new Error(`Circuit: no board art for size ${size}`);
  return pool;
}

/**
 * Deal order for one cycle of `poolLength` pictures.
 *
 * `previousLast` is the last index of the cycle before this one, or -1 for the first cycle.
 * When the new shuffle opens on that index, the first two entries are swapped. A pool of one
 * cannot avoid the repeat; that case is the single-hero fallback, not a bug.
 */
export function cycleOrder(
  seed: string,
  size: GridSize,
  cycle: number,
  poolLength: number,
  previousLast: number,
): number[] {
  const rng = new SeededRandom(derive(seed, "skin", size, cycle));
  const order = rng.shuffle(Array.from({ length: poolLength }, (_, index) => index));
  const opened = order.at(0);
  const second = order.at(1);
  if (poolLength > 1 && previousLast >= 0 && opened === previousLast && second !== undefined) {
    order.splice(0, 2, second, opened);
  }
  return order;
}

/** The art URL for board `index` of this size. */
export function skinFile(contentSeed: string, size: GridSize, index: number): string {
  const pool = poolFor(size);
  const poolLength = pool.length;
  const safeIndex = index < 0 ? 0 : index;
  const only = pool.at(0);
  if (poolLength === 1 && only) return only;

  const targetCycle = Math.floor(safeIndex / poolLength);
  let previousLast = -1;
  let order: number[] = [];
  for (let cycle = 0; cycle <= targetCycle; cycle++) {
    order = cycleOrder(contentSeed, size, cycle, poolLength, previousLast);
    previousLast = order.at(poolLength - 1) ?? -1;
  }
  const slot = safeIndex % poolLength;
  const picked = order.at(slot);
  const file = picked === undefined ? undefined : pool.at(picked);
  if (!file) throw new Error(`Circuit: missing board art for ${size} index ${safeIndex}`);
  return file;
}
