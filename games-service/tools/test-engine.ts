/**
 * Engine tests for Circuit. Run with `npx tsx tools/test-engine.ts`.
 *
 * WHY node:assert AND NOT A TEST FRAMEWORK
 * ----------------------------------------
 * This service deliberately shares nothing with the platform, including its tooling. A test
 * runner would be a dependency added for convenience, and the assertions here are simple
 * enough not to need one. If this grows into something that needs fixtures and mocks, that is
 * the moment to add a runner - not before.
 *
 * THE CENTRAL TEST IS THE CROSS-CHECK
 * -----------------------------------
 * `generate.ts` and `verify.ts` are two independent implementations of the same rules: one
 * builds a covering set of non-crossing paths, the other decides whether a covering set of
 * non-crossing paths is valid. Feeding the generator's own solution to the verifier is
 * therefore not a tautology - it is the cheapest available proof that the two agree about what
 * the game is. A bug in either shows up here.
 *
 * The determinism tests matter for a different reason: section 12 of the provider
 * specification requires that one seed produces identical content indefinitely, and a failure
 * would be silent - two players in one contest quietly solving different puzzles while the
 * ranking pays out real money.
 */

import assert from "node:assert/strict";

import { SeededRandom, derive } from "../src/engine/rng";
import { generateForPlayer, generatePuzzle, PuzzleShape } from "../src/engine/generate";
import {
  Cell,
  GeneratedPuzzle,
  TRANSFORM_COUNT,
  cellKey,
  transformCell,
  transformPuzzle,
  transformedDimensions,
} from "../src/engine/puzzle";
import { verifyAttempt } from "../src/engine/verify";

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

/** The generator's solution, in the shape the verifier expects from a browser. */
function solutionAsSubmission(puzzle: GeneratedPuzzle) {
  return puzzle.pairs.map((pair, index) => ({
    pairId: pair.id,
    // `index` is the map callback's own counter, bounded by the pairs array.
    // eslint-disable-next-line security/detect-object-injection
    cells: puzzle.solution[index].map((c) => [c[0], c[1]]),
  }));
}

const SHAPES: PuzzleShape[] = [
  { width: 5, height: 5, minPairs: 3, maxPairs: 5 },
  { width: 6, height: 6, minPairs: 4, maxPairs: 6 },
  { width: 7, height: 7, minPairs: 4, maxPairs: 7 },
  { width: 5, height: 7, minPairs: 3, maxPairs: 6 },
  { width: 8, height: 6, minPairs: 5, maxPairs: 8 },
];

console.log("\nSeeded random");

test("same seed produces the same stream", () => {
  const a = new SeededRandom("cv_ctst_774219");
  const b = new SeededRandom("cv_ctst_774219");
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
});

test("different seeds diverge", () => {
  const a = new SeededRandom("cv_ctst_774219");
  const b = new SeededRandom("cv_ctst_774220");
  const left = Array.from({ length: 20 }, () => a.next());
  const right = Array.from({ length: 20 }, () => b.next());
  assert.notDeepEqual(left, right);
});

test("adjacent seeds do not produce adjacent streams", () => {
  // Reason: contest ids are sequential. Without hashing the seed, contest 774219 and 774220
  // would produce visibly similar puzzle sets, which a regular player would notice.
  const a = new SeededRandom("cv_ctst_774219");
  const b = new SeededRandom("cv_ctst_774220");
  assert.ok(Math.abs(a.next() - b.next()) > 0.01);
});

test("output stays within [0, 1)", () => {
  const rng = new SeededRandom("range");
  for (let i = 0; i < 5000; i++) {
    const value = rng.next();
    assert.ok(value >= 0 && value < 1, `got ${value}`);
  }
});

console.log("\nGeneration");

test("every generated puzzle is solvable by its own solution", () => {
  for (const shape of SHAPES) {
    for (let i = 0; i < 25; i++) {
      const puzzle = generatePuzzle(derive("seed", shape.width, shape.height, i), shape);
      const result = verifyAttempt(puzzle, solutionAsSubmission(puzzle));
      assert.ok(
        result.solved,
        `${shape.width}x${shape.height} #${i}: ${JSON.stringify(result)}`,
      );
    }
  }
});

test("the solution covers every cell", () => {
  for (const shape of SHAPES) {
    const puzzle = generatePuzzle(derive("coverage", shape.width), shape);
    const cells = new Set<string>();
    for (const path of puzzle.solution) for (const cell of path) cells.add(cellKey(cell));
    assert.equal(cells.size, shape.width * shape.height);
  }
});

test("no pair is degenerate - two terminals are never the same cell", () => {
  // Reason: a one-cell path yields a "pair" that is already connected to itself, which is
  // unsolvable-looking to a player and unscoreable for us.
  for (const shape of SHAPES) {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle(derive("degenerate", i), shape);
      for (const pair of puzzle.pairs) {
        assert.notDeepEqual(pair.a, pair.b, `pair ${pair.id}`);
      }
      for (const path of puzzle.solution) {
        assert.ok(path.length >= 2, `path of ${path.length}`);
      }
    }
  }
});

test("pair count lands inside the requested band", () => {
  let inBand = 0;
  let total = 0;
  for (const shape of SHAPES) {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle(derive("band", shape.width, i), shape);
      total++;
      if (puzzle.pairs.length >= shape.minPairs && puzzle.pairs.length <= shape.maxPairs) {
        inBand++;
      }
    }
  }
  // Not asserted at 100%: the band is a difficulty preference and the generator deliberately
  // falls back to a valid out-of-band puzzle rather than failing a paid round. Asserting
  // against the observed rate keeps the test honest about what the code promises.
  assert.ok(inBand / total > 0.9, `${inBand}/${total} in band`);
});

console.log("\nDeterminism - section 12 of the provider spec");

test("same seed and shape produce an identical puzzle", () => {
  for (const shape of SHAPES) {
    const first = generatePuzzle("cv_ctst_774219", shape);
    const second = generatePuzzle("cv_ctst_774219", shape);
    assert.deepEqual(first, second);
  }
});

test("different seeds produce different puzzles", () => {
  const shape = SHAPES[2];
  const first = generatePuzzle("cv_ctst_774219", shape);
  const second = generatePuzzle("cv_ctst_774220", shape);
  assert.notDeepEqual(first.pairs, second.pairs);
});

test("regenerating one puzzle of a set does not require replaying the others", () => {
  // Reason: support has to reproduce puzzle 4 of a disputed round on its own.
  const shape = SHAPES[1];
  const direct = generatePuzzle(derive("cv_ctst_1", "puzzle", 3), shape);
  const again = generatePuzzle(derive("cv_ctst_1", "puzzle", 3), shape);
  assert.deepEqual(direct, again);
});

test("content is identical across players; only presentation differs", () => {
  const shape = SHAPES[2];
  const a = generateForPlayer("cv_ctst_5", "round_a", 0, shape);
  const b = generateForPlayer("cv_ctst_5", "round_b", 0, shape);

  // Same underlying content: the multiset of path lengths is a transform-invariant of the
  // puzzle, so if these differ the content itself changed and fairness is gone.
  const lengths = (p: GeneratedPuzzle) => p.solution.map((s) => s.length).sort((x, y) => x - y);
  assert.deepEqual(lengths(a), lengths(b));
  assert.equal(a.pairs.length, b.pairs.length);
});

console.log("\nPresentation transform");

test("all eight transforms keep the puzzle solvable", () => {
  const shape = SHAPES[3];
  const canonical = generatePuzzle("transform-seed", shape);
  for (let t = 0; t < TRANSFORM_COUNT; t++) {
    const moved = transformPuzzle(canonical, t);
    const result = verifyAttempt(moved, solutionAsSubmission(moved));
    assert.ok(result.solved, `transform ${t}: ${JSON.stringify(result)}`);
  }
});

test("rotations swap width and height", () => {
  const dims = { width: 5, height: 7 };
  assert.deepEqual(transformedDimensions(dims, 0), { width: 5, height: 7 });
  assert.deepEqual(transformedDimensions(dims, 1), { width: 7, height: 5 });
  assert.deepEqual(transformedDimensions(dims, 2), { width: 5, height: 7 });
  assert.deepEqual(transformedDimensions(dims, 3), { width: 7, height: 5 });
});

test("each transform is a bijection on the grid", () => {
  const dims = { width: 4, height: 6 };
  for (let t = 0; t < TRANSFORM_COUNT; t++) {
    const seen = new Set<string>();
    for (let y = 0; y < dims.height; y++) {
      for (let x = 0; x < dims.width; x++) {
        seen.add(cellKey(transformCell([x, y], dims, t)));
      }
    }
    assert.equal(seen.size, dims.width * dims.height, `transform ${t} collides`);
  }
});

test("transforms actually differ, so the mitigation is not cosmetic", () => {
  const shape = SHAPES[2];
  const canonical = generatePuzzle("distinct", shape);
  const signatures = new Set<string>();
  for (let t = 0; t < TRANSFORM_COUNT; t++) {
    signatures.add(JSON.stringify(transformPuzzle(canonical, t).pairs));
  }
  // A symmetric puzzle can legitimately collapse some variants, so this asserts most rather
  // than all - but one signature would mean the transform does nothing.
  assert.ok(signatures.size >= 4, `only ${signatures.size} distinct presentations`);
});

console.log("\nVerification - the rules");

const SHAPE = SHAPES[1];
const PUZZLE = generatePuzzle("verify-seed", SHAPE);

test("accepts a correct solution", () => {
  assert.ok(verifyAttempt(PUZZLE, solutionAsSubmission(PUZZLE)).solved);
});

test("verifies a puzzle that carries no solution at all", () => {
  // This is the structural proof that an attempt is judged against the rules and not against
  // the generator's stored path list: the object handed to the verifier has width, height and
  // pairs, and no solution field exists for it to compare with. A Circuit puzzle often has
  // several valid coverings, so a verifier that compared would reject correct answers - and
  // would reject the unusual routes first, which are the ones a player most likely reasoned
  // out rather than copied.
  const noSolution = {
    width: 3,
    height: 1,
    pairs: [{ id: 0, a: [0, 0] as Cell, b: [2, 0] as Cell }],
  };
  assert.ok(!("solution" in noSolution));
  assert.ok(verifyAttempt(noSolution, [{ pairId: 0, cells: [[0, 0], [1, 0], [2, 0]] }]).solved);
});

test("accepts two different coverings of the same puzzle", () => {
  // A 2x3 grid with two pairs, laid out so that the grid can legitimately be covered two
  // different ways. Both must be accepted.
  //
  //   pair 0: (0,0) -> (0,2)      pair 1: (1,0) -> (1,2)
  //
  // Covering A runs each pair straight down its own column. Covering B weaves: pair 0 goes
  // down the left column, and pair 1 must then also run straight - so for a genuine second
  // covering the pairs are placed to allow a detour.
  const puzzle = {
    width: 2,
    height: 3,
    pairs: [
      { id: 0, a: [0, 0] as Cell, b: [1, 0] as Cell },
      { id: 1, a: [0, 2] as Cell, b: [1, 2] as Cell },
    ],
  };
  // A: pair 0 takes the top row, pair 1 takes the middle and bottom rows.
  const coveringA = [
    { pairId: 0, cells: [[0, 0], [1, 0]] },
    { pairId: 1, cells: [[0, 2], [0, 1], [1, 1], [1, 2]] },
  ];
  // B: pair 0 dips through the middle row, pair 1 takes the bottom row.
  const coveringB = [
    { pairId: 0, cells: [[0, 0], [0, 1], [1, 1], [1, 0]] },
    { pairId: 1, cells: [[0, 2], [1, 2]] },
  ];
  assert.ok(verifyAttempt(puzzle, coveringA).solved, "covering A");
  assert.ok(verifyAttempt(puzzle, coveringB).solved, "covering B");
});

test("rejects reversed-order paths only when endpoints are wrong", () => {
  const submission = solutionAsSubmission(PUZZLE).map((p) => ({
    pairId: p.pairId,
    cells: [...p.cells].reverse(),
  }));
  assert.ok(verifyAttempt(PUZZLE, submission).solved, "either orientation must be accepted");
});

/*
 * Each of the next three tests breaks exactly ONE rule and asserts the refusal names that
 * rule.
 *
 * They are written this way because the obvious version does not work, and it took probing to
 * see why. Mutating a generated solution breaks several rules at once - shortening a path
 * breaks its endpoints AND leaves the grid uncovered - so a test asserting only `solved ===
 * false` passes no matter which guard caught it. Removing the adjacency check, the overlap
 * check or the endpoint check individually left the whole suite green, because coverage
 * quietly refused the attempt in every case.
 *
 * The general form is worth carrying: ASSERTING THAT SOMETHING WAS REFUSED CANNOT TELL YOU
 * WHICH RULE REFUSED IT, so one guard silently covers for every other, and a suite full of
 * such tests reports the rules as protected while none of them is.
 */

test("rejects overlapping paths, with coverage and adjacency intact", () => {
  // 3x2. Both pairs are connected correctly and contiguously, and every cell is used - but
  // pair 1 routes through two cells pair 0 already owns. Overlap is the only rule broken.
  const puzzle = {
    width: 3,
    height: 2,
    pairs: [
      { id: 0, a: [0, 0] as Cell, b: [2, 0] as Cell },
      { id: 1, a: [0, 1] as Cell, b: [2, 1] as Cell },
    ],
  };
  const overlapping = [
    { pairId: 0, cells: [[0, 0], [1, 0], [2, 0]] },
    { pairId: 1, cells: [[0, 1], [0, 0], [1, 0], [1, 1], [2, 1]] },
  ];
  const result = verifyAttempt(puzzle, overlapping);
  assert.ok(
    !result.solved && result.reason === "paths_overlap",
    `expected paths_overlap, got ${JSON.stringify(result)}`,
  );
});

test("rejects a diagonal jump, with coverage and endpoints intact", () => {
  // 2x2. The path covers all four cells and starts and ends on its own terminals, but steps
  // from (0,1) to (1,0), which is a diagonal and not a move.
  const puzzle = {
    width: 2,
    height: 2,
    pairs: [{ id: 0, a: [0, 0] as Cell, b: [1, 1] as Cell }],
  };
  const jumping = [{ pairId: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }];
  const result = verifyAttempt(puzzle, jumping);
  assert.ok(
    !result.solved && result.reason === "not_contiguous",
    `expected not_contiguous, got ${JSON.stringify(result)}`,
  );
});

test("rejects wrong endpoints, with coverage and adjacency intact", () => {
  // 2x2. Contiguous, covers everything, no overlap - but it begins at (1,0), which is not one
  // of this pair's terminals.
  const puzzle = {
    width: 2,
    height: 2,
    pairs: [{ id: 0, a: [0, 0] as Cell, b: [1, 1] as Cell }],
  };
  const wrongStart = [{ pairId: 0, cells: [[1, 0], [0, 0], [0, 1], [1, 1]] }];
  const result = verifyAttempt(puzzle, wrongStart);
  assert.ok(
    !result.solved && result.reason === "endpoints_do_not_match",
    `expected endpoints_do_not_match, got ${JSON.stringify(result)}`,
  );
});

test("rejects a missing path as a pair-count error", () => {
  const submission = solutionAsSubmission(PUZZLE);
  submission.pop();
  const result = verifyAttempt(PUZZLE, submission);
  assert.equal(result.solved, false);
  assert.ok(!result.solved && result.reason === "wrong_pair_count");
});

test("rejects incomplete coverage when everything else is correct", () => {
  // This is the only test that reaches the coverage rule, and it needs a hand-built puzzle to
  // do it. Dropping a path from a generated puzzle trips the pair-count check first, and
  // shortening one trips the endpoint check - so an earlier version of this test asserted
  // "incomplete coverage" while never executing that branch at all.
  //
  // Here the single pair is connected correctly, contiguously, in bounds and without overlap.
  // The top row is a legal path from terminal to terminal; it simply leaves the bottom row
  // unused. Coverage is the only rule left to fail.
  const puzzle = {
    width: 3,
    height: 2,
    pairs: [{ id: 0, a: [0, 0] as Cell, b: [2, 0] as Cell }],
  };
  const topRowOnly = [{ pairId: 0, cells: [[0, 0], [1, 0], [2, 0]] }];
  const result = verifyAttempt(puzzle, topRowOnly);
  assert.equal(result.solved, false);
  assert.ok(
    !result.solved && result.reason === "incomplete_coverage",
    `expected incomplete_coverage, got ${JSON.stringify(result)}`,
  );
});

test("rejects out-of-bounds cells", () => {
  const submission = solutionAsSubmission(PUZZLE);
  submission[0].cells[1] = [999, 999];
  const result = verifyAttempt(PUZZLE, submission);
  assert.equal(result.solved, false);
  assert.ok(!result.solved && result.reason === "out_of_bounds");
});

test("rejects a duplicated pair", () => {
  const submission = solutionAsSubmission(PUZZLE);
  submission[1].pairId = submission[0].pairId;
  const result = verifyAttempt(PUZZLE, submission);
  assert.equal(result.solved, false);
});

test("rejects an unknown pair id", () => {
  const submission = solutionAsSubmission(PUZZLE);
  submission[0].pairId = 4242;
  const result = verifyAttempt(PUZZLE, submission);
  assert.equal(result.solved, false);
  assert.ok(!result.solved && result.reason === "unknown_pair");
});

console.log("\nVerification - hostile input");

for (const [label, payload] of [
  ["null", null],
  ["a string", "solved"],
  ["a number", 1],
  ["an object", { pairId: 0 }],
  ["a path that is not an array", [{ pairId: 0, cells: "everything" }]],
  ["a non-integer coordinate", [{ pairId: 0, cells: [[0.5, 0]] }]],
  ["a NaN coordinate", [{ pairId: 0, cells: [[NaN, 0]] }]],
  ["a three-element cell", [{ pairId: 0, cells: [[0, 0, 0]] }]],
  ["a negative pair id", [{ pairId: -1, cells: [[0, 0]] }]],
  ["a nested array bomb", [{ pairId: 0, cells: [[[0], [0]]] }]],
] as [string, unknown][]) {
  test(`refuses ${label} without throwing`, () => {
    const result = verifyAttempt(PUZZLE, payload);
    assert.equal(result.solved, false);
  });
}

/*
 * There are TWO size guards, and one test only ever reached the first.
 *
 * A payload of ten thousand short paths is stopped by the path-count guard, so the
 * total-cells guard could be deleted with the suite staying green - it was not a weak test but
 * an unreachable one. Two payloads are needed, one aimed at each.
 */

test("refuses an absurd number of paths", () => {
  // Empty paths on purpose: they contribute nothing to the cell total, so this payload can
  // only be stopped by the path cap. With cells in them the cell cap fires first and this
  // guard is never reached - which is exactly what an earlier version of this test failed to
  // notice, leaving the path cap deletable with the suite green.
  const tooManyPaths = Array.from({ length: 10_000 }, (_, i) => ({
    pairId: i,
    cells: [],
  }));
  const result = verifyAttempt(PUZZLE, tooManyPaths);
  assert.ok(!result.solved && result.reason === "malformed", JSON.stringify(result));
});

test("refuses an absurd number of cells, in few paths", () => {
  const fewHugePaths = [
    { pairId: 0, cells: Array.from({ length: 50_000 }, () => [0, 0]) },
    { pairId: 1, cells: Array.from({ length: 50_000 }, () => [1, 0]) },
  ];
  const result = verifyAttempt(PUZZLE, fewHugePaths);
  assert.ok(!result.solved && result.reason === "malformed", JSON.stringify(result));
});

test("an overlapping submission is named as overlapping, not as malformed", () => {
  // This is the regression test for the bug the probes found: the work bound used to be the
  // grid size, so an overlapping submission - which necessarily has more cells than the grid -
  // was refused as unreadable before the overlap rule could name it. The player was told the
  // wrong thing about a correct refusal.
  const puzzle = {
    width: 3,
    height: 2,
    pairs: [
      { id: 0, a: [0, 0] as Cell, b: [2, 0] as Cell },
      { id: 1, a: [0, 1] as Cell, b: [2, 1] as Cell },
    ],
  };
  const overlapping = [
    { pairId: 0, cells: [[0, 0], [1, 0], [2, 0]] },
    { pairId: 1, cells: [[0, 1], [0, 0], [1, 0], [1, 1], [2, 1]] },
  ];
  const result = verifyAttempt(puzzle, overlapping);
  assert.ok(!result.solved && result.reason !== "malformed", JSON.stringify(result));
});

test("a submission carrying a score field cannot influence the outcome", () => {
  // The score is derived on this side. Even if a browser sends one, there is nowhere for it
  // to land - asserted behaviourally rather than by reading the type.
  const submission = solutionAsSubmission(PUZZLE) as unknown[];
  const tampered = submission.map((p) => ({
    ...(p as object),
    score: 999_999,
    solved: true,
    prize: 1_000_000,
  }));
  const result = verifyAttempt(PUZZLE, tampered);
  assert.ok(result.solved, "a correct solution with extra fields is still correct");
  assert.deepEqual(Object.keys(result).sort(), ["cellsUsed", "solved"]);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
