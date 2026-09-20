/**
 * Chapter 06 s10 threshold monitors (X9 / E7).
 *
 * Scheduled every minute. Event-driven "any occurrence" alerts (signature, score range,
 * integrity flags, unresolved rounds) fire elsewhere — this job covers thresholds that
 * need a time window or a scan of contest/settlement state.
 *
 * Dedup: threshold alerts would spam every minute without a fingerprint check. "Any
 * occurrence" ingest alerts deliberately do NOT dedupe.
 */

import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import GameProvider from "@/database/models/games/game-provider.model";
import GameRound from "@/database/models/games/game-round.model";
import ProviderEvent from "@/database/models/games/provider-event.model";
import PlatformTransaction from "@/database/models/platform-financials.model";
import SecurityAlert from "@/database/models/security-alert.model";
import {
  recordSecurityAlert,
  type RecordSecurityAlertInput,
} from "@/lib/services/security/security-alert.service";
import type { SecurityAlertType } from "@/database/models/security-alert.model";

/** Contest stuck in settling — chapter 06 s10. */
export const STUCK_FINALIZING_MS = 10 * 60 * 1000;

/** Callback failure rate window and threshold. */
export const CALLBACK_FAILURE_WINDOW_MS = 60 * 60 * 1000;
export const CALLBACK_FAILURE_RATE_THRESHOLD = 0.01; // 1%
/** Need enough events so 1 failure of 2 is not a 50% false alarm. */
export const CALLBACK_FAILURE_MIN_EVENTS = 20;

/** Provider createRound latency p95. */
export const LATENCY_WINDOW_MS = 60 * 60 * 1000;
export const LATENCY_P95_MS = 5_000;
export const LATENCY_MIN_SAMPLES = 5;

/** Catalogue sync stale. */
export const CATALOGUE_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Repeat challenge pairing. Chapter says "above threshold" without a number.
 * Five completed/active challenges between the same ordered pair in 24h is enough to
 * review for soft-farming without colliding with the existing cooldown (minutes).
 */
export const REPEAT_PAIRING_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REPEAT_PAIRING_THRESHOLD = 5;

/** How long an unacked fingerprint suppresses a re-alert. */
const DEDUPE_MS = 60 * 60 * 1000;

/** Settled contests to scan for prize mismatch (recent only). */
const PRIZE_MISMATCH_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MONEY_EPSILON = 0.02;

const CALLBACK_FAILURE_RESULTS = new Set([
  "signature_invalid",
  "timestamp_rejected",
  "provider_unknown",
  "unparseable",
  "error",
]);

export interface ThresholdMonitorSummary {
  examined: number;
  alerts: number;
  skippedDuplicate: number;
  errors: string[];
}

export async function runProviderThresholdMonitors(
  now: Date = new Date(),
): Promise<ThresholdMonitorSummary> {
  const summary: ThresholdMonitorSummary = {
    examined: 0,
    alerts: 0,
    skippedDuplicate: 0,
    errors: [],
  };

  const runners: Array<() => Promise<void>> = [
    () => checkStuckFinalizing(now, summary),
    () => checkPrizePoolMismatch(now, summary),
    () => checkCallbackFailureRates(now, summary),
    () => checkProviderLatency(now, summary),
    () => checkCatalogueStale(now, summary),
    () => checkRepeatChallengePairing(now, summary),
  ];

  for (const run of runners) {
    try {
      await run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(message);
      console.error("⚠️ [THRESHOLD MONITORS] check failed:", err);
    }
  }

  return summary;
}

async function checkStuckFinalizing(
  now: Date,
  summary: ThresholdMonitorSummary,
): Promise<void> {
  const cutoff = new Date(now.getTime() - STUCK_FINALIZING_MS);

  const [comps, challenges] = await Promise.all([
    Competition.find({
      status: "finalizing",
      updatedAt: { $lt: cutoff },
    })
      .select("_id name gameKey updatedAt")
      .lean<{ _id: { toString(): string }; name: string; gameKey?: string; updatedAt: Date }[]>(),
    Challenge.find({
      status: "finalizing",
      updatedAt: { $lt: cutoff },
    })
      .select("_id slug gameKey updatedAt")
      .lean<{ _id: { toString(): string }; slug: string; gameKey?: string; updatedAt: Date }[]>(),
  ]);

  for (const c of comps) {
    summary.examined += 1;
    const id = c._id.toString();
    await alertOnce(summary, {
      alertType: "contest_stuck_finalizing",
      severity: "critical",
      source: "provider-threshold-monitors",
      reason: `Competition "${c.name}" has been stuck in finalizing for more than 10 minutes.`,
      fingerprint: `stuck-competition:${id}`,
      metadata: {
        contestKind: "competition",
        contestId: id,
        gameKey: c.gameKey ?? null,
        updatedAt: c.updatedAt?.toISOString?.() ?? null,
      },
    });
  }

  for (const ch of challenges) {
    summary.examined += 1;
    const id = ch._id.toString();
    await alertOnce(summary, {
      alertType: "contest_stuck_finalizing",
      severity: "critical",
      source: "provider-threshold-monitors",
      reason: `Challenge "${ch.slug}" has been stuck in finalizing for more than 10 minutes.`,
      fingerprint: `stuck-challenge:${id}`,
      metadata: {
        contestKind: "challenge",
        contestId: id,
        gameKey: ch.gameKey ?? null,
        updatedAt: ch.updatedAt?.toISOString?.() ?? null,
      },
    });
  }
}

async function checkPrizePoolMismatch(
  now: Date,
  summary: ThresholdMonitorSummary,
): Promise<void> {
  const since = new Date(now.getTime() - PRIZE_MISMATCH_LOOKBACK_MS);

  const contests = await Competition.find({
    status: "completed",
    updatedAt: { $gte: since },
    prizePool: { $gt: 0 },
  })
    .select("_id name prizePool finalLeaderboard")
    .lean<{
      _id: { toString(): string };
      name: string;
      prizePool: number;
      finalLeaderboard?: { prizeAmount?: number }[];
    }[]>();

  for (const c of contests) {
    summary.examined += 1;
    const id = c._id.toString();
    const prizes = (c.finalLeaderboard ?? []).reduce(
      (sum, row) => sum + (Number(row.prizeAmount) || 0),
      0,
    );

    const feeRows = await PlatformTransaction.find({
      sourceType: "competition",
      sourceId: id,
      transactionType: {
        $in: [
          "platform_fee",
          "unclaimed_pool",
          "retained_gm_fee",
        ],
      },
    })
      .select("amount transactionType")
      .lean<{ amount: number; transactionType: string }[]>();

    const booked = feeRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const accounted = prizes + booked;
    const pool = Number(c.prizePool) || 0;

    if (Math.abs(accounted - pool) <= MONEY_EPSILON) continue;

    await alertOnce(summary, {
      alertType: "prize_pool_mismatch",
      severity: "critical",
      source: "provider-threshold-monitors",
      reason: `Competition "${c.name}": prizes (${prizes.toFixed(2)}) + booked fees/unclaimed (${booked.toFixed(2)}) = ${accounted.toFixed(2)}, but prizePool is ${pool.toFixed(2)}.`,
      fingerprint: `prize-mismatch:${id}`,
      metadata: {
        contestId: id,
        prizePool: pool,
        prizesPaid: prizes,
        bookedFees: booked,
        accounted,
        feeTypes: feeRows.map((r) => r.transactionType),
      },
    });
  }
}

async function checkCallbackFailureRates(
  now: Date,
  summary: ThresholdMonitorSummary,
): Promise<void> {
  const since = new Date(now.getTime() - CALLBACK_FAILURE_WINDOW_MS);

  const grouped = await ProviderEvent.aggregate<{
    _id: string;
    total: number;
    failures: number;
  }>([
    { $match: { receivedAt: { $gte: since }, processingResult: { $exists: true } } },
    {
      $group: {
        _id: "$providerKey",
        total: { $sum: 1 },
        failures: {
          $sum: {
            $cond: [
              { $in: ["$processingResult", [...CALLBACK_FAILURE_RESULTS]] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  for (const row of grouped) {
    summary.examined += 1;
    if (row.total < CALLBACK_FAILURE_MIN_EVENTS) continue;
    const rate = row.failures / row.total;
    if (rate <= CALLBACK_FAILURE_RATE_THRESHOLD) continue;

    await alertOnce(summary, {
      alertType: "provider_callback_failure_rate",
      severity: "high",
      source: "provider-threshold-monitors",
      provider: row._id,
      reason: `Provider "${row._id}" callback failure rate ${(rate * 100).toFixed(1)}% over the last hour (${row.failures}/${row.total}).`,
      fingerprint: `callback-fail-rate:${row._id}:${hourBucket(now)}`,
      metadata: {
        providerKey: row._id,
        failures: row.failures,
        total: row.total,
        rate,
        windowMs: CALLBACK_FAILURE_WINDOW_MS,
      },
    });
  }
}

async function checkProviderLatency(
  now: Date,
  summary: ThresholdMonitorSummary,
): Promise<void> {
  const since = new Date(now.getTime() - LATENCY_WINDOW_MS);

  const grouped = await GameRound.aggregate<{
    _id: string;
    samples: number[];
  }>([
    {
      $match: {
        createdAt: { $gte: since },
        providerCreateLatencyMs: { $type: "number", $gte: 0 },
      },
    },
    {
      $group: {
        _id: "$providerKey",
        samples: { $push: "$providerCreateLatencyMs" },
      },
    },
  ]);

  for (const row of grouped) {
    summary.examined += 1;
    if (row.samples.length < LATENCY_MIN_SAMPLES) continue;
    const p95 = percentile(row.samples, 0.95);
    if (p95 <= LATENCY_P95_MS) continue;

    await alertOnce(summary, {
      alertType: "provider_latency_high",
      severity: "high",
      source: "provider-threshold-monitors",
      provider: row._id,
      reason: `Provider "${row._id}" createRound p95 latency ${Math.round(p95)}ms over the last hour (threshold ${LATENCY_P95_MS}ms, n=${row.samples.length}).`,
      fingerprint: `latency-p95:${row._id}:${hourBucket(now)}`,
      metadata: {
        providerKey: row._id,
        p95Ms: p95,
        sampleCount: row.samples.length,
        thresholdMs: LATENCY_P95_MS,
      },
    });
  }
}

async function checkCatalogueStale(
  now: Date,
  summary: ThresholdMonitorSummary,
): Promise<void> {
  const cutoff = new Date(now.getTime() - CATALOGUE_STALE_MS);

  const providers = await GameProvider.find({})
    .select("providerKey displayName enabled lastCatalogueSyncAt")
    .lean<
      {
        providerKey: string;
        displayName: string;
        enabled: boolean;
        lastCatalogueSyncAt?: Date | null;
      }[]
    >();

  for (const p of providers) {
    summary.examined += 1;
    // Reason: a disabled provider with a stale catalogue is noise — sync is for titles
    // that can still be offered. Enabled ones (or never-synced) matter.
    if (!p.enabled) continue;

    const last = p.lastCatalogueSyncAt
      ? new Date(p.lastCatalogueSyncAt)
      : null;
    const stale = !last || last.getTime() < cutoff.getTime();
    if (!stale) continue;

    await alertOnce(summary, {
      alertType: "catalogue_sync_stale",
      severity: "low",
      source: "provider-threshold-monitors",
      provider: p.providerKey,
      reason: last
        ? `Catalogue for "${p.displayName}" was last synced more than 24 hours ago (${last.toISOString()}).`
        : `Catalogue for "${p.displayName}" has never been synced.`,
      fingerprint: `catalogue-stale:${p.providerKey}:${dayBucket(now)}`,
      metadata: {
        providerKey: p.providerKey,
        lastCatalogueSyncAt: last?.toISOString() ?? null,
      },
    });
  }
}

async function checkRepeatChallengePairing(
  now: Date,
  summary: ThresholdMonitorSummary,
): Promise<void> {
  const since = new Date(now.getTime() - REPEAT_PAIRING_WINDOW_MS);

  // Directed pair: challenger → challenged. Open challenges have no challengedId and are
  // excluded — farming an open seat is a different question.
  const pairs = await Challenge.aggregate<{
    _id: { a: string; b: string };
    n: number;
  }>([
    {
      $match: {
        createdAt: { $gte: since },
        challengedId: { $type: "string", $ne: "" },
        status: {
          $in: [
            "pending",
            "accepted",
            "active",
            "completed",
            "finalizing",
          ],
        },
      },
    },
    {
      $group: {
        _id: { a: "$challengerId", b: "$challengedId" },
        n: { $sum: 1 },
      },
    },
    { $match: { n: { $gte: REPEAT_PAIRING_THRESHOLD } } },
  ]);

  for (const row of pairs) {
    summary.examined += 1;
    const { a, b } = row._id;
    await alertOnce(summary, {
      alertType: "repeat_challenge_pairing",
      severity: "medium",
      source: "provider-threshold-monitors",
      reason: `Players ${a} and ${b} have ${row.n} challenges together in the last 24 hours (threshold ${REPEAT_PAIRING_THRESHOLD}).`,
      fingerprint: `repeat-pair:${a}:${b}:${dayBucket(now)}`,
      metadata: {
        challengerId: a,
        challengedId: b,
        count: row.n,
        threshold: REPEAT_PAIRING_THRESHOLD,
        windowMs: REPEAT_PAIRING_WINDOW_MS,
      },
    });
  }
}

/** Pure percentile helper — exported for tests. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1),
  );
  // Reason: idx is clamped to [0, length-1]; not a user-controlled key.
  // eslint-disable-next-line security/detect-object-injection -- bounded array index
  return sorted[idx] ?? 0;
}

function hourBucket(now: Date): string {
  return now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function dayBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function alertOnce(
  summary: ThresholdMonitorSummary,
  input: RecordSecurityAlertInput & { fingerprint: string },
): Promise<void> {
  const { fingerprint, ...alertInput } = input;
  const recent = await SecurityAlert.findOne({
    alertType: alertInput.alertType as SecurityAlertType,
    "metadata.fingerprint": fingerprint,
    acknowledged: false,
    createdAt: { $gte: new Date(Date.now() - DEDUPE_MS) },
  })
    .select("_id")
    .lean();

  if (recent) {
    summary.skippedDuplicate += 1;
    return;
  }

  const doc = await recordSecurityAlert({
    ...alertInput,
    metadata: { ...(alertInput.metadata ?? {}), fingerprint },
  });
  if (doc) summary.alerts += 1;
}
