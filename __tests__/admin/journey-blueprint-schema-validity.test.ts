import { describe, expect, it } from "vitest";

import { planBadgeQuota } from "../../lib/services/games/gamification-economy";
import { buildJourneyBlueprint } from "../../lib/services/games/journey-blueprint";
import JourneyMapConfig from "../../apps/admin/database/models/journey-map-config.model";
import JourneyMilestone from "../../apps/admin/database/models/journey-milestone.model";

/**
 * The journey blueprint is written straight into Mongoose with `create()`, and
 * `writeMapsBatch` / `writeMilestonesBatch` swallow the error into an `errors`
 * counter that nothing renders. So a document the schema rejects produces a
 * wizard that reports "Generated 24 milestones across 2 maps" beside an empty
 * journey screen — which is exactly what an operator reported.
 *
 * Reason: validate every generated document against the REAL schemas, with no
 * database, so a required field, an enum value or a `min`/`max` bound that the
 * blueprint violates fails here rather than silently in production.
 */

const plan = planBadgeQuota(
  [
    { gameKey: "trading", name: "Trading" },
    {
      gameKey: "provider:chartvolt_games:circuit_sprint",
      name: "Circuit Sprint: Fast and Fun Spatial Puzzles",
    },
    {
      gameKey: "provider:chartvolt_games:circuit_perfect",
      name: "Circuit Perfect",
    },
  ],
  220,
);

const journey = buildJourneyBlueprint(plan, { earnableBadgeXp: 12_000 });

describe("journey blueprint produces documents the schemas accept", () => {
  it("generates at least one map and its milestones", () => {
    expect(journey.maps.length).toBe(10);
    expect(journey.milestones.length).toBeGreaterThan(0);
  });

  it("every generated map validates against JourneyMapConfig", () => {
    const failures = journey.maps.flatMap((map) => {
      const error = new JourneyMapConfig(map).validateSync();
      return error ? [`${map.mapId}: ${error.message}`] : [];
    });
    expect(failures).toEqual([]);
  });

  it("every generated milestone validates against JourneyMilestone", () => {
    const failures = journey.milestones.flatMap((milestone) => {
      const error = new JourneyMilestone(milestone).validateSync();
      return error ? [`${milestone.id}: ${error.message}`] : [];
    });
    expect(failures).toEqual([]);
  });

  it("no generated field is silently discarded by strict mode", () => {
    // Reason: strict mode drops an undeclared path without erroring, so a
    // renamed field survives validation and then simply is not stored — the
    // failure mode behind the phantom `score: 0` and `suspensionEndsAt`.
    // A nested path is declared as `position.x`, so compare on the root segment
    // or the guard fails on a correct document.
    const roots = (paths: string[]) =>
      new Set(paths.map((p) => p.split(".").at(0) ?? p));

    const declaredMapPaths = roots(Object.keys(JourneyMapConfig.schema.paths));
    const mapExtras = Object.keys(journey.maps[0] ?? {}).filter(
      (key) => !declaredMapPaths.has(key),
    );
    expect(mapExtras).toEqual([]);

    const declaredMilestonePaths = roots(
      Object.keys(JourneyMilestone.schema.paths),
    );
    const milestoneExtras = Object.keys(journey.milestones[0] ?? {}).filter(
      (key) => !declaredMilestonePaths.has(key),
    );
    expect(milestoneExtras).toEqual([]);
  });

  it("milestone ids are globally unique, because the index is not scoped to the map", () => {
    // Reason: `JourneyMilestone.id` carries `unique: true` with no `mapId` in
    // the key, so two maps producing the same id means the second one's write
    // fails with E11000 while the wizard still reports the blueprint's count.
    const ids = journey.milestones.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every milestone belongs to a map that was generated", () => {
    const mapIds = new Set(journey.maps.map((m) => m.mapId));
    const orphans = journey.milestones
      .filter((m) => !mapIds.has(m.mapId))
      .map((m) => m.id);
    expect(orphans).toEqual([]);
  });
});
