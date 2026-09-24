/**
 * Friday 00:00 UTC automatic catalogue sync for providers that opted in.
 *
 * Owner decision, 24 September 2026: operators can flip `autoCatalogueSyncFriday` on a
 * provider so the worker pulls that catalogue every Friday at midnight UTC without a
 * click. Same sync path as the admin button — never enables a title, never deletes rows.
 *
 * The job is scheduled hourly and only acts in the Friday 00:00–00:59 UTC window, with a
 * per-Friday claim so a restart mid-hour cannot run the same provider twice.
 */

import GameProvider from "@/database/models/games/game-provider.model";
import { getProviderAdapter } from "./registry";
import { syncProviderCatalogue } from "./catalogue.service";

export interface FridayAutoSyncSummary {
  /** Wall clock used for the Friday / midnight checks. */
  now: string;
  skippedReason?: "not_friday" | "not_midnight_hour";
  examined: number;
  synced: number;
  failed: number;
  skippedNoAdapter: number;
  skippedAlreadyRun: number;
  errors: string[];
}

/** UTC Friday. */
export function isUtcFriday(now: Date): boolean {
  return now.getUTCDay() === 5;
}

/** First hour of the UTC day (00:00–00:59). */
export function isUtcMidnightHour(now: Date): boolean {
  return now.getUTCHours() === 0;
}

/** `YYYY-MM-DD` of the current UTC calendar day — the claim key for one Friday run. */
export function fridayAutoSyncClaimKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function runCatalogueFridayAutoSync(
  now: Date = new Date(),
): Promise<FridayAutoSyncSummary> {
  const summary: FridayAutoSyncSummary = {
    now: now.toISOString(),
    examined: 0,
    synced: 0,
    failed: 0,
    skippedNoAdapter: 0,
    skippedAlreadyRun: 0,
    errors: [],
  };

  if (!isUtcFriday(now)) {
    summary.skippedReason = "not_friday";
    return summary;
  }
  if (!isUtcMidnightHour(now)) {
    summary.skippedReason = "not_midnight_hour";
    return summary;
  }

  const claimKey = fridayAutoSyncClaimKey(now);

  const providers = await GameProvider.find({
    autoCatalogueSyncFriday: true,
  })
    .select("providerKey displayName lastFridayAutoSyncClaimKey")
    .lean<
      {
        providerKey: string;
        displayName: string;
        lastFridayAutoSyncClaimKey?: string | null;
      }[]
    >();

  for (const provider of providers) {
    summary.examined += 1;

    if (provider.lastFridayAutoSyncClaimKey === claimKey) {
      summary.skippedAlreadyRun += 1;
      continue;
    }

    const adapter = getProviderAdapter(provider.providerKey);
    if (!adapter) {
      summary.skippedNoAdapter += 1;
      console.warn(
        `⚠️ [CATALOGUE FRIDAY SYNC] No adapter for "${provider.providerKey}" — skipped.`,
      );
      continue;
    }

    // Claim before the network call so a slow provider cannot be double-synced if the
    // hour job overlaps a retry. A failed sync still burns the claim for this Friday —
    // operators see the failure in logs and can sync manually; re-trying every hour of
    // Friday midnight would reintroduce the spam this job exists to avoid.
    const claimed = await GameProvider.findOneAndUpdate(
      {
        providerKey: provider.providerKey,
        autoCatalogueSyncFriday: true,
        $or: [
          { lastFridayAutoSyncClaimKey: { $exists: false } },
          { lastFridayAutoSyncClaimKey: null },
          { lastFridayAutoSyncClaimKey: { $ne: claimKey } },
        ],
      },
      { $set: { lastFridayAutoSyncClaimKey: claimKey } },
      { new: true },
    );

    if (!claimed) {
      summary.skippedAlreadyRun += 1;
      continue;
    }

    try {
      const result = await syncProviderCatalogue(adapter);
      if (!result.success) {
        summary.failed += 1;
        const message =
          result.error ??
          `Provider "${provider.providerKey}" did not return a catalogue.`;
        summary.errors.push(message);
        console.error(`❌ [CATALOGUE FRIDAY SYNC] ${message}`);
        continue;
      }
      summary.synced += 1;
      console.log(
        `📊 [CATALOGUE FRIDAY SYNC] ${provider.providerKey}: ${result.created} added, ${result.updated} updated, ${result.unchanged} unchanged`,
      );
    } catch (err) {
      summary.failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${provider.providerKey}: ${message}`);
      console.error(
        `❌ [CATALOGUE FRIDAY SYNC] ${provider.providerKey}:`,
        err,
      );
    }
  }

  return summary;
}
