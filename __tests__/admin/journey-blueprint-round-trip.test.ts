import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";

import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import { planBadgeQuota } from "../../lib/services/games/gamification-economy";
import { buildJourneyBlueprint } from "../../lib/services/games/journey-blueprint";
import JourneyMapConfig from "../../apps/admin/database/models/journey-map-config.model";
import JourneyMilestone from "../../apps/admin/database/models/journey-milestone.model";

/**
 * Does a generated journey actually reach the database, and can the editor find it?
 *
 * WHY THIS EXISTS. `journey-blueprint-schema-validity.test.ts` validates every generated
 * document with `validateSync()`, which is the right guard and is structurally blind to
 * three things that only a real database has: a **unique index** (`JourneyMilestone.id`
 * carries `unique: true` and is NOT scoped to the map, so a duplicate is an E11000 at
 * write time and not a validation error), **strict mode discarding an undeclared path**
 * on the way in, and the **editor's own read queries**. An operator reported "Generated
 * 24 milestones across 2 maps" beside an empty screen, so every one of those three was a
 * live candidate and none of them could be ruled out by a test that never writes.
 *
 * WHAT IT DELIBERATELY DOES NOT COVER. The route's control flow - which mode replaces and
 * which skips, and what it reports - is pinned structurally in
 * `r96b-gamification-orchestration.test.ts`. This file writes through the same two calls
 * the batch writers make (`Model.create`) and then asks the questions
 * `GET /api/journey-map?list=true`, `?mapId=` and `GET /api/journey-milestones?mapId=`
 * ask. A pass here means: if the write is reached, the data lands and the screen can
 * read it.
 *
 * The models imported are the **admin** copies only. Importing both copies of one model
 * into a single test silently returns the first for both, because each registers under
 * the same name via `models.X || model(...)`.
 */

const plan = planBadgeQuota(
  [
    { gameKey: "trading", name: "Trading" },
    {
      gameKey: "provider:chartvolt_games:circuit_sprint",
      name: "Circuit Sprint: Fast and Fun Spatial Puzzles",
    },
  ],
  220,
);

const journey = buildJourneyBlueprint(plan, { earnableBadgeXp: 12_000 });

/** The two calls `writeMapsBatch` / `writeMilestonesBatch` make, with nothing swallowed. */
async function writeBlueprint() {
  const mapErrors: string[] = [];
  const milestoneErrors: string[] = [];

  for (const map of journey.maps) {
    try {
      await JourneyMapConfig.create(map);
    } catch (err) {
      mapErrors.push(`${map.mapId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const ms of journey.milestones) {
    try {
      await JourneyMilestone.create(ms);
    } catch (err) {
      milestoneErrors.push(`${ms.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { mapErrors, milestoneErrors };
}

describe("a generated journey survives the round trip into the database", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["journeymapconfigs", "journeymilestones"]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("writes every map and every milestone, with no error swallowed", async () => {
    const { mapErrors, milestoneErrors } = await writeBlueprint();

    // Reason: assert the MESSAGES, not a count. A count reproduces the defect
    // being guarded against - the operator saw a number and not the cause.
    expect(mapErrors).toEqual([]);
    expect(milestoneErrors).toEqual([]);

    expect(await JourneyMapConfig.countDocuments()).toBe(journey.maps.length);
    expect(await JourneyMilestone.countDocuments()).toBe(
      journey.milestones.length,
    );
  });

  it("stores the zones, which is the half a validation test cannot see", async () => {
    await writeBlueprint();

    const stored = await JourneyMapConfig.find({}).lean();
    expect(stored.length).toBeGreaterThan(0);

    for (const map of stored) {
      const planned = journey.maps.find((m) => m.mapId === map.mapId);
      expect(planned, `${map.mapId} was not in the blueprint`).toBeDefined();
      // Reason: "no zones" was reported alongside "no milestones". Strict mode
      // drops an undeclared path without erroring, so a renamed `zones` field
      // would validate, write, and simply not be there - and every screen would
      // render an empty map with nothing in any log.
      expect(Array.isArray(map.zones)).toBe(true);
      expect(map.zones.length).toBe(planned!.zones.length);
      expect(map.zones.length).toBeGreaterThan(0);
      for (const zone of map.zones) {
        expect(typeof zone.id).toBe("string");
        expect(zone.id.length).toBeGreaterThan(0);
      }
    }
  });

  it("answers the three queries the editor actually makes", async () => {
    await writeBlueprint();

    // 1. GET /api/journey-map?list=true - the map list the Sequence tab renders.
    const list = await JourneyMapConfig.find({})
      .sort({ sequenceOrder: 1, createdAt: 1 })
      .select("mapId name theme sequenceOrder estimatedXP gameKey isActive")
      .lean();
    expect(list.length).toBe(journey.maps.length);
    expect(list.every((m) => typeof m.mapId === "string" && m.mapId.length > 0)).toBe(true);
    // Reason: the list is the editor's only source of map ids since it stopped
    // driving itself from ten hard-coded legacy themes, so a map that is not
    // active here is a map the operator cannot open.
    expect(list.every((m) => m.isActive !== false)).toBe(true);

    // 2. The per-map milestone count shown on each card.
    const counts = await JourneyMilestone.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$mapId", count: { $sum: 1 } } },
    ]);
    const countByMap = new Map(counts.map((c) => [c._id, c.count]));
    for (const map of list) {
      expect(countByMap.get(map.mapId) ?? 0).toBeGreaterThan(0);
    }

    // 3. GET /api/journey-map?mapId= and /api/journey-milestones?mapId= - the map
    //    the editor opens first.
    const first = list.at(0)!;
    const config = await JourneyMapConfig.findOne({ mapId: first.mapId }).lean();
    expect(config).not.toBeNull();
    const milestones = await JourneyMilestone.find({ mapId: first.mapId }).lean();
    expect(milestones.length).toBeGreaterThan(0);
  });

  it("a second write of the same blueprint adds nothing and loses nothing", async () => {
    await writeBlueprint();
    const before = await JourneyMilestone.countDocuments();

    // Reason: `JourneyMilestone.id` is unique WITHOUT `mapId`, so a re-run is
    // where an E11000 would appear - counted as an `errors` entry that nothing
    // rendered. Proving the collision exists is what justifies the batch
    // writer's existence check, and proves the index is real in this harness.
    const second = await writeBlueprint();
    expect(second.milestoneErrors.length).toBe(journey.milestones.length);
    expect(second.milestoneErrors.at(0)).toMatch(/E11000|duplicate key/i);

    expect(await JourneyMilestone.countDocuments()).toBe(before);
  });

  it("a replace pass leaves exactly the new design behind", async () => {
    // A legacy row of the kind the old trading-only generator left: this is what
    // "Getting Started with a blank page" was.
    await JourneyMapConfig.create({
      mapId: "getting_started",
      name: "Getting Started",
      description: "legacy",
      zones: [],
      defaultStartNode: "start",
    });
    expect(await JourneyMapConfig.countDocuments()).toBe(1);

    await JourneyMilestone.deleteMany({});
    await JourneyMapConfig.deleteMany({});
    const { mapErrors, milestoneErrors } = await writeBlueprint();

    expect(mapErrors).toEqual([]);
    expect(milestoneErrors).toEqual([]);
    const ids = (await JourneyMapConfig.find({}).select("mapId").lean()).map(
      (m) => m.mapId,
    );
    expect(ids).not.toContain("getting_started");
    expect(ids.length).toBe(journey.maps.length);
  });

  it("the collections are the ones the wizard and the editor both name", async () => {
    // Reason: these schemas take their collection name from Mongoose's
    // pluralisation, and a write to a guessed collection has exactly the same
    // symptom as a write that was rejected - the screen finds nothing.
    await writeBlueprint();
    const db = mongoose.connection.db!;
    expect(await db.collection("journeymapconfigs").countDocuments()).toBe(
      journey.maps.length,
    );
    expect(await db.collection("journeymilestones").countDocuments()).toBe(
      journey.milestones.length,
    );
  });
});
