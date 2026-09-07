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
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * THE UNIVERSAL CUT-OFF: one clock for everybody, and the wait that makes it fair.
 *
 * The owner's question was "what happens when one player finishes and another is still
 * going". Half the answer was already built - `createRound` clamps a round's `expiresAt` to
 * the play window, and since `12` s2.3 the play window IS the contest clock, so no round can
 * outlive its contest and nobody waits for anybody.
 *
 * THE HALF THAT WAS MISSING COST MONEY, AND IT WAS THE HANDOVER RATHER THAN THE CLOCK.
 * `checkAndFinalizeCompetitions` claims any contest whose `endTime` has passed, every
 * minute - so settlement ran **before the grace window had even opened.** A player who
 * finished at 13:59:50 has their result posted by the provider seconds later;
 * `resultGracePeriodSeconds` exists to say that result is still welcome. Settling at
 * 14:00:00 refused it as a late result, ranked the player on nothing, and **paid them
 * nothing for a round they had actually finished.** The only trace is an audit entry.
 *
 * WHY THE FIXTURE HAS TO SEED REAL ROUNDS, and why the existing settlement suites could
 * never have caught this. They seed participants and scores and no `game_round` documents
 * at all, so there was never anything for a cut-off to be measured against - the same shape
 * as the score-seam finding, where every suite seeded the value under test. **When a value
 * crosses a seam, one test must start on the far side of it.**
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

vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    notifyCompetitionEnded: async () => {},
    notifyCompetitionWinner: async () => {},
    notifyCompetitionCancelled: async () => {},
  },
}));

const { finalizeCompetition } = await import(
  "@/lib/actions/trading/competition-end.actions"
);
const { assessRoundCutoff } = await import(
  "@/lib/services/settlement/round-cutoff"
);

const ENTRY_FEE = 100;
const START_BALANCE = 1_000;
const GAME_KEY = "provider:mock:mock-puzzle";
const GRACE_SECONDS = 600;

/** Ada finished and has a score; Bo was still playing when the clock ran out. */
const FINISHER = { id: "6500000000000000000000c1", name: "Ada", score: 900 };
const UNFINISHED = { id: "6500000000000000000000c2", name: "Bo" };

interface SeedOptions {
  /** How long ago play closed. The grace window is measured from here. */
  playClosedSecondsAgo: number;
  unresolvedRoundPolicy?: "score_zero" | "exclude" | "hold_and_alert";
  /** Status of the round belonging to the player who did not finish. */
  unfinishedRoundStatus?: "pending" | "launched" | "abandoned";
}

async function seedContest(options: SeedOptions): Promise<string> {
  const {
    playClosedSecondsAgo,
    unresolvedRoundPolicy = "score_zero",
    unfinishedRoundStatus = "launched",
  } = options;

  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;
  const playWindowEnd = new Date(Date.now() - playClosedSecondsAgo * 1000);

  await db?.collection("competitions").insertOne({
    _id: id,
    name: "Cut-off Cup",
    slug: `cutoff-${id.toString()}`,
    description: "Seeded by provider-round-cutoff.test.ts",
    createdBy: "6500000000000000000000ff",
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig: { providerKey: "mock", gameCode: "mock-puzzle", settings: {} },
    attemptsPolicy: "single",
    unresolvedRoundPolicy,
    playWindowStart: new Date(Date.now() - 2 * 60 * 60 * 1000),
    // ONE CLOCK. `12` s2.3 derives the play window from the contest's own times, so a
    // fixture that let these drift apart would be testing a contest no operator can create.
    playWindowEnd,
    endTime: playWindowEnd,
    resultGracePeriodSeconds: GRACE_SECONDS,
    registrationDeadline: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "active",
    entryFee: ENTRY_FEE,
    prizePool: 2 * ENTRY_FEE,
    currentParticipants: 2,
    minParticipants: 2,
    maxParticipants: 100,
    platformFeePercentage: 20,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    competitionType: "time_based",
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date(),
  });

  await db?.collection("competitionparticipants").insertMany([
    {
      competitionId: id.toString(),
      userId: FINISHER.id,
      username: FINISHER.name,
      gameKey: GAME_KEY,
      score: FINISHER.score,
      status: "active",
      enteredAt: new Date(Date.now() - 90 * 60 * 1000),
    },
    {
      // NO `score` FIELD AT ALL, not a zero. A player who never finished has no score, and
      // the two are different facts - conflating them is what made every provider
      // participant tie in R37.
      competitionId: id.toString(),
      userId: UNFINISHED.id,
      username: UNFINISHED.name,
      gameKey: GAME_KEY,
      status: "active",
      enteredAt: new Date(Date.now() - 89 * 60 * 1000),
    },
  ]);

  /*
    Rounds are inserted with the raw driver, which does NOT cast - so `contestId` must be a
    real ObjectId. Passing the string looks correct, matches nothing, and the symptom is a
    settlement that finds no rounds and reports success: the same fixture bug that made R42
    mark a contest `completed` having paid nobody.
  */
  await db?.collection("game_round").insertMany([
    {
      roundId: `round-finished-${id.toString()}`,
      providerKey: "mock",
      gameCode: "mock-puzzle",
      gameKey: GAME_KEY,
      userId: FINISHER.id,
      contestType: "competition",
      contestId: id,
      attemptNumber: 1,
      mode: "ranked",
      status: "completed",
      rawScore: FINISHER.score,
      expiresAt: playWindowEnd,
      createdAt: new Date(),
    },
    {
      roundId: `round-open-${id.toString()}`,
      providerKey: "mock",
      gameCode: "mock-puzzle",
      gameKey: GAME_KEY,
      userId: UNFINISHED.id,
      contestType: "competition",
      contestId: id,
      attemptNumber: 1,
      mode: "ranked",
      status: unfinishedRoundStatus,
      expiresAt: playWindowEnd,
      createdAt: new Date(),
    },
  ]);

  await db?.collection("creditwallets").insertMany(
    [FINISHER.id, UNFINISHED.id].map((userId) => ({
      userId,
      creditBalance: START_BALANCE,
      totalDeposited: START_BALANCE,
      totalWonFromCompetitions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  return id.toString();
}

async function readContest(competitionId: string) {
  return mongoose.connection.db
    ?.collection("competitions")
    .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
}

async function readRound(roundId: string) {
  return mongoose.connection.db
    ?.collection("game_round")
    .findOne({ roundId });
}

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "competitions",
    "competitionparticipants",
    "creditwallets",
    "wallettransactions",
    "platformtransactions",
    "tradingpositions",
    "tradingorders",
    "tradehistories",
    "gamemasterearnings",
    "gamemastersubscriptions",
    "userreferrals",
    "user",
    "marketplaceitems",
    "game_round",
    "provider_game",
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

afterEach(async () => {
  await clearTestMongo();
});

describe("settlement waits out the result grace window", () => {
  it("defers, leaving the contest untouched, while a round could still report", async () => {
    // Play closed a minute ago and the grace window is ten minutes, so a provider may still
    // post Bo's result.
    const competitionId = await seedContest({ playClosedSecondsAgo: 60 });

    const result = await finalizeCompetition(competitionId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/still open when play closed/i);

    /*
      THE ASSERTION THAT MATTERS IS THAT NOTHING WAS WRITTEN, not that it refused. The gate
      sits before the optimistic claim precisely so a contest that is merely waiting is
      never moved to `finalizing` - a refusal after the claim would churn the status of every
      contest with a last-minute finisher, once a minute, until the grace window closed.

      `updatedAt` is the observable, and it is the load-bearing assertion here: a
      claim-and-release ends at `active` too, so the end status alone cannot tell the two
      placements apart. The fixture inserts with the raw driver and writes no `updatedAt`,
      so its mere existence proves Mongoose touched the document. Same lesson as the
      pre-lock game gate in the main app's finalizer, where a guard whose whole value is
      "no write happened" needed a test that could observe a write.
    */
    const contest = await readContest(competitionId);
    expect(contest?.status).toBe("active");
    expect(contest?.finalLeaderboard).toBeUndefined();
    expect(contest?.updatedAt).toBeUndefined();

    // And nobody was paid, which is the harm the deferral exists to prevent in reverse:
    // settling now would have paid Ada out of a pool Bo might still have a claim on.
    const wallet = await mongoose.connection.db
      ?.collection("creditwallets")
      .findOne({ userId: FINISHER.id });
    expect(wallet?.creditBalance).toBe(START_BALANCE);

    // The round is left exactly as it was - the deferral must not pre-emptively close it,
    // or the result it is waiting for would be refused when it arrived.
    const open = await readRound(`round-open-${competitionId}`);
    expect(open?.status).toBe("launched");
  });

  it("settles once the grace window has expired", async () => {
    const competitionId = await seedContest({
      playClosedSecondsAgo: GRACE_SECONDS + 60,
    });

    const result = await finalizeCompetition(competitionId);

    expect(result.success).toBe(true);

    const contest = await readContest(competitionId);
    expect(contest?.status).toBe("completed");

    /*
      Ada is paid and Bo is not, which is the owner's question answered: **a player who did
      not finish does not stop the contest paying out, and does not share in it.** The prize
      is the pool less the platform fee - 200 less 20% - and it goes to rank 1 because the
      distribution is 100% to first place.

      Asserted as money rather than as a rank, because a terminal status is not evidence of
      a settlement: R42's fixture bug produced a `completed` contest that had paid nobody
      and still returned success.
    */
    const paid = await mongoose.connection.db
      ?.collection("creditwallets")
      .findOne({ userId: FINISHER.id });
    const unpaid = await mongoose.connection.db
      ?.collection("creditwallets")
      .findOne({ userId: UNFINISHED.id });

    expect(paid?.creditBalance).toBeGreaterThan(START_BALANCE);
    expect(unpaid?.creditBalance).toBe(START_BALANCE);
  });

  it("marks the round that never reported UNRESOLVED, not voided", async () => {
    const competitionId = await seedContest({
      playClosedSecondsAgo: GRACE_SECONDS + 60,
    });

    await finalizeCompetition(competitionId);

    const open = await readRound(`round-open-${competitionId}`);

    /*
      THE STATUS IS THE WHOLE DECISION, and `voided` would have been the tidy-looking
      mistake. `unresolved` is the one persisted fact `assessUnresolvedRounds` reads, so it
      is what lets the operator's configured policy - score zero, exclude and refund, or
      park for a human - actually decide. Writing `voided` reads as housekeeping and
      silently overrides all three with "score zero, nothing owed", which is a configured
      control that cannot fire.
    */
    expect(open?.status).toBe("unresolved");

    // `resultSource` records where a result came from, and none came from anywhere.
    // Stamping "manual" here would claim a human adjudicated it.
    expect(open?.resultSource).toBeUndefined();

    /*
      A round that already reported is not touched.

      TWO GUARDS HOLD THIS AND NEITHER CAN BE PROBED ALONE - the query filter on
      `LIVE_ROUND_STATUSES`, and the transition check inside the loop, which refuses
      `completed -> unresolved` because `ROUND_TRANSITIONS` maps `completed` to nothing.
      The cleanup service documents that check as unreachable, and that is true of normal
      operation and of the `cancelled` outcome; it stops being true exactly when the filter
      is the thing that breaks, which is the case this assertion is for. So the probe
      removes both in one edit, as R42's pair of game gates had to.
    */
    const finished = await readRound(`round-finished-${competitionId}`);
    expect(finished?.status).toBe("completed");
    expect(finished?.rawScore).toBe(FINISHER.score);
  });

  it("leaves the mark DURABLE when the hold policy aborts settlement", async () => {
    /*
      THE ORDERING BUG THIS TEST EXISTS FOR, which is the subtlest part of the whole slice.

      Under `hold_and_alert` the settlement transaction aborts - that is the policy working.
      Had the round been marked inside that transaction, the mark would roll back, the
      pre-lock gate would keep seeing nothing unresolved, and **every cron pass would
      re-mark, re-block and re-roll-back for ever**: nobody paid, no round for an operator
      to resolve in the admin inspector, and no error anywhere. The mark is therefore
      written outside the transaction, before settlement is asked to run.
    */
    const competitionId = await seedContest({
      playClosedSecondsAgo: GRACE_SECONDS + 60,
      unresolvedRoundPolicy: "hold_and_alert",
    });

    const result = await finalizeCompetition(competitionId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/held/i);

    // The contest is parked and reclaimable, not stranded at `finalizing`.
    const contest = await readContest(competitionId);
    expect(contest?.status).toBe("active");

    /*
      AND IT WAS NEVER CLAIMED, which is the only way to prove the ORDER of the two steps
      above. Probing this taught the lesson: `settleProviderCompetition` asks the same
      unresolved question again inside the transaction, so assessing before the mark - which
      would make the pre-lock gate see nothing and let the contest through - ends at exactly
      the same status with exactly the same error. `updatedAt` is what differs, because the
      wrong order claims the contest and releases it.

      Same shape as the deferral test above, and the same reason the main app's pre-lock
      hold gate needed a test that could observe a write rather than an end status.
    */
    expect(contest?.updatedAt).toBeUndefined();

    // And the round survived the refusal, which is what an operator resolves.
    const open = await readRound(`round-open-${competitionId}`);
    expect(open?.status).toBe("unresolved");
  });

  it("does not defer a contest whose rounds have all reported", async () => {
    /*
      The no-regression half. A contest where everybody finished must settle on the first
      pass even one second after the cut-off - waiting out ten minutes for nothing would
      make every well-behaved contest ten minutes late, which is a worse outcome than the
      defect being fixed.
    */
    const competitionId = await seedContest({
      playClosedSecondsAgo: 1,
      unfinishedRoundStatus: "abandoned",
    });

    const result = await finalizeCompetition(competitionId);

    expect(result.success).toBe(true);
    const contest = await readContest(competitionId);
    expect(contest?.status).toBe("completed");
  });
});

describe("the cut-off assessment itself", () => {
  it("is off entirely for a contest with no play window", async () => {
    /*
      This is what keeps the gate away from trading. A trading contest has no rounds, so the
      query would return zero anyway - but returning early also means a contest that
      predates the field cannot be deferred by a grace window computed from `undefined`,
      which would be an unbounded wait on a contest nothing can ever resolve.
    */
    const assessment = await assessRoundCutoff({
      competitionId: new mongoose.Types.ObjectId().toString(),
      playWindowEnd: undefined,
    });

    expect(assessment.deferSettlement).toBe(false);
    expect(assessment.graceEndsAt).toBeNull();
  });

  it("does not throw on an id that is not an ObjectId", async () => {
    // Reason: a throw here aborts a settlement that could otherwise have paid everyone.
    // Mongoose would cast a valid hex string, but an arbitrary one raises a CastError.
    const assessment = await assessRoundCutoff({
      competitionId: "not-an-object-id",
      playWindowEnd: new Date(),
    });

    expect(assessment.deferSettlement).toBe(false);
  });

  it("measures grace from the play window end, and resolves the default", async () => {
    const playWindowEnd = new Date("2026-09-07T14:00:00.000Z");

    const named = await assessRoundCutoff({
      competitionId: new mongoose.Types.ObjectId().toString(),
      playWindowEnd,
      resultGracePeriodSeconds: 120,
    });
    expect(named.graceSeconds).toBe(120);
    expect(named.graceEndsAt?.toISOString()).toBe("2026-09-07T14:02:00.000Z");

    /*
      An ABSENT grace period resolves to the shared default rather than to zero. Zero would
      mean a contest that predates the field settles instantly at its cut-off, which is the
      defect this slice exists to fix - reintroduced for exactly the older contests least
      likely to be noticed.

      The default is imported from `round-types.ts` by both apps deliberately: two copies
      would mean whichever cron claimed the contest decided whether a last-minute finisher
      was paid, which is R26's failure mode.
    */
    const defaulted = await assessRoundCutoff({
      competitionId: new mongoose.Types.ObjectId().toString(),
      playWindowEnd,
    });
    expect(defaulted.graceSeconds).toBe(600);
  });
});
