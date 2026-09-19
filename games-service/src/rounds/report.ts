import crypto from "crypto";

import { loadConfig } from "../config";
import { isTerminal, type RoundDoc, type RoundStatus } from "../store/round.model";

/**
 * The result body, built in exactly one place.
 *
 * WHY ONE SERIALISER AND NOT TWO
 * ------------------------------
 * Section 9 requires the fetch endpoint to return the round "in exactly the same shape as the
 * result callback body". Two functions producing that shape is the failure the ChartVolt
 * platform has now hit four separate times in its own history - one rule with two copies, which
 * agree on the day they are written and diverge silently afterwards. There the copies were
 * `referenceId`, `failedReason`, `challengeId` and a Game Master percentage, and none of them
 * was caught by the guard that compares the two apps, because that guard compares models rather
 * than the code writing to them.
 *
 * Here the consequence would be precise and awful: the callback reports one score, the fetch
 * used for reconciliation reports another, and the platform cannot tell which is a bug and which
 * is the truth. So the callback sends this, the fetch returns this, and there is no second path.
 *
 * WHAT A NON-TERMINAL ROUND REPORTS, AND WHAT THE SPECIFICATION DOES NOT SAY
 * -------------------------------------------------------------------------
 * Section 9 says "if the round is still in progress, return it with a non-terminal status" and
 * never names one. Section 13's diagram shows two boxes before the terminal states, labelled
 * `created` and `in progress` - the first is a plausible code, the second contains a space and
 * cannot be one. So a provider has to guess between `in_progress`, `inProgress`, `started` and
 * `playing`, and a wrong guess is not a parse error: the platform sees an unrecognised status on
 * a round it is trying to reconcile, which is the exact situation section 9 exists to prevent.
 *
 * `in_progress` is used here because it matches the diagram's wording in the casing style the
 * rest of the document uses for enumerated values. Recorded as an ambiguity rather than treated
 * as settled.
 */

export type EventType =
  | "round.completed"
  | "round.abandoned"
  | "round.expired"
  | "round.voided";

/**
 * The event type for a terminal state.
 *
 * The specification's example shows `round.completed` and never names the other three, even
 * though it requires all four states to be reported. Deriving them mechanically from the status
 * is the only choice that can be made from the document, and it is the one a platform parser is
 * most likely to accept - but a provider guessing `round.abandon` or `round.round_abandoned`
 * would be equally within the letter of the document. Ambiguity A4.
 */
export function eventTypeFor(status: RoundStatus): EventType | undefined {
  switch (status) {
    case "completed":
      return "round.completed";
    case "abandoned":
      return "round.abandoned";
    case "expired":
      return "round.expired";
    case "voided":
      return "round.voided";
    default:
      return undefined;
  }
}

/**
 * A stateless replay link.
 *
 * The token is an HMAC of the provider's own round id, so the URL is unguessable without being
 * stored anywhere. That is what lets it satisfy "should stay valid for at least 90 days" without
 * a expiry sweep - there is nothing to expire, and the specification wants these links to
 * outlive the dispute rather than the deployment.
 */
export function replayUrl(round: Pick<RoundDoc, "providerRoundId">): string {
  const config = loadConfig();
  const token = crypto
    .createHmac("sha256", config.inbound.apiSecret)
    .update(`replay:${round.providerRoundId}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `${config.publicUrl}/replay/${round.providerRoundId}?t=${token}`;
}

export interface ResultBody {
  eventId?: string;
  eventType?: EventType;
  occurredAt: string;

  roundId: string;
  providerRoundId: string;
  playerId: string;
  gameCode: string;

  status: RoundStatus;
  score?: number;
  scoreBreakdown?: Record<string, unknown>;

  startedAt?: string;
  completedAt?: string;
  durationMs?: number;

  replayUrl: string;

  integrity: {
    suspicious: boolean;
    flags: string[];
  };
}

/**
 * Integrity signals.
 *
 * The specification asks for anything suspicious we noticed, and is clear that a flag "holds the
 * payout for review instead of paying blindly". This provider's honest position is that it has
 * one signal worth reporting and should not pretend to more: a board solved implausibly fast.
 *
 * Reason for reporting rather than refusing: a provider that voids a round it merely suspects has
 * taken a money decision, and section 1 of the requirements puts every money decision on the
 * platform's side. Flagging leaves the judgement where it belongs.
 */
function integrityFor(round: RoundDoc): { suspicious: boolean; flags: string[] } {
  const flags: string[] = [];

  /** No human solves a board this fast; a script does. */
  const IMPLAUSIBLE_SOLVE_MS = 700;
  const implausible = round.boards.filter((board) => {
    if (!board.solvedAt) return false;
    return board.solvedAt.getTime() - board.issuedAt.getTime() < IMPLAUSIBLE_SOLVE_MS;
  });

  if (implausible.length > 0) {
    flags.push(`implausible_solve_time:${implausible.length}`);
  }

  // A board solved on the first submission every single time is not suspicious in itself; a
  // board solved with zero redraws AND at implausible speed is, which the flag above covers.
  return { suspicious: flags.length > 0, flags };
}

export function buildResultBody(round: RoundDoc, occurredAt = new Date()): ResultBody {
  const terminal = isTerminal(round.status);

  const body: ResultBody = {
    occurredAt: occurredAt.toISOString(),

    roundId: round.roundId,
    providerRoundId: round.providerRoundId,
    playerId: round.playerId,
    gameCode: round.gameCode,

    status: round.status,

    replayUrl: replayUrl(round),
    integrity: integrityFor(round),
  };

  // `eventId` identifies a delivered message. A fetch is a question, not a message, so a round
  // that has never been reported has no event id to quote - and inventing one per fetch would
  // hand the platform a new identifier every time it polled, which is precisely the value it
  // uses to avoid counting one score twice.
  if (round.delivery.eventId) body.eventId = round.delivery.eventId;
  if (terminal) body.eventType = eventTypeFor(round.status);

  if (round.startedAt) body.startedAt = round.startedAt.toISOString();

  if (terminal) {
    // Reason these three are set together: the specification requires all of `startedAt`,
    // `completedAt` and `durationMs` on a result, and uses duration as a tie-break. A terminal
    // round missing one of them is a round whose ties cannot be broken.
    if (typeof round.score === "number") body.score = round.score;
    if (round.scoreBreakdown) body.scoreBreakdown = round.scoreBreakdown;
    if (round.completedAt) body.completedAt = round.completedAt.toISOString();
    if (typeof round.durationMs === "number") body.durationMs = round.durationMs;
  }

  return body;
}
