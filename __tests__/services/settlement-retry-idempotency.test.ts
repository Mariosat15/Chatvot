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

import { PlatformFinancialsService } from "@/lib/services/platform-financials.service";

/**
 * TASK 30's LAST TWO CASES: a settlement retry must create neither a duplicate payment nor
 * a duplicate unclaimed-pool row. They are separated from the rest of the matrix because
 * these are the only two that cannot be answered by a pure function - "did a second call
 * write a second row" is a question about a database.
 *
 * WHY THE UNCLAIMED POOL NEEDED A GUARD AND THE PRIZES DID NOT, which is the finding worth
 * carrying out of this file. Prize payments are written inside the settlement transaction,
 * behind an optimistic lock that claims `active -> finalizing`, so a second caller never
 * reaches the payout at all. `recordUnclaimedPool` had no such protection: it was reachable
 * from seven different writers, four of them in a worker whose job re-runs on a timer, and
 * every one of them wrote unconditionally. So the two halves of task 30's requirement were
 * in completely different states, and reading only the prize half would have concluded that
 * settlement was already idempotent.
 *
 * THE ROWS ARE COUNTED, NEVER MERELY CHECKED FOR EXISTENCE. A guard that refuses the second
 * write and a guard that overwrites the first both leave exactly one row when asked "is
 * there a row"; only a count separates "recorded once" from "recorded twice", and only
 * reading the row's amount separates "refused the duplicate" from "replaced the original
 * with the duplicate". The distinction matters because a replacement is how a retry with a
 * different figure - a recomputed pool, say - silently rewrites the books.
 */

const COMPETITION_ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const CHALLENGE_ID = "bbbbbbbbbbbbbbbbbbbbbbb1";

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections(["platformtransactions", "creditconversionsettings"]);
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

function unclaimedRows(filter: Record<string, unknown> = {}) {
  return db()
    .collection("platformtransactions")
    .find({ transactionType: "unclaimed_pool", ...filter })
    .toArray();
}

async function recordOnce(overrides: Record<string, unknown> = {}) {
  await PlatformFinancialsService.recordUnclaimedPool({
    competitionId: COMPETITION_ID,
    competitionName: "Retry Test Contest",
    poolAmount: 900,
    reason: "no_qualified_winners",
    winnersCount: 0,
    expectedWinnersCount: 3,
    ...overrides,
  } as Parameters<
    typeof PlatformFinancialsService.recordUnclaimedPool
  >[0]);
}

describe("a settlement retry does not duplicate the unclaimed pool", () => {
  it("records one row however many times the same contest is settled", async () => {
    /*
      Five calls, not two. A guard written as "skip if a row already exists" and one written
      as "skip only the second call" both pass at two, and the worker's job re-runs every
      minute for as long as the contest sits in a settleable state - so the realistic
      failure is dozens of rows, not one spare.
    */
    for (let i = 0; i < 5; i++) await recordOnce();

    const rows = await unclaimedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(900);
  });

  it("keeps the FIRST figure when a retry arrives with a different one", async () => {
    /*
      The half a count cannot see. If the guard were an upsert rather than a refusal, this
      would leave one row holding 111 - the books rewritten by a retry, with the row count
      still perfectly correct. The first write is the one that happened, so it is the one
      that stands, and a genuinely different second figure is a discrepancy for an operator
      to look at rather than something to silently absorb.
    */
    await recordOnce({ poolAmount: 900 });
    await recordOnce({ poolAmount: 111 });

    const rows = await unclaimedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(900);
  });

  it("does not confuse a challenge with a competition that shares its id", async () => {
    /*
      `sourceId` alone is not the key. Competitions and challenges are separate collections
      with independently generated ObjectIds, so nothing stops one of each existing with the
      same id - and the guard added for the worker would then refuse the challenge's row on
      the grounds that "it" was already recorded, losing a real unclaimed pool with no error
      anywhere. The pair `{ sourceType, sourceId }` is the identity.
    */
    await recordOnce({ competitionId: COMPETITION_ID });
    await recordOnce({
      competitionId: COMPETITION_ID,
      sourceType: "challenge",
      competitionName: "Retry Test Challenge",
      poolAmount: 50,
    });

    expect(await unclaimedRows()).toHaveLength(2);
    expect(await unclaimedRows({ sourceType: "competition" })).toHaveLength(1);
    expect(await unclaimedRows({ sourceType: "challenge" })).toHaveLength(1);
  });

  it("still records two DIFFERENT contests, so the guard is not simply refusing everything", async () => {
    /*
      The control. Every assertion above is satisfied by a `recordUnclaimedPool` that writes
      nothing at all, which would lose every unclaimed pool the platform ever takes - a far
      worse defect than the duplicates being fixed, and invisible to a suite that only ever
      counts down from two.
    */
    await recordOnce({ competitionId: COMPETITION_ID });
    await recordOnce({ competitionId: CHALLENGE_ID, poolAmount: 400 });

    const rows = await unclaimedRows();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.amount).sort((a, b) => a - b)).toEqual([400, 900]);
  });

  it("converts the euro figure through the stored rate rather than assuming 1:1", async () => {
    /*
      NOT AN IDEMPOTENCY CASE, and it is here because it is the defect that unifying the
      seven writers actually fixed. The raw inserts hardcoded `amountEUR: poolAmount`, so
      every unclaimed pool on the financial screens read a hundred times its real value at
      the default rate of 100 credits to the euro. The duplicate-row guard was the reason
      to touch these writers; this was the live wrong number.

      THE SEEDED RATE IS 50, DELIBERATELY NOT THE SCHEMA DEFAULT OF 100. The first version
      of this test seeded 100 and asserted 9, and it passed - but it would have passed just
      as happily against a function that ignored the stored settings entirely and used the
      default, because the two agreed. Two sources have to DISAGREE before a test can prove
      which one was read. At 50 credits to the euro, 900 credits is 18, a figure neither the
      default nor the old hardcoded 1:1 can produce.

      AND THE `_id` IS THE LITERAL SINGLETON KEY, which is what made the first attempt at
      the disagreeing version fail: `getSingleton` is `findById("global-credit-conversion")`,
      so a seeded row with an ordinary ObjectId is not found, and the method then CREATES a
      fresh document at the default rate. The symptom is a seeded 50 producing an answer of
      9 - indistinguishable, at a glance, from the service hardcoding the rate it is being
      tested for.
    */
    await db()
      .collection("creditconversionsettings")
      .insertOne({
        _id: "global-credit-conversion" as unknown as never,
        eurToCreditsRate: 50,
        createdAt: new Date(),
      });

    await recordOnce({ poolAmount: 900 });

    const rows = await unclaimedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(900);
    expect(rows[0].amountEUR).toBeCloseTo(18, 6);
  });
});
