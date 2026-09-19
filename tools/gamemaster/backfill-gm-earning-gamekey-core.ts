/**
 * Report-only (until --apply) backfill of gameKey onto gamemasterearnings.
 *
 * X7 step 5 stamps gameKey at write time. Rows created before that have no label.
 * This script joins each earning to its Competition or Challenge by sourceId and
 * copies that document's gameKey (absent → "trading", invariant 5).
 *
 * It NEVER rewrites a row that already has a non-blank gameKey — gameKey is the
 * join key for historical stats and must stay immutable once set.
 */

import mongoose from "mongoose";
import { TRADING_GAME_KEY } from "../../lib/services/gamemaster/earnings-by-game";
import { missingStringFilter } from "../games/backfill-game-labels-core";

export interface BackfillGmEarningResult {
  needing: number;
  updated: number;
  unresolved: number;
  bySource: { competition: number; challenge: number };
}

function coerceObjectId(id: string): mongoose.Types.ObjectId | string {
  if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

/**
 * Resolve the contest gameKey for one earning row from its source document.
 */
export async function resolveSourceGameKey(
  db: NonNullable<typeof mongoose.connection.db>,
  sourceType: string,
  sourceId: string,
): Promise<string | null> {
  const collection =
    sourceType === "challenge" ? "challenges" : "competitions";
  const id = coerceObjectId(sourceId);
  const doc = await db.collection(collection).findOne(
    { _id: id as mongoose.Types.ObjectId },
    { projection: { gameKey: 1 } },
  );
  if (!doc) return null;
  const raw = (doc as { gameKey?: string }).gameKey;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return TRADING_GAME_KEY;
}

/**
 * Count and optionally stamp missing gameKey on gamemasterearnings.
 */
export async function backfillGmEarningGameKeys(
  apply: boolean,
): Promise<BackfillGmEarningResult> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle on the mongoose connection.");

  const collection = db.collection("gamemasterearnings");
  const filter = missingStringFilter("gameKey");
  const needing = await collection.countDocuments(filter);

  const result: BackfillGmEarningResult = {
    needing,
    updated: 0,
    unresolved: 0,
    bySource: { competition: 0, challenge: 0 },
  };

  if (needing === 0) return result;

  const cursor = collection.find(filter).project({
    _id: 1,
    sourceType: 1,
    sourceId: 1,
    gameKey: 1,
  });

  for await (const row of cursor) {
    const sourceType = String(row.sourceType || "competition");
    const sourceId = String(row.sourceId || "");
    if (!sourceId) {
      result.unresolved += 1;
      continue;
    }

    const gameKey = await resolveSourceGameKey(db, sourceType, sourceId);
    if (!gameKey) {
      result.unresolved += 1;
      continue;
    }

    if (sourceType === "challenge") result.bySource.challenge += 1;
    else result.bySource.competition += 1;

    if (apply) {
      // Reason: re-assert missing filter on write so a concurrent stamp is not overwritten.
      const write = await collection.updateOne(
        { _id: row._id, ...missingStringFilter("gameKey") },
        { $set: { gameKey, updatedAt: new Date() } },
      );
      if (write.modifiedCount > 0) result.updated += 1;
    }
  }

  return result;
}
