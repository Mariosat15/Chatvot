/**
 * Cross-game normalised points — `05` section 3 / New games plan `04` section 3.
 *
 * Deliberately uses rank and field size, never raw score: trading P&L and a puzzle
 * score are not comparable, and a single headline that summed them would be the
 * failure mode of every trading-shaped aggregate.
 *
 * Pure. No I/O. Both apps import the same module (mirrored).
 */

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export interface NormalizedPointsInput {
  /** 1-based finishing position. Absent / non-positive → 0 points. */
  rank?: number;
  /** Field size of the contest (participants who count toward difficulty). */
  fieldSize: number;
  /** Entry fee in credits. 0 is a real free contest, not a missing value. */
  entryFee: number;
}

/**
 * Points for one finish. Bounded roughly 0..2250. Disqualified / unranked → 0.
 */
export function computeNormalizedPoints(input: NormalizedPointsInput): number {
  const { rank, fieldSize, entryFee } = input;
  if (typeof rank !== "number" || !Number.isFinite(rank) || rank < 1) {
    return 0;
  }
  if (!Number.isFinite(fieldSize) || fieldSize < 1) {
    return 0;
  }

  const placementFactor = (fieldSize - rank + 1) / fieldSize;
  const difficultyFactor = clamp(Math.log10(fieldSize) / Math.log10(50), 0.4, 1.5);
  const fee = Number.isFinite(entryFee) && entryFee >= 0 ? entryFee : 0;
  const stakeFactor = clamp(Math.log10(1 + fee) / Math.log10(101), 0.5, 1.5);

  return Math.round(1000 * placementFactor * difficultyFactor * stakeFactor);
}

const DEFAULT_K = 24;
const RATING_MIN = 100;
const RATING_MAX = 3000;

/**
 * Multiplayer Elo adaptation from New games plan `04` section 4.
 * Expected rank is the field midpoint; beating it raises rating.
 */
export function computeRatingDelta(args: {
  rank: number;
  fieldSize: number;
  k?: number;
}): number {
  const { rank, fieldSize } = args;
  const k = args.k ?? DEFAULT_K;
  if (fieldSize <= 1) return 0;
  if (!Number.isFinite(rank) || rank < 1) return 0;

  const expectedRank = (fieldSize + 1) / 2;
  const ratingDelta = (k * (expectedRank - rank) / (fieldSize - 1)) * 2;
  return Math.round(ratingDelta);
}

export function clampRating(rating: number): number {
  return clamp(rating, RATING_MIN, RATING_MAX);
}
