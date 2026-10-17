import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { startTestMongo, stopTestMongo, clearTestMongo, ensureCollections } from "../helpers/mongo-test-server";

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
vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    send: async (n: { userId: string; templateId: string; variables?: Record<string, unknown> }) => {
      sent.push(n);
    },
  },
}));
vi.mock("@/lib/services/email-notification-bridge", () => ({
  emailNotificationBridge: { gmTermsRequest: async () => undefined },
}));
vi.mock("@/lib/utils/user-lookup", () => ({
  getUserById: async (id: string) => ({ id, email: `${id}@player.test`, name: "Player One" }),
}));

import UserReferral from "@/database/models/user-referral.model";
import GmTermsRequest from "@/database/models/gamemaster/gm-terms-request.model";
import GmReferralClaim from "@/database/models/gamemaster/gm-referral-claim.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { answerAffiliateConsent, getAffiliateConsentPrompt } from "@/lib/services/gamemaster/affiliate-consent.service";
import { sendTermsRequest } from "@/lib/services/gamemaster/gm-terms-request.service";
import {
  readAdminAwaitingClaims,
  readAdminTermsStates,
  sendAdminTermsReminder,
} from "@/apps/admin/lib/services/gamemaster/admin-terms-reminder.service";
import { ADMIN_CONSENT_LABELS, canAdminSendTerms } from "@/apps/admin/lib/admin/admin-terms-reminder-view";

/**
 * The end-to-end Game Master referral terms flow (`External game plans/24` s5.6): ONE consent
 * backend answers both kinds of question, and an admin may remind a player without limit while
 * the Game Master's own send stays once-only. Every refusal asserts nothing was sent and no
 * counter moved, because a refusal that half-sent is a notification a player cannot explain.
 */

const root = resolve(__dirname, "../..");
const code = (p: string) =>
  readFileSync(resolve(root, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const PLAYER = "64c000000000000000000001";
const OTHER_PLAYER = "64c000000000000000000002";
const GM_1 = "64c0000000000000000000a1";
const GM_2 = "64c0000000000000000000a2";
const ADMIN = { id: "64c0000000000000000000ff", email: "admin@chartvolt.test", name: "Ada Admin" };
const player = { id: PLAYER, email: `${PLAYER}@player.test`, name: "Player One" };
const db = () => mongoose.connection.db!;

function subscription(userId: string, referralCode: string) {
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

async function seedClaim(status = "pending", userId = PLAYER) {
  await GmReferralClaim.collection.insertOne({
    userId,
    userEmail: `${userId}@player.test`,
    referralCode: "GMONE",
    gameMasterId: GM_1,
    gameMasterName: "Master GMONE",
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const gm1SubscriptionId = async () =>
  String((await GameMasterSubscription.collection.findOne({ userId: GM_1 }))!._id);

const remind = async (playerUserId = PLAYER) =>
  sendAdminTermsReminder(db() as never, {
    gameMasterSubscriptionId: await gm1SubscriptionId(),
    playerUserId,
    admin: ADMIN,
    meta: { ipAddress: "10.0.0.9", userAgent: "vitest" },
  });

const audits = () => db().collection("customer_audit_trail").find({ action: "admin_terms_reminder_sent" }).toArray();

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "userreferrals",
    "gamemastersubscriptions",
    "gm_terms_requests",
    "gm_referral_claims",
    "customer_audit_trail",
    "employee_notifications",
    "customer_assignments",
    "notifications",
    "user",
  ]);
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  sent.length = 0;
  await GameMasterSubscription.collection.insertOne(subscription(GM_1, "GMONE"));
  await GameMasterSubscription.collection.insertOne(subscription(GM_2, "GMTWO"));
});

describe("one consent backend (POST /api/affiliate/consent)", () => {
  it("a legacy referral with no request is asked, and declining keeps the affiliation (owner: keep)", async () => {
    const referralId = await seedReferral();
    expect(await getAffiliateConsentPrompt(player)).toMatchObject({ show: true, kind: "request", gameMasterId: GM_1 });
    expect(await answerAffiliateConsent({ user: player, decision: "decline" })).toMatchObject({
      success: true,
      kind: "request",
      decision: "decline",
    });
    const row = await UserReferral.findById(referralId).lean<{ isActive: boolean; termsAcceptanceId?: string }>();
    expect(row?.isActive).toBe(true);
    expect(row?.termsAcceptanceId).toBeUndefined();
    expect((await GmTermsRequest.findOne({ referralId }).lean())?.status).toBe("declined");
    // Decline is final: never asked again.
    expect(await getAffiliateConsentPrompt(player)).toEqual({ show: false });
  });

  it("accepting stamps consent on the existing row and resolves the bell reminder", async () => {
    const referralId = await seedReferral();
    await db().collection("notifications").insertOne({ userId: PLAYER, templateId: "affiliate_terms_required", isRead: false });
    expect(await answerAffiliateConsent({ user: player, decision: "accept", termsAcceptanceId: "consent-ok" })).toMatchObject({
      success: true,
      decision: "accept",
    });
    expect((await UserReferral.findById(referralId).lean<{ termsAcceptanceId?: string }>())?.termsAcceptanceId).toBe("consent-ok");
    expect(await db().collection("notifications").countDocuments({ userId: PLAYER, isRead: false })).toBe(0);
    expect(await getAffiliateConsentPrompt(player)).toEqual({ show: false });
  });

  it("an accept with no recorded acceptance is refused and stays answerable", async () => {
    await seedReferral();
    expect(await answerAffiliateConsent({ user: player, decision: "accept" })).toMatchObject({
      success: false,
      retryable: true,
    });
    expect(await getAffiliateConsentPrompt(player)).toMatchObject({ show: true });
  });

  it("a pending link sign-up is declined into independence - nobody is attached", async () => {
    await seedClaim();
    expect(await getAffiliateConsentPrompt(player)).toMatchObject({ show: true, kind: "claim", gameMasterId: GM_1 });
    expect(await answerAffiliateConsent({ user: player, decision: "decline" })).toMatchObject({ success: true, kind: "claim" });
    expect(await UserReferral.countDocuments({ userId: PLAYER })).toBe(0);
    expect((await GmReferralClaim.findOne({ userId: PLAYER }).lean())?.status).toBe("declined");
    expect(sent.filter((n) => n.userId === GM_1 && n.templateId === "gm_terms_request_answered")).toHaveLength(1);
    expect(await getAffiliateConsentPrompt(player)).toEqual({ show: false });
  });

  it("refuses an unknown decision and an answer with nothing open", async () => {
    expect(await answerAffiliateConsent({ user: player, decision: "constructor" })).toMatchObject({
      success: false,
      code: "invalid_decision",
    });
    expect(await answerAffiliateConsent({ user: player, decision: "decline" })).toMatchObject({
      success: false,
      code: "no_open_consent",
    });
  });

  it("the route takes the player from the session and never from the body", () => {
    const route = code("app/api/affiliate/consent/route.ts");
    expect(route).toMatch(/auth\.api\.getSession/);
    expect(route).not.toMatch(/body\??\.(userId|gameMasterId|referralId|user)\b/);
  });
});

describe("admin SEND TERMS reminder", () => {
  it("reminds a pending referral, counts it, notifies with the GM name only, and audits the admin", async () => {
    const referralId = await seedReferral();
    expect(await remind()).toEqual({ success: true, adminTermsReminderCount: 1, target: "referral" });
    const request = await GmTermsRequest.findOne({ referralId }).lean<Record<string, unknown>>();
    expect(request).toMatchObject({ status: "pending", sendCount: 0, adminTermsReminderCount: 1 });
    expect(request?.lastAdminTermsReminderAt).toBeInstanceOf(Date);
    expect(sent).toEqual([{ userId: PLAYER, templateId: "affiliate_terms_required", variables: { gameMasterName: "Master GMONE" } }]);
    const [audit] = await audits();
    expect(audit).toMatchObject({
      customerId: PLAYER,
      actionCategory: "assignment",
      performedBy: { type: "admin", id: ADMIN.id, email: ADMIN.email },
      metadata: { gameMasterId: GM_1, referralId, adminTermsReminderCount: 1 },
      ipAddress: "10.0.0.9",
    });
  });

  it("is unlimited and never spends the Game Master's one send", async () => {
    const referralId = await seedReferral();
    for (let i = 1; i <= 3; i++) expect(await remind()).toMatchObject({ success: true, adminTermsReminderCount: i });
    expect(await GmTermsRequest.findOne({ referralId }).lean()).toMatchObject({ sendCount: 0, adminTermsReminderCount: 3 });
    expect(await audits()).toHaveLength(3);
    expect(await sendTermsRequest({ gameMasterUserId: GM_1, referralId })).toEqual({ success: true, sendCount: 1 });
    expect(await GmTermsRequest.findOne({ referralId }).lean()).toMatchObject({ sendCount: 1, adminTermsReminderCount: 3 });
  });

  it("refuses an accepted referral and sends nothing", async () => {
    await seedReferral({ termsAcceptanceId: "consent-ok" });
    expect(await remind()).toMatchObject({ success: false, code: "already_accepted" });
    expect(sent).toHaveLength(0);
    expect(await GmTermsRequest.countDocuments()).toBe(0);
    expect(await audits()).toHaveLength(0);
  });

  it("refuses a declined request - a decline is final", async () => {
    const referralId = await seedReferral();
    await GmTermsRequest.collection.insertOne({ referralId, userId: PLAYER, gameMasterId: GM_1, status: "declined", sendCount: 1 });
    expect(await remind()).toMatchObject({ success: false, code: "declined" });
    expect(sent).toHaveLength(0);
    expect((await GmTermsRequest.findOne({ referralId }).lean<{ adminTermsReminderCount?: number }>())?.adminTermsReminderCount).toBeUndefined();
  });

  it("another Game Master's player reads as not found", async () => {
    await seedReferral({ gameMasterId: GM_2, referralCode: "GMTWO" });
    expect(await remind()).toMatchObject({ success: false, code: "not_found" });
    expect(sent).toHaveLength(0);
  });

  it("a pending link sign-up is reminded on the claim, and a declined one is refused", async () => {
    await seedClaim("pending");
    expect(await remind()).toEqual({ success: true, adminTermsReminderCount: 1, target: "claim" });
    expect((await GmReferralClaim.findOne({ userId: PLAYER }).lean())?.adminTermsReminderCount).toBe(1);
    await seedClaim("declined", OTHER_PLAYER);
    sent.length = 0;
    expect(await remind(OTHER_PLAYER)).toMatchObject({ success: false, code: "declined" });
    expect(sent).toHaveLength(0);
  });

  it("lists waiting and declined link sign-ups as referred, not assigned", async () => {
    await seedClaim("pending");
    await seedClaim("declined", OTHER_PLAYER);
    await seedClaim("accepted", "64c000000000000000000003");
    const rows = await readAdminAwaitingClaims(db() as never, GM_1);
    expect(rows.map((r) => [r.userId, r.consent]).sort()).toEqual([
      [PLAYER, "pending"],
      [OTHER_PLAYER, "declined"],
    ].sort());
    expect(await readAdminAwaitingClaims(db() as never, GM_2)).toEqual([]);
  });

  it("an admin-created request still opens the player's modal", async () => {
    await seedReferral();
    await remind();
    expect(await getAffiliateConsentPrompt(player)).toMatchObject({ show: true, kind: "request" });
  });

  it("reports consent and both reminder sources for the tab", async () => {
    const pendingId = await seedReferral();
    const declinedId = await seedReferral({ userId: OTHER_PLAYER });
    await GmTermsRequest.collection.insertOne({
      referralId: declinedId,
      userId: OTHER_PLAYER,
      gameMasterId: GM_1,
      status: "declined",
      sendCount: 1,
      lastSentAt: new Date("2026-10-01T10:00:00Z"),
    });
    await remind();
    const states = await readAdminTermsStates(db() as never, [
      { referralId: pendingId, termsAccepted: false },
      { referralId: declinedId, termsAccepted: false },
      { referralId: "64c0000000000000000000ee", termsAccepted: true },
    ]);
    expect(states.get(pendingId)).toMatchObject({ consent: "pending", gmReminderSent: false, adminReminderCount: 1 });
    expect(states.get(declinedId)).toMatchObject({
      consent: "declined",
      gmReminderSent: true,
      gmReminderSentAt: "2026-10-01T10:00:00.000Z",
      adminReminderCount: 0,
    });
    expect(states.get("64c0000000000000000000ee")?.consent).toBe("accepted");
    expect(canAdminSendTerms(states.get(pendingId))).toBe(true);
    expect(canAdminSendTerms(states.get(declinedId))).toBe(false);
    expect(ADMIN_CONSENT_LABELS.get("pending")).toBe("Pending Terms");
  });
});

describe("admin send-terms route", () => {
  const ROUTE = "apps/admin/app/api/gamemasters/[id]/referrals/[userId]/send-terms/route.ts";

  it("every exported handler is guarded by the section that renders the tab", () => {
    const src = code(ROUTE);
    const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? [];
    expect(handlers).toEqual(["export async function POST"]);
    expect(src.match(/guardSection\("gamemaster-management"\)/g)).toHaveLength(handlers.length);
  });

  it("takes the admin from the guard, never from the request body", () => {
    const src = code(ROUTE);
    expect(src).toMatch(/admin:\s*guard\.admin/);
    expect(src).not.toMatch(/request\.json\(/);
  });

  it("the tab hides the button unless consent is pending", () => {
    const cells = code("apps/admin/components/admin/gamemaster/GmTermsReminderCells.tsx");
    expect(cells).toMatch(/if \(!canAdminSendTerms\(state\)\) return null/);
  });
});
