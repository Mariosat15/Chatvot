/**
 * Volt Stack fairness tests. Run with `npx tsx tools/test-volt-stack.ts`.
 *
 * THE LOAD-BEARING PROPERTIES
 * ---------------------------
 * 1. Same content seed → same piece bag (fair contests).
 * 2. Same locks → same score (server recompute is deterministic).
 * 3. Soft-drop points are structurally zero (no farming).
 * 4. A client-supplied `score` field is refused / ignored.
 * 5. A piece out of bag order is refused (tamper).
 */

import assert from "node:assert/strict";

import {
  applyLock,
  createStackEngine,
  derivePieceSeed,
  scoreFromLocks,
} from "../src/games/volt-stack/engine";
import {
  HARD_DROP_POINTS_PER_CELL,
  SOFT_DROP_POINTS_PER_CELL,
  type StackLockInput,
} from "../src/games/volt-stack/scoring";
import { sequenceForSeed, matrixFor, COLS, ROWS } from "../src/games/volt-stack/shapes";
import { parseStackLockInput, scoreVoltStackRound, zeroScore } from "../src/games/scoring";
import { findTitle, resolveConfig, VOLT_STACK, VOLT_STACK_CODE } from "../src/games/titles";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(error as Error).message.split("\n")[0]}`);
  }
}

/** Drop the next expected piece straight down at its spawn column. */
function dropNext(engine: ReturnType<typeof createStackEngine>, hardDropCells = 0): StackLockInput {
  const piece = engine.queue[0]!;
  const rotation = 0;
  const matrix = matrixFor(piece, rotation);
  const x = piece === "O" ? 4 : Math.floor((COLS - matrix[0]!.length) / 2);
  let y = 3; // HIDDEN_ROWS - 1, matches the client spawn
  // Walk down until resting.
  const collides = (py: number): boolean => {
    for (let my = 0; my < matrix.length; my++) {
      // eslint-disable-next-line security/detect-object-injection -- loop index into matrix rows
      const row = matrix[my]!;
      for (let mx = 0; mx < row.length; mx++) {
        // eslint-disable-next-line security/detect-object-injection -- loop index into matrix cells
        if (!row[mx]) continue;
        const by = py + my;
        const bx = x + mx;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        // eslint-disable-next-line security/detect-object-injection -- loop indices into the board
        if (by >= 0 && engine.board[by]![bx]) return true;
      }
    }
    return false;
  };
  while (!collides(y + 1)) y++;
  const input: StackLockInput = { piece, rotation, x, y, hardDropCells };
  const result = applyLock(engine, input);
  assert.equal(result.ok, true, `drop of ${piece} failed: ${!result.ok ? result.reason : ""}`);
  return input;
}

console.log("\nVolt Stack - catalogue");

test("title is active in the catalogue with competition + 1v1 + content seed", () => {
  const title = findTitle(VOLT_STACK_CODE);
  assert.ok(title);
  assert.equal(title!.status, "active");
  assert.equal(title!.supportsCompetition, true);
  assert.equal(title!.supportsOneVsOne, true);
  assert.equal(title!.supportsContentSeed, true);
  assert.equal(title!.family, "independent");
  assert.equal(title!.scoreDirection, "higher_is_better");
  const resolved = resolveConfig(title!, { durationSeconds: 120 });
  assert.equal(resolved.config.kind, "volt-stack");
});

console.log("\nVolt Stack - seeded bag");

test("same seed yields an identical piece sequence", () => {
  const a = sequenceForSeed("fair-contest-seed", 28);
  const b = sequenceForSeed("fair-contest-seed", 28);
  assert.deepEqual(a, b);
});

test("different seeds diverge within the first bag", () => {
  const a = sequenceForSeed("seed-a", 7);
  const b = sequenceForSeed("seed-b", 7);
  assert.notDeepEqual(a, b);
});

test("derivePieceSeed is stable and does not equal the content seed", () => {
  const content = "contest-content-seed-xyz";
  const once = derivePieceSeed(content);
  const twice = derivePieceSeed(content);
  assert.equal(once, twice);
  assert.notEqual(once, content);
  assert.match(once, /^[a-f0-9]{64}$/);
});

console.log("\nVolt Stack - scoring authority");

test("soft-drop points are structurally zero", () => {
  assert.equal(SOFT_DROP_POINTS_PER_CELL, 0);
  assert.equal(HARD_DROP_POINTS_PER_CELL, 2);
});

test("same locks produce the same score", () => {
  const seed = derivePieceSeed("volt-score-seed");
  const engine = createStackEngine(seed);
  const locks: StackLockInput[] = [];
  for (let i = 0; i < 8; i++) locks.push(dropNext(engine, i % 2 === 0 ? 4 : 0));

  const first = scoreFromLocks(seed, locks, 30_000);
  const second = scoreFromLocks(seed, locks, 30_000);
  assert.equal(first.score, second.score);
  assert.equal(first.breakdown.locks, 8);

  const titled = scoreVoltStackRound(VOLT_STACK, seed, locks, 30_000);
  assert.equal(titled.score, first.score);
});

test("hard-drop cells add 2 points each and soft path adds none", () => {
  const seed = derivePieceSeed("hard-drop-seed");
  const softEngine = createStackEngine(seed);
  const softLocks: StackLockInput[] = [];
  for (let i = 0; i < 3; i++) softLocks.push(dropNext(softEngine, 0));

  const hardEngine = createStackEngine(seed);
  const hardLocks: StackLockInput[] = [];
  for (let i = 0; i < 3; i++) hardLocks.push(dropNext(hardEngine, 10));

  const soft = scoreFromLocks(seed, softLocks, 5_000);
  const hard = scoreFromLocks(seed, hardLocks, 5_000);
  assert.equal(hard.score - soft.score, 3 * 10 * HARD_DROP_POINTS_PER_CELL);
});

test("a piece out of bag order is refused", () => {
  const seed = derivePieceSeed("tamper-seed");
  const engine = createStackEngine(seed);
  const expected = engine.queue[0]!;
  const wrong = expected === "I" ? "O" : "I";
  const result = applyLock(engine, {
    piece: wrong,
    rotation: 0,
    x: 4,
    y: 20,
    hardDropCells: 0,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "piece_mismatch");
});

test("parseStackLockInput ignores a client score field", () => {
  const parsed = parseStackLockInput({
    piece: "T",
    rotation: 0,
    x: 3,
    y: 18,
    hardDropCells: 2,
    score: 999_999,
  });
  assert.ok(parsed);
  assert.equal(parsed!.piece, "T");
  assert.equal((parsed as { score?: number }).score, undefined);
});

test("zeroScore for volt-stack is 0 with an empty lock breakdown", () => {
  const resolved = resolveConfig(VOLT_STACK, { durationSeconds: 120 });
  assert.equal(resolved.config.kind, "volt-stack");
  const zero = zeroScore(VOLT_STACK, resolved.config);
  assert.equal(zero.score, 0);
  assert.equal(zero.breakdown.locks, 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
