/**
 * Authoritative Volt Stack board: place locks from the seeded bag, clear lines, score.
 *
 * Hold is allowed in every round. It never changes the bag - every entrant still draws the
 * same seeded sequence - it only changes which of two known pieces is placed next, so a
 * lock must be the next bag piece or the piece in hold (see `consumeLockedPiece`).
 * Soft-drop points are never awarded. A client `score` field is never read.
 */

/* eslint-disable security/detect-object-injection --
   Reason: board/matrix cells are addressed by loop counters and validated piece
   coordinates, not by looking up arbitrary keys on a caller-supplied object. */

import crypto from "crypto";

import {
  COLS,
  HIDDEN_ROWS,
  ROWS,
  createPieceRng,
  isPieceType,
  matrixFor,
  shuffledBag,
  type PieceType,
} from "./shapes";
import {
  HARD_DROP_POINTS_PER_CELL,
  MILESTONE_RULES,
  SOFT_DROP_POINTS_PER_CELL,
  perfectClearBonus,
  scoreClear,
  type SpinInfo,
  type StackLockInput,
  type StackScoreResult,
} from "./scoring";

type Cell = PieceType | null;

export interface StackEngineState {
  board: Cell[][];
  bag: PieceType[];
  rng: () => number;
  queue: PieceType[];
  /** The piece in hold, as far as the locks so far prove it. */
  held: PieceType | null;
  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBack: boolean;
  locks: number;
  awardedMilestones: Set<string>;
  pieceSeed: string;
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function nextFromBag(state: StackEngineState): PieceType {
  if (!state.bag.length) state.bag = shuffledBag(state.rng);
  return state.bag.pop()!;
}

function refillQueue(state: StackEngineState): void {
  while (state.queue.length < 6) state.queue.push(nextFromBag(state));
}

export function createStackEngine(pieceSeed: string): StackEngineState {
  const rng = createPieceRng(pieceSeed);
  const state: StackEngineState = {
    board: emptyBoard(),
    bag: [],
    rng,
    queue: [],
    held: null,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    backToBack: false,
    locks: 0,
    awardedMilestones: new Set(),
    pieceSeed,
  };
  refillQueue(state);
  return state;
}

function collides(
  board: Cell[][],
  matrix: number[][],
  px: number,
  py: number,
): boolean {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < (matrix[y]?.length ?? 0); x++) {
      if (!matrix[y]![x]) continue;
      const by = py + y;
      const bx = px + x;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by]![bx]) return true;
    }
  }
  return false;
}

function occupiedCorner(board: Cell[][], x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
  return Boolean(board[y]![x]);
}

function detectTSpin(
  board: Cell[][],
  piece: PieceType,
  rotation: number,
  x: number,
  y: number,
  claimed: boolean,
): SpinInfo {
  if (piece !== "T" || !claimed) return { tspin: false, mini: false };
  const cx = x + 1;
  const cy = y + 1;
  const corners = [
    occupiedCorner(board, cx - 1, cy - 1),
    occupiedCorner(board, cx + 1, cy - 1),
    occupiedCorner(board, cx - 1, cy + 1),
    occupiedCorner(board, cx + 1, cy + 1),
  ];
  const filled = corners.filter(Boolean).length;
  if (filled < 3) return { tspin: false, mini: false };
  const frontByRot: Record<number, [number, number]> = {
    0: [0, 1],
    1: [1, 3],
    2: [2, 3],
    3: [0, 2],
  };
  const front = frontByRot[rotation] ?? [0, 1];
  const frontFilled = (corners[front[0]] ? 1 : 0) + (corners[front[1]] ? 1 : 0);
  return { tspin: true, mini: frontFilled < 2 };
}

function findFullRows(board: Cell[][]): number[] {
  const rows: number[] = [];
  for (let y = 0; y < ROWS; y++) {
    if (board[y]!.every((cell) => cell !== null)) rows.push(y);
  }
  return rows;
}

function clearRows(board: Cell[][], rows: number[]): void {
  const remove = new Set(rows);
  const kept = board.filter((_, y) => !remove.has(y));
  while (kept.length < ROWS) kept.unshift(Array<Cell>(COLS).fill(null));
  for (let y = 0; y < ROWS; y++) board[y] = kept[y]!;
}

function isPerfectClear(board: Cell[][]): boolean {
  return board.every((row) => row.every((cell) => cell === null));
}

function milestoneBonus(state: StackEngineState): number {
  let bonus = 0;
  for (const rule of MILESTONE_RULES) {
    if (state.awardedMilestones.has(rule.key)) continue;
    const reached =
      rule.type === "lines" ? state.lines >= rule.value : state.level >= rule.value;
    if (!reached) continue;
    state.awardedMilestones.add(rule.key);
    bonus += rule.bonus * Math.max(1, Math.floor(state.level / 3));
  }
  return bonus;
}

/**
 * Advance the bag for one locked piece. Legal placements, in order of preference:
 * the next bag piece (no hold, or a swap with a same-type held piece); the held piece
 * (a swap - the next bag piece goes into hold); or, with hold empty, the piece after
 * next (first hold - the next bag piece goes into hold).
 *
 * Reason: preferring the plain match when types coincide can leave the server's hold
 * empty while the client's holds an identical piece at the queue front. The two states
 * accept exactly the same future locks, so the greedy choice never refuses a real game.
 */
export function consumeLockedPiece(state: StackEngineState, piece: PieceType): boolean {
  refillQueue(state);
  if (piece === state.queue[0]) {
    state.queue.shift();
  } else if (state.held !== null && piece === state.held) {
    state.held = state.queue.shift()!;
  } else if (state.held === null && piece === state.queue[1]) {
    state.held = state.queue.shift()!;
    state.queue.shift();
  } else {
    return false;
  }
  refillQueue(state);
  return true;
}

export type ApplyLockResult =
  | { ok: true; gained: number; clearCount: number; state: StackEngineState }
  | { ok: false; reason: string };

export function applyLock(
  state: StackEngineState,
  input: StackLockInput,
): ApplyLockResult {
  if (!isPieceType(input.piece)) {
    return { ok: false, reason: "invalid_piece" };
  }

  if (!consumeLockedPiece(state, input.piece)) {
    return { ok: false, reason: "piece_mismatch" };
  }

  const rotation = ((Math.trunc(input.rotation) % 4) + 4) % 4;
  const matrix = matrixFor(input.piece, rotation);
  const x = Math.trunc(input.x);
  const y = Math.trunc(input.y);

  if (collides(state.board, matrix, x, y)) {
    return { ok: false, reason: "collision" };
  }
  if (!collides(state.board, matrix, x, y + 1)) {
    return { ok: false, reason: "not_resting" };
  }

  let anyVisible = false;
  for (let my = 0; my < matrix.length; my++) {
    for (let mx = 0; mx < (matrix[my]?.length ?? 0); mx++) {
      if (!matrix[my]![mx]) continue;
      const by = y + my;
      const bx = x + mx;
      if (by < 0) return { ok: false, reason: "lock_out" };
      if (by < ROWS && bx >= 0 && bx < COLS) {
        state.board[by]![bx] = input.piece;
        if (by >= HIDDEN_ROWS) anyVisible = true;
      }
    }
  }

  const claimedSpin = Boolean(input.claimedSpin?.tspin);
  const spin = detectTSpin(state.board, input.piece, rotation, x, y, claimedSpin);

  const clearedRows = findFullRows(state.board);
  const clearCount = clearedRows.length;

  if (clearCount === 0 && !anyVisible) {
    return { ok: false, reason: "lock_out" };
  }

  const scoringLevel = state.level;
  const scoring = scoreClear(clearCount, spin);
  const previousBackToBack = state.backToBack;
  const qualifiesB2B = Boolean(scoring.difficult && clearCount > 0);

  if (clearCount > 0) state.combo++;
  else state.combo = -1;

  const basePoints = scoring.base * scoringLevel;
  const backToBackBonus =
    qualifiesB2B && previousBackToBack ? Math.round(basePoints * 0.5) : 0;
  const comboBonus =
    clearCount > 0 && state.combo > 0 ? 50 * state.combo * scoringLevel : 0;

  let perfect = false;
  if (clearCount > 0) {
    const probe = state.board.map((row) => [...row]);
    clearRows(probe, clearedRows);
    perfect = isPerfectClear(probe);
  }
  const pcBonus = perfect
    ? perfectClearBonus(clearCount, scoringLevel, previousBackToBack)
    : 0;

  const hardCells = Math.max(0, Math.min(40, Math.trunc(input.hardDropCells ?? 0)));
  const hardDropPoints = hardCells * HARD_DROP_POINTS_PER_CELL;
  const softDropPoints = SOFT_DROP_POINTS_PER_CELL * 0;

  if (clearCount > 0) {
    clearRows(state.board, clearedRows);
    state.backToBack = qualifiesB2B;
    state.lines += clearCount;
    state.level = Math.floor(state.lines / 10) + 1;
  }

  const milestones = milestoneBonus(state);
  const gained =
    basePoints +
    backToBackBonus +
    comboBonus +
    pcBonus +
    hardDropPoints +
    softDropPoints +
    milestones;

  state.score += gained;
  state.locks += 1;

  return { ok: true, gained, clearCount, state };
}

export function scoreFromLocks(
  pieceSeed: string,
  locks: StackLockInput[],
  durationMs: number,
): StackScoreResult {
  const engine = createStackEngine(pieceSeed);
  for (const lock of locks) {
    const result = applyLock(engine, lock);
    if (!result.ok) {
      throw new Error(`Volt Stack lock refused: ${result.reason}`);
    }
  }
  return {
    score: engine.score,
    durationMs,
    lines: engine.lines,
    level: engine.level,
    locks: engine.locks,
    breakdown: {
      locks: engine.locks,
      lines: engine.lines,
      level: engine.level,
      softDropPointsPerCell: SOFT_DROP_POINTS_PER_CELL,
      hardDropPointsPerCell: HARD_DROP_POINTS_PER_CELL,
    },
  };
}

/** One-way bag seed so the client never sees `contentSeed`. */
export function derivePieceSeed(contentSeed: string): string {
  return crypto
    .createHash("sha256")
    .update(`volt-stack-bag:${contentSeed}`, "utf8")
    .digest("hex");
}
