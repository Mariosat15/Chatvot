import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

import {
  clearPhantomScores,
  SETTLED_STATUSES,
} from "../../tools/games/clear-phantom-scores-core";
import { SCORING_ROUND_STATUSES } from "../../lib/services/games/participant-score.service";

/**
 * THE R50 CLEANUP, TESTED FOR WHAT IT REFUSES TO DO.
 *
 * The script exists because a schema default fixes future rows only: every seat written before
 * 7 September 2026 holds a real `score: 0`, which `providerHasResult` reads as "played and
 * scored nothing" and therefore pays. Clearing those is the point.
 *
 * But `score` feeds ranking, so a script that can clear one can rewrite who won - and "it only
 * clears rows that never scored" is **an assertion about a query filter**, which is exactly the
 * thing people get wrong. Every test below seeds a row the script must leave alone and asserts
 * it survives untouched, which is the same shape the game-label backfill is pinned with.
 *
 * The rows are written with the raw driver deliberately. The model no longer defaults `score`,
 * so it can no longer produce the pre-migration document this script exists for - the driver
 * is the only way to seed the past.
 */

const PROVIDER_KEY = "mock";
const GAME_CODE = "mock-puzzle";
const GAME_KEY = `provider:${PROVIDER_KEY}:${GAME_CODE}`;

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "competitions",
    "competitionparticipants",
    "gamerounds",
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

function db() {
  const handle = mongoose.connection.db;
  if (!handle) throw new Error("No database handle.");
  return handle;
}

async function seedContest(
  overrides: Record<string, unknown> = {},
): Promise<mongoose.Types.ObjectId> {
  const _id = new mongoose.Types.ObjectId();
  await db()
    .collection("competitions")
    .insertOne({
      _id,
      name: "Puzzle Cup",
      gameType: "provider",
      gameKey: GAME_KEY,
      status: "active",
      ...overrides,
    } as never);
  return _id;
}

/** A seat as it was written before the fix: a stored, phantom nought. */
async function seedSeat(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  await db()
    .collection("competitionparticipants")
    .insertOne({
      competitionId: contestId.toString(),
      userId,
      username: userId,
      email: `${userId}@example.com`,
      gameKey: GAME_KEY,
      score: 0,
      status: "active",
      enteredAt: new Date(),
      ...overrides,
    } as never);
}

async function seedRound(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  status: string,
  rawScore?: number,
) {
  await db()
    .collection("gamerounds")
    .insertOne({
      roundId: `cv_rnd_${Math.random().toString(16).slice(2)}`,
      providerKey: PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      userId,
      contestType: "competition",
      // Reason: an ObjectId, matching the round schema. The participant's `competitionId` is a
      // String on its own model, and the driver casts neither - the script has to bridge that.
      contestId,
      attemptNumber: 1,
      mode: "ranked",
      status,
      ...(rawScore === undefined ? {} : { rawScore }),
    } as never);
}

async function storedScore(userId: string) {
  const row = await db()
    .collection("competitionparticipants")
    .findOne({ userId });
  return row && "score" in row ? row.score : undefined;
}

async function scoreKeyPresent(userId: string) {
  const row = await db()
    .collection("competitionparticipants")
    .findOne({ userId });
  return Boolean(row && "score" in row);
}

describe("the cleanup clears a phantom zero", () => {
  it("reports without writing anything by default", async () => {
    const contestId = await seedContest();
    await seedSeat(contestId, "never-played");

    const outcome = await clearPhantomScores(db(), { apply: false });

    expect(outcome.totalClearable).toBe(1);
    expect(outcome.totalCleared).toBe(0);
    // The load-bearing half of a report-only mode: the row is still exactly as it was.
    expect(await storedScore("never-played")).toBe(0);
  });

  it("unsets the field when applied, rather than writing another number", async () => {
    const contestId = await seedContest();
    await seedSeat(contestId, "never-played");

    const outcome = await clearPhantomScores(db(), { apply: true });

    expect(outcome.totalCleared).toBe(1);
    // `$unset`, not `$set: { score: null }`. `Number.isFinite(null)` is false, so null would
    // pass the eligibility gate correctly today and break the first `typeof === "number"`
    // reader that meets it.
    expect(await scoreKeyPresent("never-played")).toBe(false);
  });

  it("matches nothing on a second pass", async () => {
    const contestId = await seedContest();
    await seedSeat(contestId, "never-played");

    await clearPhantomScores(db(), { apply: true });
    const second = await clearPhantomScores(db(), { apply: true });

    expect(second.totalClearable).toBe(0);
  });
});

describe("what the cleanup refuses to touch", () => {
  it("leaves a player who has a contributing round", async () => {
    const contestId = await seedContest();
    await seedSeat(contestId, "played-zero");
    // A genuine nought from a round that counts. This is the row the whole distinction exists
    // to protect: the player attempted the game, so they are eligible for a prize position.
    await seedRound(contestId, "played-zero", "completed", 0);

    const outcome = await clearPhantomScores(db(), { apply: true });

    expect(outcome.totalCleared).toBe(0);
    expect(await storedScore("played-zero")).toBe(0);
  });

  it("respects every status in the shared scoring list, not just completed", async () => {
    /*
      R48 widened the list from `completed` alone to include `abandoned` and `expired`. A
      migration carrying its own copy of those statuses would keep clearing the scores of
      players whose cut-short runs now count - and every row would look correctly handled.
      Driven off the imported constant so this test widens with the rule.
    */
    const contestId = await seedContest();

    for (const status of SCORING_ROUND_STATUSES) {
      await seedSeat(contestId, `player-${status}`);
      await seedRound(contestId, `player-${status}`, status, 0);
    }

    const outcome = await clearPhantomScores(db(), { apply: true });

    expect(outcome.totalCleared).toBe(0);
    for (const status of SCORING_ROUND_STATUSES) {
      expect(await storedScore(`player-${status}`)).toBe(0);
    }
  });

  it("leaves a real score alone", async () => {
    const contestId = await seedContest();
    // No round at all, so the only thing standing between this row and a clear is the exact
    // `score: 0` filter. A `$lte` or a truthiness test would take this player's result.
    await seedSeat(contestId, "scored", { score: 1840 });

    const outcome = await clearPhantomScores(db(), { apply: true });

    /*
      `totalClearable` is asserted as well as `totalCleared`, and it is the load-bearing half.
      The exact `score: 0` appears TWICE - once in the read that builds the report, once
      re-asserted in the `updateMany` filter - so widening either one alone leaves this test
      green if it only checks what was written: the read admits the row and the write refuses
      it. That is defence in depth working, but `totalClearable` is the number an operator
      reads BEFORE `--apply`, and a report offering to clear a scored player is wrong however
      the write then behaves.
    */
    expect(outcome.totalClearable).toBe(0);
    expect(outcome.totalCleared).toBe(0);
    expect(await storedScore("scored")).toBe(1840);
  });

  it("leaves a trading participant", async () => {
    const contestId = await seedContest({
      gameType: "trading",
      gameKey: "trading",
    });
    await seedSeat(contestId, "trader", { gameKey: "trading" });

    const outcome = await clearPhantomScores(db(), { apply: true });

    expect(outcome.contests).toHaveLength(0);
    expect(await storedScore("trader")).toBe(0);
  });

  for (const status of SETTLED_STATUSES) {
    it(`leaves a ${status} contest, whose stored leaderboard is what was paid`, async () => {
      const contestId = await seedContest({ status });
      await seedSeat(contestId, `seat-${status}`);

      const outcome = await clearPhantomScores(db(), { apply: true });

      expect(outcome.contests).toHaveLength(0);
      expect(await storedScore(`seat-${status}`)).toBe(0);
    });
  }

  it("reports a trading-labelled seat on a provider contest without touching it", async () => {
    // An R7 mislabel, and `gameKey` is immutable - so the script surfaces it for a human
    // instead of repairing it, which is the same choice the catalogue sync makes for a title
    // that has gone missing.
    const contestId = await seedContest();
    await seedSeat(contestId, "mislabelled", { gameKey: "trading" });

    const outcome = await clearPhantomScores(db(), { apply: true });

    expect(outcome.contests[0].mislabelled).toBe(1);
    expect(outcome.totalCleared).toBe(0);
    expect(await storedScore("mislabelled")).toBe(0);
  });
});
