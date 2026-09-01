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
 * A challenge is the other paid entry point. Accepting one debits the entry fee from both
 * players, so it is a money path and it should refuse the same accounts competition entry
 * refuses. It does not, and these tests measure exactly which guards are missing rather
 * than asserting the intended behaviour and leaving a red test behind.
 *
 * Guards on POST /api/challenges/[id]/accept, as built:
 *
 *   authenticated            yes    line 21
 *   email verified           yes    line 28
 *   market hours             yes    line 43
 *   only the challenged user yes    line 67
 *   status is pending        yes    line 76
 *   accept deadline          yes    line 85
 *   wallet balance           yes    line 96
 *   account restriction      NO
 *   fraud gate               NO
 *
 * The last two are the sub-defect. Competition entry (Gate A) checks both.
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

vi.mock("@/lib/better-auth/auth", async () => {
  const { currentSession } = await import("../helpers/server-action-context");
  return { auth: { api: { getSession: async () => currentSession() } } };
});

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

// Reason: mocked even though the accept route never calls them. If the route is later fixed
// to consult these, the mocks are already wired and the two defect tests below flip to
// failing - which is the signal the fix landed, and a prompt to rewrite them as guard tests.
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

  describe("guards that are MISSING - this is sub-defect 1b", () => {
    it("ACCEPTS a restricted account, which competition entry refuses", async () => {
      // Reason: this test records a defect, not a fix.
      //
      // A restriction is how a suspended or under-investigation account is stopped from
      // moving money. Gate A calls canUserPerformAction("enterCompetition") and refuses.
      // The accept route never calls it, so the same account that cannot join a competition
      // can enter a paid 1v1 and have its wallet debited.
      const challengeId = await seedPendingChallenge();
      withRestriction("Account suspended pending review");

      const { status } = await callAccept(challengeId);

      expect(status).toBe(200);

      // The money moved, which is the part that matters.
      expect(await balanceOf(DEFAULT_USER_ID)).toBe(START_BALANCE - ENTRY_FEE);
      expect(await readChallenge(challengeId)).toMatchObject({
        status: "active",
      });
    });

    it("ACCEPTS a fraud-flagged account, which competition entry refuses", async () => {
      // Reason: as above. The fraud gate is what stops coordinated entries - two accounts
      // controlled by one person entering the same contest. A challenge is the *easiest*
      // shape for that abuse, because it is exactly two players and the pot returns to the
      // pair minus the platform fee, so the gate matters here at least as much as it does
      // on a competition.
      const challengeId = await seedPendingChallenge();
      withFraudBlock("Coordinated entry detected from a shared address");

      const { status } = await callAccept(challengeId);

      expect(status).toBe(200);
      expect(await balanceOf(DEFAULT_USER_ID)).toBe(START_BALANCE - ENTRY_FEE);
    });
  });
});
