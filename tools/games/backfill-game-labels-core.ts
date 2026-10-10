/**
 * The testable half of the X1 step 7 backfill. See `backfill-game-labels.ts` for the CLI
 * and the reasoning; this file holds only the collection list and the update logic, so a
 * test can drive it against a real MongoDB without the script's `main()` running on
 * import and trying to connect to production.
 */

import mongoose from "mongoose";
import { TRADING_GAME_TYPE } from "../../lib/games/types";

/**
 * A document has no usable label if the field is absent, null, or blank.
 *
 * Reason: all three states occur. Absent is the pre-X1 document; null is what some older
 * writers stored; blank is what a form submission with an empty field produces. Treating
 * only `$exists: false` as unlabelled would leave the other two behind, and they are the
 * ones that look correct in a document dump.
 */
export function missingStringFilter(field: string): Record<string, unknown> {
  return {
    $or: [
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: "" },
    ],
  };
}

/** An array field is unset only when absent or null. Empty is a deliberate choice. */
export function missingArrayFilter(field: string): Record<string, unknown> {
  return {
    $or: [{ [field]: { $exists: false } }, { [field]: null }],
  };
}

export interface Target {
  collection: string;
  label: string;
  stringFields: string[];
  arrayFields?: { field: string; value: string[] }[];
}

export const TARGETS: readonly Target[] = [
  { collection: "competitions", label: "Competitions", stringFields: ["gameType", "gameKey"] },
  { collection: "challenges", label: "Challenges", stringFields: ["gameType", "gameKey"] },
  { collection: "competitionparticipants", label: "Competition participants", stringFields: ["gameKey"] },
  { collection: "challengeparticipants", label: "Challenge participants", stringFields: ["gameKey"] },
  {
    collection: "badgeconfigs",
    label: "Badge configs",
    stringFields: [],
    arrayFields: [{ field: "gameTypes", value: [TRADING_GAME_TYPE] }],
  },
];

export interface FieldResult {
  field: string;
  needing: number;
  updated: number;
}

/**
 * Count, and optionally set, the missing label fields on one collection.
 *
 * Writes through the raw driver rather than a Mongoose model on purpose. Two of these
 * collections are written by raw-driver code paths anyway, the update is a plain `$set`
 * with no validation to gain, and going through a model would make this script depend on
 * five model imports staying importable - which is exactly what the stale compiled `.js`
 * files broke once already.
 */
export async function processTarget(
  target: Target,
  apply: boolean,
): Promise<FieldResult[]> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle on the mongoose connection.");
  const collection = db.collection(target.collection);
  const results: FieldResult[] = [];

  for (const field of target.stringFields) {
    // Reason: each field is counted and set independently rather than as one $or over
    // both. A row with gameType set and gameKey missing is exactly what a partial or
    // interrupted earlier run leaves behind, and a combined filter would either skip it
    // or rewrite the field that is already correct.
    const filter = missingStringFilter(field);
    const needing = await collection.countDocuments(filter);
    let updated = 0;
    if (apply && needing > 0) {
      const res = await collection.updateMany(filter, {
        $set: { [field]: TRADING_GAME_TYPE },
      });
      updated = res.modifiedCount;
    }
    results.push({ field, needing, updated });
  }

  for (const { field, value } of target.arrayFields ?? []) {
    // Reason: an EMPTY array counts as already-configured and is left alone. On
    // BadgeConfig an empty gameTypes means "every game", which is a legitimate operator
    // choice; overwriting it with ["trading"] would silently narrow a badge somebody
    // deliberately made universal.
    const filter = missingArrayFilter(field);
    const needing = await collection.countDocuments(filter);
    let updated = 0;
    if (apply && needing > 0) {
      const res = await collection.updateMany(filter, { $set: { [field]: value } });
      updated = res.modifiedCount;
    }
    results.push({ field, needing, updated });
  }

  return results;
}

/** Total fields still needing a value across every target. Used to verify after a run. */
export async function countRemaining(): Promise<number> {
  let remaining = 0;
  for (const target of TARGETS) {
    const results = await processTarget(target, false);
    remaining += results.reduce((sum, r) => sum + r.needing, 0);
  }
  return remaining;
}
