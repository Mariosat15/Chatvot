/**
 * Volt Stack tetromino shapes and the seeded seven-bag.
 *
 * THE BAG IS CONTENT, THE SAME WAY A CIRCUIT BOARD IS CONTENT
 * ----------------------------------------------------------
 * Every ranked entrant with the same `contentSeed` must see the same piece order. The
 * play surface receives a one-way hash of that seed (`pieceSeed`), never the seed itself,
 * which is the Circuit equivalent of shipping puzzle cells without shipping the seed.
 */

/* eslint-disable security/detect-object-injection --
   Reason: every indexed read here is a loop counter or a PieceType key into the fixed
   SHAPES table, never a caller-supplied object key. */

export const PIECE_TYPES = ["I", "J", "L", "O", "S", "T", "Z"] as const;
export type PieceType = (typeof PIECE_TYPES)[number];

export type Matrix = readonly (readonly number[])[];

/** Guideline spawn orientations — identical to Neon Stack 9.4. */
export const SHAPES: Record<PieceType, Matrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 4;
export const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;

/**
 * FNV-1a → xorshift32, matching Neon Stack's `setPieceSeed` / `pieceRandom`.
 *
 * Byte-identical to the browser engine so a probe that hashes the same seed produces the
 * same bag on both sides. Soft-drop scoring stays 0 for the same fairness reason.
 */
export function createPieceRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = h || 0x6d2b79f5;
  return () => {
    let x = state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state = x >>> 0;
    return (state >>> 0) / 4294967296;
  };
}

export function shuffledBag(rng: () => number): PieceType[] {
  const bag: PieceType[] = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return bag;
}

/** First `count` piece types drawn from the seven-bag for `seed`. */
export function sequenceForSeed(seed: string, count: number): PieceType[] {
  const rng = createPieceRng(seed);
  const out: PieceType[] = [];
  let bag: PieceType[] = [];
  while (out.length < count) {
    if (!bag.length) bag = shuffledBag(rng);
    out.push(bag.pop()!);
  }
  return out;
}

export function rotateMatrix(matrix: Matrix): number[][] {
  const h = matrix.length;
  const w = matrix[0]?.length ?? 0;
  const next: number[][] = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      next[x]![h - 1 - y] = matrix[y]![x]!;
    }
  }
  return next;
}

export function matrixFor(type: PieceType, rotation: number): number[][] {
  let matrix: number[][] = SHAPES[type].map((row) => [...row]);
  const turns = ((rotation % 4) + 4) % 4;
  for (let i = 0; i < turns; i++) matrix = rotateMatrix(matrix);
  return matrix;
}

export function isPieceType(value: unknown): value is PieceType {
  return typeof value === "string" && (PIECE_TYPES as readonly string[]).includes(value);
}
