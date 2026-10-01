import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import { readReferredPlayers } from "@/lib/services/gamemaster/referral-read-model";
import {
  toGameMasterReferralView,
  maskLastName,
  MASKED_CONTACT,
  CONTACT_MASKED_NOTE,
} from "@/lib/services/gamemaster/gm-referral-view";
import {
  buildSubscriptionLimits,
  resolveShowExternalReferralDetails,
} from "@/lib/services/gamemaster/subscription-limits";

/**
 * R120 (1 Oct 2026) - the Game Master package switch "Show external referral details".
 *
 * Pins: off is the default and masks an EXTERNAL referral's email and last name as
 * `**********` while the full client id stays visible; on shows full details; own referrals are
 * never masked; D6 (no consent, no email) still applies on top; the current package decides
 * with the cached limits as the fallback and only `=== true` reveals; a GM search cannot find
 * a masked row by what the screen hides; both GM routes read the switch from the session's
 * package; the admin route validates, syncs and audits it; the editor offers the toggle.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const GM = "bbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = new Date("2026-10-01T12:00:00Z");
const PAGE = { page: 1, limit: 25 };
const db = () => mongoose.connection.db!;
let seq = 0;
const uid = () => (++seq).toString(16).padStart(24, "d");

async function referral(overrides: Record<string, unknown> = {}) {
  const row = {
    userId: uid(),
    userEmail: `jane${seq}@x.test`,
    userName: "Jane Smith",
    gameMasterId: GM,
    gameMasterEmail: "gm@x.test",
    referralCode: "CODE",
    referredAt: new Date(NOW.getTime() - 5 * 86_400_000),
    isActive: true,
    termsAcceptanceId: "acc-1",
    source: "chartvolt_join_gm",
    ...overrides,
  };
  await db().collection("userreferrals").insertOne(row);
  return row;
}

const gmFilter = (search: string, mask: boolean) => ({
  gameMasterIds: [GM],
  search,
  contactRequiresConsent: true,
  maskExternalContact: mask,
});

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "userreferrals",
    "competitionparticipants",
    "challengeparticipants",
    "gamemasterearnings",
  ]);
}, 60_000);
afterAll(async () => stopTestMongo());
beforeEach(async () => clearTestMongo());

describe("resolveShowExternalReferralDetails - current package first, only true reveals", () => {
  it("absent everywhere masks (the default is off)", () => {
    expect(resolveShowExternalReferralDetails({ packageConfig: {}, cachedLimits: {} })).toBe(false);
    expect(resolveShowExternalReferralDetails({ packageConfig: null, cachedLimits: null })).toBe(false);
  });

  it("the current package decides over a stale cache in both directions", () => {
    expect(
      resolveShowExternalReferralDetails({
        packageConfig: { showExternalReferralDetails: false },
        cachedLimits: { showExternalReferralDetails: true },
      }),
    ).toBe(false);
    expect(
      resolveShowExternalReferralDetails({
        packageConfig: { showExternalReferralDetails: true },
        cachedLimits: { showExternalReferralDetails: false },
      }),
    ).toBe(true);
  });

  it("a deleted package falls back to the cached limits", () => {
    expect(
      resolveShowExternalReferralDetails({ packageConfig: null, cachedLimits: { showExternalReferralDetails: true } }),
    ).toBe(true);
  });

  it("a string 'true' is not true", () => {
    expect(
      resolveShowExternalReferralDetails({ packageConfig: { showExternalReferralDetails: "true" }, cachedLimits: null }),
    ).toBe(false);
  });

  it("buildSubscriptionLimits caches the switch opt-in", () => {
    expect(buildSubscriptionLimits({}).showExternalReferralDetails).toBe(false);
    expect(buildSubscriptionLimits({ showExternalReferralDetails: true }).showExternalReferralDetails).toBe(true);
  });
});

describe("maskLastName", () => {
  it("keeps the first word and masks the rest", () => {
    expect(maskLastName("Jane Smith")).toBe(`Jane ${MASKED_CONTACT}`);
    expect(maskLastName("Jane Ann Smith")).toBe(`Jane ${MASKED_CONTACT}`);
  });

  it("a one-word name has no last name to hide", () => {
    expect(maskLastName("Jane")).toBe("Jane");
  });

  it("a name holding an email is masked whole", () => {
    expect(maskLastName("jane@x.test")).toBe(MASKED_CONTACT);
  });

  it("null stays null", () => {
    expect(maskLastName(null)).toBeNull();
  });
});

describe("the view masks external referrals only", () => {
  it("off: an external referral shows the id, the first name and a masked email", async () => {
    const row = await referral();
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    const view = toGameMasterReferralView(report.rows[0], { showExternalDetails: false });
    expect(view.userId).toBe(row.userId);
    expect(view.userName).toBe(`Jane ${MASKED_CONTACT}`);
    expect(view.userEmail).toBe(MASKED_CONTACT);
    expect(view.contactMasked).toBe(true);
    expect(view.contactHidden).toBe(false);
  });

  it("on: an external referral shows full details", async () => {
    const row = await referral();
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    const view = toGameMasterReferralView(report.rows[0], { showExternalDetails: true });
    expect(view.userName).toBe("Jane Smith");
    expect(view.userEmail).toBe(row.userEmail);
    expect(view.contactMasked).toBe(false);
  });

  it("an admin move is external and is masked too", async () => {
    await referral({ source: "admin_assigned" });
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    expect(toGameMasterReferralView(report.rows[0], { showExternalDetails: false }).userEmail).toBe(MASKED_CONTACT);
  });

  it("an own referral is never masked by the switch", async () => {
    const row = await referral({ source: "gm_referral_link" });
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    const view = toGameMasterReferralView(report.rows[0], { showExternalDetails: false });
    expect(view.userName).toBe("Jane Smith");
    expect(view.userEmail).toBe(row.userEmail);
    expect(view.contactMasked).toBe(false);
  });

  it("D6 still applies on top: no consent means no email even when on", async () => {
    await referral({ termsAcceptanceId: undefined });
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    const view = toGameMasterReferralView(report.rows[0], { showExternalDetails: true });
    expect(view.userEmail).toBeNull();
    expect(view.contactHidden).toBe(true);
    expect(view.contactMasked).toBe(false);
  });

  it("the masked note names what stays visible", () => {
    expect(CONTACT_MASKED_NOTE).toMatch(/client id/);
  });
});

describe("a masked external row cannot be found by what the screen hides", () => {
  it("by email: not found masked, found when shown", async () => {
    await referral({ userEmail: "secret@x.test" });
    expect((await readReferredPlayers(db(), gmFilter("secret@x", true), PAGE, NOW)).total).toBe(0);
    expect((await readReferredPlayers(db(), gmFilter("secret@x", false), PAGE, NOW)).total).toBe(1);
  });

  it("by last name: not found masked", async () => {
    await referral();
    expect((await readReferredPlayers(db(), gmFilter("Smith", true), PAGE, NOW)).total).toBe(0);
  });

  it("a full-name query cannot reach the second word", async () => {
    await referral();
    expect((await readReferredPlayers(db(), gmFilter("Jane Smith", true), PAGE, NOW)).total).toBe(0);
  });

  it("by first name prefix: found", async () => {
    await referral();
    expect((await readReferredPlayers(db(), gmFilter("Jan", true), PAGE, NOW)).total).toBe(1);
  });

  it("a name holding an email cannot be searched while masked", async () => {
    await referral({ userName: "secret@x.test" });
    expect((await readReferredPlayers(db(), gmFilter("secret", true), PAGE, NOW)).total).toBe(0);
  });

  it("by exact client id: found", async () => {
    const row = await referral();
    expect((await readReferredPlayers(db(), gmFilter(row.userId, true), PAGE, NOW)).total).toBe(1);
  });

  it("an own referral is still searchable by email and last name while masking", async () => {
    await referral({ source: "gm_referral_link", userEmail: "mine@x.test" });
    expect((await readReferredPlayers(db(), gmFilter("mine@x", true), PAGE, NOW)).total).toBe(1);
    expect((await readReferredPlayers(db(), gmFilter("Smith", true), PAGE, NOW)).total).toBe(1);
  });

  it("the admin report (no flags) still finds an external player by last name", async () => {
    await referral();
    const admin = await readReferredPlayers(db(), { gameMasterIds: [GM], search: "Smith" }, PAGE, NOW);
    expect(admin.total).toBe(1);
  });
});

describe("wiring", () => {
  const ROUTES = [
    "app/api/gamemaster/referrals/route.ts",
    "app/api/gamemaster/dashboard/route.ts",
  ] as const;

  it.each(ROUTES)("%s resolves the switch from the session's subscription", (path) => {
    const src = stripComments(read(path));
    expect(src).toMatch(/resolveShowExternalReferralDetails\(\{[\s\S]*?cachedLimits:\s*subscription\.limits/);
    expect(src).not.toMatch(/searchParams\.get\(["']showExternal/);
  });

  it("the query parser never reads the mask flag", () => {
    const src = stripComments(read("lib/services/gamemaster/referral-report-filter.ts"));
    expect(src).not.toMatch(/maskExternalContact\s*[:=]\s*params/);
    expect(src).not.toMatch(/get\(["']maskExternalContact/);
  });

  it("the admin route refuses a non-boolean on POST and PUT", () => {
    const src = stripComments(read("apps/admin/app/api/marketplace/route.ts"));
    expect(src.match(/!isOptionalBoolean\([^)]*showExternalReferralDetails\)/g)).toHaveLength(2);
    expect(src).toMatch(/return value === undefined \|\| typeof value === "boolean";/);
  });

  it("the admin route syncs the cache and audits the change", () => {
    const src = stripComments(read("apps/admin/app/api/marketplace/route.ts"));
    expect(src).toMatch(/limitsUpdate\["limits\.showExternalReferralDetails"\]\s*=\s*gmConfig\.showExternalReferralDetails/);
    expect(src).toMatch(/showExternalReferralDetails:\s*externalDetailsChange/);
  });

  it("both model copies declare the field with no default", () => {
    for (const p of [
      "database/models/marketplace/marketplace-item.model.ts",
      "apps/admin/database/models/marketplace/marketplace-item.model.ts",
    ]) {
      expect(stripComments(read(p))).toMatch(/showExternalReferralDetails:\s*\{\s*type:\s*Boolean\s*\}/);
    }
  });

  it("the package editor offers the toggle", () => {
    const src = stripComments(read("apps/admin/components/admin/MarketplaceSection.tsx"));
    expect(src).toMatch(/<ExternalReferralDetailsToggle/);
    expect(src).toMatch(/showExternalReferralDetails:\s*next/);
  });

  it("the toggle reads absent as off", () => {
    const src = stripComments(read("apps/admin/components/admin/gamemaster/ExternalReferralDetailsToggle.tsx"));
    expect(src).toMatch(/const on = value === true;/);
  });

  it.each([
    "app/(root)/gamemaster/gamemaster-dashboard-tabs.tsx",
    "app/(root)/gamemaster/referrals/page.tsx",
  ])("%s shows the client id", (path) => {
    expect(stripComments(read(path))).toMatch(/<ReferralClientId referral=/);
  });

  it("the contact component renders the masked branch", () => {
    const src = stripComments(read("components/gamemaster/GmReferralBadges.tsx"));
    expect(src).toMatch(/if \(referral\.contactMasked\)/);
    expect(src).toMatch(/title=\{CONTACT_MASKED_NOTE\}/);
  });
});
