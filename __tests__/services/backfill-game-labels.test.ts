import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";

import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  TARGETS,
  processTarget,
  countRemaining,
  missingStringFilter,
  missingArrayFilter,
} from "../../tools/games/backfill-game-labels-core";

/**
 * X1 step 7: the game label backfill, against a real MongoDB.
 *
 * Written against a real server rather than a mock because every claim worth making here
 * is a claim about what the database actually did - that a filter matched the three
 * different shapes of "unlabelled", that a second run is a genuine no-op, and above all
 * that an existing label was not touched.
 *
 * That last one is the reason this file exists. `gameKey` is IMMUTABLE - it is the join
 * key for every historical stat - so a backfill that can overwrite it is a script that
 * can silently destroy history. "It only sets missing fields" is an assertion about a
 * query filter, and query filters are exactly the thing people get wrong.
 */

const COLLECTIONS = TARGETS.map((t) => t.collection);

function db() {
  const handle = mongoose.connection.db;
  if (!handle) throw new Error("no db handle");
  return handle;
}

beforeAll(async () => {
  await startTestMongo();
  // Reason: MongoDB cannot create a collection inside a transaction, and a first-touch
  // creation is indistinguishable at a glance from a real failure. Cheap insurance even
  // though this backfill takes no transaction.
  await ensureCollections(COLLECTIONS);
}, 60_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await ensureCollections(COLLECTIONS);
});

describe("the filters recognise every shape of 'unlabelled'", () => {
  it.each([
    ["absent", {}],
    ["null", { gameType: null }],
    ["empty string", { gameType: "" }],
  ])("matches a document whose gameType is %s", async (_name, doc) => {
    await db().collection("competitions").insertOne({ name: "x", ...doc });
    const found = await db()
      .collection("competitions")
      .countDocuments(missingStringFilter("gameType"));
    expect(found).toBe(1);
  });

  it("does not match a document that already has one", async () => {
    await db().collection("competitions").insertOne({ gameType: "trading" });
    const found = await db()
      .collection("competitions")
      .countDocuments(missingStringFilter("gameType"));
    expect(found).toBe(0);
  });

  it("treats an EMPTY array as configured, not as missing", async () => {
    // Reason: on BadgeConfig an empty gameTypes means "every game", which is a legitimate
    // operator choice. Overwriting it with ["trading"] would silently narrow a badge
    // somebody deliberately made universal - and it would look like a correct backfill.
    await db().collection("badgeconfigs").insertOne({ id: "b", gameTypes: [] });
    const found = await db()
      .collection("badgeconfigs")
      .countDocuments(missingArrayFilter("gameTypes"));
    expect(found).toBe(0);
  });
});

describe("report mode writes nothing", () => {
  it("counts what it would do and leaves the data alone", async () => {
    await db().collection("competitions").insertMany([{ name: "a" }, { name: "b" }]);

    const results = await processTarget(
      TARGETS.find((t) => t.collection === "competitions")!,
      false,
    );

    expect(results.find((r) => r.field === "gameType")?.needing).toBe(2);
    expect(results.find((r) => r.field === "gameType")?.updated).toBe(0);

    const stillUnlabelled = await db()
      .collection("competitions")
      .countDocuments(missingStringFilter("gameType"));
    expect(stillUnlabelled).toBe(2);
  });
});

describe("apply mode labels what is missing and nothing else", () => {
  it("labels contests and participants across all four collections", async () => {
    await db().collection("competitions").insertOne({ name: "c" });
    await db().collection("challenges").insertOne({ slug: "ch" });
    await db().collection("competitionparticipants").insertOne({ userId: "u" });
    await db().collection("challengeparticipants").insertOne({ userId: "u" });

    for (const target of TARGETS) await processTarget(target, true);

    const comp = await db().collection("competitions").findOne({ name: "c" });
    expect(comp?.gameType).toBe("trading");
    expect(comp?.gameKey).toBe("trading");

    const chal = await db().collection("challenges").findOne({ slug: "ch" });
    expect(chal?.gameType).toBe("trading");
    expect(chal?.gameKey).toBe("trading");

    for (const c of ["competitionparticipants", "challengeparticipants"]) {
      const row = await db().collection(c).findOne({ userId: "u" });
      expect(row?.gameKey).toBe("trading");
    }
  });

  it("NEVER overwrites a label that already exists", async () => {
    // Reason: the single most important assertion in this file. gameKey is immutable and
    // is the join key for all historical stats, so a backfill that can rewrite it can
    // destroy history silently. A provider contest must come out the other side untouched.
    await db().collection("competitions").insertOne({
      name: "provider one",
      gameType: "provider",
      gameKey: "chess-blitz",
    });

    for (const target of TARGETS) await processTarget(target, true);

    const row = await db().collection("competitions").findOne({ name: "provider one" });
    expect(row?.gameType).toBe("provider");
    expect(row?.gameKey).toBe("chess-blitz");
  });

  it("completes a HALF-labelled row rather than skipping it", async () => {
    // Reason: gameType set and gameKey missing is exactly what an interrupted earlier run
    // leaves behind. Filtering on both fields at once with a single $or would either skip
    // this row or rewrite the field that was already correct.
    await db().collection("competitions").insertOne({
      name: "half",
      gameType: "trading",
    });

    for (const target of TARGETS) await processTarget(target, true);

    const row = await db().collection("competitions").findOne({ name: "half" });
    expect(row?.gameType).toBe("trading");
    expect(row?.gameKey).toBe("trading");
  });

  it("defaults badge configs to trading", async () => {
    await db().collection("badgeconfigs").insertOne({ id: "first-trade" });

    for (const target of TARGETS) await processTarget(target, true);

    const row = await db().collection("badgeconfigs").findOne({ id: "first-trade" });
    expect(row?.gameTypes).toEqual(["trading"]);
  });
});

describe("it is idempotent, which is the whole safety claim", () => {
  it("a second run matches nothing and changes nothing", async () => {
    await db().collection("competitions").insertMany([{ n: 1 }, { n: 2 }, { n: 3 }]);
    await db().collection("badgeconfigs").insertOne({ id: "b" });

    for (const target of TARGETS) await processTarget(target, true);
    expect(await countRemaining()).toBe(0);

    const afterFirst = await db().collection("competitions").find({}).toArray();

    let secondRunUpdates = 0;
    for (const target of TARGETS) {
      const results = await processTarget(target, true);
      secondRunUpdates += results.reduce((sum, r) => sum + r.updated, 0);
    }

    expect(secondRunUpdates).toBe(0);
    const afterSecond = await db().collection("competitions").find({}).toArray();
    expect(afterSecond).toEqual(afterFirst);
  });

  it("countRemaining reports zero only when every field is set", async () => {
    await db().collection("competitions").insertOne({ n: 1 });
    expect(await countRemaining()).toBeGreaterThan(0);

    for (const target of TARGETS) await processTarget(target, true);
    expect(await countRemaining()).toBe(0);
  });
});

describe("the label the backfill writes matches the label the app writes", () => {
  it("uses the same value contestGameLabel() produces", async () => {
    // Reason: two sources of the string "trading" is one too many. If the app's default
    // ever changes, a backfill carrying its own literal would relabel history to a value
    // nothing else uses - and every row would look correctly labelled.
    const { contestGameLabel } = await import("@/lib/games");
    await db().collection("competitions").insertOne({ n: 1 });

    for (const target of TARGETS) await processTarget(target, true);

    const row = await db().collection("competitions").findOne({ n: 1 });
    expect(row?.gameType).toBe(contestGameLabel().gameType);
    expect(row?.gameKey).toBe(contestGameLabel().gameKey);
  });
});
