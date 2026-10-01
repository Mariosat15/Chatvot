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

/**
 * R121 (owner report, 1 Oct 2026): a player detached by an admin showed as Ended on the GM and
 * admin pages, yet could open and enter that Game Master's private contest - and the lobby
 * offered no Join GM button.
 *
 * Cause: private-contest access asked `getAffiliation`, the EARNINGS question, which counts an
 * active row with no accepted terms (an admin move carries none over, D6), the user-document
 * fallback, and a Game Master who has expired. The GM and admin pages show only accepted
 * links. And for such a player the gate decided "already your GM" and offered nothing.
 *
 * These tests pin the three halves: membership (view), the gate's Join GM offer, and Join GM
 * recording the acceptance onto the existing row so the button actually admits the player.
 */

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose,
  default: async () => mongoose,
}));

vi.mock("@/lib/services/gamemaster/gm-terms.service", () => ({
  verifyGmTermsAcceptance: async ({ acceptanceId }: { acceptanceId?: string }) =>
    acceptanceId === "consent-ok"
      ? { ok: true, termsAcceptanceId: "consent-ok", termsSlug: "terms-gamemaster-affiliation", termsVersion: "v1" }
      : { ok: false, code: "terms_not_accepted", message: "Please accept the Game Master terms to continue." },
}));

import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import UserReferral from "@/database/models/user-referral.model";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { canViewContestById } from "@/lib/services/gamemaster/private-contest-access.service";
import { getPrivateContestGate } from "@/lib/services/gamemaster/private-contest-gate.service";
import { resolveContestViewer } from "@/lib/services/gamemaster/contest-viewer.service";
import { affiliate } from "@/lib/services/gamemaster/affiliation.service";
import { privateContestInvitation } from "@/lib/utils/private-contest-card-copy";

const GM = "64e0000000000000000000a1";
const OTHER_GM = "64e0000000000000000000a2";
const PLAYER = "64e000000000000000000001";
const player = { id: PLAYER, email: "p@player.test", name: "Player" };
const db = () => mongoose.connection.db!;

async function seedGm(userId: string, over: Record<string, unknown> = {}): Promise<string> {
  const now = new Date();
  const res = await GameMasterSubscription.collection.insertOne({
    userId,
    userEmail: `${userId.slice(-2)}@gm.test`,
    userName: "Martha Lambrianou",
    packageId: "pkg",
    packageName: "Pro",
    status: "active",
    activatedAt: now,
    startDate: now,
    endDate: now,
    nextRenewalDate: now,
    autoRenew: true,
    renewalPrice: 10,
    referralCode: `RC${userId.slice(-2)}`,
    limits: { referralFeePercentage: 5, canCreateCompetitions: true },
    isPaused: false,
    scheduledForDeletion: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  });
  return String(res.insertedId);
}

async function seedContest(): Promise<string> {
  const id = new ObjectId();
  await Competition.collection.insertOne({
    _id: id,
    slug: `c-${id}`,
    name: "Private",
    status: "upcoming",
    entryFee: 10,
    startTime: new Date(Date.now() + 3_600_000),
    endTime: new Date(Date.now() + 7_200_000),
    gameMasterId: GM,
    visibility: "gm_private",
  });
  return String(id);
}

const row = (over: Record<string, unknown> = {}) =>
  UserReferral.collection.insertOne({
    userId: PLAYER,
    gameMasterId: GM,
    referralCode: "RCa1",
    isActive: true,
    source: "admin_assigned",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

describe("R121 - private-contest membership requires accepted Affiliate Terms", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "userreferrals",
      "gamemastersubscriptions",
      "user",
      "whitelabels",
      "customer_audit_trail",
      Competition.collection.name,
      CompetitionParticipant.collection.name,
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    await WhiteLabel.collection.insertOne({ gmJoinEnabled: true });
    await db().collection("user").insertOne({ _id: new ObjectId(PLAYER), email: player.email });
  });

  describe("who may VIEW the contest", () => {
    it("refuses a moved row with no accepted terms, and the list does not mark it member", async () => {
      await seedGm(GM);
      const id = await seedContest();
      await row();
      expect(await canViewContestById(id, PLAYER)).toBe(false);
      expect((await resolveContestViewer(PLAYER))?.affiliatedGameMasterId).toBeNull();
    });

    it("refuses a player known only to the user-document fallback", async () => {
      await seedGm(GM);
      const id = await seedContest();
      await db().collection("user").updateOne({ _id: new ObjectId(PLAYER) }, { $set: { referredByGameMasterId: GM } });
      expect(await canViewContestById(id, PLAYER)).toBe(false);
    });

    it("refuses an accepted member once their Game Master has expired (D4)", async () => {
      await seedGm(GM, { status: "expired" });
      const id = await seedContest();
      await row({ termsAcceptanceId: "accepted-1" });
      expect(await canViewContestById(id, PLAYER)).toBe(false);
    });

    it("admits an accepted member of an active Game Master, and the list marks them member", async () => {
      await seedGm(GM);
      const id = await seedContest();
      await row({ termsAcceptanceId: "accepted-1" });
      expect(await canViewContestById(id, PLAYER)).toBe(true);
      expect((await resolveContestViewer(PLAYER))?.affiliatedGameMasterId).toBe(GM);
    });
  });

  describe("the gate offers Join GM instead of nothing", () => {
    it("offers Join GM to a player whose row to THIS Game Master has no accepted terms", async () => {
      const subId = await seedGm(GM);
      await row();
      const gate = await getPrivateContestGate({ gameMasterId: GM, viewerUserId: PLAYER });
      expect(gate.state).toBe("joinable");
      expect(gate.subscriptionId).toBe(subId);
    });

    it("offers Join GM to a fallback-only player (no active row)", async () => {
      await seedGm(GM);
      await db().collection("user").updateOne({ _id: new ObjectId(PLAYER) }, { $set: { referredByGameMasterId: GM } });
      expect((await getPrivateContestGate({ gameMasterId: GM, viewerUserId: PLAYER })).state).toBe("joinable");
    });

    it("offers Join GM to a player whose previous Game Master expired (D4)", async () => {
      await seedGm(GM);
      await seedGm(OTHER_GM, { status: "expired", referralCode: "RCOLD" });
      await row({ gameMasterId: OTHER_GM, termsAcceptanceId: "accepted-1" });
      expect((await getPrivateContestGate({ gameMasterId: GM, viewerUserId: PLAYER })).state).toBe("joinable");
    });

    it("does not offer Join GM for an unaccepted row when the Game Master is paused (D7)", async () => {
      await seedGm(GM, { isPaused: true });
      await row();
      expect((await getPrivateContestGate({ gameMasterId: GM, viewerUserId: PLAYER })).state).toBe("unavailable");
    });
  });

  describe("pressing Join GM admits the player", () => {
    it("stamps the verified acceptance onto the existing unaccepted row and opens the contest", async () => {
      const subId = await seedGm(GM);
      const id = await seedContest();
      await row();
      const result = await affiliate({
        user: player,
        gameMaster: { subscriptionId: subId },
        channel: "chartvolt_join_gm",
        termsAcceptanceId: "consent-ok",
      });
      expect(result).toMatchObject({ success: true, created: false, alreadyAffiliated: true });
      const rows = await UserReferral.collection.find({ userId: PLAYER }).toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ isActive: true, termsAcceptanceId: "consent-ok", termsVersion: "v1" });
      expect(await canViewContestById(id, PLAYER)).toBe(true);
    });

    it("refuses an unverified acceptance and leaves the row unaccepted", async () => {
      const subId = await seedGm(GM);
      await row();
      const result = await affiliate({
        user: player,
        gameMaster: { subscriptionId: subId },
        channel: "chartvolt_join_gm",
        termsAcceptanceId: "forged",
      });
      expect(result).toMatchObject({ success: false, code: "terms_not_accepted" });
      const stored = await UserReferral.collection.findOne({ userId: PLAYER });
      expect(stored?.termsAcceptanceId).toBeUndefined();
    });
  });

  describe("the lobby wording (owner text, 1 Oct 2026)", () => {
    it("names the host in full and the surname in the second sentence", () => {
      const copy = privateContestInvitation("Martha Lambrianou");
      expect(copy.title).toBe("Want to join this private competition?");
      expect(copy.body).toBe(
        "This competition is hosted by Martha Lambrianou and is only open to players who have joined this Game Master as a referral.",
      );
      expect(copy.notLinked).toBe(
        "Not linked to Lambrianou yet? No problem — press Join GM, accept the Affiliate Terms, and you'll be able to enter this competition and future private competitions hosted by this Game Master.",
      );
    });

    it("never renders undefined when the name is missing", () => {
      const copy = privateContestInvitation(undefined);
      expect(`${copy.body} ${copy.notLinked}`).not.toMatch(/undefined/);
      expect(copy.notLinked).toMatch(/^Not linked to this Game Master yet\?/);
    });

    it("shows the Join GM sentence only when the gate offers the button", () => {
      const src = readFileSync("components/gamemaster/PrivateContestGate.tsx", "utf8");
      expect(src).toMatch(/gate\.state === "joinable" && \(\s*<p[^>]*>\{invitation\.notLinked\}<\/p>/);
      expect(src.match(/invitation\.notLinked/g)).toHaveLength(1);
      expect(src).not.toMatch(/can enter this competition or see its leaderboard/);
    });
  });
});
