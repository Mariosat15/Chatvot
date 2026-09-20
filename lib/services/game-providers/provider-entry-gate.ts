/**
 * X9 / E7 leftover — pre-start outage responses (chapter 07 section 3.2).
 *
 * Play-in-progress is handled by `provider-outage-pause.service.ts` (pause + extend).
 * These helpers cover the two rows that come *before* play:
 *
 *   Not yet open          → hide empty upcoming contests from discovery
 *   Registration open     → refuse new entries while the provider is down / disabled;
 *                           if still down when play opens, cancel and refund
 *
 * MAIN APP ONLY for the cancel-at-gun callers (Inngest + getCompetitionById).
 * The entry check is shared with any path that seats a player.
 */

import GameProvider from "@/database/models/games/game-provider.model";

export const PROVIDER_OUTAGE_ENTRY_MESSAGE =
  "This contest is temporarily unavailable — the game provider is having an outage. Try again when it recovers, or pick another contest.";

export const PROVIDER_OUTAGE_CANCEL_REASON =
  "Provider outage — contest cancelled before play started; entry fees refunded in full";

export type ProviderAvailabilityFacts = {
  enabled: boolean;
  healthStatus: "healthy" | "degraded" | "down" | string;
  healthDownSince?: Date | string | null;
};

/**
 * `healthStatus` DEFAULTS TO `"down"` AND IS NOT EVIDENCE OF AN OUTAGE.
 *
 * The field is written only by the kill-switch worker, and `nextHealthState`
 * passes the previous status through on `no_evidence` — so a provider that has
 * never produced a scored round keeps the schema default for ever. Reading the
 * status alone therefore refuses entry to a brand-new provider, which stops the
 * first round being created, which is what would have produced the evidence.
 * That is not fail-closed, it is unrecoverable without a database edit, and it
 * is the same field the admin health panel deliberately does not read.
 *
 * `healthDownSince` is the observed half: the worker stamps it only when a real
 * failure streak pushes a provider down, and `$unset`s it on recovery. Absent
 * means "never seen to be down", which is the default's actual meaning.
 */
export function providerObservedDown(
  provider: Pick<
    ProviderAvailabilityFacts,
    "healthStatus" | "healthDownSince"
  >,
): boolean {
  if (provider.healthStatus !== "down") return false;
  return provider.healthDownSince != null;
}

/**
 * Query form of `providerObservedDown`. `$type: "date"` covers both shapes an
 * unstamped field takes — absent and explicitly `null` — in one clause.
 */
export const PROVIDER_OBSERVED_DOWN_FILTER = {
  healthStatus: "down",
  healthDownSince: { $type: "date" },
} as const;

/**
 * A provider that is kill-switched off, or observed to be sustainedly down,
 * must not take new entry fees. Degraded still accepts entries — play may be
 * slow, but the contest can run.
 */
export function providerBlocksEntries(
  provider: ProviderAvailabilityFacts | null | undefined,
): boolean {
  if (!provider) return true;
  if (provider.enabled === false) return true;
  return providerObservedDown(provider);
}

export function providerKeyFromContest(contest: {
  gameType?: string | null;
  gameConfig?: { providerKey?: string | null } | null;
}): string | null {
  if (contest.gameType !== "provider") return null;
  const key = contest.gameConfig?.providerKey;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/**
 * Empty upcoming provider contests vanish from hubs while the provider is down.
 * Contests with paid seats stay visible so entrants can see the status; entry is
 * refused separately. Active contests are the pause/extend path, not this filter.
 */
export function shouldHideUpcomingEmptyDuringOutage(
  contest: {
    status?: string | null;
    gameType?: string | null;
    currentParticipants?: number | null;
    participants?: unknown[] | null;
    gameConfig?: { providerKey?: string | null } | null;
  },
  blockingProviderKeys: ReadonlySet<string> | readonly string[],
): boolean {
  if (contest.status !== "upcoming") return false;
  if (contest.gameType !== "provider") return false;
  const seats =
    contest.currentParticipants ??
    (Array.isArray(contest.participants) ? contest.participants.length : 0);
  if (seats > 0) return false;
  const key = providerKeyFromContest(contest);
  if (!key) return false;
  if (blockingProviderKeys instanceof Set) {
    return blockingProviderKeys.has(key);
  }
  return blockingProviderKeys.includes(key);
}

/** Provider keys that currently refuse new paid entry. */
export async function listProvidersBlockingEntries(): Promise<Set<string>> {
  const rows = await GameProvider.find({
    $or: [{ enabled: false }, PROVIDER_OBSERVED_DOWN_FILTER],
  })
    .select("providerKey")
    .lean<{ providerKey: string }[]>();
  return new Set(rows.map((r) => r.providerKey));
}

/**
 * Look up one provider and answer whether entry is blocked.
 * Missing key → block (fail closed: cannot verify the supplier is healthy).
 */
export async function providerBlocksContestEntry(
  providerKey: string,
): Promise<boolean> {
  const row = await GameProvider.findOne({ providerKey })
    .select("enabled healthStatus healthDownSince")
    .lean<ProviderAvailabilityFacts | null>();
  return providerBlocksEntries(row);
}
