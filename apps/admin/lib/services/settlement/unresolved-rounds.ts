import { Types } from "mongoose";
import GameRound from "@/database/models/games/game-round.model";
// Reason for importing the type rather than restating the three values: a local copy of a
// policy union cannot be caught when it drifts, because the two copies never meet in one
// expression - the mismatch is silent. `round-types.ts` is the canonical declaration and
// exists in both apps; `reconciliation.service.ts` imports it from here too.
import type { UnresolvedRoundPolicy } from "@/lib/services/games/round-types";

/**
 * What the contest's unresolved-round policy means for THIS settlement run.
 *
 * WHY THIS RE-DERIVES THE OBLIGATION INSTEAD OF BEING TOLD IT
 * ----------------------------------------------------------
 * `reconcileRound` returns `refundOwed: true` and `blocksSettlement: true`, and both are
 * ephemeral - a return value in a worker process that has long since exited by the time
 * settlement runs. Nothing persists them. So settlement cannot consume them; it has to ask
 * the database the same question the reconciliation net answered, which is:
 *
 *   which rounds in this contest are sitting at `unresolved`?
 *
 * That is the whole state. `round.status = "unresolved"` is the one thing stage 4 writes,
 * and it is written before the outcome is returned, so it survives the process boundary.
 *
 * Reading it here rather than passing it in also means a contest settled by a path that
 * never ran reconciliation - the lazy auto-finalize, a manual admin trigger - honours the
 * policy anyway. A parameter would have made those paths silently skip it.
 */

export interface UnresolvedRoundsAssessment {
  /** The contest's configured policy, resolved. */
  policy: UnresolvedRoundPolicy;
  /** How many rounds in this contest never reported. */
  unresolvedRoundCount: number;
  /**
   * Players to remove from ranking and refund. Populated under `exclude` ONLY - the other
   * two policies leave it empty, so a caller that ignores `policy` still cannot exclude
   * anyone by accident.
   */
  excludedUserIds: string[];
  /**
   * True when settlement must not run at all. Under `hold_and_alert` ONLY, and only when
   * there is actually something unresolved.
   */
  blocksSettlement: boolean;
  /** Operator-facing reason, set whenever `blocksSettlement` is true. */
  blockReason?: string;
}

/**
 * Resolve the policy for a contest that may predate the field.
 *
 * Reason for defaulting to `score_zero`: it is the only policy that needs settlement to do
 * nothing, so an absent value cannot cause a refund nobody configured or a contest held
 * indefinitely. The other direction fails badly - defaulting to `hold_and_alert` would
 * freeze every legacy contest the first time a round went missing.
 *
 * Note this is the opposite instinct to a capability gate, which fails closed. The
 * difference is that here the "closed" option is not refusing an action, it is *taking a
 * money action nobody asked for*.
 */
export function resolveUnresolvedPolicy(
  stored: string | null | undefined,
): UnresolvedRoundPolicy {
  if (stored === "exclude" || stored === "hold_and_alert") return stored;
  return "score_zero";
}

export async function assessUnresolvedRounds({
  competitionId,
  storedPolicy,
  session,
}: {
  competitionId: string;
  storedPolicy: string | null | undefined;
  session?: import("mongoose").ClientSession;
}): Promise<UnresolvedRoundsAssessment> {
  const policy = resolveUnresolvedPolicy(storedPolicy);

  // Reason: `score_zero` needs no query at all. The round already holds a zero score and
  // ranking treats it as any other score, which is exactly what the policy promises.
  if (policy === "score_zero") {
    return {
      policy,
      unresolvedRoundCount: 0,
      excludedUserIds: [],
      blocksSettlement: false,
    };
  }

  // The `isValid` guard is the load-bearing half of this, not the construction below.
  // Mongoose casts a string to ObjectId when the query executes, so passing the id straight
  // through would have matched correctly - probing proved that, against a first version of
  // this comment which claimed a string would silently match nothing. What a non-ObjectId
  // string does instead is throw a CastError, and a throw here aborts a settlement that
  // could otherwise have paid everyone. Constructing it explicitly is for the reader.
  //
  // Note the raw MongoDB driver does NOT cast, which is why the test helper that seeds
  // rounds must build a real ObjectId - the two halves of this are genuinely different.
  if (!Types.ObjectId.isValid(competitionId)) {
    return {
      policy,
      unresolvedRoundCount: 0,
      excludedUserIds: [],
      blocksSettlement: false,
    };
  }

  const query = GameRound.find({
    contestId: new Types.ObjectId(competitionId),
    status: "unresolved",
  }).select("userId");

  if (session) query.session(session);

  const rounds = await query.lean<{ userId: string }[]>();

  if (rounds.length === 0) {
    return {
      policy,
      unresolvedRoundCount: 0,
      excludedUserIds: [],
      blocksSettlement: false,
    };
  }

  // Reason for the Set: under `best_of_n` one player can hold several unresolved rounds,
  // and refunding per ROUND rather than per PLAYER would pay their entry fee back twice.
  const userIds = [...new Set(rounds.map((r) => r.userId))];

  if (policy === "hold_and_alert") {
    return {
      policy,
      unresolvedRoundCount: rounds.length,
      excludedUserIds: [],
      blocksSettlement: true,
      blockReason: `Settlement is held: ${rounds.length} round(s) across ${userIds.length} player(s) never reported a result, and this contest's unresolved-round policy is "hold and alert". A human must resolve or void them before it can settle.`,
    };
  }

  return {
    policy,
    unresolvedRoundCount: rounds.length,
    excludedUserIds: userIds,
    blocksSettlement: false,
  };
}
