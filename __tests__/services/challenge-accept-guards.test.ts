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
  withRestriction,
  withFraudBlock,
  withUnverifiedEmail,
  signOut,
} from "../helpers/server-action-context";

/**
 * Stage 0, Defect 1, test 11: the guards on accepting a 1v1 challenge (sub-defect 1b).
 *
 * A challenge is the other paid entry point. Accepting one debits the entry fee from BOTH
 * players, so it is a money path and it must refuse the accounts competition entry
 * refuses. It did not. Measured on 1 September 2026 and fixed the same day; the two tests
 * that recorded the defect are kept and inverted rather than deleted, because the reason
 * the gap mattered is the most valuable part of them.
 *
 * Guards on POST /api/challenges/[id]/accept:
 *
 *   authenticated            always
 *   email verified           always
 *   market hours             always
 *   only the challenged user always
 *   status is pending        always
 *   accept deadline          always
 *   wallet balance           always
 *   account restriction      ADDED 1 Sep 2026
 *   fraud gate               ADDED 1 Sep 2026
 *
 * Why it was only reachable here: the challenge CREATE route checks both, so reading one
 * route would never have found it. The last two now come from `checkAccountStanding` in
 * `lib/services/contest-entry/guards.ts`, shared with the unified competition entry
 * service, so the two paths cannot drift apart again.
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

vi.mock("@/lib/better-auth/auth", async () => {
  const { currentSession } = await import("../helpers/server-action-context");
  return { auth: { api: { getSession: async () => currentSession() } } };
});

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

/**
 * Records which restriction action the route asks about, as well as answering.
 *
 * Reason: the answer alone cannot distinguish a route that asks about challenges from one
 * that asks about competitions, and the two flags behave differently on purpose - so a
 * test that only checked the refusal would pass either way.
 */
const restrictionCalls: string[] = [];

vi.mock("@/lib/services/user-restriction.service", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return {
    canUserPerformAction: async (_userId: string, action: string) => {
      restrictionCalls.push(action);
      return c.restriction;
    },
    getHiddenUserIds: async () => [] as string[],
  };
});

vi.mock("@/lib/services/fraud/entry-fraud-gate.service", async () => {
  const { ctx: c } = await import("../helpers/server-action-context");
  return { assertEntryFraudGate: async () => c.fraud };
});

const marketState = { open: true, reason: "Market is open" };

vi.mock("@/lib/services/market-hours.service", () => ({
  // The property is `canJoin`. See the note in competition-join-gate-parity.test.ts.
  canJoinChallenge: async () => ({
    canJoin: marketState.open,
    reason: marketState.reason,
  }),
  canJoinCompetition: async () => ({
    canJoin: marketState.open,
    reason: marketState.reason,
  }),
  isMarketOpen: async () => ({
    isOpen: marketState.open,
    reason: marketState.reason,
  }),
}));

vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    // `send` is the one the accept route actually calls, after the commit. Stubbed so a
    // post-commit side effect cannot print a failure that looks like the entry failing.
    send: async () => {},
    notifyChallengeAccepted: async () => {},
    notifyCompetitionCancelled: async () => {},
  },
}));

const { POST: acceptChallenge } = await import(
  "@/app/api/challenges/[id]/accept/route"
);

const ENTRY_FEE = 50;
const START_BALANCE = 500;
const CHALLENGER_ID = "6500000000000000000000d1";

async function callAccept(challengeId: string) {
  const request = new NextRequest(
    `http://localhost:3000/api/challenges/${challengeId}/accept`,
    { method: "POST" },
  );
  const response = await acceptChallenge(request, {
    params: Promise.resolve({ id: challengeId }),
  });
  return {
    status: response.status,
    body: (await response.json()) as { error?: string; success?: boolean },
  };
}

/**
 * Seeds a pending challenge addressed to DEFAULT_USER_ID, with both wallets funded.
 *
 * Inserted through the raw driver rather than the model: the schema marks twenty-two fields
 * required, none of which this test is about, and a fixture that large hides the three
 * fields that actually matter here (status, challengedId, entryFee).
 */
async function seedPendingChallenge(): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;

  await db?.collection("challenges").insertOne({
    _id: id,
    slug: "test-challenge",
    challengerId: CHALLENGER_ID,
    challengerName: "Challenger",
    challengerEmail: "challenger@example.com",
    challengedId: DEFAULT_USER_ID,
    challengedName: "Test Player",
    challengedEmail: "player@example.com",
    entryFee: ENTRY_FEE,
    startingCapital: 10_000,
    prizePool: ENTRY_FEE * 2,
    platformFeePercentage: 10,
    platformFeeAmount: ENTRY_FEE * 0.2,
    winnerPrize: ENTRY_FEE * 1.8,
    acceptDeadline: new Date(Date.now() + 60 * 60 * 1000),
    duration: 60,
    status: "pending",
    minimumTrades: 0,
    disqualifyOnLiquidation: false,
    // A percentage of capital, capped at 100 by the schema - not a credit amount.
    maxPositionSize: 25,
    maxOpenPositions: 5,
    allowShortSelling: true,
    marginCallThreshold: 50,
    createdAt: new Date(),
  });

  await db?.collection("creditwallets").insertMany(
    [CHALLENGER_ID, DEFAULT_USER_ID].map((userId) => ({
      userId,
      creditBalance: START_BALANCE,
      totalDeposited: START_BALANCE,
      totalSpentOnCompetitions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  return id.toString();
}

async function readChallenge(challengeId: string) {
  return mongoose.connection.db
    ?.collection("challenges")
    .findOne({ _id: new mongoose.Types.ObjectId(challengeId) });
}

async function balanceOf(userId: string): Promise<number | undefined> {
  const wallet = await mongoose.connection.db
    ?.collection("creditwallets")
    .findOne({ userId });
  return wallet?.creditBalance as number | undefined;
}

/** Asserts the accept was refused cleanly: no fee taken from either side, still pending. */
async function expectNoEntry(challengeId: string) {
  expect(await balanceOf(DEFAULT_USER_ID)).toBe(START_BALANCE);
  expect(await balanceOf(CHALLENGER_ID)).toBe(START_BALANCE);

  const challenge = await readChallenge(challengeId);
  expect(challenge?.status).toBe("pending");

  const participants = await mongoose.connection.db
    ?.collection("challengeparticipants")
    .countDocuments({ challengeId });
  expect(participants).toBe(0);
}

describe("challenge accept - guards (sub-defect 1b)", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "challenges",
      "challengeparticipants",
      "creditwallets",
      "wallettransactions",
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(() => {
    resetActionContext();
    marketState.open = true;
    marketState.reason = "Market is open";
    restrictionCalls.length = 0;
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  describe("guards that are present, so a fix must not remove them", () => {
    it("refuses an unauthenticated caller", async () => {
      const challengeId = await seedPendingChallenge();
      signOut();

      const { status, body } = await callAccept(challengeId);

      expect(status).toBe(401);
      expect(body.error).toMatch(/unauthorized/i);
      await expectNoEntry(challengeId);
    });

    it("refuses an unverified email address", async () => {
      const challengeId = await seedPendingChallenge();
      withUnverifiedEmail();

      const { status, body } = await callAccept(challengeId);

      expect(status).toBe(403);
      expect(body.error).toMatch(/verify your email/i);
      await expectNoEntry(challengeId);
    });

    it("refuses when the market is closed", async () => {
      const challengeId = await seedPendingChallenge();
      marketState.open = false;
      marketState.reason = "Market is closed for the weekend";

      const { status, body } = await callAccept(challengeId);

      expect(status).toBe(400);
      expect(body.error).toMatch(/closed/i);
      await expectNoEntry(challengeId);
    });
  });

  describe("the two guards that were missing - sub-defect 1b, now fixed", () => {
    it("refuses a restricted account, as competition entry does", async () => {
      // Reason: a restriction is how a suspended or under-investigation account is stopped
      // from moving money. Gate A always called canUserPerformAction; the accept route
      // never did, so the same account that could not join a competition could enter a
      // paid 1v1 and have its wallet debited. Both now share `checkAccountStanding`.
      const challengeId = await seedPendingChallenge();
      withRestriction("Account suspended pending review");

      const { status, body } = await callAccept(challengeId);

      expect(status).toBe(403);
      expect(body.error).toMatch(/suspended pending review/i);

      // The part that matters: no fee left either wallet and the challenge is untouched.
      await expectNoEntry(challengeId);
    });

    it("refuses a fraud-flagged account, as competition entry does", async () => {
      // Reason: the fraud gate is what stops coordinated entry - two accounts controlled
      // by one person entering the same contest. A challenge is the EASIEST shape for that
      // abuse, being exactly two players with the pot returning to the pair minus the
      // platform fee, so the gate matters here at least as much as on a competition.
      const challengeId = await seedPendingChallenge();
      withFraudBlock("Coordinated entry detected from a shared address");

      const { status, body } = await callAccept(challengeId);

      expect(status).toBe(403);
      expect(body.error).toMatch(/coordinated entry/i);
      await expectNoEntry(challengeId);
    });

    it("still admits an account in good standing", async () => {
      // Reason: asserted so that a guard which refuses everything - the easiest way to make
      // the two tests above pass - cannot be mistaken for a fix. Both fees must move.
      const challengeId = await seedPendingChallenge();

      const { status } = await callAccept(challengeId);

      expect(status).toBe(200);
      expect(await balanceOf(DEFAULT_USER_ID)).toBe(START_BALANCE - ENTRY_FEE);
      expect(await balanceOf(CHALLENGER_ID)).toBe(START_BALANCE - ENTRY_FEE);
      expect(await readChallenge(challengeId)).toMatchObject({
        status: "active",
      });
    });

    it("attributes both entry-fee ledger rows to their challenge", async () => {
      // Reason: a second instance of the `referenceId` defect, found while documenting this
      // fix. `challengeId` was NOT declared on the WalletTransaction schema in either app,
      // yet nine writers already passed it - challenge entry twice, the refund on decline,
      // and six finalization payout rows - so strict mode discarded every one and the
      // whole challenge money trail was unattributable to its challenge.
      //
      // As with competitions, state the harm accurately: no balance is computed from this
      // field, so nothing was mis-paid. It is an audit-trail defect. And because BOTH model
      // copies lacked the field identically, it is one bug duplicated rather than mirror
      // drift, so `npm run check:mirrors` neither caught it nor could have.
      const challengeId = await seedPendingChallenge();

      const { status } = await callAccept(challengeId);
      expect(status).toBe(200);

      const rows = await mongoose.connection.db
        ?.collection("wallettransactions")
        .find({ transactionType: "challenge_entry" })
        .toArray();

      expect(rows).toHaveLength(2);
      for (const row of rows ?? []) {
        // The assertion that fails when the field is undeclared: strict mode drops it, so
        // the key is absent entirely rather than holding a wrong value.
        expect(row.challengeId).toBe(challengeId);
      }

      // Both players, one row each, and the fee signed as a debit.
      expect(new Set((rows ?? []).map((r) => r.userId))).toEqual(
        new Set([CHALLENGER_ID, DEFAULT_USER_ID]),
      );
      expect((rows ?? []).map((r) => r.amount)).toEqual([
        -ENTRY_FEE,
        -ENTRY_FEE,
      ]);
    });

    it("consults the CHALLENGE restriction flag, not the competition one", async () => {
      // Reason: the two flags are deliberately different. `canEnterCompetitions` blocks
      // when falsy; `canEnterChallenges` blocks only on an explicit `false`, because
      // restrictions created before that field existed have it undefined and must stay
      // allowed. Passing "enterCompetition" here would quietly start refusing every
      // legacy-restricted account, so pin the action the route asks about.
      const challengeId = await seedPendingChallenge();

      await callAccept(challengeId);

      expect(restrictionCalls).toContain("enterChallenge");
      expect(restrictionCalls).not.toContain("enterCompetition");
    });
  });
});
