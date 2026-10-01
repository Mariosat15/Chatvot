import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const sessionUser: { current: { id: string; email: string; name?: string } | null } = { current: null };
vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: async () => (sessionUser.current ? { user: sessionUser.current } : null) } },
}));

import SitePage from "@/database/models/site-page.model";
import TermsAcceptance from "@/database/models/terms-acceptance.model";
import UserReferral from "@/database/models/user-referral.model";
import GmReferralClaim from "@/database/models/gamemaster/gm-referral-claim.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { GM_AFFILIATION_TERMS_SLUG } from "@/lib/services/gamemaster/gm-terms-rules";
import { GM_AFFILIATION_TERMS_PAGE } from "@/lib/constants/gm-affiliation-terms-page";
import { recordGmTermsAcceptance } from "@/lib/services/gamemaster/gm-terms.service";
import { affiliate } from "@/lib/services/gamemaster/affiliation.service";
import {
  acceptReferralClaim,
  declineReferralClaim,
  getReferralClaimPrompt,
  recordReferralClaim,
} from "@/lib/services/gamemaster/referral-claim.service";
import {
  ACCEPTING_STALE_MS,
  RETRYABLE_ACCEPT_CODES,
  decideClaimPrompt,
  isClaimOpen,
} from "@/lib/services/gamemaster/referral-claim-rules";
import { GET as getClaim, POST as postClaim } from "@/app/api/gamemaster/referral-claim/route";

/**
 * Gamemaster Program v2, s5.3: a referral-link sign-up attaches NOBODY until the player
 * accepts the Game Master terms on the one-time prompt. Declining - or never answering -
 * leaves them unattached. Every test asserts the affiliation stores, not just the result.
 */

const root = resolve(__dirname, "../..");
const code = (p: string) =>
  readFileSync(resolve(root, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const PLAYER = "64c000000000000000000001";
const GM_1 = "64c0000000000000000000a1";
const GM_2 = "64c0000000000000000000a2";
const player = { id: PLAYER, email: "p@player.test", name: "Player" };
const NOW = new Date("2026-09-30T12:00:00Z");

describe("referral claim rules (pure)", () => {
  const gm = { userId: GM_1, status: "active" };
  const pending = { status: "pending" as const, gameMasterId: GM_1 };

  it("an open claim is pending, or an Accept that stalled", () => {
    expect(isClaimOpen(pending, NOW)).toBe(true);
    expect(isClaimOpen({ ...pending, status: "accepting", updatedAt: NOW }, NOW)).toBe(false);
    const stale = new Date(NOW.getTime() - ACCEPTING_STALE_MS);
    expect(isClaimOpen({ ...pending, status: "accepting", updatedAt: stale }, NOW)).toBe(true);
    for (const status of ["accepted", "declined", "refused", "lapsed"] as const) {
      expect(isClaimOpen({ ...pending, status }, NOW)).toBe(false);
    }
  });

  it("shows for a joinable Game Master, waits for a suspended one, lapses for good refusals", () => {
    const decide = (over: Record<string, unknown>) =>
      decideClaimPrompt({ userId: PLAYER, claim: pending, gm, now: NOW, ...over });
    expect(decide({})).toEqual({ kind: "show", gameMasterId: GM_1 });
    expect(decide({ gm: { ...gm, status: "suspended" } })).toEqual({ kind: "wait" });
    expect(decide({ gm: undefined })).toEqual({ kind: "lapse", reason: "gm_not_found" });
    expect(decide({ userId: GM_1 })).toEqual({ kind: "lapse", reason: "self" });
    expect(decide({ activeGameMasterId: GM_1, activeGameMaster: gm })).toEqual({
      kind: "lapse",
      reason: "already_affiliated",
    });
    const other = { activeGameMasterId: GM_2 };
    expect(decide({ ...other, activeGameMaster: { userId: GM_2, status: "active" } })).toMatchObject({
      kind: "lapse",
      reason: "already_affiliated_other",
    });
    // D4: a previous Game Master that expired no longer holds the player.
    expect(decide({ ...other, activeGameMaster: { userId: GM_2, status: "expired" } })).toMatchObject({
      kind: "show",
    });
    expect(decide({ claim: { ...pending, status: "declined" } })).toEqual({ kind: "none" });
  });

  it("only refusals that say nothing about the answer are retryable", () => {
    for (const c of ["gm_not_joinable", "terms_not_accepted", "terms_outdated", "terms_unavailable", "error"]) {
      expect(RETRYABLE_ACCEPT_CODES.has(c), c).toBe(true);
    }
    for (const c of ["already_affiliated_other", "gm_not_found", "self", "constructor"]) {
      expect(RETRYABLE_ACCEPT_CODES.has(c), c).toBe(false);
    }
  });
});

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
    totalEarnings: 0,
    pendingEarnings: 0,
    totalReferredUsers: 0,
    activeReferredUsers: 0,
    isPaused: false,
    scheduledForDeletion: false,
    createdAt: now,
    updatedAt: now,
  };
}

const db = () => mongoose.connection.db!;
const subs = () => GameMasterSubscription.collection;
const claimOf = () => GmReferralClaim.findOne({ userId: PLAYER }).lean();
const audit = (action: string) => db().collection("customer_audit_trail").find({ action }).toArray();

async function attached() {
  const u = await db().collection("user").findOne({ _id: new ObjectId(PLAYER) });
  return {
    rows: await UserReferral.countDocuments({ userId: PLAYER, isActive: true }),
    fallback: u?.referredByGameMasterId,
  };
}

async function consent(gameMasterId = GM_1) {
  const r = await recordGmTermsAcceptance({ user: player, gameMasterId, affiliationSource: "gm_referral_link" });
  if (!r.success) throw new Error(`consent failed: ${r.code}`);
  return r.acceptanceId;
}

const signUp = (referralCode = "GMONE") => recordReferralClaim({ user: player, referralCode });

describe("the referral claim against a real replica set", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "userreferrals",
      "gamemastersubscriptions",
      "user",
      "customer_audit_trail",
      "termsacceptances",
      "sitepages",
      "gm_referral_claims",
    ]);
    await UserReferral.init();
    await TermsAcceptance.init();
    await SitePage.init();
    await GmReferralClaim.init();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    sessionUser.current = null;
    await subs().insertOne(subscription(GM_1, "GMONE"));
    await subs().insertOne(subscription(GM_2, "GMTWO"));
    await db().collection("user").insertOne({ _id: new ObjectId(PLAYER), email: player.email });
    await SitePage.collection.insertOne({
      slug: GM_AFFILIATION_TERMS_SLUG,
      title: GM_AFFILIATION_TERMS_PAGE.title,
      sections: GM_AFFILIATION_TERMS_PAGE.sections,
      category: "action_terms",
      isActive: true,
      isSystem: true,
      version: "1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("sign-up records a pending claim and attaches nobody", async () => {
    expect(await signUp()).toMatchObject({ recorded: true, created: true, gameMasterId: GM_1 });
    expect(await claimOf()).toMatchObject({ status: "pending", gameMasterId: GM_1, referralCode: "GMONE" });
    expect(await attached()).toEqual({ rows: 0, fallback: undefined });
    expect((await subs().findOne({ referralCode: "GMONE" }))?.totalReferredUsers).toBe(0);
    expect(await audit("gm_referral_link_pending")).toHaveLength(1);
    // A repeated sign-up call does not reopen or duplicate the claim.
    expect(await signUp()).toMatchObject({ recorded: true, created: false });
    expect(await GmReferralClaim.countDocuments({})).toBe(1);
  });

  it("a dead link records no claim at all", async () => {
    expect(await signUp("GMNOPE")).toMatchObject({ recorded: false, reason: "gm_not_found" });
    await subs().updateOne({ referralCode: "GMONE" }, { $set: { status: "expired" } });
    expect(await signUp()).toMatchObject({ recorded: false, reason: "gm_not_joinable" });
    expect(await GmReferralClaim.countDocuments({})).toBe(0);
    expect(await getReferralClaimPrompt(player)).toEqual({ show: false });
  });

  it("the prompt shows once there is a pending claim, naming the Game Master", async () => {
    await signUp();
    expect(await getReferralClaimPrompt(player)).toEqual({
      show: true,
      gameMasterId: GM_1,
      gameMasterName: "Master GMONE",
    });
  });

  it("accepting with real consent attaches the player; repeating it is harmless", async () => {
    await signUp();
    const id = await consent();
    expect(await acceptReferralClaim({ user: player, termsAcceptanceId: id })).toMatchObject({
      success: true,
      outcome: "affiliated",
      gameMasterId: GM_1,
    });
    expect(await attached()).toEqual({ rows: 1, fallback: GM_1 });
    expect(await UserReferral.findOne({ userId: PLAYER }).lean()).toMatchObject({
      source: "gm_referral_link",
      affiliatedVia: { surface: "signup" },
      termsAcceptanceId: id,
    });
    expect(await claimOf()).toMatchObject({ status: "accepted", resolution: "affiliated" });
    expect(await acceptReferralClaim({ user: player, termsAcceptanceId: id })).toMatchObject({
      success: true,
      outcome: "already_affiliated",
    });
    expect(await getReferralClaimPrompt(player)).toEqual({ show: false });
  });

  it("declining is final: never attached, never asked again, and Accept afterwards is refused", async () => {
    await signUp();
    expect(await declineReferralClaim({ user: player })).toMatchObject({ success: true, outcome: "declined" });
    expect(await declineReferralClaim({ user: player })).toMatchObject({ success: true, outcome: "declined" });
    expect(await audit("gm_referral_link_declined")).toHaveLength(1);
    expect(await getReferralClaimPrompt(player)).toEqual({ show: false });
    const id = await consent();
    expect(await acceptReferralClaim({ user: player, termsAcceptanceId: id })).toMatchObject({
      success: false,
      code: "no_open_claim",
    });
    expect(await attached()).toEqual({ rows: 0, fallback: undefined });
  });

  it("an Accept without valid consent attaches nobody and leaves the prompt open", async () => {
    await signUp();
    for (const termsAcceptanceId of [undefined, "junk", await consent(GM_2)]) {
      expect(await acceptReferralClaim({ user: player, termsAcceptanceId })).toMatchObject({
        success: false,
        code: "terms_not_accepted",
        retryable: true,
      });
      expect(await claimOf()).toMatchObject({ status: "pending" });
    }
    expect(await attached()).toEqual({ rows: 0, fallback: undefined });
    expect(await getReferralClaimPrompt(player)).toMatchObject({ show: true });
  });

  it("an Accept racing a Decline has exactly one winner", async () => {
    await signUp();
    const id = await consent();
    const [a, d] = await Promise.all([
      acceptReferralClaim({ user: player, termsAcceptanceId: id }),
      declineReferralClaim({ user: player }),
    ]);
    expect([a.success, d.success].filter(Boolean)).toHaveLength(1);
    const claim = await claimOf();
    expect(await attached()).toEqual(
      a.success ? { rows: 1, fallback: GM_1 } : { rows: 0, fallback: undefined },
    );
    expect(claim?.status).toBe(a.success ? "accepted" : "declined");
  }, 30_000);

  it("a stalled Accept is taken over rather than stranding the claim", async () => {
    await signUp();
    await GmReferralClaim.collection.updateOne(
      { userId: PLAYER },
      { $set: { status: "accepting", updatedAt: new Date(Date.now() - ACCEPTING_STALE_MS - 1000) } },
    );
    expect(await declineReferralClaim({ user: player })).toMatchObject({ success: true });
  });

  it("an Accept still in flight blocks a second answer", async () => {
    await signUp();
    await GmReferralClaim.collection.updateOne({ userId: PLAYER }, { $set: { status: "accepting", updatedAt: new Date() } });
    expect(await declineReferralClaim({ user: player })).toMatchObject({ success: false, code: "in_progress" });
  });

  it("a suspended Game Master makes the claim wait, not lapse", async () => {
    await signUp();
    await subs().updateOne({ referralCode: "GMONE" }, { $set: { status: "suspended" } });
    expect(await getReferralClaimPrompt(player)).toEqual({ show: false });
    expect(await claimOf()).toMatchObject({ status: "pending" });
    await subs().updateOne({ referralCode: "GMONE" }, { $set: { status: "active" } });
    expect(await getReferralClaimPrompt(player)).toMatchObject({ show: true });
  });

  it("a deleted Game Master lapses the claim with an audit row", async () => {
    await signUp();
    await subs().deleteOne({ referralCode: "GMONE" });
    expect(await getReferralClaimPrompt(player)).toEqual({ show: false });
    expect(await claimOf()).toMatchObject({ status: "lapsed", resolution: "gm_not_found" });
    expect(await audit("gm_referral_link_lapsed")).toHaveLength(1);
  });

  it("a player already under another active Game Master is not offered the link (D1)", async () => {
    expect(
      await affiliate({
        user: player,
        gameMaster: { referralCode: "GMTWO" },
        channel: "gm_referral_link",
        termsAcceptanceId: await consent(GM_2),
      }),
    ).toMatchObject({ success: true });
    await GmReferralClaim.collection.insertOne({
      userId: PLAYER,
      userEmail: player.email,
      referralCode: "GMONE",
      gameMasterId: GM_1,
      gameMasterName: "Master GMONE",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await getReferralClaimPrompt(player)).toEqual({ show: false });
    expect(await claimOf()).toMatchObject({ status: "lapsed", resolution: "already_affiliated_other" });

    // D4: had that Game Master expired, the link would be offered instead.
    await GmReferralClaim.collection.updateOne({ userId: PLAYER }, { $set: { status: "pending" } });
    await subs().updateOne({ referralCode: "GMTWO" }, { $set: { status: "expired" } });
    expect(await getReferralClaimPrompt(player)).toMatchObject({ show: true, gameMasterId: GM_1 });
    expect(
      await acceptReferralClaim({ user: player, termsAcceptanceId: await consent() }),
    ).toMatchObject({ success: true, outcome: "affiliated" });
    expect(await attached()).toEqual({ rows: 1, fallback: GM_1 });
  });

  it("the route answers only for the signed-in player", async () => {
    await signUp();
    const get = () => getClaim(new NextRequest("http://x/api/gamemaster/referral-claim"));
    const post = (body: unknown) =>
      postClaim(
        new NextRequest("http://x/api/gamemaster/referral-claim", { method: "POST", body: JSON.stringify(body) }),
      );
    expect((await get()).status).toBe(401);
    expect((await post({ action: "decline" })).status).toBe(401);

    sessionUser.current = player;
    expect(await (await get()).json()).toMatchObject({ success: true, show: true, gameMasterId: GM_1 });
    expect((await post({ action: "constructor" })).status).toBe(400);
    expect((await post({ action: "accept", termsAcceptanceId: "junk" })).status).toBe(422);
    expect((await post({ action: "decline" })).status).toBe(200);
    expect((await post({ action: "accept", termsAcceptanceId: await consent() })).status).toBe(409);
    expect(await attached()).toEqual({ rows: 0, fallback: undefined });
  });
});

describe("wiring", () => {
  it("the prompt is mounted in the signed-in layout", () => {
    const layout = code("app/(root)/layout.tsx");
    expect(layout).toMatch(/import GmReferralTermsPrompt from "@\/components\/gamemaster\/GmReferralTermsPrompt"/);
    expect(layout).toMatch(/<GmReferralTermsPrompt \/>/);
  });

  it("the route takes the player from the session, never from the body", () => {
    const route = code("app/api/gamemaster/referral-claim/route.ts");
    expect(route).not.toMatch(/body\??\.(userId|gameMasterId|referralCode|user)\b/);
    expect(route).toMatch(/auth\.api\.getSession/);
  });

  it("closing the terms opens a confirm step that Escape and outside clicks cannot dismiss", () => {
    const src = code("components/gamemaster/GmReferralTermsPrompt.tsx");
    expect(src).toMatch(/onDecline=\{\(\) => setStage\("confirm-decline"\)\}/);
    const confirm = src.slice(src.indexOf('open={stage === "confirm-decline"}'));
    expect(confirm.length).toBeGreaterThan(100);
    expect(confirm).toMatch(/onEscapeKeyDown=\{\(e\) => e\.preventDefault\(\)\}/);
    expect(confirm).toMatch(/onPointerDownOutside=\{\(e\) => e\.preventDefault\(\)\}/);
    expect(confirm).toMatch(/showCloseButton=\{false\}/);
    // The decline POST is reachable only from the confirm step's Decline button.
    expect(src.match(/action: "decline"/g)).toHaveLength(1);
    expect(src).toMatch(/affiliationSource: "gm_referral_link"/);
  });
});
