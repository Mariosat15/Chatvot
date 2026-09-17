/**
 * Dual-path journey blueprint: always emits up to 10 thematic maps with
 * trading OR gaming completion conditions, progressive XP/counts, themed
 * zones, map-gated starts, and per-map background art.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildJourneyBlueprint } from "../../lib/services/games/journey-blueprint";
import {
  DEFAULT_MAP_COUNT,
  JOURNEY_MAP_SHELLS,
  MAP_MILESTONE_COUNTS,
  MAP_XP_BUDGETS,
  MAX_JOURNEY_MAPS,
  THEME_ZONES,
  backgroundImageForMapId,
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

  it("gives each map a unique progressive XP budget and milestone count", () => {
    const journey = buildJourneyBlueprint(emptyPlan);
    const xpSet = new Set(journey.maps.map((m) => m.estimatedXP));
    expect(xpSet.size).toBe(journey.maps.length);
    journey.maps.forEach((map, i) => {
      // eslint-disable-next-line security/detect-object-injection -- i is map index in forEach
      expect(map.totalMilestones).toBe(MAP_MILESTONE_COUNTS[i]);
      // Budget is allocated across nodes; estimatedXP should be near the budget.
      // eslint-disable-next-line security/detect-object-injection -- i is map index in forEach
      expect(map.estimatedXP).toBeGreaterThanOrEqual(MAP_XP_BUDGETS[i]! - 20);
      // eslint-disable-next-line security/detect-object-injection -- i is map index in forEach
      expect(map.estimatedXP).toBeLessThanOrEqual(MAP_XP_BUDGETS[i]! + 20);
    });
    expect(journey.maps[0]!.estimatedXP).toBeLessThan(
      journey.maps[journey.maps.length - 1]!.estimatedXP,
    );
  });

  it("stamps a real backgroundImage per map and files exist", () => {
    const journey = buildJourneyBlueprint(emptyPlan);
    const mapsDir = path.join(process.cwd(), "public", "assets", "maps");
    for (const map of journey.maps) {
      expect(map.backgroundImage).toBe(backgroundImageForMapId(map.mapId));
      const file = path.join(mapsDir, path.basename(map.backgroundImage));
      expect(fs.existsSync(file)).toBe(true);
    }
    const images = new Set(journey.maps.map((m) => m.backgroundImage));
    expect(images.size).toBe(10);
  });

  it("uses theme-specific zone names — Space Station is not Foundations", () => {
    const journey = buildJourneyBlueprint(emptyPlan);
    const pirate = journey.maps.find((m) => m.mapId === "pirate_cove")!;
    const space = journey.maps.find((m) => m.mapId === "space_station")!;
    expect(pirate.zones.map((z) => z.name)).toEqual(
      THEME_ZONES.pirate.map((z) => z.name),
    );
    expect(space.zones.map((z) => z.name)).toEqual(
      THEME_ZONES.space.map((z) => z.name),
    );
    expect(space.zones.some((z) => z.name === "Foundations")).toBe(false);
    expect(space.zones.some((z) => z.name === "Launch Bay")).toBe(true);
  });

  it("starts map 1 with onboarding and later maps with map_completed", () => {
    const journey = buildJourneyBlueprint(emptyPlan);
    const map1Starts = journey.milestones.filter(
      (m) => m.mapId === "pirate_cove" && m.nodeType === "start",
    );
    expect(map1Starts[0]?.completeCondition.type).toBe("account_created");
    const map1Types = journey.milestones
      .filter((m) => m.mapId === "pirate_cove")
      .map((m) => m.completeCondition.type);
    expect(map1Types).toContain("kyc_verified");
    expect(map1Types).toContain("first_deposit");

    const map2Start = journey.milestones.find(
      (m) => m.mapId === "space_station" && m.nodeType === "start",
    );
    expect(map2Start?.completeCondition.type).toBe("map_completed");
    expect(map2Start?.completeCondition.value).toBe("pirate_cove");
    expect(map2Start?.completeCondition.type).not.toBe("account_created");
  });
});
