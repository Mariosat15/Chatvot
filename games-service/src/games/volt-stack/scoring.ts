/**
 * Volt Stack scoring tables — mirrored from Neon Stack 9.6.
 *
 * Soft drop is always zero. Hard drop is 2 per cell. Line clears, T-spins, B2B,
 * combo and milestones are recomputed here; a client-supplied total is never stored.
 */

import type { PieceType } from "./shapes";

export const HARD_DROP_POINTS_PER_CELL = 2;
export const SOFT_DROP_POINTS_PER_CELL = 0;

export const SCORE_TABLE = {
  single: 100,
  double: 300,
  triple: 500,
  tetris: 800,
  tspinMini0: 100,
  tspin0: 400,
  tspinMini1: 200,
  tspin1: 800,
  tspin2: 1200,
  tspin3: 1600,
  perfectClearSingle: 800,
  perfectClearDouble: 1200,
  perfectClearTriple: 1800,
  perfectClearTetris: 2000,
  perfectClearB2BTetris: 3200,
} as const;

export const MILESTONE_RULES = [
  { key: "lines25", type: "lines" as const, value: 25, bonus: 500 },
  { key: "lines50", type: "lines" as const, value: 50, bonus: 1200 },
  { key: "lines100", type: "lines" as const, value: 100, bonus: 3000 },
  { key: "level5", type: "level" as const, value: 5, bonus: 700 },
  { key: "level10", type: "level" as const, value: 10, bonus: 1800 },
  { key: "level15", type: "level" as const, value: 15, bonus: 3500 },
  { key: "level20", type: "level" as const, value: 20, bonus: 6000 },
];

export interface SpinInfo {
  tspin: boolean;
  mini: boolean;
}

export interface ClearScoring {
  base: number;
  label: string;
  difficult: boolean;
}

export function scoreClear(n: number, spin: SpinInfo): ClearScoring {
  if (spin.tspin) {
    if (n === 0) {
      return {
        base: spin.mini ? SCORE_TABLE.tspinMini0 : SCORE_TABLE.tspin0,
        label: spin.mini ? "T-SPIN MINI" : "T-SPIN",
        difficult: false,
      };
    }
    if (n === 1) {
      return {
        base: spin.mini ? SCORE_TABLE.tspinMini1 : SCORE_TABLE.tspin1,
        label: spin.mini ? "T-SPIN MINI SINGLE" : "T-SPIN SINGLE",
        difficult: true,
      };
    }
    if (n === 2) {
      return { base: SCORE_TABLE.tspin2, label: "T-SPIN DOUBLE", difficult: true };
    }
    return { base: SCORE_TABLE.tspin3, label: "T-SPIN TRIPLE", difficult: true };
  }
  if (n === 1) return { base: SCORE_TABLE.single, label: "SINGLE", difficult: false };
  if (n === 2) return { base: SCORE_TABLE.double, label: "DOUBLE", difficult: false };
  if (n === 3) return { base: SCORE_TABLE.triple, label: "TRIPLE", difficult: false };
  if (n === 4) return { base: SCORE_TABLE.tetris, label: "TETRIS", difficult: true };
  return { base: 0, label: "", difficult: false };
}

export function perfectClearBonus(
  clearCount: number,
  level: number,
  previousBackToBack: boolean,
): number {
  if (clearCount === 1) return SCORE_TABLE.perfectClearSingle * level;
  if (clearCount === 2) return SCORE_TABLE.perfectClearDouble * level;
  if (clearCount === 3) return SCORE_TABLE.perfectClearTriple * level;
  if (clearCount === 4) {
    const base = previousBackToBack
      ? SCORE_TABLE.perfectClearB2BTetris
      : SCORE_TABLE.perfectClearTetris;
    return base * level;
  }
  return 0;
}

/** One verified lock the play surface reported; score fields are ignored. */
export interface StackLockInput {
  piece: PieceType;
  rotation: number;
  x: number;
  y: number;
  /** Cells travelled on a hard drop immediately before this lock. Soft drop is never scored. */
  hardDropCells?: number;
  /** Client may claim a T-spin; the engine re-detects from the board after placement. */
  claimedSpin?: SpinInfo;
}

export interface StackScoreResult {
  score: number;
  durationMs: number;
  breakdown: Record<string, unknown>;
  lines: number;
  level: number;
  locks: number;
}
