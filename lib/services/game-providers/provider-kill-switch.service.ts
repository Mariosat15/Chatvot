/**
 * X9 / E7 — automatic provider kill switch (chapter 07 sections 3.1 and 3.3).
 *
 * Each minute:
 *   1. For every *enabled* provider with a registered adapter, look at recent
 *      round/event evidence (short window — "is it broken now").
 *   2. Bump or reset `healthFailureStreak`. Three consecutive failures →
 *      `degraded`; sustained failure → `down` and stamp `healthDownSince`.
 *   3. If `down` for more than 15 minutes, record a critical SecurityAlert — once
 *      per outage episode, whatever happens next.
 *   4. THEN, and only if the operator set `autoOutageResponseEnabled` on that
 *      provider, set `enabled: false` (new contests and rounds refuse via
 *      `resolveEnabledProvider`). Live contests continue either way.
 *
 * Owner decision, 20 September 2026: step 4 is opt-in per provider and off by
 * default. Taking a supplier off sale is an operator's call. Step 3 is not opt-in,
 * because the operator making that call needs to be told there is one to make —
 * and the alert used to be a side effect of the disable, so without splitting them
 * switching the automation off would also switch off the notice.
 *
 * No catalogue HTTP ping in this slice — evidence is the same shape the admin
 * health screen already trusts. Idle providers (`no_evidence`) do not accumulate
 * streak: killing a quiet provider for having no traffic is the wrong failure.
 *
 * MAIN APP ONLY (worker). Do not mirror ahead of an admin caller.
 */

import GameProvider from "@/database/models/games/game-provider.model";
import GameRound from "@/database/models/games/game-round.model";
import ProviderEvent from "@/database/models/games/provider-event.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { recordSecurityAlert } from "@/lib/services/security/security-alert.service";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";

/** How far back one probe looks for failure evidence. */
export const KILL_SWITCH_OBSERVATION_MS = 30 * 60 * 1000;

/** Chapter 07 s3.3: disable new creation after this long continuously down. */
export const KILL_SWITCH_DOWN_MS = 15 * 60 * 1000;

/** Chapter 07 s3.1: three consecutive failures → degraded. */
export const KILL_SWITCH_DEGRADED_STREAK = 3;

/** Sustained failure past degraded → down (and start the 15-minute clock). */
export const KILL_SWITCH_DOWN_STREAK = 5;

const ENDED_WITHOUT_RESULT = ["abandoned", "expired", "voided"] as const;

export type ProbeEvidence = "ok" | "fail" | "no_evidence";

export interface KillSwitchProviderResult {
  providerKey: string;
  evidence: ProbeEvidence;
  streak: number;
  healthStatus: "healthy" | "degraded" | "down";
  disabled: boolean;
  alerted: boolean;
  /**
   * The outage lasted long enough to act on, and the operator has not opted in.
   * Reported rather than left silent: "0 disabled" is the same number whether
   * nothing was wrong or four providers were down and nobody had asked us to act.
   */
  autoResponseWithheld: boolean;
}

export interface RunProviderKillSwitchSummary {
  examined: number;
  updated: number;
  disabled: number;
  alerts: number;
  /** Outages past the 15-minute mark that were left alone because the flag is off. */
  withheld: number;
  skipped: number;
  errors: string[];
  providers: KillSwitchProviderResult[];
}

/**
 * Classify one provider's recent traffic. Pure so tests can drive the streak
 * without seeding every collection.
 */
export function classifyProviderEvidence(input: {
  completed: number;
  unresolved: number;
  endedWithoutResult: number;
  signatureInvalid: number;
  scored: number;
}): ProbeEvidence {
  const finished =
    input.completed + input.unresolved + input.endedWithoutResult;

  // Signature failures with nothing scored: every result refused unread.
  if (input.signatureInvalid > 0 && input.scored === 0) {
    return "fail";
  }

  if (finished === 0 && input.completed === 0) {
    return "no_evidence";
  }

  // Finished rounds and none produced a score.
  if (input.completed === 0 && finished > 0) {
    return "fail";
  }

  // High unresolved share among finished rounds.
  if (finished > 0 && input.unresolved / finished > 0.1) {
    return "fail";
  }

  return "ok";
}

/**
 * Next streak / status from one probe. Pure.
 *
 * Reason `no_evidence` neither increments nor resets: a quiet minute after an
 * outage must not wipe the clock, and a quiet minute alone must not start one.
 */
export function nextHealthState(input: {
  evidence: ProbeEvidence;
  previousStreak: number;
  previousStatus: "healthy" | "degraded" | "down";
  previousDownSince: Date | null;
  now: Date;
}): {
  streak: number;
  healthStatus: "healthy" | "degraded" | "down";
  healthDownSince: Date | null;
} {
  const { evidence, previousStreak, previousDownSince, now } = input;

  if (evidence === "no_evidence") {
    return {
      streak: previousStreak,
      healthStatus: input.previousStatus,
      healthDownSince: previousDownSince,
    };
  }

  if (evidence === "ok") {
    return {
      streak: 0,
      healthStatus: "healthy",
      healthDownSince: null,
    };
  }

  const streak = previousStreak + 1;
  let healthStatus: "healthy" | "degraded" | "down" = "healthy";
  if (streak >= KILL_SWITCH_DOWN_STREAK) {
    healthStatus = "down";
  } else if (streak >= KILL_SWITCH_DEGRADED_STREAK) {
    healthStatus = "degraded";
  }

  let healthDownSince: Date | null = previousDownSince;
  if (healthStatus === "down") {
    healthDownSince = previousDownSince ?? now;
  } else {
    healthDownSince = null;
  }

  return { streak, healthStatus, healthDownSince };
}

/** Recent round/event counts for one provider. Exported for the outage pause sibling. */
export async function loadProviderEvidence(
  providerKey: string,
  since: Date,
): Promise<Parameters<typeof classifyProviderEvidence>[0]> {
  const [rounds, events] = await Promise.all([
    GameRound.aggregate<{ _id: string; n: number }>([
      { $match: { providerKey, createdAt: { $gte: since } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    ProviderEvent.aggregate<{ _id: string; n: number }>([
      { $match: { providerKey, receivedAt: { $gte: since } } },
      { $group: { _id: "$processingResult", n: { $sum: 1 } } },
    ]),
  ]);

  const roundCount = (status: string) =>
    rounds.find((r) => r._id === status)?.n ?? 0;
  const endedWithoutResult = ENDED_WITHOUT_RESULT.reduce(
    (sum, s) => sum + roundCount(s),
    0,
  );
  const eventCount = (result: string) =>
    events.find((e) => e._id === result)?.n ?? 0;

  return {
    completed: roundCount("completed"),
    unresolved: roundCount("unresolved"),
    endedWithoutResult,
    signatureInvalid: eventCount("signature_invalid"),
    scored: eventCount("scored"),
  };
}

async function loadEvidence(
  providerKey: string,
  since: Date,
): Promise<Parameters<typeof classifyProviderEvidence>[0]> {
  return loadProviderEvidence(providerKey, since);
}

/**
 * Disable new contests/rounds for a provider. Claims via `enabled: true` so a
 * retried Agenda pass cannot disable twice. WhiteLabel is updated too because
 * `resolveEnabledProvider` reads that flag, not the GameProvider row.
 *
 * Correction, 20 September 2026: this claim used to gate the alert as well. It no
 * longer does — `claimOutageAlert` owns that — because an operator who has opted
 * out of automatic disabling still needs telling. The comment said "double-alert"
 * and is corrected in place rather than retensed, since it was true for a fortnight.
 */
async function disableProvider(providerKey: string): Promise<boolean> {
  const claimed = await GameProvider.findOneAndUpdate(
    { providerKey, enabled: true },
    { $set: { enabled: false } },
    { new: true },
  );
  if (!claimed) return false;

  const settings = await WhiteLabel.findOne().select("gameProviders");
  if (!settings) return true;

  const list = settings.gameProviders ?? [];
  const entry = list.find((p) => p.providerKey === providerKey);
  if (entry) {
    entry.enabled = false;
  } else {
    list.push({
      providerKey,
      enabled: false,
      baseUrl: claimed.baseUrl,
      displayName: claimed.displayName,
    });
  }
  settings.gameProviders = list;
  await settings.save();
  return true;
}

/**
 * Claim the one alert this outage episode is allowed, atomically.
 *
 * Previously the `enabled: true → false` write was the claim, which made the
 * alert impossible without the disable. `outageAlertedAt` is the claim now: it is
 * set only when it is absent or older than the current `healthDownSince`, so a
 * retried Agenda pass finds it already stamped and a *later* outage — which gets
 * a fresh `healthDownSince`, the old one being `$unset` on recovery — re-arms it.
 */
async function claimOutageAlert(
  providerKey: string,
  downSince: Date,
  now: Date,
): Promise<boolean> {
  const claimed = await GameProvider.findOneAndUpdate(
    {
      providerKey,
      $or: [
        { outageAlertedAt: { $exists: false } },
        { outageAlertedAt: null },
        { outageAlertedAt: { $lt: downSince } },
      ],
    },
    { $set: { outageAlertedAt: now } },
  );
  return Boolean(claimed);
}

/**
 * One Agenda pass over every enabled provider.
 */
export async function runProviderKillSwitch(
  now: Date = new Date(),
): Promise<RunProviderKillSwitchSummary> {
  const summary: RunProviderKillSwitchSummary = {
    examined: 0,
    updated: 0,
    disabled: 0,
    alerts: 0,
    withheld: 0,
    skipped: 0,
    errors: [],
    providers: [],
  };

  const since = new Date(now.getTime() - KILL_SWITCH_OBSERVATION_MS);

  const providers = await GameProvider.find({ enabled: true }).lean<
    {
      providerKey: string;
      healthStatus?: "healthy" | "degraded" | "down";
      healthFailureStreak?: number;
      healthDownSince?: Date | null;
      autoOutageResponseEnabled?: boolean;
    }[]
  >();

  for (const provider of providers) {
    const key = provider.providerKey;
    summary.examined += 1;

    try {
      if (!getProviderAdapter(key)) {
        summary.skipped += 1;
        continue;
      }

      const counts = await loadEvidence(key, since);
      const evidence = classifyProviderEvidence(counts);
      const next = nextHealthState({
        evidence,
        previousStreak: provider.healthFailureStreak ?? 0,
        previousStatus: provider.healthStatus ?? "down",
        previousDownSince: provider.healthDownSince ?? null,
        now,
      });

      await GameProvider.updateOne(
        { providerKey: key },
        {
          $set: {
            healthStatus: next.healthStatus,
            healthFailureStreak: next.streak,
            lastHealthCheckAt: now,
            ...(next.healthDownSince
              ? { healthDownSince: next.healthDownSince }
              : {}),
          },
          ...(next.healthDownSince
            ? {}
            : { $unset: { healthDownSince: 1 } }),
        },
      );
      summary.updated += 1;

      let disabled = false;
      let alerted = false;
      let autoResponseWithheld = false;

      if (
        next.healthStatus === "down" &&
        next.healthDownSince &&
        now.getTime() - next.healthDownSince.getTime() >= KILL_SWITCH_DOWN_MS
      ) {
        const mayAct = provider.autoOutageResponseEnabled === true;

        // Alert first, and unconditionally. The operator who has asked to make
        // this decision themselves is exactly the one who must hear about it.
        if (await claimOutageAlert(key, next.healthDownSince, now)) {
          const alert = await recordSecurityAlert({
            alertType: "provider_kill_switch",
            severity: "critical",
            source: "provider-kill-switch",
            provider: key,
            reason: mayAct
              ? `Provider "${key}" has been down for more than 15 minutes and is being automatically disabled. New contests and rounds are blocked; live contests continue.`
              : `Provider "${key}" has been down for more than 15 minutes. Automatic response is OFF for this provider, so nothing has been blocked — new contests, entries and rounds are still being accepted. Switch the provider off by hand if you want it taken out of sale.`,
            metadata: {
              providerKey: key,
              healthDownSince: next.healthDownSince.toISOString(),
              streak: next.streak,
              observationMs: KILL_SWITCH_OBSERVATION_MS,
              autoOutageResponseEnabled: mayAct,
            },
          });
          if (alert) {
            alerted = true;
            summary.alerts += 1;
          }
        }

        if (mayAct) {
          disabled = await disableProvider(key);
          if (disabled) summary.disabled += 1;
        } else {
          autoResponseWithheld = true;
          summary.withheld += 1;
        }
      }

      summary.providers.push({
        providerKey: key,
        evidence,
        streak: next.streak,
        healthStatus: next.healthStatus,
        disabled,
        alerted,
        autoResponseWithheld,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${key}: ${message}`);
      console.error(`⚠️ Kill switch: provider ${key} failed:`, err);
    }
  }

  return summary;
}
