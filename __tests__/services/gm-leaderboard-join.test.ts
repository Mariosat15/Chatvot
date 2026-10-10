import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

// Reason: the harness owns the connection; the real helper would dial the configured URI.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose,
  default: async () => mongoose,
}));

// Reason: both routes read the session; a test sets who is signed in.
const sessionUser: { current: { id: string; email: string; name?: string } | null } = {
  current: null,
};
vi.mock("@/lib/better-auth/auth", () => ({
  auth: {
    api: {
      getSession: async () => (sessionUser.current ? { user: sessionUser.current } : null),
    },
  },
}));

import SitePage from "@/database/models/site-page.model";
import TermsAcceptance from "@/database/models/terms-acceptance.model";
import UserReferral from "@/database/models/user-referral.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { GM_AFFILIATION_TERMS_SLUG } from "@/lib/services/gamemaster/gm-terms-rules";
import { GM_AFFILIATION_TERMS_PAGE } from "@/lib/constants/gm-affiliation-terms-page";
import { recordGmTermsAcceptance } from "@/lib/services/gamemaster/gm-terms.service";
import {
  clearGmLeaderboardCache,
  getGmLeaderboardMetrics,
} from "@/lib/services/gamemaster/gm-leaderboard-metrics";
import { GM_LEADERBOARD_ROW_KEYS } from "@/lib/services/gamemaster/gm-leaderboard-rules";
import { GET as getLeaderboard } from "@/app/api/gamemasters/leaderboard/route";
import { POST as postJoin } from "@/app/api/gamemasters/[subscriptionId]/join/route";

/**
 * Gamemaster Program v2, step 4 (`External game plans/24` s6.1 / s6.3) against a real
 * replica set: the cached figures, the public row shape, and both routes - including the
 * switch that keeps the whole feature dark by default.
 */

const PLAYER = "64c000000000000000000001";
const GM_1 = "64c0000000000000000000a1";
const GM_2 = "64c0000000000000000000a2";
const GM_PAUSED = "64c0000000000000000000a3";
const GM_LEAVING = "64c0000000000000000000a4";
const GM_CANCELLED = "64c0000000000000000000a5";
const player = { id: PLAYER, email: "p@player.test", name: "Player" };
const db = () => mongoose.connection.db!;
const DAY = 24 * 60 * 60 * 1000;

function subscription(userId: string, referralCode: string, over: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    userId,
    userEmail: `${referralCode.toLowerCase()}@gm.test`,
    userName: `Master ${referralCode}`,
    packageId: "pkg",
    packageName: "Pro",
    status: "active",
    activatedAt: now,
    startDate: now,
    endDate: now,
    nextRenewalDate: now,
    autoRenew: true,
    renewalPrice: 10,
    referralCode,
    limits: {
      maxCompetitionsPerDay: 1,
      maxActiveCompetitions: 1,
      maxUsersPerCompetition: 10,
      referralFeePercentage: 5,
      canCreateCompetitions: true,
      canEarnFromChallenges: true,
    },
    currentPeriodCompetitionsCreated: 0,
    lastCompetitionResetDate: now,
    totalCompetitionsCreated: 0,
    totalEarnings: 999,
    pendingEarnings: 77,
    totalReferredUsers: 0,
    activeReferredUsers: 0,
    isPaused: false,
    scheduledForDeletion: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

const referral = (userId: string, gameMasterId: string, isActive = true) => ({
  userId,
  gameMasterId,
  referralCode: "X",
  isActive,
  source: "gm_referral_link",
  createdAt: new Date(),
  updatedAt: new Date(),
});

async function seedGmPage() {
  await SitePage.collection.insertOne({
    slug: GM_AFFILIATION_TERMS_SLUG,
    title: GM_AFFILIATION_TERMS_PAGE.title,
    subtitle: GM_AFFILIATION_TERMS_PAGE.subtitle,
    sections: GM_AFFILIATION_TERMS_PAGE.sections,
    category: "action_terms",
    isActive: true,
    isSystem: true,
    showEveryTime: false,
    version: "1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const switchOn = (value: unknown = true) => WhiteLabel.collection.insertOne({ gmJoinEnabled: value });
const subIdOf = async (code: string) =>
  String((await GameMasterSubscription.collection.findOne({ referralCode: code }))!._id);

async function acceptFor(gameMasterId: string) {
  const r = await recordGmTermsAcceptance({ user: player, gameMasterId });
  if (!r.success) throw new Error(`accept failed: ${r.code}`);
  return r.acceptanceId;
}

const leaderboard = (query = "") =>
  getLeaderboard(new NextRequest(`http://x/api/gamemasters/leaderboard${query}`));

const join = (subscriptionId: string, body: unknown) =>
  postJoin(
    new NextRequest(`http://x/api/gamemasters/${subscriptionId}/join`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json", "user-agent": "vitest" },
    }),
    { params: Promise.resolve({ subscriptionId }) },
  );

describe("Gamemaster leaderboard and Join GM", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "userreferrals",
      "gamemastersubscriptions",
      "user",
      "customer_audit_trail",
      "termsacceptances",
      "sitepages",
      "whitelabels",
      Competition.collection.name,
      CompetitionParticipant.collection.name,
    ]);
    await UserReferral.init();
    await TermsAcceptance.init();
    await SitePage.init();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    clearGmLeaderboardCache();
    sessionUser.current = null;
    await GameMasterSubscription.collection.insertMany([
      subscription(GM_1, "GMONE"),
      subscription(GM_2, "GMTWO"),
      subscription(GM_PAUSED, "GMPAUSED", { isPaused: true }),
      subscription(GM_LEAVING, "GMLEAVING", { scheduledForDeletion: true }),
      subscription(GM_CANCELLED, "GMCANCELLED", { status: "cancelled" }),
    ]);
    await db().collection("user").insertOne({ _id: new ObjectId(PLAYER), email: player.email });
  });

  describe("the cached figures", () => {
    it("counts affiliates, active affiliates and contests, and lists only joinable GMs", async () => {
      const A1 = "64c000000000000000000011";
      const A2 = "64c000000000000000000012";
      const A3 = "64c000000000000000000013";
      const B1 = "64c000000000000000000021";
      const C1 = "64c000000000000000000031";
      await UserReferral.collection.insertMany([
        referral(A1, GM_1),
        referral(A2, GM_1),
        referral(A3, GM_1, false),
        referral(B1, GM_2),
        referral(C1, GM_PAUSED),
      ]);
      const [paid, draft, cancelled, free] = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
      await Competition.collection.insertMany([
        { _id: paid, slug: "c-paid", gameMasterId: GM_1, status: "completed", entryFee: 10, currentParticipants: 3 },
        { _id: draft, slug: "c-draft", gameMasterId: GM_1, status: "draft", entryFee: 10, currentParticipants: 5 },
        { _id: cancelled, slug: "c-cancelled", gameMasterId: GM_1, status: "cancelled", entryFee: 5, currentParticipants: 2 },
        { _id: free, slug: "c-free", gameMasterId: GM_2, status: "upcoming", entryFee: 0, currentParticipants: 1 },
      ]);
      // Reason: competitionId is declared String on the seat; seeded as the app writes it,
      // so the ObjectId conversion in the aggregate is what the test exercises.
      await CompetitionParticipant.collection.insertMany([
        { userId: A1, competitionId: String(paid), enteredAt: new Date() },
        { userId: A2, competitionId: String(paid), enteredAt: new Date(Date.now() - 40 * DAY) },
        { userId: B1, competitionId: String(free), enteredAt: new Date() },
      ]);

      const { rows } = await getGmLeaderboardMetrics();
      expect(rows.map((r) => r.gameMasterUserId)).toEqual([GM_1, GM_2]);
      expect(rows[0]).toMatchObject({
        rank: 1,
        affiliates: 2,
        activeAffiliates: 1,
        competitionsCreated: 2,
        competitionsCompleted: 1,
        participants: 3,
        entryVolts: 30,
      });
      expect(rows[1]).toMatchObject({
        rank: 2,
        affiliates: 1,
        activeAffiliates: 0,
        competitionsCreated: 1,
        participants: 1,
        entryVolts: 0,
      });
    });
  });

  describe("GET /api/gamemasters/leaderboard", () => {
    it("refuses a signed-out caller", async () => {
      await switchOn();
      expect((await leaderboard()).status).toBe(401);
    });

    it("is dark by default and when the switch holds anything but true", async () => {
      sessionUser.current = player;
      const off = await leaderboard();
      expect(off.status).toBe(403);
      expect(await off.json()).toMatchObject({ code: "feature_disabled" });
      await switchOn("true");
      expect((await leaderboard()).status).toBe(403);
    });

    it("refuses an unknown sort rather than ignoring it", async () => {
      await switchOn();
      sessionUser.current = player;
      const res = await leaderboard("?sort=totalEarnings");
      expect(res.status).toBe(400);
    });

    it("rows carry exactly the public keys, and the viewer's own GM locks the others", async () => {
      await switchOn();
      sessionUser.current = player;
      await UserReferral.collection.insertOne(referral(PLAYER, GM_1));
      const res = await leaderboard();
      expect(res.status).toBe(200);
      const json = await res.json();
      for (const row of json.rows) expect(Object.keys(row).sort()).toEqual([...GM_LEADERBOARD_ROW_KEYS].sort());
      expect(JSON.stringify(json)).not.toMatch(/999|totalEarnings|pendingEarnings|@gm\.test/);
      const state = new Map(json.rows.map((r: { gameMasterUserId: string; joinState: string }) => [r.gameMasterUserId, r.joinState]));
      expect(Object.fromEntries(state)).toEqual({ [GM_1]: "your_gm", [GM_2]: "locked" });
      // Reason: this once expected the stored real name "Master GMONE". The board is public,
      // so since usernames (Oct 2026) a Game Master is shown by username; the seeded GM has
      // none, so the Player_ fallback - never the real name.
      expect(json.viewer).toEqual({ affiliatedGameMasterName: expect.stringMatching(/^Player_/), locked: true });
      expect(JSON.stringify(json)).not.toContain("Master GMONE");
    });
  });

  describe("POST /api/gamemasters/[subscriptionId]/join", () => {
    it("refuses a signed-out caller and stays dark while the switch is off", async () => {
      await seedGmPage();
      const sub = await subIdOf("GMONE");
      expect((await join(sub, {})).status).toBe(401);
      sessionUser.current = player;
      const res = await join(sub, { termsAcceptanceId: await acceptFor(GM_1) });
      expect(res.status).toBe(403);
      expect(await UserReferral.countDocuments({ userId: PLAYER })).toBe(0);
    });

    it("refuses a bad body and a join without consent", async () => {
      await switchOn();
      await seedGmPage();
      sessionUser.current = player;
      const sub = await subIdOf("GMONE");
      expect((await join(sub, "not json")).status).toBe(400);
      const res = await join(sub, {});
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "terms_not_accepted" });
    });

    it("an unknown Game Master is 404 and a paused one is 409", async () => {
      await switchOn();
      await seedGmPage();
      sessionUser.current = player;
      expect((await join(String(new ObjectId()), { termsAcceptanceId: await acceptFor(GM_1) })).status).toBe(404);
      const paused = await join(await subIdOf("GMPAUSED"), { termsAcceptanceId: await acceptFor(GM_PAUSED) });
      expect(paused.status).toBe(409);
      expect(await paused.json()).toMatchObject({ code: "gm_not_joinable" });
    });

    it("joins with fresh consent, then refuses a second Game Master D1", async () => {
      await switchOn();
      await seedGmPage();
      sessionUser.current = player;
      const ok = await join(await subIdOf("GMONE"), { termsAcceptanceId: await acceptFor(GM_1) });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ success: true, created: true });
      expect(await UserReferral.findOne({ userId: PLAYER, isActive: true }).lean()).toMatchObject({
        gameMasterId: GM_1,
        source: "chartvolt_join_gm",
      });

      const other = await join(await subIdOf("GMTWO"), { termsAcceptanceId: await acceptFor(GM_2) });
      expect(other.status).toBe(409);
      expect(await other.json()).toMatchObject({ code: "already_affiliated_other" });
      expect(await UserReferral.countDocuments({ userId: PLAYER, isActive: true })).toBe(1);
    });

    // Reason: step 6 - the private contest gate sends the contest id so the audit trail can say
    // the join started there. It is reporting only; a malformed id falls back to the leaderboard.
    it("records a join from a private contest's gate as that surface", async () => {
      await switchOn();
      await seedGmPage();
      sessionUser.current = player;
      const contestId = String(new ObjectId());
      const ok = await join(await subIdOf("GMONE"), {
        termsAcceptanceId: await acceptFor(GM_1),
        competitionId: contestId,
      });
      expect(ok.status).toBe(200);
      const row = await UserReferral.findOne({ userId: PLAYER, isActive: true }).lean<{ affiliatedVia?: unknown }>();
      expect(row?.affiliatedVia).toEqual({ surface: "private_contest", competitionId: contestId });
    });

    it("ignores a malformed competition id and records the leaderboard surface", async () => {
      await switchOn();
      await seedGmPage();
      sessionUser.current = player;
      const ok = await join(await subIdOf("GMONE"), {
        termsAcceptanceId: await acceptFor(GM_1),
        competitionId: "not-an-id",
      });
      expect(ok.status).toBe(200);
      const row = await UserReferral.findOne({ userId: PLAYER, isActive: true }).lean<{ affiliatedVia?: unknown }>();
      expect(row?.affiliatedVia).toEqual({ surface: "leaderboard" });
    });

    it("rate-limits the eleventh attempt in an hour", async () => {
      await switchOn();
      // Reason: a user no other test signs in as - the limiter store is per process.
      sessionUser.current = { id: "64c0000000000000000000f1", email: "rl@player.test" };
      const sub = await subIdOf("GMONE");
      for (let i = 0; i < 10; i++) expect((await join(sub, "garbage")).status).toBe(400);
      const res = await join(sub, "garbage");
      expect(res.status).toBe(429);
      expect(await res.json()).toMatchObject({ code: "rate_limited" });
    });
  });
});
