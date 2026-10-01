import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

// Reason: the real verification is proven in gm-terms.test.ts; this stub refuses anything but
// one id, so a missing or borrowed acceptance still refuses here.
vi.mock("@/lib/services/gamemaster/gm-terms.service", () => ({
  verifyGmTermsAcceptance: async ({ acceptanceId }: { acceptanceId?: string }) =>
    acceptanceId === "consent-ok"
      ? { ok: true, termsAcceptanceId: "consent-ok", termsSlug: "terms-gamemaster-affiliation", termsVersion: "v1" }
      : { ok: false, code: "terms_not_accepted", message: "Please accept the Gamemaster terms first." },
}));

const sent: Array<{ userId: string; templateId: string; variables?: Record<string, unknown> }> = [];
const emails: Array<{ email: string; gameMasterName: string }> = [];
vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    send: async (n: { userId: string; templateId: string; variables?: Record<string, unknown> }) => {
      sent.push(n);
    },
  },
}));
vi.mock("@/lib/services/email-notification-bridge", () => ({
  emailNotificationBridge: {
    gmTermsRequest: async (u: { email: string }, gameMasterName: string) => {
      emails.push({ email: u.email, gameMasterName });
    },
  },
}));
vi.mock("@/lib/utils/user-lookup", () => ({
  getUserById: async (id: string) => ({ id, email: `${id}@player.test`, name: "Player One" }),
}));

import UserReferral from "@/database/models/user-referral.model";
import GmTermsRequest from "@/database/models/gamemaster/gm-terms-request.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import {
  answerTermsRequest,
  getTermsRequestPrompt,
  sendTermsRequest,
} from "@/lib/services/gamemaster/gm-terms-request.service";
import { recordAffiliationConsent } from "@/lib/services/gamemaster/affiliation-consent.service";
import {
  TERMS_REQUEST_MAX_SENDS,
  TERMS_REQUEST_REFUSAL_COPY,
  decideTermsRequestSend,
} from "@/lib/services/gamemaster/gm-terms-request-rules";
import { canSendReferralTerms } from "@/lib/services/gamemaster/gm-referral-view";

/**
 * "Send T&C" (`External game plans/24` s5.5): a Game Master asks their OWN referral, who never
 * accepted the Gamemaster terms, to answer them. Every refusal is asserted to have written
 * nothing - no request row, no notification, no email - because a refusal that half-sent is
 * a notification a player cannot explain.
 */

const root = resolve(__dirname, "../..");
const code = (p: string) =>
  readFileSync(resolve(root, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const PLAYER = "64c000000000000000000001";
const GM_1 = "64c0000000000000000000a1";
const GM_2 = "64c0000000000000000000a2";
const db = () => mongoose.connection.db!;
const NOW = new Date("2026-10-01T12:00:00Z");

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
    limits: { maxCompetitionsPerDay: 1, maxActiveCompetitions: 1, maxUsersPerCompetition: 10, referralFeePercentage: 5 },
    isPaused: false,
    scheduledForDeletion: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

async function seedReferral(over: Record<string, unknown> = {}): Promise<string> {
  const now = new Date();
  const { insertedId } = await UserReferral.collection.insertOne({
    userId: PLAYER,
    userEmail: `${PLAYER}@player.test`,
    gameMasterId: GM_1,
    gameMasterEmail: "gmone@gm.test",
    referralCode: "GMONE",
    referredAt: now,
    isActive: true,
    source: "gm_referral_link",
    totalEntryFees: 0,
    totalGMEarnings: 0,
    competitionsEntered: 0,
    challengesEntered: 0,
    createdAt: now,
    updatedAt: now,
    ...over,
  });
  return String(insertedId);
}

const send = (referralId: unknown, gameMasterUserId = GM_1, now = NOW) =>
  sendTermsRequest({ gameMasterUserId, referralId, now, meta: { ipAddress: "10.0.0.1", userAgent: "vitest" } });

const player = { id: PLAYER, email: `${PLAYER}@player.test`, name: "Player One" };

describe("terms request rules (pure)", () => {
  const base = { kind: "own" as const, isActive: true, termsAccepted: false, previous: null };

  it("allows a first send to an own, active referral with no terms", () => {
    expect(decideTermsRequestSend(base)).toEqual({ ok: true });
  });

  it("refuses external and unclassified referrals", () => {
    for (const kind of ["external", "unclassified"] as const) {
      expect(decideTermsRequestSend({ ...base, kind })).toEqual({ ok: false, reason: "not_own_referral" });
    }
  });

  it("refuses an ended referral and one that already accepted", () => {
    expect(decideTermsRequestSend({ ...base, isActive: false })).toMatchObject({ reason: "referral_ended" });
    expect(decideTermsRequestSend({ ...base, termsAccepted: true })).toMatchObject({ reason: "already_accepted" });
  });

  // Reason (flipped 1 Oct 2026): this used to pin a 24-hour cooldown under a cap of 3. The owner
  // made the Game Master's send ONCE per referral - the popup already reappears on every visit
  // while the answer is pending - so the cooldown could never fire and was removed. What is
  // pinned now is the replacement: the cap is one, and a request created by an ADMIN reminder
  // (sendCount 0) still leaves the Game Master their one send.
  it("a Game Master may send exactly once per referral", () => {
    expect(TERMS_REQUEST_MAX_SENDS).toBe(1);
    expect(decideTermsRequestSend({ ...base, previous: { sendCount: 1 } })).toEqual({ ok: false, reason: "limit_reached" });
    expect(decideTermsRequestSend({ ...base, previous: { sendCount: 0, status: "pending" } })).toEqual({ ok: true });
  });

  it("a declined request is final and is refused before the cap", () => {
    expect(decideTermsRequestSend({ ...base, previous: { sendCount: 0, status: "declined" } })).toEqual({
      ok: false,
      reason: "declined",
    });
  });

  it("every refusal has its own copy", () => {
    for (const reason of ["not_own_referral", "referral_ended", "already_accepted", "declined", "limit_reached"] as const) {
      expect(TERMS_REQUEST_REFUSAL_COPY.get(reason)).toBeTruthy();
    }
  });

  it("the button asks the same question as the service", () => {
    expect(canSendReferralTerms({ kind: "own", isCurrent: true, termsAccepted: false })).toBe(true);
    expect(canSendReferralTerms({ kind: "external", isCurrent: true, termsAccepted: false })).toBe(false);
    expect(canSendReferralTerms({ kind: "own", isCurrent: false, termsAccepted: false })).toBe(false);
    expect(canSendReferralTerms({ kind: "own", isCurrent: true, termsAccepted: true })).toBe(false);
  });
});

describe("terms requests against a real replica set", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "userreferrals",
      "gamemastersubscriptions",
      "gm_terms_requests",
      "customer_audit_trail",
      "employee_notifications",
      "customer_assignments",
    ]);
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    sent.length = 0;
    emails.length = 0;
    await GameMasterSubscription.collection.insertOne(subscription(GM_1, "GMONE"));
    await GameMasterSubscription.collection.insertOne(subscription(GM_2, "GMTWO"));
  });

  async function nothingSent() {
    expect(await GmTermsRequest.countDocuments()).toBe(0);
    expect(sent).toHaveLength(0);
    expect(emails).toHaveLength(0);
  }

  it("a send notifies the player, emails them and writes an audit row", async () => {
    const referralId = await seedReferral();
    const r = await send(referralId);
    expect(r).toEqual({ success: true, sendCount: 1 });

    const row = await GmTermsRequest.findOne({ referralId }).lean();
    expect(row).toMatchObject({ userId: PLAYER, gameMasterId: GM_1, status: "pending", sendCount: 1 });
    // Reason (flipped 1 Oct 2026): the request now uses the one AFFILIATE_TERMS_REQUIRED template
    // whose "Review Terms" button opens the shared modal - formerly `gm_terms_request`.
    expect(sent).toEqual([
      { userId: PLAYER, templateId: "affiliate_terms_required", variables: { gameMasterName: "Master GMONE" } },
    ]);
    expect(emails).toEqual([{ email: `${PLAYER}@player.test`, gameMasterName: "Master GMONE" }]);

    const audit = await db().collection("customer_audit_trail").find({ action: "gm_terms_request_sent" }).toArray();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ customerId: PLAYER, performedBy: { type: "user", id: GM_1 }, ipAddress: "10.0.0.1" });
  });

  // Reason (flipped 1 Oct 2026): these two pinned "a second send after the cooldown succeeds" and
  // "a send inside the cooldown is refused". Under the once-only rule the second send is refused
  // whenever it comes, and the row is untouched.
  it("a second send is refused at any time and sends nothing more", async () => {
    const referralId = await seedReferral();
    await send(referralId);
    sent.length = 0;
    emails.length = 0;
    const r = await send(referralId, GM_1, new Date(NOW.getTime() + 30 * 24 * 3_600_000));
    expect(r).toMatchObject({ success: false, code: "limit_reached" });
    expect(await GmTermsRequest.countDocuments()).toBe(1);
    expect((await GmTermsRequest.findOne({ referralId }).lean())?.sendCount).toBe(1);
    expect(sent).toHaveLength(0);
    expect(emails).toHaveLength(0);
  });

  it("two simultaneous sends send once", async () => {
    const referralId = await seedReferral();
    const results = await Promise.all([send(referralId), send(referralId)]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect((await GmTermsRequest.findOne({ referralId }).lean())?.sendCount).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("a declined request is never sent again", async () => {
    const referralId = await seedReferral();
    await GmTermsRequest.collection.insertOne({ referralId, userId: PLAYER, gameMasterId: GM_1, status: "declined", sendCount: 0 });
    expect(await send(referralId)).toMatchObject({ success: false, code: "declined" });
    expect(sent).toHaveLength(0);
  });

  it("an admin reminder does not use up the Game Master's one send", async () => {
    const referralId = await seedReferral();
    await GmTermsRequest.collection.insertOne({
      referralId,
      userId: PLAYER,
      gameMasterId: GM_1,
      status: "pending",
      sendCount: 0,
      adminTermsReminderCount: 4,
    });
    expect(await send(referralId)).toEqual({ success: true, sendCount: 1 });
    expect(await GmTermsRequest.findOne({ referralId }).lean()).toMatchObject({ sendCount: 1, adminTermsReminderCount: 4 });
  });

  it("another Game Master's referral reads as not found", async () => {
    const referralId = await seedReferral();
    expect(await send(referralId, GM_2)).toMatchObject({ success: false, code: "not_found" });
    await nothingSent();
  });

  it("a malformed id is not found without a query", async () => {
    expect(await send("not-an-id")).toMatchObject({ success: false, code: "not_found" });
    expect(await send({ $ne: null })).toMatchObject({ success: false, code: "not_found" });
    await nothingSent();
  });

  it("refuses an external, an ended and an already-accepted referral", async () => {
    const external = await seedReferral({ source: "chartvolt_join_gm" });
    expect(await send(external)).toMatchObject({ success: false, code: "not_own_referral" });
    await UserReferral.collection.deleteMany({});

    const ended = await seedReferral({ isActive: false });
    expect(await send(ended)).toMatchObject({ success: false, code: "referral_ended" });
    await UserReferral.collection.deleteMany({});

    const accepted = await seedReferral({ termsAcceptanceId: "earlier" });
    expect(await send(accepted)).toMatchObject({ success: false, code: "already_accepted" });
    await nothingSent();
  });

  it("refuses at the cap", async () => {
    const referralId = await seedReferral();
    await GmTermsRequest.collection.insertOne({
      referralId,
      userId: PLAYER,
      gameMasterId: GM_1,
      status: "pending",
      sendCount: TERMS_REQUEST_MAX_SENDS,
      lastSentAt: new Date(NOW.getTime() - 10 * 24 * 3_600_000),
    });
    expect(await send(referralId)).toMatchObject({ success: false, code: "limit_reached" });
    expect(sent).toHaveLength(0);
  });

  it("only an active Game Master may send", async () => {
    const referralId = await seedReferral();
    await GameMasterSubscription.collection.updateOne({ userId: GM_1 }, { $set: { isPaused: true } });
    expect(await send(referralId)).toMatchObject({ success: false, code: "not_game_master" });
    await GameMasterSubscription.collection.updateOne({ userId: GM_1 }, { $set: { isPaused: false, status: "expired" } });
    expect(await send(referralId)).toMatchObject({ success: false, code: "not_game_master" });
    await nothingSent();
  });

  it("the prompt shows a pending request for an open row", async () => {
    const referralId = await seedReferral();
    await send(referralId);
    expect(await getTermsRequestPrompt(PLAYER)).toMatchObject({ show: true, gameMasterId: GM_1, gameMasterName: "Master GMONE" });
    expect(await getTermsRequestPrompt(GM_2)).toEqual({ show: false });
  });

  it("the prompt resolves a request whose row already has terms, and shows nothing", async () => {
    const referralId = await seedReferral();
    await send(referralId);
    await UserReferral.collection.updateOne({ _id: new ObjectId(referralId) }, { $set: { termsAcceptanceId: "elsewhere" } });
    expect(await getTermsRequestPrompt(PLAYER)).toEqual({ show: false });
    expect((await GmTermsRequest.findOne({ referralId }).lean())?.status).toBe("accepted");
  });

  it("the prompt resolves a request whose row has ended", async () => {
    const referralId = await seedReferral();
    await send(referralId);
    await UserReferral.collection.updateOne({ _id: new ObjectId(referralId) }, { $set: { isActive: false } });
    expect(await getTermsRequestPrompt(PLAYER)).toEqual({ show: false });
    expect((await GmTermsRequest.findOne({ referralId }).lean())?.status).toBe("declined");
  });

  it("accepting stamps consent on the existing row and tells the Game Master and the account manager", async () => {
    const referralId = await seedReferral();
    await send(referralId);
    const manager = new ObjectId();
    await db().collection("customer_assignments").insertOne({ customerId: PLAYER, employeeId: manager, isActive: true });
    sent.length = 0;

    const r = await answerTermsRequest({ user: player, action: "accept", termsAcceptanceId: "consent-ok" });
    expect(r).toEqual({ success: true, status: "accepted" });

    const row = await UserReferral.findById(referralId).lean();
    expect(row).toMatchObject({ gameMasterId: GM_1, isActive: true, termsAcceptanceId: "consent-ok", termsVersion: "v1" });
    expect(await UserReferral.countDocuments()).toBe(1);
    expect(await GmTermsRequest.findOne({ referralId }).lean()).toMatchObject({ status: "accepted", termsAcceptanceId: "consent-ok" });
    expect(sent).toEqual([
      expect.objectContaining({ userId: GM_1, templateId: "gm_terms_request_answered", variables: expect.objectContaining({ answer: "accepted" }) }),
    ]);
    const bell = await db().collection("employee_notifications").find({}).toArray();
    expect(bell).toHaveLength(1);
    expect(String(bell[0].employeeId)).toBe(String(manager));
    expect(await db().collection("customer_audit_trail").countDocuments({ action: "gm_terms_request_accepted" })).toBe(1);
  });

  it("a refused consent keeps the request pending and writes nothing", async () => {
    const referralId = await seedReferral();
    await send(referralId);
    sent.length = 0;
    const r = await answerTermsRequest({ user: player, action: "accept", termsAcceptanceId: "borrowed" });
    expect(r).toMatchObject({ success: false, code: "terms_not_accepted" });
    expect((await GmTermsRequest.findOne({ referralId }).lean())?.status).toBe("pending");
    expect((await UserReferral.findById(referralId).lean<{ termsAcceptanceId?: string }>())?.termsAcceptanceId).toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("declining leaves the affiliation exactly as it was", async () => {
    const referralId = await seedReferral();
    await send(referralId);
    const before = await UserReferral.findById(referralId).lean();
    expect(await answerTermsRequest({ user: player, action: "decline" })).toEqual({ success: true, status: "declined" });
    expect(await UserReferral.findById(referralId).lean()).toEqual(before);
    expect((await GmTermsRequest.findOne({ referralId }).lean())?.status).toBe("declined");
    expect(await db().collection("customer_audit_trail").countDocuments({ action: "gm_terms_request_declined" })).toBe(1);
  });

  it("an answer is recorded once, so a double-click notifies once", async () => {
    const referralId = await seedReferral();
    await send(referralId);
    sent.length = 0;
    await answerTermsRequest({ user: player, action: "decline" });
    expect(await answerTermsRequest({ user: player, action: "decline" })).toMatchObject({ success: false, code: "no_request" });
    expect(sent).toHaveLength(1);
  });

  it("refuses an unknown action before reading anything", async () => {
    expect(await answerTermsRequest({ user: player, action: "maybe" })).toMatchObject({ success: false, code: "invalid_action" });
  });

  it("recordAffiliationConsent never creates a row and never overwrites one", async () => {
    const r = await recordAffiliationConsent({
      userId: PLAYER,
      gameMasterId: GM_1,
      referralId: String(new ObjectId()),
      termsAcceptanceId: "consent-ok",
    });
    expect(r).toEqual({ success: true, recorded: false });
    expect(await UserReferral.countDocuments()).toBe(0);

    const referralId = await seedReferral({ termsAcceptanceId: "earlier", termsVersion: "v0" });
    const again = await recordAffiliationConsent({ userId: PLAYER, gameMasterId: GM_1, referralId, termsAcceptanceId: "consent-ok" });
    expect(again).toEqual({ success: true, recorded: false });
    expect(await UserReferral.findById(referralId).lean()).toMatchObject({ termsAcceptanceId: "earlier", termsVersion: "v0" });
  });

  it("recordAffiliationConsent refuses another Game Master's row", async () => {
    const referralId = await seedReferral();
    const r = await recordAffiliationConsent({ userId: PLAYER, gameMasterId: GM_2, referralId, termsAcceptanceId: "consent-ok" });
    expect(r).toEqual({ success: true, recorded: false });
    expect((await UserReferral.findById(referralId).lean<{ termsAcceptanceId?: string }>())?.termsAcceptanceId).toBeUndefined();
  });
});

describe("terms request wiring (structural)", () => {
  it("both routes take identity from the session, never the body", () => {
    const sendRoute = code("app/api/gamemaster/referrals/send-terms/route.ts");
    expect(sendRoute).toMatch(/const userId = session\?\.user\?\.id;/);
    expect(sendRoute).toMatch(/gameMasterUserId:\s*userId,/);
    expect(sendRoute).not.toMatch(/body\?*\.(gameMasterUserId|gameMasterId|userId)/);
    const answerRoute = code("app/api/gamemaster/terms-request/route.ts");
    expect(answerRoute).toMatch(/getTermsRequestPrompt\(userId\)/);
    expect(answerRoute).toMatch(/user:\s*\{\s*id:\s*user\.id,/);
    expect(answerRoute).not.toMatch(/body\?*\.(userId|user|gameMasterId)\b/);
  });

  it("the notification templates exist in both apps", () => {
    for (const p of ["database/models/notification-template.model.ts", "apps/admin/database/models/notification-template.model.ts"]) {
      const src = code(p);
      expect(src).toContain('"gm_terms_request"');
      expect(src).toContain('"gm_terms_request_answered"');
    }
  });

  // Reason (flipped 1 Oct 2026): this pinned `GmTermsRequestPrompt`. The two prompts were merged
  // into ONE modal for both kinds (link sign-up and Send Terms), so a second prompt mounted
  // beside it would show the player the same question twice.
  it("one affiliate terms modal is mounted in the player layout, and the old prompts are gone", () => {
    const layout = code("app/(root)/layout.tsx");
    expect(layout.match(/<AffiliateTermsModal\b/g)).toHaveLength(1);
    expect(layout).not.toMatch(/GmTermsRequestPrompt|GmReferralTermsPrompt/);
  });

  // Reason: the service refuses anyway, but a button offered on an external or accepted row is
  // a control whose only outcome is a refusal - so every render must sit behind the row flag.
  // Since 1 Oct 2026 the gate also admits `termsSent`, so a sent row shows "TERMS SENT ✓".
  it.each([
    ["dashboard tab", "app/(root)/gamemaster/gamemaster-dashboard-tabs.tsx", /\{\(r\.canSendTerms \|\| r\.termsSent\) && \(?\s*$/],
    ["referrals page", "app/(root)/gamemaster/referrals/page.tsx", /\{\(user\.canSendTerms \|\| user\.termsSent\) && \(?\s*$/],
  ])("the %s offers Send T and C only behind canSendTerms", (_name, file, gate) => {
    const src = code(file);
    const renders = src.match(/<SendTermsButton\b/g) ?? [];
    expect(renders).toHaveLength(1);
    const at = src.indexOf("<SendTermsButton");
    const before = src.slice(Math.max(0, at - 120), at);
    expect(before).toMatch(gate);
  });
});
