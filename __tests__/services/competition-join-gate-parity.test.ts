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
import { NextRequest } from "next/server";
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
  withFraudBlock,
  withRestriction,
  withUnverifiedEmail,
} from "../helpers/server-action-context";

/**
 * Stage 0, Defect 1: the two join paths compared side by side, in one file.
 *
 * A player can enter the same competition through either of two entrances:
 *
 *   Gate A  `enterCompetition`                     lib/actions/trading/competition.actions.ts
 *   Gate B  POST /api/competitions/[id]/join       app/api/competitions/[id]/join/route.ts
 *
 * They were two independent implementations, and they disagreed about which guards applied
 * and what money moved. These tests measured every disagreement first, so the unified
 * service in `lib/services/contest-entry.service.ts` had a specification to satisfy and
 * could not quietly drop a behaviour that only one gate had.
 *
 * Both gates now call that service. The tests are unchanged in what they assert about, but
 * three have flipped from recording a defect to proving its fix - Gate B funding the prize
 * pool, a mixed field funding it in full, and the market-hours ruling. Each says so, and
 * says what the old behaviour was, because a test that only states today's answer does not
 * tell the next reader why the answer was ever in doubt.
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
    getHiddenUserIds: async () => [] as string[],
  };
});

vi.mock("@/lib/services/fraud/entry-fraud-gate.service", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return { assertEntryFraudGate: async () => c.fraud };
});

// Reason: the unified service runs badges, notifications and coordination detection as
// fire-and-forget work after the transaction commits. None of it is what these tests are
// about, and leaving it real caused two kinds of noise that look like failures: duplicate
// keys on the fraud collections, and "Client must be connected" when the work outlived the
// test that started it. Stubbing them keeps the output readable and the assertions honest.
vi.mock("@/lib/services/badge-evaluation.service", () => ({
  evaluateUserBadges: async () => ({ newBadges: [] }),
}));

vi.mock("@/lib/services/notification.service", () => ({
  notificationService: { notifyCompetitionJoined: async () => {} },
}));

vi.mock("@/lib/services/fraud/coordination-detection.service", () => ({
  CoordinationDetectionService: { detectCoordinatedEntry: async () => {} },
}));

vi.mock("@/lib/services/fraud/behavioral-analysis.service", () => ({
  BehavioralAnalysisService: { recordCompetitionEntry: async () => {} },
}));

// Reason: Gate B gates on market hours and Gate A does not. That difference is measured in
// its own test below by driving this mock, rather than being left to whatever day the suite
// happens to run on - a test that passes only on a weekday is not a test.
const marketState = { open: true, reason: "Market is open" };

// Reason: the property is `canJoin`, not `allowed`. Getting it wrong produced a 400 whose
// body read `error: "Market is open"` - the reason string from an open market attached to a
// refusal - which is a good reminder to mock the real signature rather than a plausible one.
vi.mock("@/lib/services/market-hours.service", () => ({
  canJoinCompetition: async () => ({
    canJoin: marketState.open,
    reason: marketState.reason,
  }),
  canJoinChallenge: async () => ({
    canJoin: marketState.open,
    reason: marketState.reason,
  }),
  isMarketOpen: async () => ({
    isOpen: marketState.open,
    reason: marketState.reason,
  }),
}));

const { enterCompetition } = await import(
  "@/lib/actions/trading/competition.actions"
);
const CompetitionParticipant = (
  await import("@/database/models/trading/competition-participant.model")
).default;
const { POST: joinViaApi } = await import(
  "@/app/api/competitions/[id]/join/route"
);
const { placeOrder } = await import("@/lib/actions/trading/order.actions");

const ENTRY_FEE = 25;
const START_BALANCE = 500;

/** Calls Gate B the way Next.js would, for the currently signed-in test session. */
async function callGateB(competitionId: string) {
  const request = new NextRequest(
    `http://localhost:3000/api/competitions/${competitionId}/join`,
    { method: "POST" },
  );
  const response = await joinViaApi(request, {
    params: Promise.resolve({ id: competitionId }),
  });
  return {
    status: response.status,
    body: (await response.json()) as { success?: boolean; error?: string },
  };
}

async function seedCompetition(): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  await mongoose.connection.db?.collection("competitions").insertOne({
    _id: id,
    name: "Gate Parity Competition",
    status: "upcoming",
    entryFee: ENTRY_FEE,
    prizePool: 0,
    currentParticipants: 0,
    maxParticipants: 100,
    minParticipants: 2,
    startingCapital: 10_000,
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    registrationDeadline: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
  });
  return id.toString();
}

async function seedWallets(userIds: string[]): Promise<void> {
  await mongoose.connection.db?.collection("creditwallets").insertMany(
    userIds.map((userId) => ({
      userId,
      creditBalance: START_BALANCE,
      totalDeposited: START_BALANCE,
      totalSpentOnCompetitions: 0,
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

async function totalCollected(userIds: string[]): Promise<number> {
  const wallets = await mongoose.connection.db
    ?.collection("creditwallets")
    .find({ userId: { $in: userIds } })
    .toArray();
  const remaining = (wallets ?? []).reduce(
    (sum, w) => sum + (w.creditBalance as number),
    0,
  );
  return userIds.length * START_BALANCE - remaining;
}

describe("competition entry - the two gates compared", () => {
  beforeAll(async () => {
    await startTestMongo();
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
    marketState.open = true;
    marketState.reason = "Market is open";
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("Gate A funds the prize pool with the fee it collects", async () => {
    const competitionId = await seedCompetition();
    await seedWallets([DEFAULT_USER_ID]);

    const result = await enterCompetition(competitionId);
    expect(result.success).toBe(true);

    const comp = await readCompetition(competitionId);
    expect(await totalCollected([DEFAULT_USER_ID])).toBe(ENTRY_FEE);
    expect(comp?.currentParticipants).toBe(1);
    expect(comp?.prizePool).toBe(ENTRY_FEE);
  });

  it("Gate B funds the prize pool with the fee it collects", async () => {
    // Reason: this test used to record the defect and now records its fix. It is the
    // clearest money statement in the whole of Defect 1, so it is worth stating what was
    // wrong: the route debited the wallet and incremented only `currentParticipants`. There
    // was no `prizePool` increment anywhere in it. The platform collected the entry fee and
    // the pot the players were competing for did not grow by it.
    //
    // The finalize-time safeguard did not catch that, and the reason matters: it compares
    // `prizePool` against `currentParticipants * entryFee` and caps the pool when it is too
    // HIGH. The pool was too LOW, so the check passed and the shortfall was distributed as
    // though it were the correct amount. Under-payment is silent; over-payment is not.
    const competitionId = await seedCompetition();
    await seedWallets([DEFAULT_USER_ID]);

    const { status, body } = await callGateB(competitionId);
    // Asserted as a pair so a refusal prints its reason rather than "expected 400 to be 200".
    expect({ status, error: body.error }).toEqual({
      status: 200,
      error: undefined,
    });

    const comp = await readCompetition(competitionId);

    expect(await totalCollected([DEFAULT_USER_ID])).toBe(ENTRY_FEE);
    expect(comp?.currentParticipants).toBe(1);
    expect(comp?.prizePool).toBe(ENTRY_FEE);
  });

  it("funds the pool in full for a mixed field, whichever gate each player used", async () => {
    // Reason: the single-player case above could be read as a rounding curiosity. This is
    // the shape of the harm that was there - a mixed field, which is what a live competition
    // is once both entrances are reachable from different parts of the product. Six players
    // each pay the fee; before the unification the pool held half of what they paid.
    //
    // This is the test that would catch a future entrance being added without the increment,
    // so it asserts the invariant directly: what was collected is what can be paid out.
    const competitionId = await seedCompetition();
    const players = signInAsDistinctPlayers(6);
    await seedWallets(players);

    // Sessions are consumed in order, so alternating the gate alternates the player.
    for (let i = 0; i < players.length; i += 1) {
      if (i % 2 === 0) {
        const result = await enterCompetition(competitionId);
        expect(result.success).toBe(true);
      } else {
        const { body } = await callGateB(competitionId);
        expect(body.success).toBe(true);
      }
    }

    const comp = await readCompetition(competitionId);
    const collected = await totalCollected(players);

    expect(collected).toBe(6 * ENTRY_FEE);
    expect(comp?.currentParticipants).toBe(6);
    expect(comp?.prizePool).toBe(collected);
    expect(collected - (comp?.prizePool as number)).toBe(0);
  });

  it("both gates allow a join while the market is closed", async () => {
    // Reason: this is the divergence the owner ruled on 1 September 2026. Gate B refused a
    // join while the market was shut and Gate A allowed it. The ruling was that joining an
    // upcoming competition is allowed at any time and only trading itself is gated, because
    // carrying Gate B's check into the unified service would block weekend sign-ups for
    // Monday contests - the most common way a contest fills.
    //
    // The mock forces the market closed, so this asserts the decision rather than whatever
    // day the suite happens to run on. The other half of the ruling - that placing an order
    // outside market hours is still refused - is asserted further down this file.
    marketState.open = false;
    marketState.reason = "Market is closed for the weekend";

    const competitionId = await seedCompetition();
    const [gateAPlayer, gateBPlayer] = signInAsDistinctPlayers(2);
    await seedWallets([gateAPlayer, gateBPlayer]);

    const gateA = await enterCompetition(competitionId);
    expect(gateA.success).toBe(true);

    const gateB = await callGateB(competitionId);
    expect({ status: gateB.status, error: gateB.body.error }).toEqual({
      status: 200,
      error: undefined,
    });

    // Both players are seated and both fees are in the pool.
    const comp = await readCompetition(competitionId);
    expect(comp?.currentParticipants).toBe(2);
    expect(comp?.prizePool).toBe(2 * ENTRY_FEE);
    expect(await totalCollected([gateAPlayer, gateBPlayer])).toBe(
      2 * ENTRY_FEE,
    );
  });

  it("returns 409 without leaking the driver message when Gate B exhausts its retries (test 10, live bug 6 fixed)", async () => {
    // Reason: this was the proof of live bug 6 and is now the proof of its fix. Before it,
    // the fifth failure re-threw into the outer catch, which returned **500** with
    // `error.message` verbatim - so a caller received "Write conflict during plan execution
    // and yielding is disabled".
    //
    // Both halves mattered. A 500 tells a browser not to retry and can make a load balancer
    // pull the instance out of rotation, so a busy competition looked like an outage rather
    // than a lost race. And the driver's own text names the storage engine and its
    // configuration to an unauthenticated caller.
    //
    // The conflict is forced rather than raced, so this is deterministic. A second
    // transaction holds a write lock on the competition document; WiredTiger fails the
    // join's write immediately instead of blocking, so every attempt loses and the retry
    // budget drains at the speed of its own backoff.
    const competitionId = await seedCompetition();
    await seedWallets([DEFAULT_USER_ID]);

    const blocker = await mongoose.startSession();
    blocker.startTransaction();

    try {
      await mongoose.connection
        .collection("competitions")
        .updateOne(
          { _id: new mongoose.Types.ObjectId(competitionId) },
          { $set: { name: "Locked by the blocking transaction" } },
          { session: blocker },
        );

      const { status, body } = await callGateB(competitionId);

      expect(status).toBe(409);
      expect(body.success).toBe(false);

      // Something a player can act on, and nothing about the database.
      expect(body.error).toMatch(/try again/i);
      expect(body.error).not.toMatch(/write conflict|yielding|WiredTiger|transaction/i);
    } finally {
      await blocker.abortTransaction();
      await blocker.endSession();
    }

    // The refusal must also be clean, which was already true before the fix and must stay
    // true: a conflict that took the fee without seating the player would be far worse than
    // a wrong status code.
    const comp = await readCompetition(competitionId);
    expect(comp?.currentParticipants).toBe(0);
    expect(comp?.prizePool).toBe(0);
    expect(await totalCollected([DEFAULT_USER_ID])).toBe(0);

    const participants = await mongoose.connection.db
      ?.collection("competitionparticipants")
      .countDocuments({ competitionId });
    expect(participants).toBe(0);
  }, 60_000);

  it("refuses the ORDER outside market hours, which is the half that must keep refusing (test 12)", async () => {
    // Reason: this is the second direction of the owner's decision, and it is the one a
    // careless fix breaks. Relaxing the market-hours check to let weekend sign-ups through
    // must not relax it on the trading path - a player who joined on Saturday still cannot
    // trade until the market opens.
    //
    // Asserted here rather than in a trading test file because the two halves only mean
    // something together. Split apart, each looks like an arbitrary rule.
    //
    // Almost no fixture is needed: placeOrder checks the market immediately after the
    // session and before it even connects to the database (order.actions.ts line 255), so
    // the refusal happens before any competition state is read.
    marketState.open = false;
    marketState.reason = "Market is closed for the weekend";

    const competitionId = await seedCompetition();
    await seedWallets([DEFAULT_USER_ID]);

    const joined = await enterCompetition(competitionId);
    expect(joined.success).toBe(true);

    const order = await placeOrder({
      competitionId,
      symbol: "EUR/USD",
      side: "buy",
      orderType: "market",
      quantity: 1000,
    });

    expect(order.success).toBe(false);
    expect(order.error).toMatch(/market is currently closed/i);

    // No order and no position may exist as a result of the refusal.
    const orders = await mongoose.connection.db
      ?.collection("tradingorders")
      .countDocuments({ competitionId });
    const positions = await mongoose.connection.db
      ?.collection("tradingpositions")
      .countDocuments({ competitionId });
    expect(orders).toBe(0);
    expect(positions).toBe(0);
  });

  it("attributes the entry-fee ledger row to its competition, through either gate", async () => {
    // Reason: the end-to-end half of test 9. `entry-fee-ledger.test.ts` proves what the
    // schema does with the wrong field name; this proves the real entry path uses the right
    // one, which is the assertion that would have caught the defect in the first place.
    //
    // Gate A used to write `referenceId`, which the schema does not declare, so strict mode
    // discarded it and the row was left unattributable. Gate B already wrote `competitionId`
    // correctly - so this is also the test that stops the unified service regressing to the
    // worse of the two behaviours it inherited.
    const competitionId = await seedCompetition();
    const [gateAPlayer, gateBPlayer] = signInAsDistinctPlayers(2);
    await seedWallets([gateAPlayer, gateBPlayer]);

    expect((await enterCompetition(competitionId)).success).toBe(true);
    expect((await callGateB(competitionId)).body.success).toBe(true);

    const rows =
      (await mongoose.connection.db
        ?.collection("wallettransactions")
        .find({ transactionType: "competition_entry" })
        .toArray()) ?? [];

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => String(r.competitionId)).sort()).toEqual([
      competitionId,
      competitionId,
    ]);

    // The field the old code used must not come back. It looks harmless in a debug dump,
    // which is precisely the problem.
    for (const row of rows) {
      expect(row).not.toHaveProperty("referenceId");
      expect(row.amount).toBe(-ENTRY_FEE);
    }

    // And the query the audit trail needs actually answers.
    const collected = rows.reduce(
      (sum, r) => sum + Math.abs(r.amount as number),
      0,
    );
    expect(collected).toBe((await readCompetition(competitionId))?.prizePool);
  });

  it("charges one fee when the same player joins twice at the same instant", async () => {
    // Reason: the shape of the real hazard - a double-click on the website while a retry
    // from the app is in flight, hitting two entrances at once. Both gates are raced rather
    // than tested separately, because that is what a player actually does.
    //
    // Measured, not assumed: on this harness the two joins serialize and the second one is
    // caught by the seat check rather than by the unique index. That is worth stating,
    // because it means this test does NOT exercise the duplicate-key path - the test below
    // does that deliberately.
    const competitionId = await seedCompetition();
    await seedWallets([DEFAULT_USER_ID]);

    const [viaAction, viaRoute] = await Promise.all([
      enterCompetition(competitionId),
      callGateB(competitionId),
    ]);

    // Reason: both must succeed. One of them found or created the seat and the other was
    // told the seat exists; neither is an error the player should ever see.
    expect(viaAction.success).toBe(true);
    expect(viaRoute.body.success).toBe(true);

    const comp = await readCompetition(competitionId);
    expect(comp?.currentParticipants).toBe(1);
    expect(comp?.prizePool).toBe(ENTRY_FEE);
    expect(await totalCollected([DEFAULT_USER_ID])).toBe(ENTRY_FEE);

    const participants = await mongoose.connection.db
      ?.collection("competitionparticipants")
      .countDocuments({ competitionId });
    expect(participants).toBe(1);

    // Exactly one fee in the ledger. Two rows here would mean the player paid twice for
    // one seat, which is the outcome the whole test exists to rule out.
    const rows = await mongoose.connection.db
      ?.collection("wallettransactions")
      .countDocuments({ transactionType: "competition_entry" });
    expect(rows).toBe(1);
  }, 60_000);

  it("returns the existing seat when the unique index catches a duplicate insert", async () => {
    // Reason: the seat check is a read followed by an insert, so two joins by one player can
    // both pass it. The unique index on (competitionId, userId) is what actually prevents
    // the second seat, and it surfaces as a duplicate-key error (11000) rather than a write
    // conflict - so it was outside the retry logic either gate had. Neither handled it: the
    // loser received an opaque 500 and could not tell whether it had been charged.
    //
    // The window is too narrow to hit reliably by racing - the test above tried, and the
    // seat check won every time - so it is forced here instead. `findOne` is stubbed to
    // report "no seat" exactly once, which is precisely what the losing request sees, and
    // the insert then collides with the row that really is there. Forcing the condition is
    // the only way this branch gets covered at all; left to a race it would sit untested
    // and the 500 would come back the first time it mattered.
    const competitionId = await seedCompetition();
    await seedWallets([DEFAULT_USER_ID]);

    const first = await enterCompetition(competitionId);
    expect(first.success).toBe(true);

    const balanceAfterFirst = await totalCollected([DEFAULT_USER_ID]);
    expect(balanceAfterFirst).toBe(ENTRY_FEE);

    // Reason: `mockImplementationOnce` on a spy falls back to the real method once consumed,
    // so the recovery lookup inside the duplicate-key handler runs for real and the test
    // proves the seat is genuinely found rather than fabricated.
    const spy = vi
      .spyOn(CompetitionParticipant, "findOne")
      .mockImplementationOnce(
        () =>
          ({
            // The service calls `.session(session)` on the query it gets back.
            session: async () => null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stands in for a Mongoose Query
          }) as any,
      );

    try {
      const second = await enterCompetition(competitionId);

      // The player is in, and knows it, rather than receiving a server error.
      expect(second.success).toBe(true);
      expect(second).toMatchObject({ alreadyEntered: true });
      if (second.success && first.success) {
        expect(second.participantId).toBe(first.participantId);
      }
    } finally {
      spy.mockRestore();
    }

    // The money is the point: the duplicate must cost nothing. A second debit here would
    // mean the collision path charged for a seat it did not create.
    expect(await totalCollected([DEFAULT_USER_ID])).toBe(balanceAfterFirst);

    const comp = await readCompetition(competitionId);
    expect(comp?.currentParticipants).toBe(1);
    expect(comp?.prizePool).toBe(ENTRY_FEE);

    const participants = await mongoose.connection.db
      ?.collection("competitionparticipants")
      .countDocuments({ competitionId });
    expect(participants).toBe(1);

    const rows = await mongoose.connection.db
      ?.collection("wallettransactions")
      .countDocuments({ transactionType: "competition_entry" });
    expect(rows).toBe(1);
  });

  it("applies Gate A's guards to Gate B, which used to skip them", async () => {
    // Reason: the security half of the defect. Gate B checked none of email verification,
    // account restrictions, the fraud gate or the level requirement, so any of them could
    // be bypassed simply by using the other entrance. Each is asserted through Gate B
    // specifically, because that is the side that lacked them.
    //
    // The refusal has to be clean in every case: a guard that blocks the seat but keeps the
    // fee would be worse than no guard.
    const cases = [
      {
        name: "an unverified email",
        arrange: () => withUnverifiedEmail(),
        expected: /verify your email/i,
      },
      {
        name: "a restricted account",
        arrange: () => withRestriction("Account suspended pending review"),
        expected: /suspended/i,
      },
      {
        name: "a fraud-flagged account",
        arrange: () =>
          withFraudBlock("Entry is not allowed at this time."),
        expected: /not allowed/i,
      },
    ];

    for (const testCase of cases) {
      resetActionContext();
      const competitionId = await seedCompetition();
      await seedWallets([DEFAULT_USER_ID]);
      testCase.arrange();

      const { status, body } = await callGateB(competitionId);

      expect({ case: testCase.name, success: body.success }).toEqual({
        case: testCase.name,
        success: false,
      });
      expect(body.error).toMatch(testCase.expected);
      // 403 rather than 400: the request is well formed, the account is not permitted.
      expect(status).toBe(403);

      const comp = await readCompetition(competitionId);
      expect(comp?.currentParticipants).toBe(0);
      expect(comp?.prizePool).toBe(0);
      expect(await totalCollected([DEFAULT_USER_ID])).toBe(0);

      await clearTestMongo();
    }
  });
});
