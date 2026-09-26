/**
 * Load a Game Master package's `gameMasterConfig` for limit resolution.
 *
 * WHY THIS EXISTS. Dashboard, status and create paths all needed the same lookup, and the
 * dashboard used to rebuild limits by hand from the package while create used
 * `resolveCreationLimits`. When those disagreed, the GM screen showed a stale daily cap
 * (e.g. 10) after an admin had set the package to 2. One loader, one resolver.
 *
 * Callers pass a Db handle so both Mongoose-model and raw-driver routes can share it.
 */

import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { GameMasterPackageConfig } from "./subscription-limits";

export async function loadGameMasterPackageConfig(
  db: Db,
  packageId: string | null | undefined,
): Promise<GameMasterPackageConfig | null> {
  if (!packageId || typeof packageId !== "string") return null;
  const trimmed = packageId.trim();
  if (!trimmed || !ObjectId.isValid(trimmed)) return null;

  try {
    const pkg = await db.collection("marketplaceitems").findOne(
      { _id: new ObjectId(trimmed) },
      { projection: { gameMasterConfig: 1 } },
    );
    return (pkg?.gameMasterConfig as GameMasterPackageConfig | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Match subscriptions for a marketplace package whether `packageId` was stored as a
 * string (activate/purchase) or historically as an ObjectId.
 */
export function packageIdSyncFilter(itemId: string): Record<string, unknown> {
  const idStr = String(itemId);
  if (ObjectId.isValid(idStr)) {
    return {
      $or: [{ packageId: idStr }, { packageId: new ObjectId(idStr) }],
    };
  }
  return { packageId: idStr };
}
