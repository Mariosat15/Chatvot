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
import { readReferredPlayers, type ReferredPlayerRow } from "@/lib/services/gamemaster/referral-read-model";
import {
  toGameMasterReferralView,
  CONTACT_HIDDEN_NOTE,
  REFERRAL_CONSENT_LABELS,
} from "@/lib/services/gamemaster/gm-referral-view";
import { ADMIN_CONSENT_LABELS } from "../../apps/admin/lib/admin/admin-terms-reminder-view";

/**
 * Task 5 (1 Oct 2026) - the Game Master's own affiliate area (`External game plans/24` s1 D6).
 *
 * Pins: a Game Master sees a player's email only when that player accepted the affiliation
 * terms; the hidden email cannot be recovered by searching for it; both Game Master routes read
 * the shared model through the one view mapper, scoped to the session user, with no spread of a
 * raw row and no error text in a 500; and the screens label own/external from the shared map.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const GM = "aaaaaaaaaaaaaaaaaaaaaaaa";
const NOW = new Date("2026-10-01T12:00:00Z");
const db = () => mongoose.connection.db!;
let seq = 0;
const uid = () => (++seq).toString(16).padStart(24, "c");

async function referral(overrides: Record<string, unknown> = {}) {
  const row = {
    userId: uid(),
    userEmail: `p${seq}@x.test`,
    userName: `Player ${seq}`,
    gameMasterId: GM,
    gameMasterEmail: "gm@x.test",
    referralCode: "CODE",
    referredAt: new Date(NOW.getTime() - 10 * 86_400_000),
    isActive: true,
    signupIP: "10.0.0.1",
    signupUserAgent: "Secret Browser",
    ...overrides,
  };
  await db().collection("userreferrals").insertOne(row);
  return row;
}

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

const PAGE = { page: 1, limit: 25 };
// Reason: the stricter package setting; these rows are own/unclassified, so it masks nothing
// and the D6 assertions below are unaffected by the switch.
const MASKED = { showExternalDetails: false };

describe("toGameMasterReferralView - contact only with consent (D6)", () => {
  it("withholds the email when no acceptance is recorded", async () => {
    await referral();
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    const view = toGameMasterReferralView(report.rows[0], MASKED);
    expect(view.userEmail).toBeNull();
    expect(view.contactHidden).toBe(true);
    expect(view.termsAccepted).toBe(false);
  });

  it("shows the email once the player accepted the terms", async () => {
    const row = await referral({ termsAcceptanceId: "acc-1" });
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    const view = toGameMasterReferralView(report.rows[0], MASKED);
    expect(view.userEmail).toBe(row.userEmail);
    expect(view.contactHidden).toBe(false);
  });

  // Reason: the consent was to THIS affiliation. An ended or moved referral stays on the old
  // Game Master's history but must not keep handing them the player's email (s5.6).
  it("an accepted referral that has ended hides the email and still reads accepted", async () => {
    await referral({ termsAcceptanceId: "acc-3", isActive: false, endedAt: NOW });
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    const view = toGameMasterReferralView(report.rows[0], MASKED);
    expect(view.userEmail).toBeNull();
    expect(view.contactHidden).toBe(true);
    expect(view.consent).toBe("accepted");
  });

  it("an empty acceptance id is not consent", () => {
    const view = toGameMasterReferralView({
      termsAccepted: "" as unknown as boolean,
      userEmail: "x@y.test",
    } as ReferredPlayerRow, MASKED);
    expect(view.userEmail).toBeNull();
  });

  // Reason: whole-key assertion - a field nobody asked about is how a leak arrives.
  it("the view carries exactly its declared fields and no tracking data", async () => {
    await referral();
    const report = await readReferredPlayers(db(), { gameMasterIds: [GM] }, PAGE, NOW);
    const keys = Object.keys(toGameMasterReferralView(report.rows[0], MASKED)).sort();
    expect(keys).toEqual(
      [
        // Reason: `country` and `canSendTerms` added 1 Oct 2026 (owner); `phone` deliberately
        // absent - it is contact data and never reaches a Game Master screen. `consent` and
        // `termsSent` added 1 Oct 2026 (s5.6): the Accepted / Pending / Declined badge and the
        // once-only SEND TERMS state - neither is contact data.
        "consent", "termsSent",
        "referralId", "userId", "userName", "userEmail", "contactHidden", "contactMasked", "termsAccepted",
        "country", "canSendTerms", "kind", "surface", "joinedAt", "endedAt", "isCurrent", "isActive", "lastActivityAt",
        "competitionsEntered", "challengesEntered", "entryFees", "earned", "paid", "pending",
      ].sort(),
    );
  });

  // Reason: two copies of one label set (the admin app cannot import the player module), so the
  // Game Master and the admin would otherwise read the same referral under different words.
  it("the Game Master and admin consent labels agree", () => {
    expect([...REFERRAL_CONSENT_LABELS]).toEqual([...ADMIN_CONSENT_LABELS]);
  });

  it("the hidden-contact note names the reason", () => {
    expect(CONTACT_HIDDEN_NOTE).toMatch(/accepted the Game Master affiliation terms/);
  });
});

describe("a hidden email cannot be found by searching for it", () => {
  it("contactRequiresConsent stops email search matching an unconsented player", async () => {
    await referral({ userEmail: "hidden@x.test" });
    const scoped = await readReferredPlayers(
      db(),
      { gameMasterIds: [GM], search: "hidden@x", contactRequiresConsent: true },
      PAGE,
      NOW,
    );
    expect(scoped.total).toBe(0);
  });

  it("the admin report (no flag) still finds them by email", async () => {
    await referral({ userEmail: "hidden@x.test" });
    const admin = await readReferredPlayers(
      db(),
      { gameMasterIds: [GM], search: "hidden@x" },
      PAGE,
      NOW,
    );
    expect(admin.total).toBe(1);
  });

  it("a consented player is still found by email under the flag", async () => {
    await referral({ userEmail: "shown@x.test", termsAcceptanceId: "acc-2" });
    const scoped = await readReferredPlayers(
      db(),
      { gameMasterIds: [GM], search: "shown@x", contactRequiresConsent: true },
      PAGE,
      NOW,
    );
    expect(scoped.total).toBe(1);
  });

  it("an accepted but ended referral cannot be found by email under the flag", async () => {
    await referral({ userEmail: "gone@x.test", termsAcceptanceId: "acc-4", isActive: false, endedAt: NOW });
    const scoped = await readReferredPlayers(
      db(),
      { gameMasterIds: [GM], search: "gone@x", contactRequiresConsent: true },
      PAGE,
      NOW,
    );
    expect(scoped.total).toBe(0);
  });

  it("name search is unaffected by the flag", async () => {
    await referral({ userName: "Zed Hidden" });
    const scoped = await readReferredPlayers(
      db(),
      { gameMasterIds: [GM], search: "Zed", contactRequiresConsent: true },
      PAGE,
      NOW,
    );
    expect(scoped.total).toBe(1);
  });
});

describe("the Game Master routes are scoped and redacted", () => {
  const ROUTES = [
    "app/api/gamemaster/referrals/route.ts",
    "app/api/gamemaster/dashboard/route.ts",
  ] as const;

  it.each(ROUTES)("%s maps rows through the view", (path) => {
    const src = stripComments(read(path));
    // Reason: flipped 1 Oct 2026 - the claim is unchanged (every row goes through the one
    // mapper) and the call now passes the package switch; a bare `.map(fn)` would hand the
    // array index to the options argument.
    // Reason (s5.6): the consent state now rides along too, keyed by the row's own referral id.
    expect(src).toMatch(
      // Reason (Oct 2026): and the row's OWN username, looked up by its own userId.
      /\.map\(\(row\)\s*=>\s*toGameMasterReferralView\(row,\s*\{\s*showExternalDetails,\s*consentState:\s*consent\.get\(row\.referralId\),\s*publicName:\s*\w+\.get\(row\.userId\)\?\.publicName,?\s*\}\)/,
    );
    expect(src).not.toMatch(/\.map\(toGameMasterReferralView\)/);
    expect(src).not.toMatch(/userEmail\s*:/);
  });

  it.each(ROUTES)("%s scopes to the session user with consent search", (path) => {
    const src = stripComments(read(path));
    expect(src).toMatch(
      /gameMasterIds:\s*\[userId\],\s*contactRequiresConsent:\s*true,\s*maskExternalContact:\s*!showExternalDetails/,
    );
  });

  it.each(ROUTES)("%s returns a generic 500", (path) => {
    const src = stripComments(read(path));
    expect(src).toMatch(/Something went wrong\. Please contact support\./);
    expect(src).not.toMatch(/error\.message/);
  });

  // Reason: the scope must be spread AFTER the parsed filter, or a `gameMasterId` in the query
  // string replaces the session user and one Game Master reads another's players.
  it("the referrals route spreads the scope last", () => {
    const src = stripComments(read("app/api/gamemaster/referrals/route.ts"));
    expect(src).toMatch(/\{\s*\.\.\.filter,\s*\.\.\.scope\s*\}/);
  });
});

describe("the Game Master screens label own and external from the shared map", () => {
  it("the badge component reads REFERRAL_KIND_LABELS", () => {
    const src = stripComments(read("components/gamemaster/GmReferralBadges.tsx"));
    expect(src).toMatch(/REFERRAL_KIND_LABELS\[referral\.kind\]/);
    expect(src).not.toMatch(/"Own referral"|"External"/);
  });

  it.each([
    "app/(root)/gamemaster/gamemaster-dashboard-tabs.tsx",
    "app/(root)/gamemaster/referrals/page.tsx",
  ])("%s renders the kind badge and the redacted contact", (path) => {
    const src = stripComments(read(path));
    expect(src).toMatch(/<ReferralKindBadge referral=/);
    expect(src).toMatch(/<ReferralContact referral=/);
  });

  it("an ended affiliation reads Ended, not Inactive", () => {
    // Reason: the claim is unchanged; since 1 Oct 2026 the word lives in the shared
    // describeAffiliationState so the admin report and this badge cannot disagree again.
    const src = stripComments(read("components/gamemaster/GmReferralBadges.tsx"));
    expect(src).toMatch(/describeAffiliationState\(referral\)/);
    const shared = stripComments(read("lib/services/gamemaster/referral-kind.ts"));
    expect(shared).toMatch(/if \(!row\.isCurrent\) return "Ended";/);
  });
});
