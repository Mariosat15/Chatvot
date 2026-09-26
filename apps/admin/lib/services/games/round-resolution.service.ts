import { connectToDatabase } from "@/database/mongoose";
import GameRound, {
  canTransitionRound,
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import Competition from "@/database/models/trading/competition.model";
// The action list lives in a model-free module so the client dialog can read the same one.
// See that file for why defining it twice was the wrong answer.
import {
  MIN_REASON_LENGTH,
  RESOLUTION_ACTIONS,
  type ResolutionAction,
} from "@/lib/admin/round-resolution-actions";

export {
  isResolutionAction,
  MIN_REASON_LENGTH,
  RESOLUTION_ACTIONS,
  resolutionActionNames,
  type ResolutionAction,
} from "@/lib/admin/round-resolution-actions";

/**
 * Resolving a stuck round by hand, so an operator is not left waiting on the reconciliation
 * net (X6, chapter 12 section 4).
 *
 * WHAT THIS DELIBERATELY CANNOT DO: enter a score.
 *
 * Chapter 02 section 10 rule 3 - "scores enter the system through exactly one function" - and
 * that function, `applyResult`, lives in the **main app only**. Mirroring it here to give an
 * operator a score box would create the second door the rule exists to prevent, in the app
 * with the fewest eyes on it and the widest privileges. Stage 0's most expensive lesson was
 * four competition-entry writers where the plan described two.
 *
 * So the operator's power here is to **void** a round: to say "this attempt produced nothing
 * usable, stop waiting for it". That writes a STATUS, never a score, which is what keeps it
 * clear of the ingestion door entirely.
 *
 * WHY VOIDING IS ENOUGH TO UNBLOCK A HELD CONTEST. `assessUnresolvedRounds` derives both of
 * its answers from `round.status === "unresolved"`, so a round moved off that status is no
 * longer holding anything. That is also why this needs no re-sync of `participant.score`:
 * only `completed` rounds contribute to it, and a voided round never counted.
 *
 * THE CONSEQUENCE THE UI MUST STATE PLAINLY, because it is a decision and not a cleanup: a
 * voided round scores nothing for that player. If it was their only attempt they finish on
 * zero, which is the `score_zero` outcome applied by hand. An operator who wants the player
 * refunded and removed instead should cancel the contest, or let the `exclude` policy run.
 */

export interface ResolveRoundResult {
  success: boolean;
  error?: string;
  /** The status the round now holds, for the audit entry and the toast. */
  status?: RoundStatus;
  /** True when the contest was being held by this round and no longer is. */
  unblockedSettlement?: boolean;
}

/**
 * Move one stuck round to a terminal status, with a reason on the record.
 *
 * Returns a result object rather than throwing - the route turns it into a response, and a
 * thrown message would be stripped in a production build.
 */
export async function resolveRoundManually(input: {
  roundId: string;
  action: ResolutionAction;
  reason: string;
  adminEmail: string;
}): Promise<ResolveRoundResult> {
  const { roundId, action, reason, adminEmail } = input;

  // Re-validated here rather than trusted from the route, so a second caller cannot skip it.
  const target = RESOLUTION_ACTIONS.get(action);
  if (!target) {
    return { success: false, error: "Unknown resolution action." };
  }

  // Reason it is checked here and not only in the route: this is the guard that makes the
  // audit trail worth having, and a second caller added later would otherwise skip it.
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    return {
      success: false,
      error: `A reason of at least ${MIN_REASON_LENGTH} characters is required.`,
    };
  }

  try {
    await connectToDatabase();

    const round = await GameRound.findOne({ roundId });
    if (!round) {
      return { success: false, error: "No round with that id." };
    }

    // The model owns which transitions are legal, so this cannot drift from the state machine
    // the ingestion path obeys. It also refuses a round that is ALREADY terminal, which is
    // the case an operator hits by double-clicking or by acting on a stale list - and
    // refusing with the current status is more use than silently succeeding.
    if (!canTransitionRound(round.status as RoundStatus, target.status)) {
      return {
        success: false,
        error: `A round that is "${round.status}" cannot be moved to "${target.status}".`,
      };
    }

    const wasHolding = round.status === "unresolved";

    round.status = target.status;
    // Reason: `resultSource` records WHO decided the outcome, and "manual" is the value the
    // schema already carries for exactly this. Without it a voided round is indistinguishable
    // from one the reconciliation net gave up on, which is the difference between a decision
    // and a failure.
    round.resultSource = "manual";
    round.resultReceivedAt = new Date();
    await round.save();

    console.log(
      `🛠️ Round ${roundId} manually resolved to "${target.status}" by ${adminEmail}: ${reason.trim()}`,
    );

    // Whether this actually released a held contest. Reported rather than assumed, because a
    // contest can be held by several rounds and clearing one changes nothing on its own - an
    // operator told "settlement unblocked" when three rounds still hold it would stop looking.
    let unblockedSettlement = false;
    if (wasHolding && round.contestId) {
      const stillHeld = await GameRound.countDocuments({
        contestId: round.contestId,
        status: "unresolved",
      });
      unblockedSettlement = stillHeld === 0;
    }

    return { success: true, status: target.status, unblockedSettlement };
  } catch (error) {
    console.error("❌ Failed to resolve round manually:", error);
    return {
      success: false,
      error: "Something went wrong. Please contact support.",
    };
  }
}

export interface StuckRoundRow {
  roundId: string;
  providerKey: string;
  gameKey: string;
  userId: string;
  status: string;
  contestType: string;
  contestId?: string;
  contestName?: string;
  attemptNumber: number;
  expiresAt?: Date;
  pollAttempts?: number;
  lastPolledAt?: Date;
  createdAt?: Date;
  integrityFlags?: string[];
  /** True when this round is what stops its contest settling. */
  holdingSettlement: boolean;
}

/**
 * The rounds an operator needs to see: unresolved, or live and past their expiry.
 *
 * Reason it is not "every round": a round inspector that lists completed rounds buries the
 * handful that need a decision. The completed ones are reachable by id when a dispute needs
 * them.
 */
export async function listRoundsNeedingAttention(
  limit = 100,
): Promise<StuckRoundRow[]> {
  await connectToDatabase();

  const now = new Date();
  const rounds = await GameRound.find({
    $or: [
      { status: "unresolved" },
      { status: { $in: ["pending", "launched"] }, expiresAt: { $lt: now } },
    ],
  })
    .sort({ expiresAt: 1 })
    .limit(limit)
    .lean();

  // One query for every contest named in the list, rather than one per row.
  const contestIds = [
    ...new Set(
      rounds
        .map((r) => (r.contestId ? String(r.contestId) : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const contests = contestIds.length
    ? await Competition.find({ _id: { $in: contestIds } })
        .select("name unresolvedRoundPolicy")
        .lean<{ _id: unknown; name?: string; unresolvedRoundPolicy?: string }[]>()
    : [];

  const contestById = new Map(
    contests.map((c) => [String(c._id), c]),
  );

  return rounds.map((r) => {
    const contest = r.contestId ? contestById.get(String(r.contestId)) : undefined;
    return {
      roundId: r.roundId,
      providerKey: r.providerKey,
      gameKey: r.gameKey,
      userId: r.userId,
      status: r.status,
      contestType: r.contestType,
      contestId: r.contestId ? String(r.contestId) : undefined,
      contestName: contest?.name,
      attemptNumber: r.attemptNumber,
      expiresAt: r.expiresAt,
      pollAttempts: r.pollAttempts,
      lastPolledAt: r.lastPolledAt,
      createdAt: r.createdAt,
      integrityFlags: r.integrityFlags,
      // Only `hold_and_alert` actually stops a contest settling. Flagging every unresolved
      // round as "holding settlement" would make the badge meaningless on the two policies
      // that settle on time.
      holdingSettlement:
        r.status === "unresolved" &&
        contest?.unresolvedRoundPolicy === "hold_and_alert",
    };
  });
}
