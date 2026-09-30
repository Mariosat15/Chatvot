import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
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

import UserReferral from "@/database/models/user-referral.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { affiliate, getAffiliation } from "@/lib/services/gamemaster/affiliation.service";
import {
  decideAffiliation,
  isGameMasterJoinable,
  previousAffiliationEnd,
} from "@/lib/services/gamemaster/affiliation-rules";

/**
 * Gamemaster Program v2, step 2 (`External game plans/24` s3, s9 test 1): the single writer
 * of a player's Game Master affiliation, and sign-up switched over to it.
 *
 * Every refusal is also asserted to have left NOTHING behind - no referral row, no
 * user-document fallback, no counter change - because a refusal that half-wrote is the
 * defect this service exists to remove.
 */

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const PLAYER = "64c000000000000000000001";
const PLAYER_2 = "64c000000000000000000002";
const GM_1 = "64c0000000000000000000a1";
const GM_2 = "64c0000000000000000000a2";

const db = () => mongoose.connection.db!;
const subs = () => GameMasterSubscription.collection;

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
    totalEarnings: 0,
    pendingEarnings: 0,
    totalReferredUsers: 0,
    activeReferredUsers: 0,
    isPaused: false,
    scheduledForDeletion: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

async function seedUser(id: string, email = `${id}@player.test`) {
  await db().collection("user").insertOne({ _id: new ObjectId(id), email, name: "Player" });
}

async function counters(referralCode: string) {
  const s = await subs().findOne({ referralCode });
  return { total: s?.totalReferredUsers, active: s?.activeReferredUsers };
}

async function userFallback(id: string) {
  const u = await db().collection("user").findOne({ _id: new ObjectId(id) });
  return u?.referredByGameMasterId;
}

async function auditRows(action: string) {
  return db().collection("customer_audit_trail").find({ action }).toArray();
}

const viaLink = (userId = PLAYER, referralCode = "GMONE") =>
  affiliate({
    user: { id: userId, email: `${userId}@player.test`, name: "Player" },
    gameMaster: { referralCode },
    channel: "gm_referral_link",
    ipAddress: "10.0.0.1",
    userAgent: "vitest",
  });

describe("affiliation rules (pure)", () => {
  it("the referral link needs only an active subscription; Join GM also refuses paused or leaving", () => {
    const gm = { userId: GM_1, status: "active", isPaused: true };
    expect(isGameMasterJoinable(gm, "gm_referral_link")).toBe(true);
    expect(isGameMasterJoinable(gm, "chartvolt_join_gm")).toBe(false);
    expect(
      isGameMasterJoinable({ userId: GM_1, status: "active", scheduledForDeletion: true }, "chartvolt_join_gm"),
    ).toBe(false);
    for (const status of ["expired", "cancelled", "suspended", undefined]) {
      expect(isGameMasterJoinable({ userId: GM_1, status }, "gm_referral_link")).toBe(false);
    }
  });

  it("only an expired or missing previous Game Master frees the player (D4)", () => {
    expect(previousAffiliationEnd(undefined)).toBe("gm_deleted");
    expect(previousAffiliationEnd({ userId: GM_1, status: "expired" })).toBe("gm_expired");
    for (const status of ["active", "cancelled", "suspended"]) {
      expect(previousAffiliationEnd({ userId: GM_1, status })).toBeNull();
    }
  });

  it("names the other Game Master in the refusal", () => {
    const d = decideAffiliation({
      userId: PLAYER,
      channel: "gm_referral_link",
      gm: { userId: GM_2, status: "active" },
      activeGameMasterId: GM_1,
      activeGameMaster: { userId: GM_1, status: "active", userName: "Alice" },
    });
    expect(d).toMatchObject({ kind: "refuse", code: "already_affiliated_other" });
    expect((d as { message: string }).message).toContain("Alice");
  });

  it("self is refused before an existing link is considered", () => {
    const d = decideAffiliation({
      userId: GM_1,
      channel: "gm_referral_link",
      gm: { userId: GM_1, status: "active" },
      activeGameMasterId: GM_1,
    });
    expect(d).toMatchObject({ kind: "refuse", code: "self" });
  });
});

describe("affiliate() against a real replica set", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections([
      "userreferrals",
      "gamemastersubscriptions",
      "user",
      "customer_audit_trail",
    ]);
    await UserReferral.init();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    await subs().insertOne(subscription(GM_1, "GMONE"));
    await subs().insertOne(subscription(GM_2, "GMTWO"));
    await seedUser(PLAYER);
  });

  it("creates the row, the user fallback and one counter increment, labelled gm_referral_link", async () => {
    const result = await viaLink();
    expect(result).toMatchObject({ success: true, created: true, gameMasterId: GM_1 });

    const rows = await UserReferral.find({ userId: PLAYER }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      gameMasterId: GM_1,
      referralCode: "GMONE",
      isActive: true,
      source: "gm_referral_link",
      affiliatedVia: { surface: "signup" },
      signupIP: "10.0.0.1",
      signupUserAgent: "vitest",
    });
    expect(await userFallback(PLAYER)).toBe(GM_1);
    expect(await counters("GMONE")).toEqual({ total: 1, active: 1 });
    expect(await getAffiliation(PLAYER)).toMatchObject({
      gameMasterId: GM_1,
      fromUserFallback: false,
    });
  });

  it("writes exactly one audit row on creation and none on the idempotent repeat", async () => {
    await viaLink();
    const again = await viaLink();
    expect(again).toMatchObject({ success: true, created: false, alreadyAffiliated: true });
    expect(await counters("GMONE")).toEqual({ total: 1, active: 1 });
    const created = await auditRows("gm_affiliation_created");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      customerId: PLAYER,
      actionCategory: "assignment",
      performedBy: { employeeId: "system", department: "Game Master" },
      metadata: { source: "gm_referral_link", gameMasterId: GM_1 },
    });
  });

  it("refuses a Game Master affiliating with themselves and writes nothing", async () => {
    await seedUser(GM_1);
    const result = await viaLink(GM_1, "GMONE");
    expect(result).toMatchObject({ success: false, code: "self" });
    expect(await UserReferral.countDocuments({})).toBe(0);
    expect(await userFallback(GM_1)).toBeUndefined();
    expect(await counters("GMONE")).toEqual({ total: 0, active: 0 });
    expect(await auditRows("gm_affiliation_refused")).toHaveLength(1);
  });

  it("refuses a second Game Master while the first is active (D1) and leaves the first intact", async () => {
    await viaLink();
    const result = await viaLink(PLAYER, "GMTWO");
    expect(result).toMatchObject({ success: false, code: "already_affiliated_other" });
    expect((result as { error: string }).error).toContain("Master GMONE");
    expect(await UserReferral.countDocuments({ userId: PLAYER })).toBe(1);
    expect(await userFallback(PLAYER)).toBe(GM_1);
    expect(await counters("GMTWO")).toEqual({ total: 0, active: 0 });
  });

  it.each([["cancelled"], ["suspended"]])(
    "a %s previous Game Master still blocks a move",
    async (status) => {
      await viaLink();
      await subs().updateOne({ referralCode: "GMONE" }, { $set: { status } });
      const result = await viaLink(PLAYER, "GMTWO");
      expect(result).toMatchObject({ success: false, code: "already_affiliated_other" });
    },
  );

  it("an expired previous Game Master frees the player: old row ended, counters moved (D4)", async () => {
    await viaLink();
    await subs().updateOne({ referralCode: "GMONE" }, { $set: { status: "expired" } });

    const result = await viaLink(PLAYER, "GMTWO");
    expect(result).toMatchObject({ success: true, created: true, endedPrevious: "gm_expired" });

    const old = await UserReferral.findOne({ userId: PLAYER, gameMasterId: GM_1 }).lean<{
      isActive: boolean;
      endedReason?: string;
      endedAt?: Date;
    }>();
    expect(old).toMatchObject({ isActive: false, endedReason: "gm_expired" });
    expect(old?.endedAt).toBeInstanceOf(Date);
    expect(await UserReferral.countDocuments({ userId: PLAYER, isActive: true })).toBe(1);
    expect(await userFallback(PLAYER)).toBe(GM_2);
    expect(await counters("GMONE")).toEqual({ total: 1, active: 0 });
    expect(await counters("GMTWO")).toEqual({ total: 1, active: 1 });
  });

  it("a deleted previous Game Master frees the player with gm_deleted", async () => {
    await viaLink();
    await subs().deleteOne({ referralCode: "GMONE" });
    const result = await viaLink(PLAYER, "GMTWO");
    expect(result).toMatchObject({ success: true, endedPrevious: "gm_deleted" });
  });

  it.each([["expired"], ["cancelled"], ["suspended"]])(
    "refuses a %s Game Master on the referral link",
    async (status) => {
      await subs().updateOne({ referralCode: "GMONE" }, { $set: { status } });
      expect(await viaLink()).toMatchObject({ success: false, code: "gm_not_joinable" });
      expect(await UserReferral.countDocuments({})).toBe(0);
    },
  );

  it("refuses a paused Game Master for Join GM but not for the referral link", async () => {
    await subs().updateOne({ referralCode: "GMONE" }, { $set: { isPaused: true } });
    const sub = await subs().findOne({ referralCode: "GMONE" });
    const join = await affiliate({
      user: { id: PLAYER, email: "p@test.com" },
      gameMaster: { subscriptionId: String(sub!._id) },
      channel: "chartvolt_join_gm",
      surface: "leaderboard",
    });
    expect(join).toMatchObject({ success: false, code: "gm_not_joinable" });
    expect(await viaLink()).toMatchObject({ success: true, created: true });
  });

  it("an unknown code is refused as gm_not_found", async () => {
    expect(await viaLink(PLAYER, "GMNOPE")).toMatchObject({ success: false, code: "gm_not_found" });
  });

  it("writes both stores or neither: an unknown user rolls back the referral row and counters", async () => {
    const result = await viaLink(PLAYER_2);
    expect(result).toMatchObject({ success: false, code: "user_not_found" });
    expect(await UserReferral.countDocuments({})).toBe(0);
    expect(await counters("GMONE")).toEqual({ total: 0, active: 0 });
  });

  it("refuses malformed input without touching the database", async () => {
    const result = await affiliate({
      user: { id: "", email: "x@test.com" },
      gameMaster: { referralCode: "GMONE" },
      channel: "gm_referral_link",
    });
    expect(result).toMatchObject({ success: false, code: "invalid_input" });
    expect(await auditRows("gm_affiliation_refused")).toHaveLength(0);
  });

  it("20 concurrent joins to one Game Master produce one row and one increment", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => viaLink()));
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.filter((r) => r.success && r.created)).toHaveLength(1);
    expect(await UserReferral.countDocuments({ userId: PLAYER })).toBe(1);
    expect(await counters("GMONE")).toEqual({ total: 1, active: 1 });
    expect(await auditRows("gm_affiliation_created")).toHaveLength(1);
  }, 60_000);

  it("a race to two different Game Masters leaves exactly one active affiliation", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => viaLink(PLAYER, i % 2 ? "GMTWO" : "GMONE")),
    );
    expect(results.filter((r) => r.success && r.created)).toHaveLength(1);
    expect(await UserReferral.countDocuments({ userId: PLAYER, isActive: true })).toBe(1);
    const one = await counters("GMONE");
    const two = await counters("GMTWO");
    expect((one.total ?? 0) + (two.total ?? 0)).toBe(1);
  }, 60_000);

  it("getAffiliation falls back to the user document when no row exists", async () => {
    await db()
      .collection("user")
      .updateOne({ _id: new ObjectId(PLAYER) }, { $set: { referredByGameMasterId: GM_2 } });
    expect(await getAffiliation(PLAYER)).toEqual({ gameMasterId: GM_2, fromUserFallback: true });
    expect(await getAffiliation(PLAYER_2)).toBeNull();
  });
});

describe("the service is the only writer (s9 test 7)", () => {
  // Reason: every entry is a file that legitimately touches the stores for a reason that is
  // NOT creating an affiliation. A new writer must be added here with its reason, which is
  // the point - it cannot appear silently.
  const EXCEPTIONS = new Map<string, string>([
    ["lib/services/gamemaster/affiliation.service.ts", "the single writer"],
    ["apps/admin/app/api/gamemasters/sync-referrals/route.ts", "admin repair tool (step 7 moves it onto the service)"],
    ["apps/admin/app/api/users/delete/route.ts", "deletes a user's rows"],
    ["apps/admin/app/api/admin/end-logic-tests/run/route.ts", "test harness fixtures"],
    ["apps/admin/app/api/admin/end-logic-tests/cleanup/route.ts", "test harness cleanup"],
    ["tools/gamemaster/backfill-affiliation-source-core.ts", "step 1 source backfill"],
    ["apps/admin/app/api/gamemasters/[id]/route.ts", "only READS userreferrals; its write calls target the subscription (coarse-scan false positive)"],
  ]);

  const DIRECT_WRITE = [
    /collection\(\s*["']userreferrals["']\s*\)\s*\.\s*(insert|update|replace|delete|bulkWrite|findOneAndUpdate)/,
    /UserReferral\s*\.\s*(create|insertMany|updateOne|updateMany|findOneAndUpdate|bulkWrite|replaceOne)/,
    /\$set\s*:\s*\{[^}]*referredByGameMasterId\s*:/,
  ];
  // Reason: `const c = db.collection("userreferrals"); c.updateMany(...)` defeats a chained
  // match - the backfill tool writes exactly that way. A file that names the collection AND
  // calls a write method anywhere is therefore treated as a writer. Coarse on purpose: a
  // false positive costs one exception line with a reason, a miss is a silent second door.
  const NAMES_COLLECTION = /collection\(\s*["']userreferrals["']\s*\)/;
  const ANY_WRITE_CALL =
    /\.\s*(insertOne|insertMany|updateOne|updateMany|replaceOne|bulkWrite|findOneAndUpdate|deleteOne|deleteMany)\s*\(/;
  const WRITE = [
    ...DIRECT_WRITE,
    {
      test: (src: string) => NAMES_COLLECTION.test(src) && ANY_WRITE_CALL.test(src),
    },
  ];

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(full);
    }
    return out;
  }

  it("no file outside the named exceptions writes userreferrals or referredByGameMasterId", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "lib", "apps/admin/app", "apps/admin/lib", "tools", "worker", "database"]) {
      for (const file of walk(resolve(root, dir))) {
        const rel = relative(root, file).replace(/\\/g, "/");
        if (EXCEPTIONS.has(rel)) continue;
        const src = code(rel);
        if (WRITE.some((re) => re.test(src))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every named exception still exists and still writes (no stale entries)", () => {
    // Reason: a stale exception reads as a known writer long after it is gone and silently
    // re-permits a new writer at that path (the R60 rule).
    for (const rel of EXCEPTIONS.keys()) {
      expect(WRITE.some((re) => re.test(code(rel))), rel).toBe(true);
    }
  });

  it("the scan reaches a known writer (canary)", () => {
    expect(WRITE.some((re) => re.test(code("lib/services/gamemaster/affiliation.service.ts")))).toBe(true);
  });

  it("sign-up no longer raw-inserts a referral and calls affiliate()", () => {
    const src = code("lib/actions/auth.actions.ts");
    expect(src).not.toMatch(/userreferrals/);
    expect(src).toMatch(/await affiliate\(\{/);
  });

  it("no client component imports the service", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const file of walk(resolve(root, dir))) {
        const src = read(relative(root, file));
        if (!/^\s*["']use client["']/.test(src)) continue;
        if (/gamemaster\/affiliation\.service["']/.test(src)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
