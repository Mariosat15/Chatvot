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
} from "../helpers/mongo-test-server";
import {
  ctx,
  DEFAULT_USER_ID,
  resetActionContext,
  signOut,
  withUnverifiedEmail,
  withRestriction,
  withFraudBlock,
  TestRedirectError,
} from "../helpers/server-action-context";

/**
 * Stage 0, Defect 1, tests 3, 4 and 5: the security guards on the competition entry
 * path, asserted per entry point.
 *
 * This file covers Gate A - `enterCompetition` in lib/actions/trading/
 * competition.actions.ts, the only path real players use. It locks in the four checks
 * Gate A performs today, so that unifying the entry paths cannot quietly drop one. Gate B
 * skips all four, which is the defect; its tests come with the unified service.
 *
 * No production code is changed by this file.
 */

// ---- mocks -----------------------------------------------------------------------------
// Reason: vi.mock factories are hoisted above the imports above, so they cannot reference
// anything in this file. They import the shared context module instead.

vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => {
    void import("../helpers/server-action-context").then((m) =>
      m.ctx.revalidated.push(p),
    );
  },
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
  const { ctx: c } = await import("../helpers/server-action-context");
  return {
    auth: { api: { getSession: async () => c.session } },
  };
});

// Reason: the harness owns the connection. The real helper would dial the configured
// MONGODB_URI, which in a test run is either absent or, worse, production.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

vi.mock("@/lib/services/user-restriction.service", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return { canUserPerformAction: async () => c.restriction };
});

vi.mock("@/lib/services/fraud/entry-fraud-gate.service", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return { assertEntryFraudGate: async () => c.fraud };
});

// Imported after the mocks are declared. vi.mock is hoisted, so this still gets them.
const { enterCompetition } = await import(
  "@/lib/actions/trading/competition.actions"
);

// ---- fixtures --------------------------------------------------------------------------

const ENTRY_FEE = 25;
const STARTING_CAPITAL = 10_000;

async function seedCompetition(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  await mongoose.connection.db?.collection("competitions").insertOne({
    _id: id,
    name: "Test Competition",
    description: "Seeded by competition-entry-guards.test.ts",
    status: "upcoming",
    entryFee: ENTRY_FEE,
    prizePool: 0,
    currentParticipants: 0,
    maxParticipants: 100,
    minParticipants: 2,
    startingCapital: STARTING_CAPITAL,
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  });
  return id.toString();
}

async function seedWallet(userId: string, balance: number): Promise<void> {
  await mongoose.connection.db?.collection("creditwallets").insertOne({
    userId,
    creditBalance: balance,
    totalDeposited: balance,
    totalWithdrawn: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function participantCount(competitionId: string): Promise<number> {
  return (
    (await mongoose.connection.db
      ?.collection("competitionparticipants")
      .countDocuments({ competitionId })) ?? -1
  );
}

async function walletBalance(userId: string): Promise<number | undefined> {
  const w = await mongoose.connection.db
    ?.collection("creditwallets")
    .findOne({ userId });
  return w?.creditBalance as number | undefined;
}

// ---- tests -----------------------------------------------------------------------------

describe("Gate A - enterCompetition security guards", () => {
  beforeAll(async () => {
    await startTestMongo();
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

  /**
   * Asserts a refusal left no trace at all.
   *
   * Reason: this is the whole point of these tests. A guard that refuses *after* taking
   * the money is worse than no guard, and half-completed entry is exactly what unifying
   * two divergent paths risks. Every guard test checks both, not just the error message.
   */
  async function expectNoTrace(competitionId: string, userId = DEFAULT_USER_ID) {
    expect(await participantCount(competitionId)).toBe(0);
    expect(await walletBalance(userId)).toBe(500);
    const comp = await mongoose.connection.db
      ?.collection("competitions")
      .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
    expect(comp?.prizePool).toBe(0);
    expect(comp?.currentParticipants).toBe(0);
  }

  it("re-throws the sign-in redirect rather than swallowing it", async () => {
    const competitionId = await seedCompetition();
    signOut();

    // Reason: this asserts a subtlety worth protecting. The action wraps everything in a
    // catch that converts errors to { success: false }, and it re-throws only errors whose
    // `digest` starts with "NEXT_" - Next's own control-flow signals. If that check is
    // ever "simplified" away, an unauthenticated visitor gets a quiet error object instead
    // of being sent to sign-in, and the page renders as though entry merely failed.
    await expect(enterCompetition(competitionId)).rejects.toThrow(
      TestRedirectError,
    );
    expect(ctx.redirectedTo).toBe("/sign-in");
    expect(await participantCount(competitionId)).toBe(0);
  });

  it("refuses an unverified email address (test 3)", async () => {
    const competitionId = await seedCompetition();
    await seedWallet(DEFAULT_USER_ID, 500);
    withUnverifiedEmail();

    // Server actions in this codebase return failures, they do not throw them - thrown
    // messages are stripped by Next in production builds.
    const result = await enterCompetition(competitionId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/verify your email/i);
    await expectNoTrace(competitionId);
  });

  it("refuses a restricted account, and passes the reason through (test 4)", async () => {
    const competitionId = await seedCompetition();
    await seedWallet(DEFAULT_USER_ID, 500);
    withRestriction("Your account is suspended pending review");

    const result = await enterCompetition(competitionId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/suspended pending review/i);
    await expectNoTrace(competitionId);
  });

  it("refuses when the fraud gate blocks entry", async () => {
    const competitionId = await seedCompetition();
    await seedWallet(DEFAULT_USER_ID, 500);
    withFraudBlock("Entry from this network is not permitted");

    const result = await enterCompetition(competitionId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not permitted/i);
    await expectNoTrace(competitionId);
  });

  it("rejects a malformed competition id before touching the database", async () => {
    const result = await enterCompetition("not-an-object-id");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid competition ID/i);
  });

  it("lets a verified, unrestricted player in, and adds the fee to the prize pool", async () => {
    const competitionId = await seedCompetition();
    await seedWallet(DEFAULT_USER_ID, 500);

    const result = await enterCompetition(competitionId);

    expect(result.success).toBe(true);
    expect(await participantCount(competitionId)).toBe(1);
    expect(await walletBalance(DEFAULT_USER_ID)).toBe(500 - ENTRY_FEE);

    // Reason: the positive case is what makes the negative cases meaningful - without it,
    // a guard that refuses *everyone* would pass every other test in this file. It also
    // pins the behaviour Gate B is missing: the entry fee must reach the prize pool.
    const comp = await mongoose.connection.db
      ?.collection("competitions")
      .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
    expect(comp?.prizePool).toBe(ENTRY_FEE);
    expect(comp?.currentParticipants).toBe(1);
  });
});
