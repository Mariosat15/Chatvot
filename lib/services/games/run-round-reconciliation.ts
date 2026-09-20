/**
 * X9 / E7 — the scheduled caller of the reconciliation net.
 *
 * `reconciliation.service.ts` owns the decision (poll / sweep / policy). This file owns
 * the loop: find expired live rounds, load the contest's config, call `reconcileRound`,
 * and fire the alert / player notify the outcome names. Nothing here moves money —
 * stage 4 writes `status: "unresolved"` and settlement re-derives refunds and holds.
 *
 * MAIN APP ONLY. Mirroring ahead of an admin caller is how R42 left two agreeing copies
 * with one of them unreachable.
 *
 * ORPHAN ROUNDS (contest row gone). Skipping + alerting forever is how a deleted challenge
 * pages critical every minute with nobody able to act — the contest that would carry the
 * policy no longer exists. Void once (same status as a cancelled contest's live rounds),
 * alert once, leave the live set. `unresolved` would be wrong here: settlement re-derives
 * from that status against a contest it cannot load.
 */

import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import GameRound, {
  canTransitionRound,
  LIVE_ROUND_STATUSES,
  type IGameRound,
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import { recordSecurityAlert } from "@/lib/services/security/security-alert.service";
import { resolveUnresolvedPolicy } from "@/lib/services/settlement/unresolved-rounds";
import { deriveChallengeWindow } from "./challenge-window";
import {
  findRoundsNeedingReconciliation,
  reconcileRound,
  type ReconciliationOutcome,
  type RoundReconciliationConfig,
} from "./reconciliation.service";
import { DEFAULT_RESULT_GRACE_SECONDS } from "./round-types";

/** Integrity flag stamped when a live round is voided because its contest row is gone. */
export const ORPHAN_CONTEST_MISSING_FLAG = "orphan_contest_missing";

export interface RunRoundReconciliationSummary {
  examined: number;
  reconciled: number;
  resolved: number;
  policiesApplied: number;
  skipped: number;
  /** Live rounds voided because competition/challenge no longer exists. */
  orphansRetired: number;
  alerts: number;
  notified: number;
  errors: string[];
}

/**
 * One Agenda pass over every expired live provider round.
 *
 * Never throws out of the per-round loop: one bad document must not stall the batch.
 */
export async function runRoundReconciliation(
  now: Date = new Date(),
  limit = 100,
): Promise<RunRoundReconciliationSummary> {
  const summary: RunRoundReconciliationSummary = {
    examined: 0,
    reconciled: 0,
    resolved: 0,
    policiesApplied: 0,
    skipped: 0,
    orphansRetired: 0,
    alerts: 0,
    notified: 0,
    errors: [],
  };

  const rounds = await findRoundsNeedingReconciliation(limit, now);
  summary.examined = rounds.length;

  for (const round of rounds) {
    try {
      if (round.contestType === "practice") {
        summary.skipped++;
        continue;
      }

      const config = await resolveRoundConfig(round);
      if (!config.ok) {
        if (config.orphan) {
          const retired = await retireOrphanRound(round);
          if (retired) {
            summary.orphansRetired++;
            summary.resolved++;
            await fireAlert(round, {
              roundId: round.roundId,
              stage: "policy",
              resolved: true,
              alert: "critical",
              detail: config.reason,
            });
            summary.alerts++;
          } else {
            summary.skipped++;
          }
          continue;
        }

        summary.skipped++;
        await fireAlert(round, {
          roundId: round.roundId,
          stage: "wait",
          resolved: false,
          alert: "critical",
          detail: config.reason,
        });
        summary.alerts++;
        continue;
      }

      const outcome = await reconcileRound(round, config.value, now);
      summary.reconciled++;
      if (outcome.resolved) summary.resolved++;
      if (outcome.policyApplied) summary.policiesApplied++;

      if (outcome.alert) {
        await fireAlert(round, outcome);
        summary.alerts++;
      }
      if (outcome.notifyPlayer) {
        const sent = await firePlayerNotify(round, outcome);
        if (sent) summary.notified++;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reconciliation error";
      summary.errors.push(`${round.roundId}: ${message}`);
      console.error(
        `❌ [ROUND RECONCILIATION] Failed for ${round.roundId}:`,
        message,
      );
    }
  }

  return summary;
}

type ConfigResult =
  | { ok: true; value: RoundReconciliationConfig }
  | { ok: false; reason: string; orphan?: boolean };

async function resolveRoundConfig(round: IGameRound): Promise<ConfigResult> {
  if (!round.contestId) {
    return {
      ok: false,
      orphan: true,
      reason: `Round ${round.roundId} has no contestId; cannot load reconciliation config.`,
    };
  }

  if (round.contestType === "competition") {
    const competition = await Competition.findById(round.contestId)
      .select("playWindowEnd endTime resultGracePeriodSeconds unresolvedRoundPolicy")
      .lean<{
        playWindowEnd?: Date;
        endTime?: Date;
        resultGracePeriodSeconds?: number;
        unresolvedRoundPolicy?: string;
      } | null>();

    if (!competition) {
      return {
        ok: false,
        orphan: true,
        reason: `Competition ${String(round.contestId)} not found for round ${round.roundId}.`,
      };
    }

    const playWindowEnd = competition.playWindowEnd ?? competition.endTime;
    if (!playWindowEnd) {
      return {
        ok: false,
        reason: `Competition ${String(round.contestId)} has no playWindowEnd or endTime.`,
      };
    }

    return {
      ok: true,
      value: {
        unresolvedRoundPolicy: resolveUnresolvedPolicy(
          competition.unresolvedRoundPolicy,
        ),
        resultGracePeriodSeconds:
          competition.resultGracePeriodSeconds ?? DEFAULT_RESULT_GRACE_SECONDS,
        playWindowEnd: new Date(playWindowEnd),
      },
    };
  }

  if (round.contestType === "challenge") {
    const challenge = await Challenge.findById(round.contestId)
      .select("startTime endTime")
      .lean<{ startTime?: Date; endTime?: Date } | null>();

    if (!challenge) {
      return {
        ok: false,
        orphan: true,
        reason: `Challenge ${String(round.contestId)} not found for round ${round.roundId}.`,
      };
    }

    const window = deriveChallengeWindow(challenge);
    if (!window) {
      return {
        ok: false,
        reason: `Challenge ${String(round.contestId)} has no play window (not yet accepted).`,
      };
    }

    // Reason: Challenge stores neither field. Create preflight hard-codes score_zero and
    // derives grace; the net must answer the same way or a challenge round would sit live
    // forever while competition rounds of the same provider get swept.
    return {
      ok: true,
      value: {
        unresolvedRoundPolicy: "score_zero",
        resultGracePeriodSeconds: DEFAULT_RESULT_GRACE_SECONDS,
        playWindowEnd: window.playWindowEnd,
      },
    };
  }

  return {
    ok: false,
    orphan: true,
    reason: `Unknown contestType "${String(round.contestType)}" on round ${round.roundId}.`,
  };
}

/**
 * End a live round whose contest row is gone so the next Agenda pass cannot see it.
 *
 * Idempotent under concurrency: the filter requires a live status, so a second worker
 * finding the same orphan gets `null` and counts as skipped rather than re-alerting.
 */
async function retireOrphanRound(round: IGameRound): Promise<boolean> {
  if (!canTransitionRound(round.status as RoundStatus, "voided")) {
    return false;
  }

  const updated = await GameRound.findOneAndUpdate(
    {
      roundId: round.roundId,
      status: { $in: LIVE_ROUND_STATUSES },
    },
    {
      $set: {
        status: "voided",
        // Reason: same shape as contest-round-cleanup's cancelled outcome — a platform
        // decision that the attempt is unusable, not a policy give-up with a contest still
        // there to settle.
        resultSource: "manual",
        resultReceivedAt: new Date(),
      },
      $addToSet: { integrityFlags: ORPHAN_CONTEST_MISSING_FLAG },
    },
    { new: true },
  );

  if (!updated) {
    return false;
  }

  console.warn(
    `🛑 [ROUND RECONCILIATION] Voided orphan round ${round.roundId} (${round.contestType} ${String(round.contestId)} missing)`,
  );
  return true;
}

async function fireAlert(
  round: IGameRound,
  outcome: ReconciliationOutcome,
): Promise<void> {
  const severity = outcome.alert === "critical" ? "critical" : "high";
  await recordSecurityAlert({
    alertType: "round_unresolved",
    severity,
    source: "round-reconciliation",
    provider: round.providerKey,
    userId: round.userId,
    reason:
      outcome.detail ??
      `Round ${round.roundId} reconciliation ${outcome.stage} raised ${outcome.alert}.`,
    metadata: {
      roundId: round.roundId,
      contestId: round.contestId ? String(round.contestId) : null,
      contestType: round.contestType,
      stage: outcome.stage,
      policyApplied: outcome.policyApplied ?? null,
      detail: outcome.detail ?? null,
    },
  });
}

/**
 * Plain-language policy outcomes. Never invent a score — the player already has none.
 */
function policyMessage(outcome: ReconciliationOutcome): string {
  switch (outcome.policyApplied) {
    case "exclude":
      return "No result was received from the game. You have been excluded from ranking and your entry fee will be returned when the contest settles.";
    case "hold_and_alert":
      return "No result was received from the game. Settlement is on hold until an operator reviews your round.";
    case "score_zero":
    default:
      return "No result was received from the game. This round scores zero and the contest will settle on time.";
  }
}

async function firePlayerNotify(
  round: IGameRound,
  outcome: ReconciliationOutcome,
): Promise<boolean> {
  try {
    const { notificationService } = await import(
      "@/lib/services/notification.service"
    );

    const contestId = round.contestId ? String(round.contestId) : "";
    const actionUrl =
      round.contestType === "challenge"
        ? `/challenges/${contestId}`
        : `/competitions/${contestId}`;

    const result = await notificationService.send({
      userId: round.userId,
      templateId: "round_unresolved",
      variables: {
        roundId: round.roundId,
        contestId,
        contestType: round.contestType,
        policyApplied: outcome.policyApplied ?? "score_zero",
        policyMessage: policyMessage(outcome),
        actionUrl,
        gameCode: round.gameCode,
      },
    });
    return result != null;
  } catch (error) {
    console.warn(
      `⚠️ [ROUND RECONCILIATION] Failed to notify player for ${round.roundId}:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
