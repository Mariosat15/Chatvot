import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
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
import {
  DEFAULT_USER_ID,
  resetActionContext,
  signInAsDistinctPlayers,
} from "../helpers/server-action-context";

/**
 * Stage 0, Defect 1, tests 1 and 2: money integrity on the competition entry path.
 *
 * Test 1 is the one that matters most in the whole of Stage 0. The prize pool is the
 * money players are competing for, and it is incremented by a separate write from the
 * wallet debit that funds it. If those two can ever disagree, the platform either pays out
 * money it never collected or keeps money it owes.
 *
 * No production code is changed by this file.
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("next/headers", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return {
    headers: async () => new Headers(c.headers),
    cookies: async () => ({ get: () => undefined, getAll: () => [] }),
  };
});

vi.mock("next/navigation", async () => {
  const { ctx: c, TestRedirectError: Redirect } = await import(
    "../helpers/server-action-context"
  );
  return {
    redirect: (target: string) => {
      c.redirectedTo = target;
      throw new Redirect(target);
    },
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  };
});

vi.mock("@/lib/better-auth/auth", async () => {
  const { currentSession } = await import("../helpers/server-action-context");
  return { auth: { api: { getSession: async () => currentSession() } } };
});

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

vi.mock("@/lib/services/user-restriction.service", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return {
    canUserPerformAction: async () => c.restriction,
    // Reason: the entry path pulls in the leaderboard, which calls this. A partial mock
    // throws "No export is defined on the mock", and the resulting noise buries the
    // failure you actually care about.
    getHiddenUserIds: async () => [] as string[],
  };
});

vi.mock("@/lib/services/fraud/entry-fraud-gate.service", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return { assertEntryFraudGate: async () => c.fraud };
});

const { enterCompetition } = await import(
  "@/lib/actions/trading/competition.actions"
);

const ENTRY_FEE = 25;
const START_BALANCE = 500;

async function seedCompetition(): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  await mongoose.connection.db?.collection("competitions").insertOne({
    _id: id,
    name: "Concurrency Test Competition",
    status: "upcoming",
    entryFee: ENTRY_FEE,
    prizePool: 0,
    currentParticipants: 0,
    maxParticipants: 100,
    minParticipants: 2,
    startingCapital: 10_000,
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    createdAt: new Date(),
  });
  return id.toString();
}

async function seedWallets(userIds: string[], balance: number): Promise<void> {
  await mongoose.connection.db?.collection("creditwallets").insertMany(
    userIds.map((userId) => ({
      userId,
      creditBalance: balance,
      totalDeposited: balance,
      totalWithdrawn: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
}

async function readCompetition(competitionId: string) {
  return mongoose.connection.db
    ?.collection("competitions")
    .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
}

async function totalDebited(
  userIds: string[],
  startBalance = START_BALANCE,
): Promise<number> {
  const wallets = await mongoose.connection.db
    ?.collection("creditwallets")
    .find({ userId: { $in: userIds } })
    .toArray();
  const remaining = (wallets ?? []).reduce(
    (sum, w) => sum + (w.creditBalance as number),
    0,
  );
  return userIds.length * startBalance - remaining;
}

describe("competition entry - money integrity under concurrency", () => {
  beforeAll(async () => {
    await startTestMongo();
    // Reason: every one of these is written inside the entry transaction, and MongoDB
    // cannot create a collection inside one. See ensureCollections for why omitting this
    // produces a convincing but false concurrency finding.
    await ensureCollections([
      "competitions",
      "creditwallets",
      "wallettransactions",
      "competitionparticipants",
      "userlevels",
      "tradingbehaviorprofiles",
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(() => {
    resetActionContext();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("keeps the prize pool, the participant count and the debits in agreement across 20 simultaneous joins (test 1)", async () => {
    const competitionId = await seedCompetition();
    const players = signInAsDistinctPlayers(20);
    await seedWallets(players, START_BALANCE);

    const results = await Promise.all(
      players.map(() => enterCompetition(competitionId)),
    );

    const succeeded = results.filter((r) => r.success).length;
    const comp = await readCompetition(competitionId);
    const participants = await mongoose.connection.db
      ?.collection("competitionparticipants")
      .countDocuments({ competitionId });

    // Reason: the invariant is not "all 20 get in". Under a transaction some lose a write
    // conflict, and refusing a join is safe. What must never happen is the three numbers
    // disagreeing - that is money appearing or vanishing. Asserting them against the
    // *observed* success count rather than against 20 is what makes this a test of
    // consistency rather than of throughput, so it keeps passing after the retry is added
    // and the count changes.
    //
    // Deliberately no assertion that `succeeded > 0`: with Gate A as it stands, zero
    // successes is a real outcome (see the sequential test below for why that is a defect
    // rather than a quirk of this test). Asserting it would make this flaky on a slow
    // machine and would be asserting throughput by the back door.
    expect(participants).toBe(succeeded);
    expect(comp?.currentParticipants).toBe(succeeded);
    expect(comp?.prizePool).toBe(succeeded * ENTRY_FEE);
    expect(await totalDebited(players)).toBe(succeeded * ENTRY_FEE);
  }, 60_000);

  it("accounts for all 20 joins exactly when they arrive one at a time", async () => {
    const competitionId = await seedCompetition();
    const players = signInAsDistinctPlayers(20);
    await seedWallets(players, START_BALANCE);

    const results = [];
    for (const _ of players) {
      results.push(await enterCompetition(competitionId));
    }

    // Reason: this is the test that makes the concurrent result above meaningful. Run
    // sequentially, all 20 joins succeed and every number lines up - so the accounting
    // logic is correct and the failures under concurrency are purely contention, not a
    // bug in the arithmetic. Without this test, "1 of 20 succeeded" could be read as the
    // entry logic being broken for everyone.
    expect(results.every((r) => r.success)).toBe(true);

    const comp = await readCompetition(competitionId);
    expect(comp?.currentParticipants).toBe(20);
    expect(comp?.prizePool).toBe(20 * ENTRY_FEE);
    expect(await totalDebited(players)).toBe(20 * ENTRY_FEE);
  }, 60_000);

  it("records how many of 20 simultaneous joins Gate A actually admits", async () => {
    const competitionId = await seedCompetition();
    const players = signInAsDistinctPlayers(20);
    await seedWallets(players, START_BALANCE);

    const results = await Promise.all(
      players.map(() => enterCompetition(competitionId)),
    );
    const succeeded = results.filter((r) => r.success).length;
    const failures = results.filter((r) => !r.success);

    // Reason: this is deliberately an observation, not a threshold. The plan records that
    // Gate A has no retry on write conflict while Gate B retries five times, and predicts
    // that concurrent joins are therefore lost. Asserting an exact number here would make
    // the test fail on a faster machine for no useful reason. What it does assert is the
    // part that must hold either way: a rejected join is *clean*, so successes plus
    // failures account for every attempt and no failure left a debit behind. When the
    // unified service adds the retry, this number should rise and the file above still
    // passes unchanged.
    expect(succeeded + failures.length).toBe(20);
    expect(await totalDebited(players)).toBe(succeeded * ENTRY_FEE);

    if (failures.length > 0) {
      console.log(
        `Gate A admitted ${succeeded}/20 concurrent joins; ` +
          `${failures.length} refused, first reason: ${failures[0]?.error}`,
      );
    }
  }, 60_000);

  it("refuses a join the wallet cannot fund, leaving no participant and no debit (test 2)", async () => {
    const competitionId = await seedCompetition();
    const underfunded = ENTRY_FEE - 1;
    await seedWallets([DEFAULT_USER_ID], underfunded);

    const result = await enterCompetition(competitionId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insufficient|balance|credit/i);

    const comp = await readCompetition(competitionId);
    expect(comp?.prizePool).toBe(0);
    expect(comp?.currentParticipants).toBe(0);
    expect(await totalDebited([DEFAULT_USER_ID], underfunded)).toBe(0);
    expect(
      await mongoose.connection.db
        ?.collection("competitionparticipants")
        .countDocuments({ competitionId }),
    ).toBe(0);
  });

  it("refuses a second join by the same player, and does not charge twice", async () => {
    const competitionId = await seedCompetition();
    await seedWallets([DEFAULT_USER_ID], START_BALANCE);

    const first = await enterCompetition(competitionId);
    expect(first.success).toBe(true);

    const second = await enterCompetition(competitionId);

    // Reason: the plan records that the two gates disagree here - Gate A throws while
    // Gate B returns success with "Already joined". Whichever the unified service picks,
    // the money outcome is the part that cannot vary: one debit, one seat, one fee in the
    // pool. This test pins that and stays silent on the response shape.
    expect(second.success).toBe(false);

    const comp = await readCompetition(competitionId);
    expect(comp?.currentParticipants).toBe(1);
    expect(comp?.prizePool).toBe(ENTRY_FEE);
    expect(await totalDebited([DEFAULT_USER_ID])).toBe(ENTRY_FEE);
  });
});
