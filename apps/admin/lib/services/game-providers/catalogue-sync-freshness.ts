/**
 * When a provider catalogue is considered stale for alerts and the admin banner.
 *
 * Owner decision, 24 September 2026: alert and the permanent red notice only after
 * more than seven days without a sync. The banner is the lasting signal; the security
 * alert fires once per stale episode so the logs are not spammed every minute.
 */

/** Seven days. Shared by the threshold monitor and the admin Games sync UI. */
export const CATALOGUE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True when there has never been a sync, or the last one is older than
 * {@link CATALOGUE_STALE_MS}.
 *
 * An absent / unparseable stamp is stale — never-synced is the strongest case for the
 * banner, not a reason to hide it.
 */
export function isCatalogueSyncStale(
  lastCatalogueSyncAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (lastCatalogueSyncAt == null || lastCatalogueSyncAt === "") return true;
  const t = new Date(lastCatalogueSyncAt).getTime();
  if (!Number.isFinite(t)) return true;
  return t < now.getTime() - CATALOGUE_STALE_MS;
}

/**
 * Fingerprint for one stale episode. Stable until the next successful sync, so the
 * threshold job can raise the SecurityAlert once and then skip forever until sync moves
 * `lastCatalogueSyncAt`.
 */
export function catalogueStaleFingerprint(
  providerKey: string,
  lastCatalogueSyncAt: Date | string | null | undefined,
): string {
  if (lastCatalogueSyncAt == null || lastCatalogueSyncAt === "") {
    return `catalogue-stale:${providerKey}:never`;
  }
  const iso = new Date(lastCatalogueSyncAt).toISOString();
  return `catalogue-stale:${providerKey}:${iso}`;
}
