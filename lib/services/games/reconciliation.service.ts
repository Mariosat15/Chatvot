import GameRound, {
  LIVE_ROUND_STATUSES,
  type IGameRound,
} from "@/database/models/games/game-round.model";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import { applyResult } from "./result-ingestion.service";
import type { UnresolvedRoundPolicy } from "./round-types";

/**
 * The reconciliation safety net (X3, chapter 07 section 2).
 *
 * WHY A CALLBACK IS NOT ENOUGH, WHICH IS THE WHOLE ARGUMENT OF CHAPTER 07
 * ----------------------------------------------------------------------
 * A callback carries about 99% of results. The other 1% is the problem: a lost webhook
 * leaves a player who genuinely played with no score, in a contest that cannot settle,
 * holding an entry fee they paid. There is no version of that which is acceptable, and no
 * amount of provider reliability removes it - which is why chapter 01 section 6 makes the
 * pull endpoint non-negotiable.
 *
 *   Stage 1  CALLBACK     Provider posts the result            (~99%)
 *   Stage 2  POLL         We pull it                           (lost webhooks)
 *   Stage 3  FINAL SWEEP  One last pull as grace ends
 *   Stage 4  POLICY       Give up deliberately, and say so
 *
 * Stage 4 is the one that matters most, because it is the only stage that ends. A net whose
 * last stage is "keep trying" blocks settlement forever, so every round reaches a decision
 * even when the answer is "we never found out".
 *
 * WHAT THIS PHASE BUILDS, AND WHAT IT DOES NOT
 * --------------------------------------------
 * X3 builds the decision. Running it on a schedule is E7/X8's job (chapter 09), so nothing
 * here assumes a worker - `reconcileRound` is called once per round and the caller owns the
 * loop. That also makes the schedule testable without waiting real minutes.
 *
 * The `exclude` policy's REFUND is deliberately not performed here. See
 * `applyUnresolvedPolicy` for why.
 */

/** Chapter 04 section 2.1. */
export const DEFAULT_RESULT_GRACE_SECONDS = 600;

export interface RoundReconciliationConfig {
  unresolvedRoundPolicy: UnresolvedRoundPolicy;
  /** Seconds after the play window in which a late result is still welcome. */
  resultGracePeriodSeconds?: number;
  /** When play closed. Grace is measured from here, not from round expiry. */
  playWindowEnd: Date;
}

/** What the net decided to do on this pass. */
export type ReconciliationStage =
  | "wait"
  | "poll"
  | "final_sweep"
  | "apply_policy";

/**
 * Chapter 07 section 2.2's schedule, as a pure function.
 *
 * Kept pure and exported on purpose: the schedule is the part of this net most likely to be
 * subtly wrong, and a bug in it is invisible - polling too eagerly just looks like traffic,
 * and polling too late looks like a slow provider. A pure function can be tested at a dozen
 * clock offsets in milliseconds instead of being inferred from logs.
 *
 *   < 2 min past expiry      wait         the callback is probably in flight
 *   2-10 min past expiry     poll         with backoff
 *   inside the grace window  final_sweep  urgently, every remaining attempt
 *   grace expired            apply_policy and raise a critical alert
 */
export function decideStage(
  round: Pick<IGameRound, "expiresAt" | "lastPolledAt" | "pollAttempts">,
  config: RoundReconciliationConfig,
  now: Date = new Date(),
): ReconciliationStage {
  const graceSeconds =
    config.resultGracePeriodSeconds ?? DEFAULT_RESULT_GRACE_SECONDS;
  const graceEndsAt =
    config.playWindowEnd.getTime() + graceSeconds * 1000;

  if (now.getTime() > graceEndsAt) return "apply_policy";

  const sinceExpiry = now.getTime() - round.expiresAt.getTime();

  // Reason for waiting rather than polling immediately: a provider posts the callback the
  // moment the round ends, so polling inside the first two minutes races its own webhook -
  // and both paths would then apply the same result, which gate 8 has to reject as a
  // conflict. Waiting turns a self-inflicted alert into no alert at all.
  if (sinceExpiry < 2 * 60 * 1000) return "wait";

  // Past the play window, inside grace: the contest is waiting on this round, so poll on
  // every pass rather than backing off.
  if (now.getTime() > config.playWindowEnd.getTime()) return "final_sweep";

  return backoffElapsed(round, now) ? "poll" : "wait";
}

/**
 * Exponential backoff between polls: 30s, 60s, 120s, 240s, capped at 5 minutes.
 *
 * Reason for a cap: an uncapped exponential eventually exceeds the grace window, so the
 * round would sit un-polled until stage 3 - the backoff would have quietly disabled stage 2.
 */
function backoffElapsed(
  round: Pick<IGameRound, "lastPolledAt" | "pollAttempts">,
  now: Date,
): boolean {
  if (!round.lastPolledAt) return true;
  const attempts = round.pollAttempts ?? 0;
  const waitMs = Math.min(30_000 * 2 ** attempts, 5 * 60_000);
  return now.getTime() - round.lastPolledAt.getTime() >= waitMs;
}

export interface ReconciliationOutcome {
  roundId: string;
  stage: ReconciliationStage;
  /** True when this pass produced a real result. */
  resolved: boolean;
  /** Set when stage 4 ran. Names what settlement must honour. */
  policyApplied?: UnresolvedRoundPolicy;
  /**
   * True only under `exclude`. Settlement (X5) owes this player their entry fee back and
   * must re-split the pool without them. Named here rather than paid here - see
   * `applyUnresolvedPolicy` for why the money stays in one place.
   */
  refundOwed?: boolean;
  /** True when settlement must not proceed at all. Only under `hold_and_alert`. */
  blocksSettlement?: boolean;
  /** Set when the player must be told something. */
  notifyPlayer?: boolean;
  alert?: "warning" | "critical";
  detail?: string;
}

export async function reconcileRound(
  round: IGameRound,
  config: RoundReconciliationConfig,
  now: Date = new Date(),
): Promise<ReconciliationOutcome> {
  const stage = decideStage(round, config, now);

  if (stage === "wait") {
    return { roundId: round.roundId, stage, resolved: false };
  }

  if (stage === "apply_policy") {
    return applyUnresolvedPolicy(round, config);
  }

  // Stages 2 and 3 both pull, and both hand the result to the SAME apply function the
  // callback uses. Reason: a poller with its own scoring path would be a second door into
  // ranking, which chapter 02 section 10 rule 3 forbids - and it is how two paths drift
  // until one of them is subtly wrong.
  const adapter = getProviderAdapter(round.providerKey);
  if (!adapter) {
    return {
      roundId: round.roundId,
      stage,
      resolved: false,
      alert: "critical",
      detail: `No adapter registered for provider "${round.providerKey}".`,
    };
  }

  round.pollAttempts = (round.pollAttempts ?? 0) + 1;
  round.lastPolledAt = now;
  await round.save();

  const pulled = await adapter.fetchRound(round.roundId);
  if (!pulled.success) {
    return {
      roundId: round.roundId,
      stage,
      resolved: false,
      // Warning, not critical: a failed pull is expected on a lost webhook and the net has
      // more stages to run. It only becomes critical if stage 4 is reached.
      alert: "warning",
      detail: pulled.error,
    };
  }

  const ingested = await applyResult({
    providerKey: round.providerKey,
    normalised: pulled.data,
    source: "poll",
  });

  return {
    roundId: round.roundId,
    stage,
    resolved: ingested.result === "scored",
    alert: ingested.alert,
    detail: ingested.message,
  };
}

/**
 * Stage 4: give up, deliberately and visibly (chapter 07 section 2.3).
 *
 * THE POLICY IS CHOSEN AT CONTEST CREATION, NEVER DURING THE INCIDENT. Reason: mid-incident
 * is precisely when the choice stops being neutral - whoever decides then knows who it
 * helps and who it hurts, and any answer looks like favouritism. Deciding in advance is the
 * only version a player can be shown afterwards.
 *
 * THE PLAYER IS ALWAYS TOLD. A round silently scored zero is indistinguishable, from the
 * player's seat, from being cheated.
 *
 * WHY `exclude` DOES NOT REFUND HERE, AND WHY THAT IS RECORDED RATHER THAN QUIETLY SKIPPED
 * ---------------------------------------------------------------------------------------
 * `exclude` owes the player their entry fee back, and paying it from this service would put
 * a second money writer beside settlement - the exact shape of the four-writer competition
 * entry defect Stage 0 spent a phase unifying. It also cannot be done correctly in
 * isolation: removing a player changes the prize pool, so the refund and the re-split are
 * one transaction, and that transaction belongs to settlement (X5).
 *
 * So this marks the round and NAMES the obligation in its return value. X5 must honour it.
 * The obligation is deliberately impossible to miss: `exclude` returns
 * `refundOwed: true`, and a settlement path that ignores it fails its own test.
 */
async function applyUnresolvedPolicy(
  round: IGameRound,
  config: RoundReconciliationConfig,
): Promise<ReconciliationOutcome> {
  const policy = config.unresolvedRoundPolicy;

  // Reason for the guard: a round that already reported must not be overwritten by the net.
  // Reachable when a callback lands between the stage decision and this write.
  if (!LIVE_ROUND_STATUSES.includes(round.status)) {
    return {
      roundId: round.roundId,
      stage: "apply_policy",
      resolved: round.status === "completed",
      detail: `Round resolved as ${round.status} before the policy could run.`,
    };
  }

  round.status = "unresolved";
  await round.save();

  const base = {
    roundId: round.roundId,
    stage: "apply_policy" as const,
    resolved: false,
    policyApplied: policy,
    notifyPlayer: true,
    // Critical in every case. Reason: reaching stage 4 at all means the provider never
    // reported and all three earlier stages failed, which is an integration problem even
    // when the contest settles cleanly on time.
    alert: "critical" as const,
  };

  switch (policy) {
    case "score_zero":
      return {
        ...base,
        detail:
          "No result was received. The round scores zero and the contest settles on time.",
      };
    case "exclude":
      return {
        ...base,
        refundOwed: true,
        detail:
          "No result was received. The player is excluded from ranking and their entry fee is owed back by settlement.",
      };
    case "hold_and_alert":
      return {
        ...base,
        blocksSettlement: true,
        detail:
          "No result was received. Settlement is blocked until a human decides.",
      };
  }
}

/**
 * Finds rounds the net should look at, using the `{ status, expiresAt }` index.
 *
 * Reason it returns rounds rather than reconciling them: the caller owns the per-contest
 * config, and E7/X8 owns the schedule. Keeping the query separate means the worker can page
 * through a backlog without this file knowing a worker exists.
 */
export async function findRoundsNeedingReconciliation(
  limit = 100,
  now: Date = new Date(),
): Promise<IGameRound[]> {
  return GameRound.find({
    status: { $in: LIVE_ROUND_STATUSES },
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1 })
    .limit(limit);
}
