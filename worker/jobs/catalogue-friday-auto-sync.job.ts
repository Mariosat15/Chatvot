/**
 * Friday 00:00 UTC catalogue auto-sync job.
 *
 * Hourly. Only acts in the Friday 00:00–00:59 UTC window for providers with
 * `autoCatalogueSyncFriday` on. See catalogue-friday-auto-sync.service.ts.
 */

import { connectToDatabase } from "../config/database";
import type { FridayAutoSyncSummary } from "../../lib/services/game-providers/catalogue-friday-auto-sync.service";

export type CatalogueFridayAutoSyncJobResult = FridayAutoSyncSummary;

export async function runCatalogueFridayAutoSyncCheck(): Promise<CatalogueFridayAutoSyncJobResult> {
  await connectToDatabase();

  const { runCatalogueFridayAutoSync } = await import(
    "../../lib/services/game-providers/catalogue-friday-auto-sync.service"
  );

  return runCatalogueFridayAutoSync();
}
