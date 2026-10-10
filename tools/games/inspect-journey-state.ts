/**
 * Read-only inspection of what the gamification wizard actually stored.
 *
 * Reason: the wizard reported "24 milestones across 2 maps" while the editor
 * showed none, and every layer reported success. A count straight out of the
 * collections is the only way to tell a rejected write from a screen that
 * cannot find what was written.
 *
 * Run: npx tsx tools/games/inspect-journey-state.ts
 */

import "dotenv/config";
import mongoose from "mongoose";

// Reason: the collection names are taken from the MODELS rather than written
// out here. Mongoose derives them by pluralising, so a hand-typed
// "journeymilestones" is a guess — and reading an empty collection that does
// not exist has exactly the same symptom as a write that never happened, which
// is the confusion this whole tool exists to resolve.
import JourneyMapConfig from "../../database/models/journey-map-config.model";
import JourneyMilestone from "../../database/models/journey-milestone.model";
import XPConfig from "../../database/models/xp-config.model";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri);

  const maps = await JourneyMapConfig.collection
    .find({}, { projection: { mapId: 1, name: 1, gameKey: 1, sequenceOrder: 1, isActive: 1, zones: 1 } })
    .toArray();

  const milestones = await JourneyMilestone.collection
    .find({}, { projection: { id: 1, mapId: 1, isActive: 1 } })
    .toArray();

  const byMap = new Map<string, number>();
  for (const m of milestones) {
    const key = String(m.mapId ?? "(none)");
    byMap.set(key, (byMap.get(key) ?? 0) + 1);
  }

  console.log(`\n${JourneyMapConfig.collection.collectionName}: ${maps.length}`);
  for (const m of maps) {
    console.log(
      `  ${m.mapId} | "${m.name}" | game=${m.gameKey ?? "-"} | order=${m.sequenceOrder ?? "-"} | active=${m.isActive} | zones=${Array.isArray(m.zones) ? m.zones.length : "MISSING"} | milestones=${byMap.get(String(m.mapId)) ?? 0}`,
    );
  }

  console.log(`\n${JourneyMilestone.collection.collectionName}: ${milestones.length}`);
  for (const [mapId, count] of byMap) {
    const orphan = maps.some((m) => String(m.mapId) === mapId) ? "" : "  <-- ORPHAN (no map)";
    console.log(`  ${mapId}: ${count}${orphan}`);
  }

  // Reason: `type` is projected alongside `configType` deliberately. R102 wrote
  // the ladder under `type`, which the schema does not declare, so a row
  // carrying one and not the other is an orphan from before that fix — and it
  // is indistinguishable from a missing ladder from any screen.
  const xp = await XPConfig.collection
    .find({}, { projection: { configType: 1, type: 1, updatedAt: 1 } })
    .toArray();
  console.log(`\n${XPConfig.collection.collectionName}: ${xp.length}`);
  for (const c of xp) {
    console.log(`  configType=${c.configType ?? "-"} type=${c.type ?? "-"} updatedAt=${c.updatedAt ?? "-"}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
