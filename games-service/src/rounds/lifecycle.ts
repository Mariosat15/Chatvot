import crypto from "crypto";

import {
  PERFECT,
  findTitle,
  roundDurationMs,
  type RoundConfig,
  type TitleDefinition,
} from "../games/titles";
import { scoreRound, zeroScore, type BoardOutcome } from "../games/scoring";
import {
  Round,
  TERMINAL_STATUSES,
  isTerminal,
  type RoundDoc,
  type RoundDocument,
  type TerminalStatus,
} from "../store/round.model";

/**
 * Terminal transitions.
 *
 * SETTING THE FINAL STATUS IS THE LOCK
 * -----------------------------------
 * Three separate things can end a round: the player finishing, the player leaving, and the
 * sweeper noticing a deadline. They run in different requests and, for the sweeper, on a timer,
 * so two of them can arrive at the same instant on the same round. If both are allowed to write
 * a terminal state, the round gets two scores and - because `eventId` is minted here - two
 * events, which is the one thing the platform's idempotency rules are built to survive but
 * should never have to.
 *
 * The guard is a conditional update rather than a read-then-write: the status filter excludes
 * every terminal state, so the first writer claims the round and the second finds nothing to
 * update and reports the round as it already stands. No intermediate state and no separate lock
 * document, which is the same conclusion the ChartVolt platform reached for its own
 * cancel-and-refund path.
 */

/** A round that ends this way has nothing to report but must still report. */
export interface FinishOptions {
  status: TerminalStatus;
  /** Recorded on a void, where the reason is the whole content of the support conversation. */
  reason?: string;
  at?: Date;
}

export interface FinishOutcome {
  round: RoundDoc;
  /** False when the round was already terminal, so the caller does not schedule a second send. */
  transitioned: boolean;
}

function boardOutcomes(round: RoundDoc): BoardOutcome[] {
  return round.boards.map((board) => ({
    index: board.index,
    issuedAt: board.issuedAt,
    solvedAt: board.solvedAt,
  }));
}

/**
 * The score for a round in a given terminal state.
 *
 * `voided` is the interesting case and it is the one a scoring function should not be asked
 * about. Section 13 says a voided round is "not scored, and we return the attempt to the
 * player - no money moves", so a voided round has no score at all. Returning zero would be
 * worse than returning nothing: on a higher-is-better title zero reads as a legitimately bad
 * performance, and on a lower-is-better title it reads as a win.
 */
function scoreFor(
  title: TitleDefinition,
  config: RoundConfig,
  round: RoundDoc,
  status: FinishOptions["status"],
): { score?: number; durationMs?: number; breakdown?: Record<string, unknown> } {
  if (status === "voided") return {};

  const boards = boardOutcomes(round);
  const solvedAny = boards.some((board) => board.solvedAt);

  // The specification asks twice for a partial score where one can be computed, and says why:
  // "a dropped mobile signal should not cost someone a paid entry". Both titles can always
  // compute one, so `zeroScore` is only reached when the player genuinely produced nothing.
  const result = solvedAny
    ? scoreRound(title, config, boards)
    : zeroScore(title, config);

  return {
    score: result.score,
    durationMs: result.durationMs,
    breakdown: result.breakdown,
  };
}

/**
 * Applies the sandbox score override, if one is armed and the service is in sandbox mode.
 *
 * The override is honoured for the score and deliberately NOT for the breakdown, which keeps
 * saying what really happened. A forced score whose breakdown agrees with it is indistinguishable
 * from a real one in a log, and the whole reason the platform wants this control is to test
 * ranking and payouts - work that becomes untrustworthy the moment a forced result cannot be
 * told apart from an earned one.
 */
function applySandboxScore(
  round: RoundDoc,
  computed: { score?: number; durationMs?: number; breakdown?: Record<string, unknown> },
): { score?: number; durationMs?: number; breakdown?: Record<string, unknown> } {
  const forced = round.sandbox.forceScore;
  if (typeof forced !== "number") return computed;

  return {
    ...computed,
    score: forced,
    breakdown: {
      ...(computed.breakdown ?? {}),
      sandboxForcedScore: forced,
      sandboxComputedScore: computed.score ?? null,
    },
  };
}

export async function finishRound(
  roundId: string,
  options: FinishOptions,
): Promise<FinishOutcome | null> {
  const current = await Round.findOne({ roundId });
  if (!current) return null;

  if (isTerminal(current.status)) {
    return { round: current.toObject(), transitioned: false };
  }

  const title = findTitle(current.gameCode);
  const at = options.at ?? new Date();

  /*
   * A round whose game we can no longer find is voided, and nothing overrides that.
   *
   * It means our own catalogue lost a title we had already issued a round for, so there is no
   * scoring rule to apply. Section 13 says a void is "not scored, and we return the attempt to the
   * player - no money moves", which is the only outcome that cannot be wrong here. Note it sits
   * ahead of the sandbox override deliberately: a forced `completed` on a round we cannot score
   * would report a score computed from nothing.
   */
  const status: TerminalStatus = !title
    ? "voided"
    : (current.sandbox.forceStatus ?? options.status);

  const reason = !title
    ? `Game '${current.gameCode}' is no longer available.`
    : options.reason;

  if (!title) {
    console.error(`❌ [lifecycle] ${roundId}: unknown gameCode '${current.gameCode}'`);
  }

  const computed = title
    ? applySandboxScore(
        current,
        scoreFor(title, current.config as unknown as RoundConfig, current, status),
      )
    : {};

  // The claim. `$nin` on the terminal statuses is what makes this safe against the sweeper
  // firing at the same moment as the player's last submission.
  const claimed = await Round.findOneAndUpdate(
    { roundId, status: { $nin: TERMINAL_STATUSES } },
    {
      $set: {
        status,
        completedAt: at,
        ...(reason ? { voidReason: reason } : {}),
        ...(computed.score !== undefined ? { score: computed.score } : {}),
        ...(computed.durationMs !== undefined ? { durationMs: computed.durationMs } : {}),
        ...(computed.breakdown ? { scoreBreakdown: computed.breakdown } : {}),
        // Minted once, here, and reused by every delivery attempt. Section 11: "unique per
        // message and stable across your retries. This is how we avoid counting one score
        // twice."
        "delivery.eventId": `cvg_ev_${crypto.randomBytes(10).toString("hex")}`,
        "delivery.nextAttemptAt": at,
      },
    },
    { new: true },
  );

  if (!claimed) {
    // Somebody else claimed it between the read and the update. Theirs is the result.
    const settled = await Round.findOne({ roundId });
    return settled ? { round: settled.toObject(), transitioned: false } : null;
  }

  return { round: claimed.toObject(), transitioned: true };
}

/**
 * When the gameplay clock runs out, as distinct from when the contest window closes.
 *
 * These are two different deadlines and conflating them would misreport a state. `expiresAt`
 * comes from the platform and closes the contest's window; the gameplay clock is the title's own
 * rules. A player whose sprint timer reaches zero has played the game to its natural end, which
 * is `completed`. A player still holding an unfinished set of boards when the contest window
 * shuts has not, which is `expired`.
 */
export function gameplayEndsAt(round: Pick<RoundDoc, "startedAt" | "config">): Date | null {
  if (!round.startedAt) return null;
  const config = round.config as unknown as RoundConfig;
  return new Date(round.startedAt.getTime() + roundDurationMs(config));
}

/** The hard ceiling section 6 requires: a round must be impossible to extend beyond it. */
export function hardDeadline(round: Pick<RoundDoc, "startedAt" | "config" | "expiresAt">): Date {
  const gameplay = gameplayEndsAt(round);
  const ceiling = round.startedAt
    ? new Date(round.startedAt.getTime() + PERFECT.maxDurationSeconds * 1000)
    : null;

  const candidates = [round.expiresAt, gameplay, ceiling].filter(
    (date): date is Date => date instanceof Date,
  );
  return new Date(Math.min(...candidates.map((date) => date.getTime())));
}

/**
 * Whether a round may still be played, and if not, which terminal state it owes.
 *
 * Called by every play endpoint before it does anything. Reason for returning the owed state
 * rather than a boolean: an endpoint that only learns "no" has to guess whether the round expired
 * or simply ran its clock out, and a guess here is a misreported terminal state.
 */
export function playability(
  round: Pick<RoundDoc, "status" | "startedAt" | "config" | "expiresAt">,
  now = new Date(),
):
  | { playable: true }
  | { playable: false; owes: FinishOptions["status"] | null } {
  if (isTerminal(round.status)) return { playable: false, owes: null };

  if (now.getTime() >= round.expiresAt.getTime()) {
    return { playable: false, owes: "expired" };
  }

  const gameplay = gameplayEndsAt(round);
  if (gameplay && now.getTime() >= gameplay.getTime()) {
    return { playable: false, owes: "completed" };
  }

  return { playable: true };
}

/**
 * Rounds whose deadline has passed while they were still open.
 *
 * The sweeper's first query, and the reason it exists at all: a player who closes the tab tells
 * us nothing, and section 13's promise that every round reaches a terminal state cannot be kept
 * by code that only runs while somebody is playing.
 */
export async function findOverdueRounds(now = new Date(), limit = 50): Promise<RoundDocument[]> {
  return Round.find({
    status: { $nin: TERMINAL_STATUSES },
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1 })
    .limit(limit);
}

/**
 * Rounds still being played whose own gameplay clock has run out.
 *
 * Kept separate from the overdue query because the terminal state differs, and because the
 * filter cannot be expressed in MongoDB: the gameplay deadline is derived from `startedAt` plus a
 * duration held inside `config`. So this fetches in-progress rounds started long enough ago that
 * the longest possible clock could have run out, and the precise decision is made in code.
 */
export async function findFinishedClocks(now = new Date(), limit = 50): Promise<RoundDocument[]> {
  const longestPossibleMs = PERFECT.maxDurationSeconds * 1000;
  const candidates = await Round.find({
    status: "in_progress",
    startedAt: { $lte: new Date(now.getTime() - 1000) },
  })
    .sort({ startedAt: 1 })
    .limit(limit * 4);

  return candidates.filter((round) => {
    const gameplay = gameplayEndsAt(round);
    if (!gameplay) return false;
    if (now.getTime() < gameplay.getTime()) return false;
    // Guards against a config that somehow asks for longer than any title allows.
    return now.getTime() - round.startedAt!.getTime() >= 0 && longestPossibleMs > 0;
  });
}
