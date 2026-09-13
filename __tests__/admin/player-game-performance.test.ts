/**
 * One player's game performance on the admin user panel - tasks 21-24.
 *
 * WHAT THIS SUITE IS ACTUALLY DEFENDING, because the task list points somewhere else. Task 21
 * says the Game Performance area carries hardcoded game-specific assumptions. The screen it
 * names does not - `game-performance.service.ts` measures the round lifecycle and mentions no
 * game. The premise was checkable and it was checked, the same duty that corrected R7 and R31
 * downward. What is genuinely broken is the per-user **Performance** tab, which computed
 * eleven trading figures and then hid the entire tab behind `totalTrades === 0`, so a player
 * who had only ever played provider games was reported as having no performance at all.
 *
 * MOSTLY BEHAVIOURAL, because "which score is this player's best" and "does a voided round
 * count" are answers about data and no amount of reading the source can check them. The
 * structural tests cover the two properties data cannot show: that nothing enumerates games,
 * and that the games block is not inside the trading empty-state branch.
 *
 * WHICH COPY OF EACH MODEL THIS FILE SEEDS IS NOT A FREE CHOICE. The service lives in
 * `apps/admin`, but vitest maps `@` to the REPO ROOT, so its `@/database/...` imports resolve
 * to the MAIN app's models. This file therefore seeds the main copies - the ones the service
 * actually reads. Seeding the admin copies puts fixtures on a Mongoose instance the service
 * never touches, and every assertion then fails on an empty collection, which reads exactly
 * like a logic bug. Only ONE copy of each model is imported, because both register under the
 * same name via `models.X || model(...)`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import mongoose, { Types } from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  findRouteFiles,
  guardedSections,
  handlerPattern,
  stripComments,
} from "../helpers/route-guard-audit";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const GameProvider = (
  await import("../../database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const GameRound = (await import("../../database/models/games/game-round.model"))
  .default;
const { getPlayerGamePerformance } = await import(
  "../../apps/admin/lib/services/games/player-game-performance.service"
);
const { SCORE_PRODUCING_ROUND_STATUSES } = await import(
  "../../lib/services/games/round-types"
);
const { SCORING_ROUND_STATUSES } = await import(
  "../../lib/services/games/participant-score.service"
);
const { MOCK_PROVIDER_KEY } = await import(
  "../../lib/services/game-providers/adapters/mock.adapter"
);

const ROOT = join(__dirname, "..", "..");
const SERVICE = join(
  ROOT,
  "apps/admin/lib/services/games/player-game-performance.service.ts",
);
const COMPONENT = join(
  ROOT,
  "apps/admin/components/admin/games/PlayerGamePerformance.tsx",
);
const PANEL = join(ROOT, "apps/admin/components/admin/UserFullDetailPanel.tsx");
const ROUTE_DIR = join(ROOT, "apps/admin/app/api/users/[userId]/performance");

const read = (path: string) => readFileSync(path, "utf8");

const RACE_CODE = "mock-race";
const RACE_KEY = `provider:${MOCK_PROVIDER_KEY}:${RACE_CODE}`;
const PUZZLE_CODE = "mock-puzzle";
const PUZZLE_KEY = `provider:${MOCK_PROVIDER_KEY}:${PUZZLE_CODE}`;

const PLAYER = new Types.ObjectId().toString();
const OTHER_PLAYER = new Types.ObjectId().toString();

const COLLECTIONS = ["game_provider", "provider_game", "game_round"];

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  await ensureCollections(COLLECTIONS);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await ensureCollections(COLLECTIONS);
  roundCounter = 0;
});

async function seedProvider() {
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: true,
  });
}

/**
 * A catalogue title, satisfying the WHOLE schema rather than the fields the service reads.
 *
 * `family` and `scoreType` play no part in any figure here, and Mongoose validates the
 * document rather than the subset a test cares about - a trimmed fixture fails every
 * assertion at once for one unrelated reason, which is the trap the `Competition` fixture
 * produced 34 times in one run.
 */
async function seedTitle(
  gameCode: string,
  gameKey: string,
  overrides: Record<string, unknown> = {},
) {
  return ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode,
    gameKey,
    displayName: `Mock ${gameCode}`,
    family: "independent",
    supportsCompetition: true,
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    providerStatus: "active",
    chartvoltEnabled: true,
    ...overrides,
  });
}

let roundCounter = 0;
async function seedRound(
  gameKey: string,
  gameCode: string,
  status: string,
  overrides: Record<string, unknown> = {},
) {
  roundCounter += 1;
  return GameRound.create({
    roundId: `cv_rnd_ppp_${roundCounter}`,
    providerKey: MOCK_PROVIDER_KEY,
    gameCode,
    gameKey,
    userId: PLAYER,
    contestType: "competition",
    contestId: new Types.ObjectId(),
    attemptNumber: roundCounter,
    mode: "ranked",
    status,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });
}

describe("a player who has played no games", () => {
  /**
   * The empty list is task 23's first option and it must reach the component as emptiness
   * rather than as a panel saying nothing happened. A pure trader's tab has to look exactly
   * as it did before this slice, or every existing operator meets a new empty box.
   */
  it("gets an empty list rather than a placeholder row", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY);

    expect(await getPlayerGamePerformance(PLAYER)).toEqual([]);
  });

  it("refuses a blank user id without touching the database", async () => {
    expect(await getPlayerGamePerformance("")).toEqual([]);
    expect(await getPlayerGamePerformance("   ")).toEqual([]);
  });
});

describe("one row per game, counted from that player's own rounds", () => {
  it("groups by game and does not mix two players together", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY);
    await seedTitle(PUZZLE_CODE, PUZZLE_KEY);

    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 10 });
    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 20 });
    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", { rawScore: 5 });
    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "launched", {
      userId: OTHER_PLAYER,
    });

    const rows = await getPlayerGamePerformance(PLAYER);
    const byKey = new Map(rows.map((row) => [row.gameKey, row]));

    expect(rows).toHaveLength(2);
    expect(byKey.get(RACE_KEY)?.rounds.started).toBe(2);
    expect(byKey.get(PUZZLE_KEY)?.rounds.started).toBe(1);
    // The other player's live round belongs to them, not to this row.
    expect(byKey.get(PUZZLE_KEY)?.rounds.live).toBe(0);
  });

  /**
   * A competition is many players and a challenge is exactly two. Folding them into one
   * "contests" count answers neither question, and an operator investigating a player is
   * usually asking about one or the other specifically.
   */
  it("counts distinct competitions and challenges apart", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY);

    const contest = new Types.ObjectId();
    // Two rounds in ONE competition must count as one competition, or the figure is just the
    // round count wearing a different label.
    await seedRound(RACE_KEY, RACE_CODE, "completed", {
      rawScore: 1,
      contestId: contest,
    });
    await seedRound(RACE_KEY, RACE_CODE, "completed", {
      rawScore: 2,
      contestId: contest,
    });
    await seedRound(RACE_KEY, RACE_CODE, "completed", {
      rawScore: 3,
      contestType: "challenge",
      contestId: new Types.ObjectId(),
    });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.competitions).toBe(1);
    expect(row.challenges).toBe(1);
  });

  /**
   * Practice is free, unranked and prize-less, so it is not performance. Counting it makes
   * every figure here partly a measure of how much free play somebody took.
   */
  it("excludes practice rounds entirely", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY);

    await seedRound(RACE_KEY, RACE_CODE, "completed", {
      rawScore: 999,
      mode: "practice",
      contestType: "practice",
    });

    expect(await getPlayerGamePerformance(PLAYER)).toEqual([]);
  });

  it("reports live rounds separately from finished ones", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY);

    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 4 });
    await seedRound(RACE_KEY, RACE_CODE, "launched");
    await seedRound(RACE_KEY, RACE_CODE, "pending");

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.rounds.started).toBe(3);
    expect(row.rounds.scored).toBe(1);
    expect(row.rounds.live).toBe(2);
  });
});

describe("which rounds count as having produced a score", () => {
  /**
   * R48's rule, on the read side. A cut-short run is a real result - `expired` is the ORDINARY
   * ending for anyone still playing at the final whistle, because `createRound` clamps
   * `expiresAt` to the play window - so excluding it punishes attendance.
   */
  it("counts a partial run, because a partial run counts", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY);

    await seedRound(RACE_KEY, RACE_CODE, "expired", { rawScore: 12 });
    await seedRound(RACE_KEY, RACE_CODE, "abandoned", { rawScore: 3 });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.rounds.scored).toBe(2);
  });

  /**
   * THE TRAP THAT MADE THE OLD READ PATH WRONG, and it is not intuitive: a `voided` round
   * stores `rawScore: 0` deliberately, and its attempt is handed back. So a filter testing
   * only for the presence of a number reports a support action as a result the player earned -
   * and worse, a zero on a lower-is-better title sorts FIRST and would be nominated as their
   * best round.
   */
  it("does not count a voided round, even though it stores a score of zero", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY, { scoreDirection: "lower_is_better" });

    await seedRound(RACE_KEY, RACE_CODE, "voided", { rawScore: 0 });
    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 42 });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.rounds.started).toBe(2);
    expect(row.rounds.scored).toBe(1);
    // The zero must not have been chosen as the best time.
    expect(row.bestScore).toBe(42);
  });

  /**
   * `unresolved` is the unresolved-round policy's question and is answered at settlement.
   * Counting it here answers it a second time, in a different place, with no configuration.
   */
  it("does not count an unresolved round", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY);

    await seedRound(RACE_KEY, RACE_CODE, "unresolved");

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.rounds.scored).toBe(0);
    expect(row.bestScore).toBeNull();
  });
});

describe("best score, in the direction the title ranks", () => {
  it("takes the highest on a higher-is-better title", async () => {
    await seedProvider();
    await seedTitle(PUZZLE_CODE, PUZZLE_KEY, {
      scoreDirection: "higher_is_better",
      scoreUnit: "points",
    });

    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", { rawScore: 700 });
    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", { rawScore: 1200 });
    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", { rawScore: 300 });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.bestScore).toBe(1200);
    expect(row.scoreDirection).toBe("higher_is_better");
    expect(row.scoreUnit).toBe("points");
  });

  /**
   * The one that is upside down when it is wrong, with no error anywhere. A time trial's best
   * run is its MINIMUM, and the figure stays the raw positive number the player achieved -
   * storing or showing `-92.4` reads as a negative lap time and poisons every cross-game total
   * (`05` s2's rule: negate only at comparison).
   */
  it("takes the lowest on a lower-is-better title, and keeps it positive", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY, {
      scoreDirection: "lower_is_better",
      scoreUnit: "ms",
    });

    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 92_400 });
    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 88_100 });
    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 105_000 });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.bestScore).toBe(88_100);
    expect(row.scoreDirection).toBe("lower_is_better");
  });

  /**
   * `null` IS NOT ZERO, and this is the read-side form of R45 and R50 - the two defects that
   * arrived from exactly this confusion. A stored nought is a genuine score on a points game,
   * so absence has to survive all the way to the screen as absence.
   */
  it("reports no score as null rather than as zero", async () => {
    await seedProvider();
    await seedTitle(PUZZLE_CODE, PUZZLE_KEY);

    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "launched");

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.bestScore).toBeNull();
    expect(row.bestScore).not.toBe(0);
  });

  it("keeps a genuine zero, which is a real result", async () => {
    await seedProvider();
    await seedTitle(PUZZLE_CODE, PUZZLE_KEY);

    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", { rawScore: 0 });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.bestScore).toBe(0);
  });
});

describe("the metrics come from the game, not from a schema", () => {
  /**
   * THE DELIBERATE DEVIATION FROM TASK 22, pinned so nobody "completes" it later. That task
   * asks each game to declare which metrics it supports, grouped by category. A declared
   * schema is a second source that can disagree with what the provider actually sends: a
   * metric declared and never sent is a permanent blank row, and one sent but not declared is
   * real data hidden. The reported breakdown is the only source.
   */
  it("carries the best round's own breakdown, verbatim", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY, { scoreDirection: "lower_is_better" });

    await seedRound(RACE_KEY, RACE_CODE, "completed", {
      rawScore: 105_000,
      scoreBreakdown: { bestLapMs: 40_000, spinOuts: 3 },
    });
    await seedRound(RACE_KEY, RACE_CODE, "completed", {
      rawScore: 88_100,
      scoreBreakdown: { bestLapMs: 28_400, spinOuts: 0, cleanLaps: 4 },
    });

    const [row] = await getPlayerGamePerformance(PLAYER);
    // The BEST round's breakdown, not the latest and not an aggregate of the two: nothing
    // here knows what any key means, so nothing here may combine them.
    expect(row.bestRoundBreakdown).toEqual({
      bestLapMs: 28_400,
      spinOuts: 0,
      cleanLaps: 4,
    });
  });

  /**
   * Task 23's second option. The game and the score are real and only the detail is missing,
   * so the row stays and one sentence explains the gap - hiding the card would hide the
   * rounds too.
   *
   * TWO THINGS ABOUT THIS FIXTURE, both learned from probes that came back green.
   *
   * The empty breakdown has to be on the BEST round. With `{}` on the losing round the
   * empty-object path is never reached, and a probe collapsing the emptiness check reports the
   * guard absent while changing no observable at all.
   *
   * And it has to be seeded with the RAW DRIVER, which is the one situation where that is the
   * honest fixture rather than a way to prove anything you like: Mongoose's `minimize` default
   * DELETES an empty object before saving, so the model physically cannot store this shape and
   * a fixture going through it silently tests the absent case instead. That also makes the
   * check a tripwire rather than a live guard today - it is kept because `minimize` is an
   * unstated dependency somebody could flip for an unrelated reason, and the failure would be
   * a detail block rendering nothing while claiming to be the game's breakdown.
   */
  it("reports an empty breakdown as null so the empty state can be shown", async () => {
    await seedProvider();
    await seedTitle(PUZZLE_CODE, PUZZLE_KEY);

    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", { rawScore: 4 });
    const best = await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", {
      rawScore: 9,
    });
    await mongoose.connection
      .collection("game_round")
      .updateOne({ _id: best._id }, { $set: { scoreBreakdown: {} } });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.bestScore).toBe(9);
    expect(row.bestRoundBreakdown).toBeNull();
  });

  it("reports an absent breakdown as null too", async () => {
    await seedProvider();
    await seedTitle(PUZZLE_CODE, PUZZLE_KEY);

    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", { rawScore: 9 });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.bestRoundBreakdown).toBeNull();
  });
});

describe("labels, categories and a title that has left the catalogue", () => {
  /**
   * Task 9's vocabulary is resolved ONCE, here. Two screens resolving it independently is how
   * one shows "Racing" and another "racing", and `category` is the key every grouping joins
   * on - so a second copy is a grouping failure waiting for a rename.
   */
  it("resolves the category and reports the provider's name", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY, { category: "racing" });

    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 1 });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.category?.label).toBe("Racing");
    expect(row.category?.isKnown).toBe(true);
    expect(row.providerName).toBe("Mock Provider");
    expect(row.inCatalogue).toBe(true);
  });

  it("shows an unrecognised genre verbatim and no genre as nothing at all", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY, { category: "hovercraft" });
    await seedTitle(PUZZLE_CODE, PUZZLE_KEY, { category: "" });

    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 1 });
    await seedRound(PUZZLE_KEY, PUZZLE_CODE, "completed", { rawScore: 1 });

    const rows = await getPlayerGamePerformance(PLAYER);
    const byKey = new Map(rows.map((row) => [row.gameKey, row]));

    // The SLUG survives verbatim, which is the part that matters - it is the grouping key, so
    // remapping an unforeseen genre would silently rewrite a provider's statement about their
    // own game. The label is a best-effort reading of that same slug, never a translation.
    expect(byKey.get(RACE_KEY)?.category?.slug).toBe("hovercraft");
    expect(byKey.get(RACE_KEY)?.category?.isKnown).toBe(false);
    expect(byKey.get(RACE_KEY)?.category?.label).toBe("Hovercraft");
    // Absent renders nothing. A badge reading "Uncategorised" is a genre nobody chose.
    expect(byKey.get(PUZZLE_KEY)?.category).toBeUndefined();
  });

  /**
   * A disabled game's rows are retired, never deleted (R29), and `gameKey` is immutable - so
   * a player's history can outlive the catalogue row. The label chain must end at the code and
   * then the key, NEVER at "Unknown": a row captioned "Unknown game" holding real rounds
   * cannot be investigated.
   */
  it("still reports a game whose catalogue row has gone, without inventing a name", async () => {
    await seedProvider();

    await seedRound(RACE_KEY, RACE_CODE, "completed", { rawScore: 6 });

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.inCatalogue).toBe(false);
    expect(row.title).toBe(RACE_CODE);
    expect(row.title.toLowerCase()).not.toContain("unknown");
    // With nobody left to declare a direction it falls back to the platform default, which is
    // the same fallback settlement uses.
    expect(row.scoreDirection).toBe("higher_is_better");
  });

  it("averages play time over rounds that have a duration, in seconds", async () => {
    await seedProvider();
    await seedTitle(RACE_CODE, RACE_KEY);

    await seedRound(RACE_KEY, RACE_CODE, "completed", {
      rawScore: 1,
      durationMs: 30_000,
    });
    await seedRound(RACE_KEY, RACE_CODE, "completed", {
      rawScore: 2,
      durationMs: 50_000,
    });
    // Still in play, so it has no duration and must not drag the average down.
    await seedRound(RACE_KEY, RACE_CODE, "launched");

    const [row] = await getPlayerGamePerformance(PLAYER);
    expect(row.averagePlaySeconds).toBe(40);
  });
});

describe("one definition of which rounds produce a score", () => {
  /**
   * THE COUPLING WAS DELETED RATHER THAN DETECTED. The admin app has to answer the same
   * question to report a player's rounds, and it cannot import `participant-score.service.ts`
   * because that file is deliberately unmirrored - there is exactly one ingestion door. The
   * list therefore moved into the mirrored, model-free `round-types.ts` and the ingestion path
   * builds from it, which is strictly better than a third copy plus a test that notices drift.
   */
  it("the ingestion path's list IS the shared list", () => {
    expect(SCORING_ROUND_STATUSES).toEqual(SCORE_PRODUCING_ROUND_STATUSES);
  });

  it("the shared list holds only statuses a round can actually reach", () => {
    // Read off the model rather than restated, so a renamed status fails here rather than
    // silently matching nothing in an aggregation.
    const allowed = GameRound.schema.path("status") as unknown as {
      enumValues?: string[];
    };
    expect(allowed.enumValues).toBeDefined();
    for (const status of SCORE_PRODUCING_ROUND_STATUSES) {
      expect(allowed.enumValues).toContain(status);
    }
  });

  /**
   * `round-types.ts` is imported by `contest-preflight.ts`, which runs in a client bundle, so
   * it must stay model-free (R58). That is why the shared type is spelled out as a literal
   * union instead of importing `RoundStatus` from the round model - and it is the kind of
   * constraint a later tidy-up removes without noticing, taking the admin panel's build with
   * it. Both copies are compared byte for byte because `check:mirrors` covers models only.
   */
  it("both copies of round-types.ts are byte-identical", () => {
    expect(read(join(ROOT, "apps/admin/lib/services/games/round-types.ts"))).toBe(
      read(join(ROOT, "lib/services/games/round-types.ts")),
    );
  });

  /**
   * The rule is R58's, exactly: a client-reachable module may not name a model or the raw
   * driver in a VALUE-import position. It deliberately does not forbid `mongoose`, which has a
   * browser build a bundler resolves, and it does not forbid a type-only import of anything -
   * `import type { Types }` is erased before a bundler ever sees it. Written any stricter this
   * fires on the correct code that is here today, and a guard that fails on correct code is
   * the kind the first person it inconveniences deletes.
   */
  it("round-types.ts imports no model and no driver in a value position", () => {
    const code = stripComments(read(join(ROOT, "lib/services/games/round-types.ts")));
    const valueImports = [...code.matchAll(/^\s*import\s+(?!type\b)[\s\S]*?from\s+["']([^"']+)["']/gm)]
      .map((match) => match[1]);

    for (const source of valueImports) {
      expect(source).not.toMatch(/database\/models/);
      expect(source).not.toBe("mongodb");
    }
  });

  /**
   * An operator and a player must read the same label for the same metric. Two copies of the
   * humaniser drift in the worst available direction - a support conversation where each side
   * is looking at a differently-named figure and both believe they agree.
   */
  it("both copies of humanize-metric.ts are byte-identical", () => {
    expect(read(join(ROOT, "apps/admin/lib/utils/humanize-metric.ts"))).toBe(
      read(join(ROOT, "lib/utils/humanize-metric.ts")),
    );
  });
});

describe("nothing enumerates games", () => {
  /**
   * The single failure mode of the no-developer-needed claim. A `switch` on a game code, an
   * `if (gameKey === ...)` or a category-to-metric table is a place the next game silently
   * fails to appear while the query runs and the page renders.
   */
  it("the service names no game and no category", () => {
    const code = stripComments(read(SERVICE));
    expect(code).not.toMatch(/gameCode\s*===/);
    expect(code).not.toMatch(/gameKey\s*===/);
    expect(code).not.toMatch(/switch\s*\(\s*[^)]*(gameKey|gameCode|category)/);
    // A metric table keyed by category is the literal reading of task 22 and is exactly what
    // must not exist.
    expect(code).not.toMatch(/category\s*\)\s*\{/);
  });

  it("the component names no game and no metric label", () => {
    const code = stripComments(read(COMPONENT));
    expect(code).not.toMatch(/gameCode\s*===/);
    expect(code).not.toMatch(/gameKey\s*===/);
    expect(code).not.toMatch(/racing|tetris|trivia/i);
  });

  /**
   * The NEGATIVE assertion is the load-bearing half. Importing the shared humaniser is
   * trivially satisfied by a component that imports it and then writes its own labels beside
   * it - which is how the metric rows would quietly become a hand-written list.
   */
  it("the component labels metrics through the shared humaniser only", () => {
    const code = stripComments(read(COMPONENT));
    expect(code).toMatch(/humanizeMetric\(\s*key\s*,\s*value\s*\)/);
    // No second labelling mechanism: no lookup table, no per-key mapping.
    expect(code).not.toMatch(/const\s+(METRIC|LABELS|METRIC_LABELS)\b/);
  });

  /**
   * The category arrives resolved and must be rendered as given. A component re-deriving it
   * from the slug is the "one rule, two copies" shape, and here the drift shows as two screens
   * disagreeing about what one game is called.
   */
  it("the component does not re-derive the category", () => {
    const code = stripComments(read(COMPONENT));
    expect(code).toMatch(/category\.label/);
    expect(code).not.toMatch(/resolveGameCategory/);
    expect(code).not.toMatch(/GAME_CATEGORIES/);
  });

  it("the component carries task 23's empty state", () => {
    expect(read(COMPONENT)).toContain(
      "Detailed performance metrics are not available for this game.",
    );
  });
});

describe("the games block is not inside the trading empty state", () => {
  /**
   * THE DEFECT ITSELF, asserted positionally. `totalTrades === 0` used to gate the whole tab,
   * so a games-only player saw "This client has no closed trades yet" and nothing else. A test
   * merely checking that the panel renders the games component is GREEN on that bug - the
   * component would be there, in the branch nobody reaches.
   */
  it("renders the games component on both sides of the trades gate", () => {
    const code = stripComments(read(PANEL));

    const gate = code.indexOf("This client has no closed trades yet");
    expect(gate).toBeGreaterThan(0);

    const uses = [...code.matchAll(/<PlayerGamePerformance\b/g)].map(
      (match) => match.index ?? -1,
    );
    // Counted, not merely found: one occurrence is satisfied by the version that renders it
    // only for a player who also trades.
    expect(uses).toHaveLength(2);
    expect(uses.some((at) => at < gate + 400 && at > gate)).toBe(true);
    expect(uses.some((at) => at > gate + 400)).toBe(true);
  });

  /**
   * The trading figures keep a trading heading. Captioning eleven questions about a trading
   * account as the client's performance is what `05` s10 forbids - a figure is generalised, or
   * explicitly scoped to one game, or removed, and there is no third option.
   */
  it("keeps the trading figures labelled as trading", () => {
    const code = read(PANEL);
    expect(code).toContain("Trading Performance");
  });
});

describe("the route is authorized by section, not by being an admin at all", () => {
  /**
   * `verifyAdminAuth` asks whether the caller is an admin, not whether they hold the grant, so
   * an employee given one unrelated section passed it. Tenth instance of that class, and found
   * the only way that works: COUNTING exported handlers against guard calls. Reading routes
   * goes straight past a weak one, because every neighbour has something.
   */
  it("every exported handler is behind guardSection('users')", () => {
    const files = findRouteFiles(ROUTE_DIR);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const code = stripComments(read(file));
      const handlers = [...code.matchAll(handlerPattern())];
      const sections = guardedSections(code);

      expect(handlers.length).toBeGreaterThan(0);
      // Per handler, not per file: a file whose GET is guarded and whose POST is not passes
      // any check that merely asks whether the file mentions a guard.
      expect(sections).toHaveLength(handlers.length);
      expect(new Set(sections)).toEqual(new Set(["users"]));
      expect(code).not.toMatch(/verifyAdminAuth|verifyAdminToken/);
    }
  });
});
