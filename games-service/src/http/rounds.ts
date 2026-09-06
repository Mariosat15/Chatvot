import type { Request, Response } from "express";

import { createRound } from "../rounds/create";
import { finishRound, playability } from "../rounds/lifecycle";
import { buildResultBody } from "../rounds/report";
import { Round } from "../store/round.model";
import { ApiError, unknownRound } from "./errors";

/**
 * The platform-facing round endpoints.
 *
 * Handlers here are thin on purpose. Creation lives in `rounds/create.ts` and every state change
 * in `rounds/lifecycle.ts`, so a route cannot be the place a rule is applied slightly differently
 * - the same reason the platform's own callback route reads the raw bytes and does nothing else.
 */

export async function postRound(req: Request, res: Response): Promise<void> {
  const created = await createRound(req.body ?? {});
  res.status(201).json(created);

  // The first delivery attempt is NOT started here - there is nothing to deliver yet. Kicking off
  // any background work from a creation response is how a round ends up reported before it has
  // been played.
}

/**
 * `GET /v1/rounds/{roundId}` - endpoint 4, "our safety net. Do not skip this one."
 *
 * WHY THIS ENDPOINT FINISHES OVERDUE ROUNDS INSTEAD OF JUST READING THEM
 * ---------------------------------------------------------------------
 * The platform polls this for any round still unresolved as a contest approaches settlement. That
 * is precisely the moment a round whose deadline has passed but whose sweeper tick has not yet
 * landed would be reported as still in progress - a true statement about our database and a false
 * one about the round, arriving at the one moment the platform is deciding whether it can settle.
 *
 * Evaluating the deadline on read closes that window. It also means the endpoint tells the same
 * story as the callback would have, which is the property section 9 is really asking for when it
 * says "exactly the same shape".
 */
export async function getRound(req: Request, res: Response): Promise<void> {
  const roundId = req.params.roundId ?? "";
  const round = await Round.findOne({ roundId });
  if (!round) throw unknownRound(roundId);

  const now = new Date();
  const status = playability(round, now);
  if (!status.playable && status.owes) {
    // Transition only. Delivering the callback is the sweeper's job and nothing else's - see the
    // note in `callback/sweeper.ts` on why there is exactly one deliverer. The transition marks the
    // delivery due, so the result goes out on the next tick regardless of who noticed the deadline.
    await finishRound(roundId, { status: status.owes, at: now });
  }

  const fresh = await Round.findOne({ roundId });
  if (!fresh) throw unknownRound(roundId);

  res.json(buildResultBody(fresh.toObject(), now));
}

/**
 * `POST /v1/rounds/{roundId}/void` - the "WANTED" endpoint of section 5.
 *
 * Implemented because the reason given for wanting it is a player-facing one: it "lets us cancel a
 * live round when a contest is cancelled, so a player is not left playing for a dead contest".
 *
 * A void is the only terminal state where no money moves and the attempt goes back to the player,
 * so voiding a round that has already produced a score would take a real result away. Hence the
 * refusal below rather than a silent no-op: if the platform believes a scored round is still live,
 * the two sides disagree about something and that is worth surfacing.
 */
export async function postVoidRound(req: Request, res: Response): Promise<void> {
  const roundId = req.params.roundId ?? "";
  const reason =
    typeof req.body?.reason === "string" && req.body.reason.trim().length > 0
      ? req.body.reason.trim()
      : "Voided at the platform's request.";

  const round = await Round.findOne({ roundId });
  if (!round) throw unknownRound(roundId);

  if (round.status === "voided") {
    // Idempotent success. A retried void has achieved what it asked for, and an error would invite
    // a third attempt at something already done.
    res.json(buildResultBody(round.toObject()));
    return;
  }

  if (round.status !== "created" && round.status !== "in_progress") {
    throw new ApiError(
      409,
      "ROUND_CONFLICT",
      `Round '${roundId}' already finished as '${round.status}' and cannot be voided.`,
    );
  }

  const outcome = await finishRound(roundId, { status: "voided", reason });
  if (!outcome) throw unknownRound(roundId);

  res.json(buildResultBody(outcome.round));
}
