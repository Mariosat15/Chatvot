/**
 * The board client, driven in Node against the real verifier.
 *
 * THE ONE PROPERTY THIS SUITE EXISTS FOR
 * -------------------------------------
 * A board the client offers Submit for must be a board the server accepts. The client necessarily
 * contains its own reading of the rules - it has to know when to enable the button and when a drag
 * is legal - and that is the "one rule, two copies" shape which has produced five defects in this
 * platform's history. Here the copies cannot both be authoritative, but they can still disagree,
 * and the disagreement has a specific cost: the player finishes a grid, taps Submit, and is told
 * their finished puzzle is wrong. On a timed contest that is indistinguishable from the game being
 * broken, and it is unreportable because the server log says the board was refused correctly.
 *
 * So the test drives the client with real pointer drags over a real generated puzzle and hands the
 * result to `verifyAttempt`. Nothing is asserted about the drawing; only about the submission.
 *
 * WHY A HAND-WRITTEN DOM AND NOT A HEADLESS BROWSER
 * -----------------------------------------------
 * The stub below is about forty lines and needs no download, no browser version to pin and no
 * second CI dependency. It is deliberately dumb: it records nothing and answers geometry
 * questions with arithmetic. If a future test needs to assert what was *drawn* rather than what
 * was submitted, that is the point to reach for a real browser - a stub that starts making
 * layout claims is a stub that will start lying about them.
 */

import assert from "assert";

import { generateForPlayer } from "../src/engine/generate";
import { toClientPuzzle, type Cell } from "../src/engine/puzzle";
import { verifyAttempt } from "../src/engine/verify";
import { shapeFor } from "../src/games/titles";

/* ------------------------------------------------------------------------------------------
 * The smallest DOM that `board.js` can run against
 * ----------------------------------------------------------------------------------------- */

const CELL_PX = 40;

/*
 * Every node can hold children, not just the root.
 *
 * It grew this from a flat list on 8 September 2026, when the board started painting into layer
 * groups so a drag repaints the wires without rebuilding the cells and the terminal artwork. A
 * stub that only lets the ROOT hold children would have made that change untestable - and the
 * tempting alternative, flattening the tree in the stub, would have quietly hidden the very thing
 * the change is for: which nodes survive a repaint.
 */
interface FakeNode {
  nodeName: string;
  attributes: Map<string, string>;
  children: FakeNode[];
  textContent: string;
  firstChild: FakeNode | null;
  setAttribute(name: string, value: string): void;
  appendChild(node: FakeNode): void;
  removeChild(node: FakeNode): void;
}

function fakeNode(nodeName: string): FakeNode {
  const node: FakeNode = {
    nodeName,
    attributes: new Map<string, string>(),
    children: [],
    textContent: "",
    firstChild: null,
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    },
    appendChild(child: FakeNode) {
      node.children.push(child);
    },
    removeChild(child: FakeNode) {
      const at = node.children.indexOf(child);
      if (at >= 0) node.children.splice(at, 1);
    },
  };

  Object.defineProperty(node, "firstChild", {
    get() {
      return node.children.length > 0 ? node.children[0] : null;
    },
  });

  return node;
}

/** Every node the board built, at any depth. */
function descendants(node: FakeNode): FakeNode[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

interface FakeSvg extends FakeNode {
  addEventListener(type: string, handler: (event: unknown) => void): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  setPointerCapture(id: number): void;
  handlers: Map<string, (event: unknown) => void>;
  grid: { width: number; height: number };
}

function fakeSvg(): FakeSvg {
  const node = fakeNode("svg") as FakeSvg;
  node.handlers = new Map();
  node.grid = { width: 1, height: 1 };

  node.addEventListener = (type, handler) => {
    node.handlers.set(type, handler);
  };
  node.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: node.grid.width * CELL_PX,
    height: node.grid.height * CELL_PX,
  });
  node.setPointerCapture = () => {};

  return node;
}

// `board.js` reaches for `document` at module scope only inside `element()`, so a two-method stub
// is enough. Installed as a global because the file is written for a browser and must not be
// edited to be testable - a module that needs a test-only branch is a module the test no longer
// covers honestly.
(globalThis as unknown as { document: unknown }).document = {
  createElementNS: (_ns: string, name: string) => fakeNode(name),
};

/* ------------------------------------------------------------------------------------------
 * Driving it
 * ----------------------------------------------------------------------------------------- */

interface Board {
  setPuzzle(puzzle: unknown): void;
  clear(): void;
  lock(): void;
  resize(width: number, height: number): void;
  isComplete(): boolean;
  joinedCount(): number;
  pairCount(): number;
  cellsUsed(): number;
  cellCount(): number;
  submission(): { pairId: number; cells: Cell[] }[];
}

/**
 * Loads the browser module.
 *
 * Both interop shapes are accepted because the loader decides which one appears: run as ESM the
 * named export is on the namespace, and transformed to CommonJS it lands under `default`. Pinning
 * one of them would make this suite fail on a loader upgrade rather than on a real defect.
 */
async function loadCreateBoard(): Promise<
  (svg: unknown, onChange: () => void) => Board
> {
  /*
   * `@ts-expect-error` rather than a declaration file, and rather than `allowJs`.
   *
   * `board.js` is browser code with no types, and the two conventional fixes are both worse. A
   * hand-written `.d.ts` would be a second copy of the `Board` interface that already exists in
   * this file, drifting silently from the module it describes - the shape this repository has been
   * bitten by five times. And `allowJs` would pull the file into the service's program, where
   * `lib` is `ES2022` with no DOM, so every `document` and `window` reference becomes an error and
   * the fix is to add DOM types to the SERVER's compilation.
   *
   * Nothing is lost by suppressing it: the namespace is immediately narrowed to
   * `Record<string, unknown>` and the export is checked at runtime on the next line. And
   * `expect-error` rather than `ignore` means that if types ever do appear, this line fails and
   * somebody deletes the comment.
   */
  // @ts-expect-error - untyped browser module, deliberately; see above.
  const loaded = (await import("../public/play/board.js")) as Record<string, unknown>;
  const direct = loaded.createBoard;
  const viaDefault = (loaded.default as Record<string, unknown> | undefined)?.createBoard;
  const create = direct ?? viaDefault;
  assert.equal(typeof create, "function", "board.js did not export createBoard");
  return create as (svg: unknown, onChange: () => void) => Board;
}

function centre(cell: Cell): { clientX: number; clientY: number } {
  return {
    clientX: cell[0] * CELL_PX + CELL_PX / 2,
    clientY: cell[1] * CELL_PX + CELL_PX / 2,
  };
}

function pointerEvent(cell: Cell) {
  return Object.assign({ pointerId: 1, preventDefault() {} }, centre(cell));
}

/** One drag: press on the first cell, move through the rest, release. */
function drag(svg: FakeSvg, cells: readonly Cell[]): void {
  const [first, ...rest] = cells;
  svg.handlers.get("pointerdown")!(pointerEvent(first));
  for (const cell of rest) {
    svg.handlers.get("pointermove")!(pointerEvent(cell));
  }
  svg.handlers.get("pointerup")!({ preventDefault() {} });
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failed++;
    const message = (error as Error).message.split("\n").slice(0, 3).join(" | ");
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${message}`);
  }
}

async function main(): Promise<void> {
  const createBoard = await loadCreateBoard();

  function boardFor(seed: string, size: "small" | "medium" | "large" = "small") {
    const generated = generateForPlayer(seed, "presentation-" + seed, 0, shapeFor(size));
    const client = toClientPuzzle(generated, 0);
    const svg = fakeSvg();
    svg.grid = { width: client.width, height: client.height };
    let changes = 0;
    const board = createBoard(svg, () => {
      changes++;
    });
    board.setPuzzle(client);
    board.resize(client.width * CELL_PX, client.height * CELL_PX);
    return { generated, client, svg, board, changes: () => changes };
  }

  /**
   * A board over a puzzle written by hand rather than generated.
   *
   * Two of the input rules can only be tested on a shape chosen in advance, and both of them were
   * first written against a generated puzzle and passed while testing nothing.
   *
   * Full coverage needs a position where every pair is joined AND a square is spare, which cannot
   * be reached by editing a solution: shortening any path unjoins its pair, so the completeness
   * check refuses at the joined count and never reaches the coverage half. And the fast-drag walk
   * needs a straight run of known length with nothing in the way, which a generated grid does not
   * promise. `setPuzzle` takes any grid, so the honest answer is to state the shape.
   */
  function syntheticBoard(puzzle: {
    width: number;
    height: number;
    pairs: { id: number; a: Cell; b: Cell }[];
  }) {
    const svg = fakeSvg();
    svg.grid = { width: puzzle.width, height: puzzle.height };
    const board = createBoard(svg, () => {});
    board.setPuzzle(Object.assign({ index: 0 }, puzzle));
    board.resize(puzzle.width * CELL_PX, puzzle.height * CELL_PX);
    return { puzzle, svg, board };
  }

  console.log("");
  console.log("The client and the verifier agree");

  test("a board drawn to the solution is complete, and the verifier accepts it", () => {
    // The whole suite in one assertion pair: the client says Submit is available, and the server
    // rules agree the submission is solved. Either half alone would pass while the game was
    // unplayable.
    const { generated, svg, board } = boardFor("agree-1");

    for (const path of generated.solution) drag(svg, path);

    assert.equal(board.joinedCount(), board.pairCount(), "not every pair was joined");
    assert.equal(board.cellsUsed(), board.cellCount(), "not every cell was used");
    assert.ok(board.isComplete(), "the client would not have offered Submit");

    const verdict = verifyAttempt(generated, board.submission());
    assert.ok(
      verdict.solved,
      "the server refused a board the client called complete: " +
        (verdict.solved ? "" : verdict.reason),
    );
  });

  test("the same holds on the largest grid, where paths are longest", () => {
    // A separate size because the walk-towards stepping and the coverage rule are the two things
    // most likely to differ with grid shape, and `large` is non-square-capable and has up to
    // eight pairs.
    const { generated, svg, board } = boardFor("agree-large", "large");
    for (const path of generated.solution) drag(svg, path);
    assert.ok(board.isComplete());
    assert.ok(verifyAttempt(generated, board.submission()).solved);
  });

  test("a fast drag that skips cells is still walked one cell at a time", () => {
    /*
     * A phone coalesces pointer moves, so a quick drag reports positions several cells apart. If
     * the client refused those, the game would feel unresponsive exactly when the player is trying
     * to be quick - which on a timed title is the difference between skill and input lag.
     *
     * One straight run of known length, so the assertion is exact. The first version of this test
     * dragged the ends of every generated path and asserted only that "more than a few" cells were
     * filled; a probe that removed the walk entirely left it green, because a puzzle with any
     * two-cell path still puts a second cell on the board.
     */
    const { svg, board } = syntheticBoard({
      width: 5,
      height: 5,
      pairs: [
        { id: 0, a: [0, 0], b: [4, 0] },
        { id: 1, a: [0, 4], b: [4, 4] },
      ],
    });

    // Press on the terminal, then report one position three cells away - the browser's version of
    // a flick. Nothing between them was ever reported by the pointer.
    svg.handlers.get("pointerdown")!(pointerEvent([0, 0]));
    svg.handlers.get("pointermove")!(pointerEvent([3, 0]));
    svg.handlers.get("pointerup")!({ preventDefault() {} });

    const drawn = board.submission().find((path) => path.pairId === 0)!;
    assert.deepEqual(
      drawn.cells,
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ],
      "the skipped cells were not filled in",
    );
  });

  console.log("");
  console.log("Rules the client enforces at input time");

  test("a path may not be routed through another pair's terminal", () => {
    // The one hard refusal in the input model. Another pair's ordinary path cell is fair game and
    // gets taken over - without that, every correction would need a manual clear first - but a
    // terminal is that pair's fixed anchor, and routing through it would make their board
    // unsolvable in a way they did not cause and cannot see.
    const { client, svg, board } = boardFor("terminal-guard");

    const first = client.pairs[0];
    const other = client.pairs[1];

    svg.handlers.get("pointerdown")!(pointerEvent(first.a as Cell));
    // Aim straight at the other pair's terminal. The walk will get as close as the rules allow and
    // must stop rather than pass through it.
    svg.handlers.get("pointermove")!(pointerEvent(other.a as Cell));
    svg.handlers.get("pointerup")!({ preventDefault() {} });

    const drawn = board.submission().find((path) => path.pairId === first.id)!;
    const trespass = drawn.cells.some(
      (cell) => cell[0] === (other.a as Cell)[0] && cell[1] === (other.a as Cell)[1],
    );
    assert.equal(trespass, false, "a path was routed through another pair's terminal");
  });

  test("dragging back over the previous cell retracts instead of refusing", () => {
    // How a mistake is undone without starting the path again. It has to be checked before the
    // no-reuse rule, or a retraction reads as revisiting a cell and the player is stuck with
    // whatever they drew.
    const { generated, svg, board } = boardFor("retract-1");
    const path = generated.solution.find((cells) => cells.length >= 3)!;

    svg.handlers.get("pointerdown")!(pointerEvent(path[0]));
    svg.handlers.get("pointermove")!(pointerEvent(path[1]));
    svg.handlers.get("pointermove")!(pointerEvent(path[2]));
    assert.equal(board.cellsUsed(), 3);

    svg.handlers.get("pointermove")!(pointerEvent(path[1]));
    assert.equal(board.cellsUsed(), 2, "dragging back did not retract");
  });

  test("touching a terminal restarts that pair rather than extending it", () => {
    const { generated, svg, board } = boardFor("restart-1");
    const path = generated.solution.find((cells) => cells.length >= 3)!;

    drag(svg, path);
    const before = board.cellsUsed();
    assert.ok(before >= 3);

    svg.handlers.get("pointerdown")!(pointerEvent(path[0]));
    svg.handlers.get("pointerup")!({ preventDefault() {} });
    assert.equal(board.cellsUsed(), 1, "touching a terminal did not restart the path");
  });

  console.log("");
  console.log("What the client will and will not offer");

  test("joining every pair is not enough while a square is unused", () => {
    /*
     * Full coverage is a rule of this puzzle rather than a bonus, so a board with every pair joined
     * and a spare square must NOT offer Submit. Offering it would send the server a board it
     * refuses with `incomplete_coverage`, and a refusal on a grid where every pair is visibly
     * connected reads as the game being wrong rather than the puzzle being unfinished.
     *
     * The shape is stated rather than generated, because this position is unreachable by editing a
     * solution: shortening a path unjoins its pair, and the completeness check then refuses at the
     * joined count without ever consulting coverage. The first version of this test did exactly
     * that and stayed green when the coverage rule was deleted outright.
     *
     * Here pair 0's terminals are adjacent, so joining it uses two of the nine squares and the
     * middle row is left empty with every pair connected.
     */
    const { puzzle, svg, board } = syntheticBoard({
      width: 3,
      height: 3,
      pairs: [
        { id: 0, a: [0, 0], b: [1, 0] },
        { id: 1, a: [0, 2], b: [2, 2] },
      ],
    });

    drag(svg, [
      [0, 0],
      [1, 0],
    ]);
    drag(svg, [
      [0, 2],
      [1, 2],
      [2, 2],
    ]);

    assert.equal(board.joinedCount(), 2, "the position under test needs every pair joined");
    assert.equal(board.cellsUsed(), 5);
    assert.equal(board.cellCount(), 9);
    assert.equal(board.isComplete(), false, "Submit was offered with four squares unused");

    // And the server agrees about why, which is the point of testing coverage in the client at all.
    const verdict = verifyAttempt(puzzle, board.submission());
    assert.equal(verdict.solved, false);
    assert.equal(verdict.solved === false && verdict.reason, "incomplete_coverage");
  });

  test("clearing releases every cell", () => {
    const { generated, svg, board } = boardFor("clear-1");
    for (const path of generated.solution) drag(svg, path);
    assert.ok(board.cellsUsed() > 0);

    board.clear();
    assert.equal(board.cellsUsed(), 0);
    assert.equal(board.joinedCount(), 0);
    assert.equal(board.isComplete(), false);
  });

  test("a locked board ignores the player", () => {
    // Locked when the round ends. Without it a drag landing between the final submission and the
    // result screen would repaint a board the server has already closed.
    const { generated, svg, board } = boardFor("lock-1");
    board.lock();
    for (const path of generated.solution) drag(svg, path);
    assert.equal(board.cellsUsed(), 0, "a locked board accepted a drag");
  });

  test("the submission carries one path per pair, and nothing else", () => {
    // The shape `verifyAttempt` walks. An extra field would be ignored, but a missing pair is
    // `wrong_pair_count` - and the client must submit unfinished pairs as short paths rather than
    // omitting them, or a partially solved board is refused as malformed instead of being scored.
    const { client, svg, board } = boardFor("shape-1");
    const submission = board.submission();

    assert.equal(submission.length, client.pairs.length);
    assert.deepEqual(
      submission.map((path) => path.pairId).sort((a, b) => a - b),
      client.pairs.map((pair) => pair.id).sort((a, b) => a - b),
    );
    for (const path of submission) {
      assert.deepEqual(Object.keys(path).sort(), ["cells", "pairId"]);
    }
    void svg;
  });

  test("the same seed draws the same puzzle for the same player", () => {
    // Determinism is the fairness property the whole contest rests on, and the client is the last
    // place it could be lost - a board that shuffled on reload would let a player reroll content.
    const first = boardFor("determinism-1");
    const second = boardFor("determinism-1");
    assert.deepEqual(second.client.pairs, first.client.pairs);
    assert.equal(second.client.width, first.client.width);
  });

  console.log("");
  console.log("What the board draws");

  test("every terminal carries its number, so a missing image costs decoration only", () => {
    /*
     * The numeral is what makes the board playable for a colour-blind player and playable with no
     * language at all, and it is drawn by us rather than being part of the artwork.
     *
     * This is the assertion that stops somebody deleting it as redundant once the tokens are on
     * screen - the tokens have numerals of their own, so it LOOKS redundant. An `<image>` that
     * 404s draws nothing and reports nothing, and this platform has had two production faults
     * from exactly that (R52, R54). Without the vector numeral underneath, the same stale cache
     * turns the board into unlabelled coloured rings.
     */
    const { client, svg } = boardFor("art-1", "large");
    const labels = descendants(svg).filter((node) => node.nodeName === "text");
    const expected = client.pairs.flatMap((pair) => [String(pair.id + 1), String(pair.id + 1)]);

    assert.equal(labels.length, expected.length, "one numeral per terminal, both ends");
    assert.deepEqual(labels.map((node) => node.textContent).sort(), expected.sort());
  });

  test("a terminal's artwork is chosen by its pair number, never by position", () => {
    // `token-3.webp` has a 3 painted into it, so indexing this list by anything but the pair id
    // puts one number in the artwork and a different one in the label underneath.
    const { client, svg } = boardFor("art-2", "large");
    const images = descendants(svg).filter((node) => node.nodeName === "image");
    const hrefs = images.map((node) => node.attributes.get("href"));

    assert.deepEqual(
      hrefs.sort(),
      client.pairs.flatMap((pair) => [
        `/play/token-${pair.id + 1}.webp`,
        `/play/token-${pair.id + 1}.webp`,
      ]).sort(),
    );
  });

  test("a drag repaints the wires and leaves the cells and terminals standing", () => {
    /*
     * The reason the board is drawn in layers, asserted by NODE IDENTITY rather than by counting.
     *
     * A count is green against a rebuild that produces the same number of nodes, which is exactly
     * what the old single `render` did - and the cost it hid is real: every pointer move destroyed
     * 36 cells and up to 16 terminals, eight of which carry an `<image>` the browser must resolve
     * again, to move one line by one square. That is invisible on a desktop and is stutter on a
     * phone, which is where this game is played and where the clock is the score.
     */
    const { generated, svg, board } = boardFor("layers-1");
    const before = descendants(svg).filter((node) => node.nodeName === "image");
    assert.ok(before.length > 0, "the fixture needs terminals with artwork");

    drag(svg, generated.solution[0]);

    const after = descendants(svg).filter((node) => node.nodeName === "image");
    assert.equal(after.length, before.length);
    // Identity, not equality: a rebuilt terminal would be an indistinguishable new node.
    for (const [node, was] of after.map((node, at) => [node, before.at(at)] as const)) {
      assert.equal(node, was, "a drag rebuilt a terminal it cannot have changed");
    }
    assert.ok(board.cellsUsed() > 0, "the drag under test must actually have drawn something");
  });

  test("resizing rebuilds, because the artwork is sized in the same units as the grid", () => {
    // The other half of the layering rule: a repaint must NOT be enough here. Cells and terminals
    // are drawn at `cellPx`, so a resize that only repainted the wires would leave the board's
    // furniture at the old size while the wires moved - which reads as a rendering fault.
    const { client, svg, board } = boardFor("layers-2");
    const before = descendants(svg).filter((node) => node.nodeName === "image");

    board.resize(client.width * CELL_PX * 2, client.height * CELL_PX * 2);

    const after = descendants(svg).filter((node) => node.nodeName === "image");
    assert.equal(after.length, before.length);
    assert.notEqual(after[0], before[0], "a resize left the terminals at their old size");
  });

  console.log("");
  console.log(`Board client tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
