/**
 * Dual-path journey blueprint: always emits up to 10 thematic maps with
 * trading OR gaming completion conditions.
 */
import { describe, expect, it } from "vitest";
import { buildJourneyBlueprint } from "../../lib/services/games/journey-blueprint";
import {
  DEFAULT_MAP_COUNT,
  JOURNEY_MAP_SHELLS,
  MAX_JOURNEY_MAPS,
} from "../../lib/services/games/journey-map-shells";
import { JOURNEY_GAME_CONDITION_FIELDS } from "../../lib/services/games/journey-game-conditions";
import type { BadgeQuotaPlan } from "../../lib/services/games/gamification-economy";

function emptyCounts() {
  return { common: 0, rare: 0, epic: 0, legendary: 0 };
}

const emptyPlan: BadgeQuotaPlan = {
  target: 0,
  planned: 0,
  scopes: [],
};

describe("buildJourneyBlueprint dual-path maps", () => {
  it("emits the historic 10-map sequence by default", () => {
    const journey = buildJourneyBlueprint(emptyPlan);
    expect(journey.maps).toHaveLength(DEFAULT_MAP_COUNT);
    expect(journey.maps).toHaveLength(MAX_JOURNEY_MAPS);
    expect(journey.maps.map((m) => m.mapId)).toEqual(
      JOURNEY_MAP_SHELLS.map((s) => s.mapId),
    );
  });

  it("does not shrink to catalogue scope count", () => {
    // Reason: the old generator built one map per scope, so trading + one game
    // produced exactly two maps. A plan with two scopes must still get ten.
    const plan: BadgeQuotaPlan = {
      target: 40,
      planned: 40,
      scopes: [
        {
          scope: "trading",
          label: "Trading",
          counts: emptyCounts(),
          total: 20,
        },
        {
          scope: "provider:cv:sprint",
          label: "Sprint",
          counts: emptyCounts(),
          total: 20,
        },
      ],
    };
    const journey = buildJourneyBlueprint(plan);
    expect(journey.maps).toHaveLength(10);
  });

  it("honours mapCount cap without going over the schema max", () => {
    const journey = buildJourneyBlueprint(emptyPlan, { mapCount: 3 });
    expect(journey.maps).toHaveLength(3);
    const over = buildJourneyBlueprint(emptyPlan, { mapCount: 99 });
    expect(over.maps).toHaveLength(MAX_JOURNEY_MAPS);
  });

  it("gives activity milestones a gaming OR path", () => {
    const journey = buildJourneyBlueprint(emptyPlan, { perMap: 6 });
    const activity = journey.milestones.filter(
      (m) => m.nodeType !== "start" && (m.orCompleteConditions?.length ?? 0) > 0,
    );
    expect(activity.length).toBeGreaterThan(0);
    for (const m of activity) {
      const orType = m.orCompleteConditions![0]!.type;
      expect(
        orType in JOURNEY_GAME_CONDITION_FIELDS || orType.startsWith("game_"),
      ).toBe(true);
    }
  });

  it("links maps in sequence order", () => {
    const journey = buildJourneyBlueprint(emptyPlan);
    journey.maps.forEach((map, i) => {
      expect(map.sequenceOrder).toBe(i + 1);
      expect(map.isActive).toBe(true);
      expect(map.gameKey).toBeNull();
      if (i === 0) expect(map.previousMapId).toBeNull();
      else expect(map.previousMapId).toBe(journey.maps.at(i - 1)?.mapId);
      if (i === journey.maps.length - 1) expect(map.nextMapId).toBeNull();
      else expect(map.nextMapId).toBe(journey.maps.at(i + 1)?.mapId);
    });
  });
});
