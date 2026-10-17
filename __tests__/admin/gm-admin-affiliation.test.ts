import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
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

// Reason: the ADMIN copy only - importing both copies of one model returns the first twice.
import UserReferral from "../../apps/admin/database/models/user-referral.model";
import {
  moveAffiliation,
  detachAffiliation,
  normaliseReason,
  MIN_REASON_LENGTH,
  MAX_REASON_LENGTH,
  REFUSAL_MESSAGES,
} from "../../apps/admin/lib/services/gamemaster/admin-affiliation.service";

/**
 * Gamemaster Program v2, task 4 (`External game plans/24` s7.3): the admin move and detach.
 * D1 says ONLY an audited admin reassignment moves a locked player, so every refusal here is
 * also asserted to have left nothing behind - no ended row, no counter change, no audit row.
 */

const PLAYER = "64c000000000000000000001";
const GM_1 = "64c0000000000000000000a1";
const GM_2 = "64c0000000000000000000a2";
const ACTOR = { id: "64c0000000000000000000f1", email: "ops@chartvolt.test", name: "Ops", role: "admin" };
const REASON = "Player asked support to change Game Master";

const db = () => mongoose.connection.db!;
const subs = () => db().collection("gamemastersubscriptions");

function subscription(userId: string, referralCode: string, over: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    userId,
    userEmail: `${referralCode.toLowerCase()}@gm.test`,
    referralCode,
    status: "active",
    isPaused: false,
    scheduledForDeletion: false,
    totalReferredUsers: 1,
    activeReferredUsers: 1,
    updatedAt: new Date(),
    ...over,
  };
}

async function seed(over2: Record<string, unknown> = {}) {
  const s1 = subscription(GM_1, "GMONE");
  const s2 = subscription(GM_2, "GMTWO", { totalReferredUsers: 0, activeReferredUsers: 0, ...over2 });
  await subs().insertMany([s1, s2]);
  await db().collection("user").insertOne({
    _id: new ObjectId(PLAYER),
    email: "player@test.io",
    name: "Player",
    referredByGameMasterId: GM_1,
    referredByReferralCode: "GMONE",
  });
  await db().collection("userreferrals").insertOne({
    userId: PLAYER,
    userEmail: "player@test.io",
    gameMasterId: GM_1,
    gameMasterEmail: "gmone@gm.test",
    referralCode: "GMONE",
    referredAt: new Date(),
    isActive: true,
    source: "gm_referral_link",
    termsAcceptedAt: new Date(),
  });
  return { s1, s2 };
}

const counters = async (id: ObjectId) => {
  const s = await subs().findOne({ _id: id });
  return { total: s?.totalReferredUsers, active: s?.activeReferredUsers };
};
const user = () => db().collection("user").findOne({ _id: new ObjectId(PLAYER) });
const rows = () => db().collection("userreferrals").find({ userId: PLAYER }).toArray();
const audit = () => db().collection("customer_audit_trail").find({}).toArray();

describe("admin affiliation reason rule (pure)", () => {
  it("trims and bounds the reason", () => {
    expect(normaliseReason("  short ")).toBeNull();
    expect(normaliseReason(123)).toBeNull();
    expect(normaliseReason("x".repeat(MIN_REASON_LENGTH))).toBe("x".repeat(MIN_REASON_LENGTH));
    expect(normaliseReason("x".repeat(MAX_REASON_LENGTH + 1))).toBeNull();
  });
});

describe("admin move and detach (real replica set)", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["userreferrals", "gamemastersubscriptions", "user", "customer_audit_trail"]);
    await UserReferral.init();
  });
  afterAll(async () => {
    await stopTestMongo();
  });
  beforeEach(async () => {
    await clearTestMongo();
  });

  it("move ends the old row as admin_reassigned and opens an admin_assigned row with no terms", async () => {
    const { s1, s2 } = await seed();
    const r = await moveAffiliation({ userId: PLAYER, targetSubscriptionId: String(s2._id), reason: REASON, actor: ACTOR });
    expect(r).toMatchObject({ success: true, action: "move", fromGameMasterId: GM_1, toGameMasterId: GM_2 });

    const all = await rows();
    const ended = all.find((x) => x.gameMasterId === GM_1)!;
    const fresh = all.find((x) => x.gameMasterId === GM_2)!;
    expect(ended).toMatchObject({ isActive: false, endedReason: "admin_reassigned" });
    expect(fresh).toMatchObject({ isActive: true, source: "admin_assigned", affiliatedVia: { surface: "admin" } });
    // Reason: D6 - the player accepted the OLD Game Master's terms, never the new one's.
    expect(fresh.termsAcceptedAt).toBeUndefined();

    expect(await counters(s1._id)).toEqual({ total: 1, active: 0 });
    expect(await counters(s2._id)).toEqual({ total: 1, active: 1 });
    expect((await user())?.referredByGameMasterId).toBe(GM_2);
  });

  it("move writes ONE customer audit row naming the real admin and the reason", async () => {
    const { s2 } = await seed();
    await moveAffiliation({ userId: PLAYER, targetSubscriptionId: String(s2._id), reason: REASON, actor: ACTOR });
    const rowsWritten = await audit();
    expect(rowsWritten).toHaveLength(1);
    expect(rowsWritten[0]).toMatchObject({
      action: "gm_affiliation_reassigned",
      customerId: PLAYER,
      performedBy: { employeeId: ACTOR.id, employeeEmail: ACTOR.email },
      metadata: { reason: REASON, fromGameMasterId: GM_1, toGameMasterId: GM_2 },
    });
  });

  it("detach ends the row as admin_detached and REMOVES the settlement fallback", async () => {
    const { s1 } = await seed();
    const r = await detachAffiliation({ userId: PLAYER, reason: REASON, actor: ACTOR });
    expect(r).toMatchObject({ success: true, action: "detach", toGameMasterId: null });
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ isActive: false, endedReason: "admin_detached" });
    // Reason: calculate.ts pays the user-document fallback when no active row exists.
    const u = await user();
    expect(u?.referredByGameMasterId).toBeUndefined();
    expect(u?.referredByReferralCode).toBeUndefined();
    expect(await counters(s1._id)).toEqual({ total: 1, active: 0 });
    const a = await audit();
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ action: "gm_affiliation_detached", metadata: { reason: REASON } });
  });

  it.each([
    ["paused", { isPaused: true }],
    ["scheduled for deletion", { scheduledForDeletion: true }],
    ["expired", { status: "expired" }],
  ])("refuses a move to a %s Game Master and leaves nothing behind", async (_label, over) => {
    const { s1, s2 } = await seed(over);
    const r = await moveAffiliation({ userId: PLAYER, targetSubscriptionId: String(s2._id), reason: REASON, actor: ACTOR });
    expect(r).toMatchObject({ success: false, code: "target_not_active" });
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0].isActive).toBe(true);
    expect(await counters(s1._id)).toEqual({ total: 1, active: 1 });
    expect(await audit()).toHaveLength(0);
  });

  it("refuses a move to the same Game Master", async () => {
    const { s1 } = await seed();
    const r = await moveAffiliation({ userId: PLAYER, targetSubscriptionId: String(s1._id), reason: REASON, actor: ACTOR });
    expect(r).toMatchObject({ success: false, code: "already_with_target" });
    expect(await counters(s1._id)).toEqual({ total: 1, active: 1 });
  });

  it("refuses a short reason before touching anything", async () => {
    await seed();
    const r = await detachAffiliation({ userId: PLAYER, reason: "too short", actor: ACTOR });
    expect(r).toMatchObject({ success: false, code: "reason_required", error: REFUSAL_MESSAGES.reason_required });
    expect((await rows())[0].isActive).toBe(true);
    expect((await user())?.referredByGameMasterId).toBe(GM_1);
  });

  it("refuses to detach a player with no Game Master", async () => {
    await db().collection("user").insertOne({ _id: new ObjectId(PLAYER), email: "p@test.io" });
    const r = await detachAffiliation({ userId: PLAYER, reason: REASON, actor: ACTOR });
    expect(r).toMatchObject({ success: false, code: "not_affiliated" });
    expect(await audit()).toHaveLength(0);
  });
});
