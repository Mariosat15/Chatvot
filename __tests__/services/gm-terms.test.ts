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

// Reason: the acceptance route reads the session; a test sets who is signed in.
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
import {
  GM_AFFILIATION_TERMS_SLUG,
  GM_TERMS_ACCEPTANCE_MAX_AGE_MS,
  decideGmTermsAcceptance,
  interpolateTermsText,
  liveGmTermsFrom,
} from "@/lib/services/gamemaster/gm-terms-rules";
import {
  recordGmTermsAcceptance,
  verifyGmTermsAcceptance,
} from "@/lib/services/gamemaster/gm-terms.service";
import { affiliate } from "@/lib/services/gamemaster/affiliation.service";
import { withMissingSystemPages } from "@/lib/services/site-page-seed.service";
import { ALL_DEFAULT_PAGES, DEFAULT_ACTION_TERMS } from "@/lib/constants/default-pages";
import { GM_AFFILIATION_TERMS_PAGE } from "@/lib/constants/gm-affiliation-terms-page";
import {
  hasTermsContentChanged,
  nextTermsVersion,
} from "../../apps/admin/lib/admin/site-page-version";
import { GET as getActionTerms } from "@/app/api/action-terms/[slug]/route";
import { POST as postAcceptance } from "@/app/api/terms-acceptance/route";

/**
 * Gamemaster Program v2, step 3 (`External game plans/24` s5): the Game Master terms page,
 * versioned consent, and Join GM refusing without it.
 *
 * The load-bearing property is FAIL CLOSED: a missing, deactivated or unversioned page means
 * nobody can consent, and consent to one Game Master, one wording or one player proves
 * nothing about another.
 */

const PLAYER = "64c000000000000000000001";
const PLAYER_2 = "64c000000000000000000002";
const GM_1 = "64c0000000000000000000a1";
const GM_2 = "64c0000000000000000000a2";

const NOW = new Date("2026-09-30T12:00:00Z");
const good = {
  userId: PLAYER,
  termsSlug: GM_AFFILIATION_TERMS_SLUG,
  termsVersion: "3",
  gameMasterId: GM_1,
  acceptedAt: new Date(NOW.getTime() - 60_000),
};
// Reason: `live` is passed explicitly - a default parameter would turn `undefined` (the
// case under test) back into a live page, and the refusal would never be exercised.
const decide = (acceptance: typeof good | null, live: { version: string } | null = { version: "3" }) =>
  decideGmTermsAcceptance({
    userId: PLAYER,
    gameMasterId: GM_1,
    live: live ?? undefined,
    acceptance,
    now: NOW,
  });

describe("Game Master terms rules (pure)", () => {
  it("a page is live only while active AND versioned", () => {
    expect(liveGmTermsFrom(null)).toBeUndefined();
    expect(liveGmTermsFrom({ isActive: false, version: "1" })).toBeUndefined();
    expect(liveGmTermsFrom({ isActive: true })).toBeUndefined();
    expect(liveGmTermsFrom({ isActive: true, version: "  " })).toBeUndefined();
    expect(liveGmTermsFrom({ isActive: true, version: "2" })).toEqual({ version: "2" });
  });

  it("accepts a fresh acceptance of the current wording for this player and Game Master", () => {
    expect(decide(good)).toEqual({ ok: true });
  });

  it("no live page refuses before anything else is looked at", () => {
    expect(decide(good, null)).toMatchObject({ ok: false, code: "terms_unavailable" });
  });

  it("an acceptance for another player, slug or Game Master is not consent to this join", () => {
    expect(decide(null)).toMatchObject({ code: "terms_not_accepted" });
    expect(decide({ ...good, userId: PLAYER_2 })).toMatchObject({ code: "terms_not_accepted" });
    expect(decide({ ...good, termsSlug: "terms-challenge" })).toMatchObject({ code: "terms_not_accepted" });
    expect(decide({ ...good, gameMasterId: GM_2 })).toMatchObject({ code: "terms_not_accepted" });
  });

  it("changed wording or a stale acceptance is outdated", () => {
    expect(decide({ ...good, termsVersion: "2" })).toMatchObject({ code: "terms_outdated" });
    expect(
      decide({ ...good, acceptedAt: new Date(NOW.getTime() - GM_TERMS_ACCEPTANCE_MAX_AGE_MS - 1) }),
    ).toMatchObject({ code: "terms_outdated" });
    expect(decide({ ...good, acceptedAt: new Date(NOW.getTime() + 61_000) })).toMatchObject({
      code: "terms_outdated",
    });
    expect(decide({ ...good, acceptedAt: new Date("nope") })).toMatchObject({ code: "terms_outdated" });
  });

  it("interpolation escapes HTML only in HTML sections and keeps unknown placeholders visible", () => {
    const vars = { gameMasterName: "<b>Al</b>" };
    expect(interpolateTermsText("Join {{gameMasterName}}", vars, false)).toBe("Join <b>Al</b>");
    expect(interpolateTermsText("Join {{ gameMasterName }}", vars, true)).toBe(
      "Join &lt;b&gt;Al&lt;/b&gt;",
    );
    expect(interpolateTermsText("Hi {{nobody}}", vars, false)).toBe("Hi {{nobody}}");
    // Reason: a Map lookup, so an inherited name is never "known".
    expect(interpolateTermsText("{{constructor}}", vars, false)).toBe("{{constructor}}");
  });
});

describe("the Game Master terms page definition", () => {
  it("is a versioned system action-terms page that requires a live copy", () => {
    expect(GM_AFFILIATION_TERMS_PAGE).toMatchObject({
      slug: GM_AFFILIATION_TERMS_SLUG,
      category: "action_terms",
      isSystem: true,
      version: "1",
      requiresLivePage: true,
    });
    expect(DEFAULT_ACTION_TERMS.map((p) => p.slug)).toContain(GM_AFFILIATION_TERMS_SLUG);
    // D1 and D6 are what the player is agreeing to, so the copy must say both.
    const copy = GM_AFFILIATION_TERMS_PAGE.sections.map((s) => s.content).join("\n");
    expect(copy).toMatch(/support/i);
    expect(copy).toMatch(/email/i);
    expect(copy).toMatch(/country/i);
  });

  it("the seeder adds a system page that saved defaults predate, and overrides nothing", () => {
    const saved = ALL_DEFAULT_PAGES.filter((p) => p.slug !== GM_AFFILIATION_TERMS_SLUG).map(
      (p) => (p.slug === "terms-challenge" ? { ...p, title: "Operator title" } : p),
    );
    const merged = withMissingSystemPages(saved);
    expect(merged.map((p) => p.slug)).toContain(GM_AFFILIATION_TERMS_SLUG);
    expect(merged.find((p) => p.slug === "terms-challenge")?.title).toBe("Operator title");
    expect(withMissingSystemPages(ALL_DEFAULT_PAGES)).toHaveLength(ALL_DEFAULT_PAGES.length);
  });
});

describe("admin terms version bump (pure)", () => {
  const base = { title: "T", subtitle: "S", sections: [{ id: "a", type: "paragraph", content: "x", order: 1 }] };

  it("any wording change is a change; toggles and Mongo ids are not", () => {
    expect(hasTermsContentChanged(base, { ...base })).toBe(false);
    expect(
      hasTermsContentChanged(base, {
        ...base,
        sections: [{ ...base.sections[0], _id: "anything" }],
      }),
    ).toBe(false);
    expect(hasTermsContentChanged(base, { ...base, title: "T2" })).toBe(true);
    expect(hasTermsContentChanged(base, { ...base, subtitle: "S2" })).toBe(true);
    expect(
      hasTermsContentChanged(base, { ...base, sections: [{ ...base.sections[0], content: "y" }] }),
    ).toBe(true);
  });

  it("the admin PUT bumps action-terms pages on a content change and never takes body.version", () => {
    const route = readFileSync(resolve(__dirname, "../../apps/admin/app/api/pages/[slug]/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(route).not.toMatch(/body\.version/);
    const bump = route.indexOf("page.version = nextTermsVersion(page.version)");
    const gate = route.indexOf('page.category === "action_terms"');
    const changed = route.indexOf("hasTermsContentChanged(before");
    const save = route.indexOf("await page.save()");
    expect(gate).toBeGreaterThan(-1);
    expect(changed).toBeGreaterThan(gate);
    expect(bump).toBeGreaterThan(changed);
    expect(save).toBeGreaterThan(bump);
  });

  it("the next version always moves", () => {
    expect(nextTermsVersion(undefined)).toBe("1");
    expect(nextTermsVersion("")).toBe("1");
    expect(nextTermsVersion("7")).toBe("8");
    expect(nextTermsVersion("2026-09-30")).toBe("2026-09-30.1");
  });
});

// ─── Against a real replica set ────────────────────────────────────────────

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
const player = { id: PLAYER, email: "p@player.test", name: "Player" };

async function seedGmPage(over: Record<string, unknown> = {}) {
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
    ...over,
  });
}

async function joinGm(termsAcceptanceId?: string, userId = PLAYER) {
  const sub = await GameMasterSubscription.collection.findOne({ referralCode: "GMONE" });
  return affiliate({
    user: { id: userId, email: `${userId}@player.test` },
    gameMaster: { subscriptionId: String(sub!._id) },
    channel: "chartvolt_join_gm",
    surface: "leaderboard",
    termsAcceptanceId,
  });
}

async function acceptFor(gameMasterId = GM_1) {
  const r = await recordGmTermsAcceptance({ user: player, gameMasterId });
  if (!r.success) throw new Error(`accept failed: ${r.code}`);
  return r.acceptanceId;
}

const actionTermsRequest = () =>
  getActionTerms(new NextRequest("http://x/api/action-terms/x"), {
    params: Promise.resolve({ slug: GM_AFFILIATION_TERMS_SLUG }),
  });

const acceptanceRequest = (body: unknown) =>
  postAcceptance(
    new NextRequest("http://x/api/terms-acceptance", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", "user-agent": "vitest" },
    }),
  );

describe("recording and verifying Game Master consent", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "userreferrals",
      "gamemastersubscriptions",
      "user",
      "customer_audit_trail",
      "termsacceptances",
      "sitepages",
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
    sessionUser.current = null;
    await GameMasterSubscription.collection.insertOne(subscription(GM_1, "GMONE"));
    await GameMasterSubscription.collection.insertOne(subscription(GM_2, "GMTWO"));
    await db().collection("user").insertOne({ _id: new ObjectId(PLAYER), email: player.email });
  });

  it("records the version and Game Master, and writes one audit row", async () => {
    await seedGmPage({ version: "4" });
    const r = await recordGmTermsAcceptance({ user: player, gameMasterId: GM_1, ipAddress: "10.0.0.9" });
    expect(r).toMatchObject({ success: true, termsVersion: "4" });
    const stored = await TermsAcceptance.findById((r as { acceptanceId: string }).acceptanceId).lean();
    expect(stored).toMatchObject({
      userId: PLAYER,
      termsSlug: GM_AFFILIATION_TERMS_SLUG,
      termsVersion: "4",
      context: { gameMasterId: GM_1, affiliationSource: "chartvolt_join_gm" },
    });
    const audit = await db().collection("customer_audit_trail").find({ action: "gm_terms_accepted" }).toArray();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      customerId: PLAYER,
      metadata: { termsVersion: "4", gameMasterId: GM_1 },
    });
  });

  it.each([
    ["missing", null],
    ["deactivated", { isActive: false }],
    ["unversioned", { version: "" }],
  ])("a %s page records nothing", async (_label, over) => {
    if (over) await seedGmPage(over);
    const r = await recordGmTermsAcceptance({ user: player, gameMasterId: GM_1 });
    expect(r).toMatchObject({ success: false, code: "terms_unavailable" });
    expect(await TermsAcceptance.countDocuments({})).toBe(0);
  });

  it("refuses an unknown Game Master and consenting to yourself", async () => {
    await seedGmPage();
    expect(await recordGmTermsAcceptance({ user: player, gameMasterId: GM_1.replace("a1", "ff") })).toMatchObject({
      code: "gm_not_found",
    });
    expect(await recordGmTermsAcceptance({ user: player, gameMasterId: PLAYER })).toMatchObject({
      code: "invalid_input",
    });
    expect(await TermsAcceptance.countDocuments({})).toBe(0);
  });

  it("verification follows the live version: an edit invalidates earlier consent", async () => {
    await seedGmPage();
    const id = await acceptFor();
    expect(await verifyGmTermsAcceptance({ acceptanceId: id, userId: PLAYER, gameMasterId: GM_1 })).toMatchObject({
      ok: true,
      termsVersion: "1",
    });
    await SitePage.collection.updateOne({ slug: GM_AFFILIATION_TERMS_SLUG }, { $set: { version: "2" } });
    expect(await verifyGmTermsAcceptance({ acceptanceId: id, userId: PLAYER, gameMasterId: GM_1 })).toMatchObject({
      ok: false,
      code: "terms_outdated",
    });
  });

  it("verification refuses a junk id without querying", async () => {
    await seedGmPage();
    expect(
      await verifyGmTermsAcceptance({ acceptanceId: "not-an-id", userId: PLAYER, gameMasterId: GM_1 }),
    ).toMatchObject({ ok: false, code: "terms_not_accepted" });
  });

  it("Join GM without consent is refused, audited, and writes no affiliation", async () => {
    await seedGmPage();
    expect(await joinGm()).toMatchObject({ success: false, code: "terms_not_accepted" });
    expect(await UserReferral.countDocuments({})).toBe(0);
    const refused = await db().collection("customer_audit_trail").find({ action: "gm_affiliation_refused" }).toArray();
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ metadata: { code: "terms_not_accepted" } });
  });

  it("Join GM with consent to ANOTHER Game Master is refused", async () => {
    await seedGmPage();
    const id = await acceptFor(GM_2);
    expect(await joinGm(id)).toMatchObject({ success: false, code: "terms_not_accepted" });
    expect(await UserReferral.countDocuments({})).toBe(0);
  });

  it("Join GM with valid consent stamps the acceptance on the affiliation", async () => {
    await seedGmPage({ version: "5" });
    const id = await acceptFor();
    expect(await joinGm(id)).toMatchObject({ success: true, created: true, gameMasterId: GM_1 });
    const row = await UserReferral.findOne({ userId: PLAYER }).lean();
    expect(row).toMatchObject({
      source: "chartvolt_join_gm",
      termsAcceptanceId: id,
      termsSlug: GM_AFFILIATION_TERMS_SLUG,
      termsVersion: "5",
    });
  });

  it("Join GM refuses when the page is deactivated after consent was given", async () => {
    await seedGmPage();
    const id = await acceptFor();
    await SitePage.collection.updateOne({ slug: GM_AFFILIATION_TERMS_SLUG }, { $set: { isActive: false } });
    expect(await joinGm(id)).toMatchObject({ success: false, code: "terms_unavailable" });
    expect(await UserReferral.countDocuments({})).toBe(0);
  });

  it("the referral link still needs no consent (s5.3 is deferred)", async () => {
    const r = await affiliate({
      user: { id: PLAYER, email: player.email },
      gameMaster: { referralCode: "GMONE" },
      channel: "gm_referral_link",
    });
    expect(r).toMatchObject({ success: true, created: true });
  });

  it("the public terms route has NO built-in fallback for the Game Master page", async () => {
    const missing = await actionTermsRequest();
    expect(missing.status).toBe(404);

    await seedGmPage({ version: "" });
    expect((await actionTermsRequest()).status).toBe(404);

    await SitePage.collection.updateOne({ slug: GM_AFFILIATION_TERMS_SLUG }, { $set: { version: "6" } });
    const live = await actionTermsRequest();
    expect(live.status).toBe(200);
    expect((await live.json()).terms).toMatchObject({ version: "6" });
  });

  it("the acceptance route records GM consent through the service and returns the id", async () => {
    await seedGmPage();
    sessionUser.current = player;
    expect((await acceptanceRequest({ slug: GM_AFFILIATION_TERMS_SLUG })).status).toBe(400);

    const ok = await acceptanceRequest({ slug: GM_AFFILIATION_TERMS_SLUG, context: { gameMasterId: GM_1 } });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body).toMatchObject({ success: true, termsVersion: "1" });
    expect(await joinGm(body.acceptanceId)).toMatchObject({ success: true, created: true });
  });

  it("the acceptance route refuses GM consent while the page is unavailable", async () => {
    sessionUser.current = player;
    const r = await acceptanceRequest({ slug: GM_AFFILIATION_TERMS_SLUG, context: { gameMasterId: GM_1 } });
    expect(r.status).toBe(409);
    expect(await TermsAcceptance.countDocuments({})).toBe(0);
  });
});
