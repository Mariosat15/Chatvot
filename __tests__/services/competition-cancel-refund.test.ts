import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * Stage 0, Defect 1, test 7: cancelling a competition and refunding its entry fees.
 *
 * This is the path that runs when a competition fails to reach `minParticipants`. Every
 * player must be made whole and the prize pool must end at zero - the plan states that
 * behaviour "already exists and must not be weakened", so it needs a test before the entry
 * paths are unified.
 *
 * No production code is changed by this file.
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

// Reason: the refund loop notifies each player. The notification service opens its own
// connections and is not what this test is about; a failure inside it is caught and logged
// by the action, which would leave a silent gap in the middle of the money loop.
vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    notifyCompetitionCancelled: async () => {},
  },
}));

const { cancelCompetitionAndRefund } = await import(
  "@/lib/actions/trading/competition-cancel.actions"
);

const ENTRY_FEE = 25;
const START_BALANCE = 500;
const PLAYERS = [
  "6500000000000000000000c1",
  "6500000000000000000000c2",
  "6500000000000000000000c3",
];

/**
 * Seeds a competition in the state the entry path leaves behind: pool funded, participants
 * counted, wallets already debited.
 *
 * `walletIds` defaults to every participant. Pass a narrower list to model a participant
 * whose wallet is missing.
 */
async function seedCancelledScenario(
  playerIds = PLAYERS,
  walletIds = playerIds,
) {
  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;

  await db?.collection("competitions").insertOne({
    _id: id,
    name: "Undersubscribed Competition",
    status: "upcoming",
    entryFee: ENTRY_FEE,
    // The state the entry path leaves behind: pool funded, participants counted.
    prizePool: playerIds.length * ENTRY_FEE,
    currentParticipants: playerIds.length,
    minParticipants: 10,
    maxParticipants: 100,
    startingCapital: 10_000,
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    createdAt: new Date(),
  });

  await db?.collection("competitionparticipants").insertMany(
    playerIds.map((userId) => ({
      competitionId: id.toString(),
      userId,
      status: "active",
      currentBalance: 10_000,
      joinedAt: new Date(),
    })),
  );

  await db?.collection("creditwallets").insertMany(
    walletIds.map((userId) => ({
      userId,
      // Already debited by the entry fee, which is the real post-join state.
      creditBalance: START_BALANCE - ENTRY_FEE,
      totalSpentOnCompetitions: ENTRY_FEE,
      totalRefunded: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  return id.toString();
}

async function balances(playerIds = PLAYERS): Promise<number[]> {
  const wallets = await mongoose.connection.db
    ?.collection("creditwallets")
    .find({ userId: { $in: playerIds } })
    .toArray();
  return (wallets ?? []).map((w) => w.creditBalance as number);
}

async function refundRows(competitionId: string) {
  return (
    (await mongoose.connection.db
      ?.collection("wallettransactions")
      .find({ competitionId, transactionType: "competition_refund" })
      .toArray()) ?? []
  );
}

async function readCompetition(competitionId: string) {
  return mongoose.connection.db
    ?.collection("competitions")
    .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
}

describe("competition cancellation and refunds", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "competitions",
      "competitionparticipants",
      "creditwallets",
      "wallettransactions",
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("makes every player whole and leaves the prize pool at zero (test 7)", async () => {
    const competitionId = await seedCancelledScenario();

    const result = await cancelCompetitionAndRefund(
      competitionId,
      "Did not meet minimum participants",
    );

    expect(result.success).toBe(true);
    expect(result.refundedCount).toBe(PLAYERS.length);
    expect(result.totalRefunded).toBe(PLAYERS.length * ENTRY_FEE);

    // Every player is back to where they started, to the credit.
    expect(await balances()).toEqual(PLAYERS.map(() => START_BALANCE));

    const comp = await readCompetition(competitionId);
    expect(comp?.status).toBe("cancelled");
    expect(comp?.prizePool).toBe(0);

    // Exactly one ledger row per player, so the audit trail matches the money.
    const rows = await refundRows(competitionId);
    expect(rows).toHaveLength(PLAYERS.length);
    expect(rows.every((r) => r.amount === ENTRY_FEE)).toBe(true);

    const participants = await mongoose.connection.db
      ?.collection("competitionparticipants")
      .find({ competitionId })
      .toArray();
    expect(participants?.every((p) => p.status === "refunded")).toBe(true);
  });

  it("reverses the spend tracking instead of counting a refund as winnings", async () => {
    // Reason: a refund that lands in totalWonFromCompetitions would overstate lifetime
    // winnings, which feeds leaderboards and the fraud signals. The action documents this
    // intent at lines 72-75; this pins it.
    const competitionId = await seedCancelledScenario();

    await cancelCompetitionAndRefund(competitionId, "Undersubscribed");

    const wallet = await mongoose.connection.db
      ?.collection("creditwallets")
      .findOne({ userId: PLAYERS[0] });

    expect(wallet?.totalRefunded).toBe(ENTRY_FEE);
    expect(wallet?.totalSpentOnCompetitions).toBe(0);
    expect(wallet?.totalWonFromCompetitions).toBeUndefined();
  });

  it("refunds once when called twice (live bug 5, fixed)", async () => {
    // Reason: this was the proof of live bug 5 and is now the proof of its fix. Before the
    // fix both calls paid out, so every player ended up a whole entry fee better off than
    // they started - credits created from nothing, with a ledger that agreed.
    //
    // Reachability was never theoretical. The Inngest cron cancels undersubscribed
    // competitions, the admin cancel route cancels on demand, and the lazy check inside
    // getCompetitionById cancels during render. A retried cron delivery, or an admin click
    // racing the sweep, paid twice.
    //
    // The fix claims the competition in the same `findOneAndUpdate` that sets its final
    // status, so a second caller matches nothing and returns a no-op. The transaction alone
    // never helped: it made each pass atomic, not unique.
    const competitionId = await seedCancelledScenario();

    const first = await cancelCompetitionAndRefund(
      competitionId,
      "First cancellation",
    );
    const afterFirst = await balances();

    const second = await cancelCompetitionAndRefund(
      competitionId,
      "Same cancellation again",
    );
    const afterSecond = await balances();

    // Everyone is whole after the first call, and unchanged after the second.
    expect(afterFirst).toEqual(PLAYERS.map(() => START_BALANCE));
    expect(afterSecond).toEqual(afterFirst);

    // The second call reports success with nothing refunded. Asserted because a duplicate
    // request is not an error - a caller that retried should not be handed a failure.
    expect(first).toMatchObject({ success: true, refundedCount: PLAYERS.length });
    expect(second).toEqual({
      success: true,
      refundedCount: 0,
      totalRefunded: 0,
    });

    // And the ledger is written once, so the audit trail matches the money.
    expect(await refundRows(competitionId)).toHaveLength(PLAYERS.length);
  });

  it("refuses to refund a competition that already paid out prizes", async () => {
    // Reason: the guard is `status !== "cancelled"`, so a *completed* competition is still
    // eligible - and refunding one would hand back entry fees on top of prizes already paid.
    // Pinning it here records what the guard does and does not cover, rather than leaving a
    // reader to assume the narrower condition also protects this case.
    const competitionId = await seedCancelledScenario();
    await mongoose.connection.db
      ?.collection("competitions")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(competitionId) },
        { $set: { status: "completed" } },
      );

    const result = await cancelCompetitionAndRefund(
      competitionId,
      "Cancelling after payout",
    );

    // Documented behaviour: it DOES refund, returning every entry fee. In production the
    // winners would keep their prizes as well, so the pool is paid out twice over.
    //
    // The narrow guard is deliberate - it fixes the proven double-refund without changing
    // which statuses an admin may cancel - but this is the adjacent hazard, and the unified
    // service is where it should be closed. Left as a measurement, not a red test.
    expect(result.refundedCount).toBe(PLAYERS.length);
    expect(await balances()).toEqual(PLAYERS.map(() => START_BALANCE));
  });

  it("refunds every player even when the caller cancelled the competition first (R43)", async () => {
    // Reason: this is the shape of R43, a LIVE money defect. The Inngest sweep that cancels
    // an undersubscribed competition wrote `status: "cancelled"` itself and only then called
    // this action. The claim below is `status: { $ne: "cancelled" }`, so it matched nothing,
    // took the already-cancelled branch, logged "refunds were already issued" when none had
    // been, and returned refundedCount: 0. Every player's entry fee stayed in the platform's
    // pocket, with a cancelled competition and a log line that agreed refunds had happened.
    //
    // The caller is the root cause and is fixed separately. This pins the action itself as
    // self-healing, because the failure is silent and the next caller to cancel-then-refund
    // would reintroduce it with no error anywhere.
    const competitionId = await seedCancelledScenario();

    // Exactly what lib/inngest/functions.ts did before the fix.
    await mongoose.connection.db
      ?.collection("competitions")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(competitionId) },
        { $set: { status: "cancelled", cancellationReason: "Undersubscribed" } },
      );

    const result = await cancelCompetitionAndRefund(
      competitionId,
      "Competition cancelled - did not meet minimum participants",
    );

    expect(result.success).toBe(true);
    expect(result.refundedCount).toBe(PLAYERS.length);
    expect(result.totalRefunded).toBe(PLAYERS.length * ENTRY_FEE);
    expect(await balances()).toEqual(PLAYERS.map(() => START_BALANCE));

    const rows = await refundRows(competitionId);
    expect(rows).toHaveLength(PLAYERS.length);

    // The pool must still be emptied, or a cancelled competition keeps a fundable pot.
    const comp = await readCompetition(competitionId);
    expect(comp?.prizePool).toBe(0);
  });

  it("still refunds only once when a pre-cancelled competition is swept twice (R43 must not reopen live bug 5)", async () => {
    // Reason: the R43 fix widens the door - an already-cancelled competition is no longer
    // refused outright. That is precisely the condition live bug 5 relied on, so idempotency
    // must now come from the per-player ledger rows rather than from the status, exactly as
    // `exclusion-refund.ts` does it. Without this test the R43 fix reads as correct while
    // paying every player twice.
    const competitionId = await seedCancelledScenario();

    await mongoose.connection.db
      ?.collection("competitions")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(competitionId) },
        { $set: { status: "cancelled" } },
      );

    const first = await cancelCompetitionAndRefund(competitionId, "Sweep one");
    const afterFirst = await balances();
    const second = await cancelCompetitionAndRefund(competitionId, "Sweep two");
    const afterSecond = await balances();

    expect(first.refundedCount).toBe(PLAYERS.length);
    expect(second.refundedCount).toBe(0);
    expect(afterFirst).toEqual(PLAYERS.map(() => START_BALANCE));
    expect(afterSecond).toEqual(afterFirst);
    expect(await refundRows(competitionId)).toHaveLength(PLAYERS.length);
  });

  it("skips a player with no wallet rather than aborting the whole refund", async () => {
    // Reason: the loop `continue`s when a wallet is missing, so one bad row does not strand
    // everyone else's money inside a cancelled competition. Worth pinning because the
    // unified service must keep this property - and because it means refundedCount can be
    // legitimately lower than the participant count, which a reader could mistake for a
    // bug.
    const walletless = "6500000000000000000000c9";
    const competitionId = await seedCancelledScenario(
      [...PLAYERS, walletless],
      PLAYERS,
    );

    const result = await cancelCompetitionAndRefund(competitionId, "Undersubscribed");

    expect(result.success).toBe(true);
    expect(result.refundedCount).toBe(PLAYERS.length);
    expect(await balances()).toEqual(PLAYERS.map(() => START_BALANCE));

    const comp = await readCompetition(competitionId);
    expect(comp?.status).toBe("cancelled");
  });
});

/**
 * R43's root cause: the caller, not the action.
 *
 * The behavioural tests above make the action self-healing, which is the safety net. This
 * block guards the actual defect - a scheduled sweep that cancelled a competition itself
 * and then asked for the refund. Structural, because the sweep is an
 * `inngest.createFunction` wrapper that a unit test cannot drive without a full Inngest
 * harness, and the property is a one-line absence that is invisible at runtime.
 *
 * No database, so this describe deliberately does not start the test mongo above.
 */
describe("R43: the undersubscribed sweep must not cancel before refunding", () => {
  const CRON_COPIES = [
    "lib/inngest/functions.ts",
    "apps/admin/lib/inngest/functions.ts",
  ];

  /** Strips comments, because both files now DISCUSS the defect at length. */
  function codeOf(relativePath: string): string {
    const source = readFileSync(
      pathResolve(process.cwd(), relativePath),
      "utf8",
    );
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  it.each(CRON_COPIES)(
    "%s refunds without writing a cancelled status of its own",
    (relativePath) => {
      const code = codeOf(relativePath);

      // Locate the sweep by its call to the refund action, then examine the statements
      // around it. Reason: `status: "cancelled"` appears legitimately elsewhere in these
      // files (queries that read cancelled competitions), so a file-wide match would fail
      // on correct code - which is the fastest way to have a guard deleted.
      const callIndex = code.indexOf("cancelCompetitionAndRefund(");
      expect(callIndex).toBeGreaterThan(-1);

      const branch = code.slice(Math.max(0, callIndex - 1200), callIndex);

      // Assert the slice actually captured the branch, or a test examining nothing passes.
      expect(branch).toContain("minRequired");

      expect(branch).not.toMatch(/\$set\s*:\s*\{[^}]*status\s*:\s*["']cancelled["']/);
      expect(branch).not.toContain("cancellationReason:");
    },
  );

  it.each(CRON_COPIES)("%s logs the refund count it was given", (relativePath) => {
    const code = codeOf(relativePath);

    // Reason: the old log printed the participant count unconditionally, so the run that
    // refunded nobody reported a full payout. The defect survived because its only
    // observable was a log line that agreed with the intention rather than the outcome.
    expect(code).toMatch(
      /const\s+refund\s*=\s*await\s+cancelCompetitionAndRefund\(/,
    );
    expect(code).toMatch(/refund\.refundedCount/);
  });
});
