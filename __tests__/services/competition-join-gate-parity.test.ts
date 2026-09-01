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
} from "../helpers/server-action-context";

/**
 * Stage 0, Defect 1: the two join paths compared side by side, in one file.
 *
 * This is the heart of the defect. A player can enter the same competition through either
 * of two independent implementations:
 *
 *   Gate A  `enterCompetition`                     lib/actions/trading/competition.actions.ts
 *   Gate B  POST /api/competitions/[id]/join       app/api/competitions/[id]/join/route.ts
 *
 * Both take the entry fee. The plan's claim is that they disagree about what else happens,
 * and that the disagreement is a money defect rather than an inconsistency. These tests
 * measure the disagreement rather than restating it, so the unified service has a
 * specification to satisfy and cannot quietly drop a behaviour that only one gate had.
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
    getHiddenUserIds: async () => [] as string[],
  };
});

vi.mock("@/lib/services/fraud/entry-fraud-gate.service", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return { assertEntryFraudGate: async () => c.fraud };
});

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
const { POST: joinViaApi } = await import(
  "@/app/api/competitions/[id]/join/route"
);

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

  it("Gate B TAKES THE FEE AND DOES NOT FUND THE PRIZE POOL", async () => {
    // Reason: this test records a defect, not a fix. It is the clearest money statement in
    // the whole of Defect 1.
    //
    // The route debits the wallet (lines 190-199) and increments only
    // `currentParticipants` (lines 260-264). There is no `prizePool` increment anywhere in
    // it. So the platform collects the entry fee and the pot the players are competing for
    // does not grow by it.
    //
    // The finalize-time safeguard does not catch this, and it is worth being precise about
    // why: it compares `prizePool` against `currentParticipants * entryFee` and caps the
    // pool when it is too HIGH. Here the pool is too LOW, so the check passes and the
    // shortfall is distributed as though it were the correct amount. Under-payment is
    // silent; over-payment is not.
    const competitionId = await seedCompetition();
    await seedWallets([DEFAULT_USER_ID]);

    const { status, body } = await callGateB(competitionId);
    // Asserted as a pair so a refusal prints its reason rather than "expected 400 to be 200".
    expect({ status, error: body.error }).toEqual({
      status: 200,
      error: undefined,
    });

    const comp = await readCompetition(competitionId);

    // The fee was taken, and the seat was given.
    expect(await totalCollected([DEFAULT_USER_ID])).toBe(ENTRY_FEE);
    expect(comp?.currentParticipants).toBe(1);

    // And the prize pool never saw it.
    expect(comp?.prizePool).toBe(0);
  });

  it("under-funds the pool in proportion to how many players used Gate B", async () => {
    // Reason: the single-player case above could be read as a rounding curiosity. This is
    // the shape of the real harm - a mixed field, which is exactly what a live competition
    // is, since the two gates are reachable from different parts of the product at the same
    // time. Six players each pay the fee; the pool holds half of what they paid.
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

    // Three players' fees are missing from the pot they are competing for.
    expect(comp?.prizePool).toBe(3 * ENTRY_FEE);
    expect(collected - (comp?.prizePool as number)).toBe(3 * ENTRY_FEE);
  });

  it("Gate B refuses outside market hours where Gate A allows the join", async () => {
    // Reason: this is the divergence the owner ruled on 1 September 2026. The unified
    // service must take Gate A's behaviour here - joining an upcoming competition is
    // allowed at any time, and only trading itself is gated - because carrying Gate B's
    // check across would block weekend sign-ups for Monday contests.
    //
    // Both halves are asserted in one test on purpose: the point is not that either gate
    // behaves a particular way, it is that they disagree on the same input.
    marketState.open = false;
    marketState.reason = "Market is closed for the weekend";

    const competitionId = await seedCompetition();
    const [gateAPlayer, gateBPlayer] = signInAsDistinctPlayers(2);
    await seedWallets([gateAPlayer, gateBPlayer]);

    const gateA = await enterCompetition(competitionId);
    expect(gateA.success).toBe(true);

    const gateB = await callGateB(competitionId);
    expect(gateB.body.success).toBe(false);
    expect(gateB.body.error).toMatch(/closed|market/i);

    // The refusal must be clean: no seat, and no fee taken.
    const comp = await readCompetition(competitionId);
    expect(comp?.currentParticipants).toBe(1);
    expect(await totalCollected([gateBPlayer])).toBe(0);
  });
});
