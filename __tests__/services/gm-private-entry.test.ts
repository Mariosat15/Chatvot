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
import { readFileSync } from "node:fs";
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
} from "../helpers/server-action-context";

/**
 * Gamemaster Program v2, step 5 (`External game plans/24` s4): the entry door of a private
 * Game Master contest, driven through BOTH entry gates against a real replica set.
 *
 * Every refusal asserts what did not happen - no seat, no debit, no prize-pool change - not
 * merely the message. A refusal that returned the right words after taking the fee is the
 * failure that matters here, and only the money assertions can see it.
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

// Reason: post-commit fire-and-forget work, stubbed for the same reason as the gate parity
// suite - it is not what these tests are about and it outlives the test that started it.
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
vi.mock("@/lib/services/market-hours.service", () => ({
  canJoinCompetition: async () => ({ canJoin: true, reason: "Market is open" }),
  canJoinChallenge: async () => ({ canJoin: true, reason: "Market is open" }),
  isMarketOpen: async () => ({ isOpen: true, reason: "Market is open" }),
}));

const { enterCompetition } = await import("@/lib/actions/trading/competition.actions");
const { POST: joinViaApi } = await import("@/app/api/competitions/[id]/join/route");
const UserReferral = (await import("@/database/models/user-referral.model")).default;

const ENTRY_FEE = 25;
const START_BALANCE = 500;
const OWNER_GM = "6500000000000000000000b1";
const OTHER_GM = "6500000000000000000000b2";
const db = () => mongoose.connection.db!;

async function callGateB(competitionId: string) {
  const request = new NextRequest(
    `http://localhost:3000/api/competitions/${competitionId}/join`,
    { method: "POST" },
  );
  const response = await joinViaApi(request, { params: Promise.resolve({ id: competitionId }) });
  return { status: response.status, body: (await response.json()) as { success?: boolean } };
}

async function seedCompetition(over: Record<string, unknown> = {}): Promise<string> {
  const id = new mongoose.Types.ObjectId();
  await db().collection("competitions").insertOne({
    _id: id,
    name: "Private GM Competition",
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
    gameMasterId: OWNER_GM,
    visibility: "gm_private",
    ...over,
  });
  return id.toString();
}

async function seedWallet(): Promise<void> {
  await db().collection("creditwallets").insertOne({
    userId: DEFAULT_USER_ID,
    creditBalance: START_BALANCE,
    totalDeposited: START_BALANCE,
    totalSpentOnCompetitions: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedGameMaster(gameMasterId: string, status = "active"): Promise<void> {
  await db().collection("gamemastersubscriptions").updateOne(
    { userId: gameMasterId },
    {
      $setOnInsert: { userId: gameMasterId, userName: "Ada Lovelace", referralCode: `RC${gameMasterId.slice(-4)}` },
      $set: { status, isPaused: false, scheduledForDeletion: false, updatedAt: new Date() },
    },
    { upsert: true },
  );
}

/**
 * Reason (R121): a MEMBER is an active row with accepted Affiliate Terms, under a Game Master
 * who has not expired or been deleted. Before R121 this fixture carried no terms and no
 * subscription and still admitted the player - that was the defect. `over` builds the
 * unaccepted shapes the R121 tests below refuse.
 */
async function affiliateTo(gameMasterId: string, over: Record<string, unknown> = {}): Promise<void> {
  await seedGameMaster(gameMasterId);
  await UserReferral.collection.insertOne({
    userId: DEFAULT_USER_ID,
    gameMasterId,
    referralCode: "PRIV",
    isActive: true,
    source: "gm_referral_link",
    termsAcceptanceId: "accepted-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });
}

/** The three things a refusal must leave untouched. */
async function expectNothingMoved(competitionId: string): Promise<void> {
  const seats = await db()
    .collection("competitionparticipants")
    .countDocuments({ competitionId });
  const wallet = await db().collection("creditwallets").findOne({ userId: DEFAULT_USER_ID });
  const comp = await db()
    .collection("competitions")
    .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
  expect(seats).toBe(0);
  expect(wallet?.creditBalance).toBe(START_BALANCE);
  expect(comp?.prizePool).toBe(0);
  expect(comp?.currentParticipants).toBe(0);
}

async function expectSeated(competitionId: string): Promise<void> {
  const wallet = await db().collection("creditwallets").findOne({ userId: DEFAULT_USER_ID });
  const comp = await db()
    .collection("competitions")
    .findOne({ _id: new mongoose.Types.ObjectId(competitionId) });
  expect(wallet?.creditBalance).toBe(START_BALANCE - ENTRY_FEE);
  expect(comp?.currentParticipants).toBe(1);
  expect(comp?.prizePool).toBe(ENTRY_FEE);
}

describe("private Game Master contest - the entry door", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "competitions",
      "creditwallets",
      "wallettransactions",
      "competitionparticipants",
      "userlevels",
      "tradingbehaviorprofiles",
      "userreferrals",
      "gamemastersubscriptions",
      "user",
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

  it("refuses an unaffiliated player through Gate A and moves nothing", async () => {
    const id = await seedCompetition();
    await seedWallet();
    const result = await enterCompetition(id);
    expect(result.success).toBe(false);
    expect(String(result.error)).toMatch(/private competition/i);
    await expectNothingMoved(id);
  });

  it("refuses an unaffiliated player through Gate B with 403 and moves nothing", async () => {
    const id = await seedCompetition();
    await seedWallet();
    const { status, body } = await callGateB(id);
    expect(status).toBe(403);
    expect(body.success).toBe(false);
    await expectNothingMoved(id);
  });

  // Reason: Gate B's status table had no entry for own_contest (step 4), so a Game Master
  // pressing Join on their own contest fell through `?? 500` and read as a server fault
  // rather than a refusal. Found when the typecheck error list LOST an entry in step 5.
  it("maps a Game Master joining their own contest to 403 through Gate B", async () => {
    const id = await seedCompetition({ visibility: "public", gameMasterId: DEFAULT_USER_ID });
    await seedWallet();
    const { status, body } = await callGateB(id);
    expect(status).toBe(403);
    expect(body.success).toBe(false);
    await expectNothingMoved(id);
  });

  it("refuses a player affiliated to a DIFFERENT Game Master", async () => {
    const id = await seedCompetition();
    await seedWallet();
    await affiliateTo(OTHER_GM);
    const result = await enterCompetition(id);
    expect(result.success).toBe(false);
    await expectNothingMoved(id);
  });

  it("admits a player affiliated to the creating Game Master, through either gate", async () => {
    const viaA = await seedCompetition();
    await seedWallet();
    await affiliateTo(OWNER_GM);
    expect((await enterCompetition(viaA)).success).toBe(true);
    await expectSeated(viaA);

    await clearTestMongo();
    const viaB = await seedCompetition();
    await seedWallet();
    await affiliateTo(OWNER_GM);
    const { status } = await callGateB(viaB);
    expect(status).toBe(200);
    await expectSeated(viaB);
  });

  it("refuses a private contest with no creator - an unknown shape fails closed", async () => {
    const id = await seedCompetition({ gameMasterId: undefined });
    await seedWallet();
    await affiliateTo(OWNER_GM);
    expect((await enterCompetition(id)).success).toBe(false);
    await expectNothingMoved(id);
  });

  it("treats an unrecognised stored visibility as private", async () => {
    const id = await seedCompetition({ visibility: "friends_only" });
    await seedWallet();
    expect((await enterCompetition(id)).success).toBe(false);
    await expectNothingMoved(id);
  });

  it("still admits anybody to a public or unlabelled contest", async () => {
    const id = await seedCompetition({ visibility: undefined, gameMasterId: undefined });
    await seedWallet();
    expect((await enterCompetition(id)).success).toBe(true);
    await expectSeated(id);
  });

  it("keeps a seated player idempotent after they leave the Game Master (D5)", async () => {
    const id = await seedCompetition();
    await seedWallet();
    await affiliateTo(OWNER_GM);
    expect((await enterCompetition(id)).success).toBe(true);
    // Reason: eligibility is checked at entry only. A second press after the affiliation ended
    // must return the existing seat, not a refusal - and must not take a second fee.
    await UserReferral.collection.updateMany({}, { $set: { isActive: false } });
    expect((await enterCompetition(id)).success).toBe(true);
    await expectSeated(id);
  });

  // R121: the owner's report - a player the GM and admin pages showed as Ended entered a
  // private contest. Membership is accepted terms on an ACTIVE row, never earnings alone.
  describe("R121 - only a player who accepted the Affiliate Terms is a member", () => {
    it("refuses an admin-moved row that carries no accepted terms (D6)", async () => {
      const id = await seedCompetition();
      await seedWallet();
      await affiliateTo(OWNER_GM, { source: "admin_assigned", termsAcceptanceId: undefined });
      expect((await enterCompetition(id)).success).toBe(false);
      expect((await callGateB(id)).status).toBe(403);
      await expectNothingMoved(id);
    });

    it("refuses a legacy row whose stored acceptance is an empty string", async () => {
      const id = await seedCompetition();
      await seedWallet();
      await affiliateTo(OWNER_GM, { termsAcceptanceId: "" });
      expect((await enterCompetition(id)).success).toBe(false);
      await expectNothingMoved(id);
    });

    it("refuses a player known only to the user-document fallback (detached or legacy)", async () => {
      const id = await seedCompetition();
      await seedWallet();
      await seedGameMaster(OWNER_GM);
      await db()
        .collection("user")
        .insertOne({ _id: new mongoose.Types.ObjectId(DEFAULT_USER_ID), referredByGameMasterId: OWNER_GM });
      expect((await enterCompetition(id)).success).toBe(false);
      await expectNothingMoved(id);
    });

    it("refuses a detached player whose ended row once had accepted terms", async () => {
      const id = await seedCompetition();
      await seedWallet();
      await affiliateTo(OWNER_GM, { isActive: false, endReason: "admin_detached" });
      expect((await enterCompetition(id)).success).toBe(false);
      await expectNothingMoved(id);
    });

    it("refuses an accepted member whose Game Master has expired (D4)", async () => {
      const id = await seedCompetition();
      await seedWallet();
      await affiliateTo(OWNER_GM);
      await seedGameMaster(OWNER_GM, "expired");
      expect((await enterCompetition(id)).success).toBe(false);
      await expectNothingMoved(id);
    });
  });
});

describe("the batch simulator writer refuses private contests", () => {
  it("returns 403 before it reads any participant or wallet", () => {
    const source = readFileSync("app/api/simulator/competitions/join-batch/route.ts", "utf8");
    const refusal = source.indexOf('=== "gm_private"');
    const firstParticipantRead = source.indexOf("CompetitionParticipant.find(");
    expect(refusal).toBeGreaterThan(-1);
    expect(firstParticipantRead).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(firstParticipantRead);
    expect(source.slice(refusal, firstParticipantRead)).toMatch(/status:\s*403/);
  });
});
