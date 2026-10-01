import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
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

import UserReferral from "../../apps/admin/database/models/user-referral.model";
import {
  moveAffiliation,
  detachAffiliation,
} from "../../apps/admin/lib/services/gamemaster/admin-affiliation.service";
import { readReferredPlayers } from "@/lib/services/gamemaster/referral-read-model";
import { parseReferredPlayersQuery } from "@/lib/services/gamemaster/referral-report-filter";
import { describeAffiliationState, describeEndedReason } from "@/lib/services/gamemaster/referral-kind";
import { toGameMasterReferralView } from "@/lib/services/gamemaster/gm-referral-view";

/**
 * Owner report, 1 Oct 2026: a player detached from a Game Master and then rejoined the same
 * Game Master from a competition appeared TWICE on the admin report (one ended, one current)
 * and read "inactive" there while the Game Master's own dashboard said "active".
 *
 * Pins: one row per (player, Game Master) with every stint summed; status filters judge the
 * row shown, not the raw history; an admin move is windowed from the move, so the new Game
 * Master is not credited with contests played under the old one; and "inactive" is not a word
 * either screen uses for "no recent play". Move and detach run through the REAL admin service.
 */

const PLAYER = "64c000000000000000000011";
const GM_1 = "64c0000000000000000000b1";
const GM_2 = "64c0000000000000000000b2";
const ACTOR = { id: "64c0000000000000000000f1", email: "ops@chartvolt.test", name: "Ops", role: "admin" };
const REASON = "Owner test of detach and rejoin";
const DAY = 86_400_000;

const db = () => mongoose.connection.db!;
const q = (extra: Record<string, string> = {}) => parseReferredPlayersQuery(new URLSearchParams(extra));
const report = (extra: Record<string, string> = {}, gm?: string) => {
  const { filter, paging } = q(extra);
  return readReferredPlayers(db(), gm ? { ...filter, gameMasterIds: [gm] } : filter, paging, new Date());
};
const at = (msAgo: number) => new Date(Date.now() - msAgo);

function subscription(userId: string, referralCode: string) {
  return {
    _id: new ObjectId(),
    userId,
    userEmail: `${referralCode.toLowerCase()}@gm.test`,
    referralCode,
    status: "active",
    isPaused: false,
    scheduledForDeletion: false,
    totalReferredUsers: 0,
    activeReferredUsers: 0,
    updatedAt: new Date(),
  };
}

/** The first stint: a Join GM from a private competition, with consent, 20 days ago. */
async function seedFirstStint() {
  const s1 = subscription(GM_1, "GMONE");
  const s2 = subscription(GM_2, "GMTWO");
  await db().collection("gamemastersubscriptions").insertMany([s1, s2]);
  await db().collection("user").insertOne({
    _id: new ObjectId(PLAYER),
    email: "support@chartvolt.test",
    name: "Antreas",
    referredByGameMasterId: GM_1,
    referredByReferralCode: "GMONE",
  });
  await db().collection("userreferrals").insertOne(joinGmRow(GM_1, "GMONE", at(20 * DAY), "t-1"));
  return { s1, s2 };
}

/** Exactly the shape `affiliate()` writes for a Join GM from a private competition. */
function joinGmRow(gameMasterId: string, referralCode: string, referredAt: Date, termsAcceptanceId?: string) {
  return {
    userId: PLAYER,
    userEmail: "support@chartvolt.test",
    userName: "Antreas",
    gameMasterId,
    gameMasterEmail: `${referralCode.toLowerCase()}@gm.test`,
    referralCode,
    referredAt,
    isActive: true,
    source: "chartvolt_join_gm",
    affiliatedVia: { surface: "private_contest", competitionId: "comp-1" },
    ...(termsAcceptanceId ? { termsAcceptanceId, termsAcceptedAt: referredAt } : {}),
  };
}

const seat = (enteredAt: Date, competitionId: string) =>
  db().collection("competitionparticipants").insertOne({ userId: PLAYER, competitionId, enteredAt });
const earning = (gameMasterId: string, createdAt: Date, netEarning: number) =>
  db().collection("gamemasterearnings").insertOne({
    gameMasterId,
    referredUserId: PLAYER,
    entryFeeAmount: netEarning * 10,
    netEarning,
    status: "pending",
    createdAt,
  });

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "userreferrals",
    "gamemastersubscriptions",
    "user",
    "customer_audit_trail",
    "competitionparticipants",
    "challengeparticipants",
    "gamemasterearnings",
  ]);
  await UserReferral.init();
}, 60_000);
afterAll(async () => stopTestMongo());
beforeEach(async () => clearTestMongo());

describe("detach then rejoin the SAME Game Master", () => {
  async function detachAndRejoin() {
    const subs = await seedFirstStint();
    await seat(at(15 * DAY), "c-first");
    await earning(GM_1, at(15 * DAY), 4);
    const detached = await detachAffiliation({ userId: PLAYER, reason: REASON, actor: ACTOR });
    expect(detached.success).toBe(true);
    // Reason: the detach really happens BEFORE the rejoin; backdate it so the stints do not overlap.
    await db().collection("userreferrals").updateOne(
      { userId: PLAYER, isActive: false },
      { $set: { endedAt: at(3 * DAY) } },
    );
    await db().collection("userreferrals").insertOne(joinGmRow(GM_1, "GMONE", at(2 * DAY), "t-2"));
    return subs;
  }

  it("the rejoined player is one current row with both stints summed", async () => {
    await detachAndRejoin();
    await seat(at(1 * DAY), "c-second");
    await earning(GM_1, at(1 * DAY), 6);
    const r = await report();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      userId: PLAYER,
      gameMasterId: GM_1,
      isCurrent: true,
      isActive: true,
      affiliations: 2,
      competitionsEntered: 2,
      earned: 10,
      endedAt: null,
    });
    expect(r.summary.all).toMatchObject({ players: 1, current: 1, active: 1, earned: 10 });
  });

  it("the gap between stints is not counted", async () => {
    await detachAndRejoin();
    // Detached on day 0 of this test, rejoined 2 days ago: a seat 3 days ago is in neither stint.
    await db().collection("userreferrals").updateOne(
      { userId: PLAYER, isActive: false },
      { $set: { endedAt: at(5 * DAY) } },
    );
    await seat(at(3 * DAY), "c-gap");
    await earning(GM_1, at(3 * DAY), 99);
    const [row] = (await report()).rows;
    expect(row).toMatchObject({ competitionsEntered: 1, earned: 4 });
  });

  it("the Ended filter does not return a player who has rejoined", async () => {
    await detachAndRejoin();
    expect((await report({ status: "ended" })).rows).toHaveLength(0);
    expect((await report({ status: "current" })).rows.map((x) => x.userId)).toEqual([PLAYER]);
  });

  it("the Game Master's own view lists the player once, with the current stint's consent", async () => {
    await detachAndRejoin();
    const r = await report({}, GM_1);
    const views = r.rows.map(toGameMasterReferralView);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ isCurrent: true, termsAccepted: true });
  });

  it("a consent-gated email search judges the stint on screen, not an older one", async () => {
    await seedFirstStint();
    await detachAffiliation({ userId: PLAYER, reason: REASON, actor: ACTOR });
    // Rejoined WITHOUT terms this time: the older stint's consent must not answer the search.
    await db().collection("userreferrals").insertOne(joinGmRow(GM_1, "GMONE", at(DAY)));
    const { filter, paging } = q({ search: "support@chartvolt" });
    const scoped = { ...filter, gameMasterIds: [GM_1], contactRequiresConsent: true };
    expect((await readReferredPlayers(db(), scoped, paging, new Date())).rows).toHaveLength(0);
  });
});

describe("admin move to ANOTHER Game Master", () => {
  it("the old Game Master keeps an ended row; the new one is current and starts at the move", async () => {
    const { s2 } = await seedFirstStint();
    await seat(at(10 * DAY), "c-under-gm1");
    const moved = await moveAffiliation({
      userId: PLAYER,
      targetSubscriptionId: String(s2._id),
      reason: REASON,
      actor: ACTOR,
    });
    expect(moved.success).toBe(true);
    await seat(at(0), "c-under-gm2");

    const under1 = (await report({}, GM_1)).rows;
    const under2 = (await report({}, GM_2)).rows;
    expect(under1).toHaveLength(1);
    expect(under1[0]).toMatchObject({ isCurrent: false, endedReason: "admin_reassigned", competitionsEntered: 1 });
    expect(under2).toHaveLength(1);
    // Reason: windowed from the epoch, the new Game Master was credited with c-under-gm1 too.
    expect(under2[0]).toMatchObject({ isCurrent: true, source: "admin_assigned", competitionsEntered: 1 });
    expect(under2[0].termsAccepted).toBe(false);
  });

  it("moved away and back is one row under the original Game Master", async () => {
    const { s1, s2 } = await seedFirstStint();
    await moveAffiliation({ userId: PLAYER, targetSubscriptionId: String(s2._id), reason: REASON, actor: ACTOR });
    await moveAffiliation({ userId: PLAYER, targetSubscriptionId: String(s1._id), reason: REASON, actor: ACTOR });
    const under1 = (await report({}, GM_1)).rows;
    expect(under1).toHaveLength(1);
    expect(under1[0]).toMatchObject({ isCurrent: true, affiliations: 2 });
    const all = await report();
    expect(all.summary.all).toMatchObject({ players: 2, current: 1 });
  });
});

describe("the words for an affiliation's state", () => {
  it("never calls an affiliated player inactive", () => {
    const words = [true, false].flatMap((isCurrent) =>
      [true, false].map((isActive) => describeAffiliationState({ isCurrent, isActive })),
    );
    for (const w of words) expect(w.toLowerCase()).not.toContain("inactive");
    expect(describeAffiliationState({ isCurrent: true, isActive: false })).toBe("Affiliated · no contest in 30 days");
    expect(describeAffiliationState({ isCurrent: false, isActive: false })).toBe("Ended");
  });

  it("both report screens take their state words from the shared function", () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const table = strip(readFileSync("apps/admin/components/admin/gamemaster/GmReportTable.tsx", "utf8"));
    const page = strip(readFileSync("app/(root)/gamemaster/referrals/page.tsx", "utf8"));
    // Reason: counted - the table states both branches, and one hand-written copy is how the
    // two screens drifted into "inactive" against "active" in the first place.
    expect(table.match(/\{describeAffiliationState\(row\)\}/g)).toHaveLength(2);
    expect(page).toMatch(/\{describeAffiliationState\(user\)\}/);
    for (const src of [table, page]) expect(src).not.toMatch(/>\s*Inactive\s*</);
    expect(table).toMatch(/row\.affiliations > 1 &&/);
  });

  it("an end reason is looked up in a Map, never walking the prototype chain", () => {
    expect(describeEndedReason("admin_detached")).toBe("detached by an admin");
    expect(describeEndedReason("__proto__")).toBe("  proto  ");
    expect(describeEndedReason(null)).toBeNull();
  });
});
