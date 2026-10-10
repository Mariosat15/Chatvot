import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";
import {
  buildReferralLink,
  REFERRAL_SIGNUP_PATH,
} from "@/lib/services/gamemaster/referral-link";
import { userDocumentIds, userIdFilter } from "@/lib/utils/user-id-filter";
import { calculateGameMasterFees } from "@/lib/services/settlement/game-master-fees";

/**
 * Gamemaster Program v2, step 0 (`External game plans/24` s0.1): the referral foundations
 * the new features stand on.
 *
 * 1. The stored referral link pointed at `/register`, which is not a route - the only
 *    sign-up page is `/sign-up`. A GM who copied the link from an admin screen sent
 *    players to a 404 and the referral was lost with nothing logged.
 * 2. The settlement fallback and `sync-referrals` looked users up by the `id` FIELD, while
 *    Better Auth keeps the identity in `_id` (the R68 shape).
 */

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("buildReferralLink", () => {
  it("points at the sign-up page that actually exists", () => {
    expect(REFERRAL_SIGNUP_PATH).toBe("/sign-up");
    expect(buildReferralLink("GMABC123", "https://app.example.com")).toBe(
      "https://app.example.com/sign-up?ref=GMABC123",
    );
  });

  it("never builds the /register link that 404s", () => {
    expect(buildReferralLink("GMABC123", "https://x.test")).not.toContain(
      "/register",
    );
  });

  it("drops a trailing slash on the base so the path is not doubled", () => {
    expect(buildReferralLink("GM1", "https://x.test///")).toBe(
      "https://x.test/sign-up?ref=GM1",
    );
  });

  it("returns an empty string for a missing code rather than a link with ref=undefined", () => {
    expect(buildReferralLink(undefined, "https://x.test")).toBe("");
    expect(buildReferralLink(null, "https://x.test")).toBe("");
    expect(buildReferralLink("   ", "https://x.test")).toBe("");
  });

  it("encodes the code", () => {
    expect(buildReferralLink("GM A&B", "https://x.test")).toBe(
      "https://x.test/sign-up?ref=GM%20A%26B",
    );
  });

  it("the link does not exist on disk as /register, and /sign-up does", () => {
    // Pins the premise the helper encodes, so renaming the page turns this red.
    expect(() => read("app/(auth)/sign-up/page.tsx")).not.toThrow();
    expect(() => read("app/(auth)/register/page.tsx")).toThrow();
  });
});

describe("every referral-link writer and reader derives from the code", () => {
  const files = [
    "app/api/gamemaster/activate/route.ts",
    "app/api/gamemaster/status/route.ts",
    "apps/admin/app/api/gamemaster/link/route.ts",
    "apps/admin/app/api/gamemaster/dashboard/route.ts",
    "apps/admin/app/api/gamemasters/route.ts",
    "apps/admin/app/api/gamemasters/[id]/route.ts",
  ];

  it.each(files)("%s calls buildReferralLink and never hand-builds a link", (p) => {
    const src = code(p);
    expect(src).toMatch(/buildReferralLink\(/);
    expect(src).not.toMatch(/\?ref=/);
    // Reading the stored field back is the defect: older rows still hold /register.
    expect(src).not.toMatch(/\.referralLink\b/);
  });
});

describe("mirrored helpers are byte-identical", () => {
  it.each([
    "lib/services/gamemaster/referral-link.ts",
    "lib/utils/user-id-filter.ts",
    "lib/services/settlement/game-master-fees/calculate.ts",
  ])("%s", (p) => {
    expect(read(`apps/admin/${p}`)).toBe(read(p));
  });
});

describe("userIdFilter / userDocumentIds", () => {
  it("matches the id field, the ObjectId _id and a string _id", () => {
    const oid = "6500000000000000000000d1";
    const filter = userIdFilter([oid]) as { $or: Record<string, unknown>[] };
    expect(filter.$or).toHaveLength(3);
    expect(filter.$or[0]).toEqual({ id: { $in: [oid] } });
    expect(String((filter.$or[1]._id as { $in: unknown[] }).$in[0])).toBe(oid);
    expect(filter.$or[2]).toEqual({ _id: { $in: [oid] } });
  });

  it("does not attempt an ObjectId for an id that is not one", () => {
    const filter = userIdFilter(["not-an-object-id"]) as {
      $or: Record<string, unknown>[];
    };
    expect(filter.$or).toHaveLength(2);
  });

  it("returns both ids, without a duplicate when they agree", () => {
    expect(userDocumentIds({ id: "a", _id: "b" })).toEqual(["a", "b"]);
    expect(userDocumentIds({ id: "a", _id: "a" })).toEqual(["a"]);
    expect(userDocumentIds({})).toEqual([]);
  });
});

describe("sync-referrals no longer looks users up by the id field", () => {
  const ROUTE = "apps/admin/app/api/gamemasters/sync-referrals/route.ts";

  it("uses userIdFilter for every user lookup and updates by _id", () => {
    const src = code(ROUTE);
    expect(src.match(/userIdFilter\(\[referral\.userId\]\)/g)?.length).toBe(2);
    expect(src).not.toMatch(/\{\s*id:\s*referral\.userId\s*\}/);
    expect(src).toMatch(/updateOne\(\s*\{\s*_id:\s*user\._id\s*\}/);
  });

  it("never echoes an error message to the caller", () => {
    const src = code(ROUTE);
    // One legitimate read, inside refusalResponse, to classify the refusal.
    expect(src.match(/error\.message/g)?.length).toBe(1);
    expect(src).not.toMatch(/err\.message/);
  });
});

describe("the settlement fallback finds a user whose identity is only in _id", () => {
  const GM_ID = "6500000000000000000000e1";
  const OTHER_GM_ID = "6500000000000000000000e3";
  const PLAYER_ID = "6500000000000000000000e2";

  beforeAll(async () => {
    await startTestMongo();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  async function seedSubscription(userId: string): Promise<void> {
    await mongoose.connection.db?.collection("gamemastersubscriptions").insertOne({
      userId,
      userEmail: `${userId}@example.com`,
      userName: "Game Master",
      status: "active",
      isPaused: false,
      limits: {
        referralFeePercentage: 5,
        canCreateCompetitions: true,
        canEarnFromChallenges: false,
      },
      createdAt: new Date(),
    });
  }

  async function seedUserWithoutIdField(gmId: string): Promise<void> {
    // The shape Better Auth writes: identity in `_id`, no `id` field at all.
    await mongoose.connection.db?.collection("user").insertOne({
      _id: new mongoose.Types.ObjectId(PLAYER_ID),
      name: "Referred Player",
      email: "player@example.com",
      referredByGameMasterId: gmId,
    });
  }

  async function calculate() {
    const db = mongoose.connection.db;
    if (!db) throw new Error("no db");
    return calculateGameMasterFees({
      db: db as never,
      participants: [{ userId: PLAYER_ID }],
      entryFee: 100,
    });
  }

  it("pays the Game Master named on the user document when no UserReferral row exists", async () => {
    await seedSubscription(GM_ID);
    await seedUserWithoutIdField(GM_ID);

    const result = await calculate();

    expect(result.payments.map((p) => p.gmId)).toEqual([GM_ID]);
    expect(result.totalGmEarnings).toBeGreaterThan(0);
  });

  it("still lets the UserReferral row override the fallback", async () => {
    // Reason: the two sources must disagree, or the precedence cannot be observed.
    await seedSubscription(GM_ID);
    await seedSubscription(OTHER_GM_ID);
    await seedUserWithoutIdField(GM_ID);
    await mongoose.connection.db?.collection("userreferrals").insertOne({
      userId: PLAYER_ID,
      gameMasterId: OTHER_GM_ID,
      userName: "Referred Player",
      userEmail: "player@example.com",
      isActive: true,
      createdAt: new Date(),
    });

    const result = await calculate();

    expect(result.payments.map((p) => p.gmId)).toEqual([OTHER_GM_ID]);
  });

  it("does not key a referral under an id the caller did not ask about", async () => {
    // A user document found through `_id` whose `id` field names somebody else must not
    // credit that other id as a participant. Two checks hold this - `requestedIds` in
    // buildReferralMap and `isParticipant` in calculateGameMasterFees - and each covers
    // for the other, so this test pins the pair rather than either one.
    await seedSubscription(GM_ID);
    await mongoose.connection.db?.collection("user").insertOne({
      _id: new mongoose.Types.ObjectId(PLAYER_ID),
      id: "someone-else",
      name: "Referred Player",
      email: "player@example.com",
      referredByGameMasterId: GM_ID,
    });

    const result = await calculate();

    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].users.map((u) => u.userId)).toEqual([PLAYER_ID]);
  });
});
