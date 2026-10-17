import type { NextFunction, Request, Response } from "express";

import { loadConfig } from "../config";
import { attemptDelivery } from "../callback/deliver";
import { finishRound } from "../rounds/lifecycle";
import { buildResultBody } from "../rounds/report";
import { Round, type TerminalStatus } from "../store/round.model";
import { ApiError, badRequest, sendError, unknownRound } from "./errors";

/**
 * The sandbox controls of section 15.
 *
 * Three of the specification's rows are "strongly wanted" rather than required, with a reason
 * given that is worth taking seriously: they are "what let us build automated tests around your
 * API instead of manual ones". Forcing a score tests ranking and payouts without playing puzzles
 * by hand; forcing each terminal state rehearses every failure before real money is involved; and
 * suppressing a callback proves the platform's recovery path works when a message never arrives.
 *
 * WHY THESE ARE ROUTES AND NOT SETTINGS INSIDE `config`
 * ----------------------------------------------------
 * `config` is validated against `configSchema`, and `configSchema` is what the platform generates
 * its admin settings form from. A sandbox control declared there would appear as a field on that
 * form, which means an operator setting up a real contest would be offered a box that forces a
 * score. The control has to live somewhere the contest configuration cannot reach it.
 *
 * WHY THE ROUTES DISAPPEAR RATHER THAN REFUSE
 * ------------------------------------------
 * With `GAMES_SANDBOX` unset these paths return the same 404 as any unknown path, so a production
 * deployment does not advertise that a score-forcing endpoint exists and is merely switched off.
 * The distinction matters because the honest failure mode of a `403` here is somebody discovering
 * the control and looking for a way to satisfy it.
 */

export function requireSandbox(req: Request, res: Response, next: NextFunction): void {
  if (!loadConfig().sandbox) {
    sendError(res, 404, "NOT_FOUND", "No such endpoint.");
    return;
  }
  next();
}

const FORCEABLE: TerminalStatus[] = ["completed", "abandoned", "expired", "voided"];

function readForceStatus(value: unknown): TerminalStatus | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !FORCEABLE.includes(value as TerminalStatus)) {
    throw badRequest(`'status' must be one of ${FORCEABLE.join(", ")}.`);
  }
  return value as TerminalStatus;
}

function readForceScore(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  // Reason for `Number.isFinite` rather than a truthy check: a forced score of 0 is one of the
  // most useful values to test with, and `!value` would discard it.
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw badRequest("'score' must be a finite number.");
  }
  return value;
}

/**
 * `POST /sandbox/rounds/{roundId}/arm`
 *
 * Attaches a behaviour to a round that already exists, so the platform's own creation path is
 * exercised unchanged. Reason this is better than a flag on the create request: a flag would mean
 * the round the platform created in a test is not shaped like the round it creates in production,
 * and the difference would sit in the one call whose correctness the test is meant to establish.
 */
export async function armRound(req: Request, res: Response): Promise<void> {
  const roundId = req.params.roundId ?? "";
  const round = await Round.findOne({ roundId });
  if (!round) throw unknownRound(roundId);

  const forceStatus = readForceStatus(req.body?.status);
  const forceScore = readForceScore(req.body?.score);
  const suppressCallback =
    req.body?.suppressCallback === undefined ? undefined : Boolean(req.body.suppressCallback);

  if (forceStatus === undefined && forceScore === undefined && suppressCallback === undefined) {
    throw badRequest("Nothing to arm. Send 'status', 'score' or 'suppressCallback'.");
  }

  const update: Record<string, unknown> = {};
  if (forceStatus !== undefined) update["sandbox.forceStatus"] = forceStatus;
  if (forceScore !== undefined) update["sandbox.forceScore"] = forceScore;
  if (suppressCallback !== undefined) update["sandbox.suppressCallback"] = suppressCallback;

  await Round.updateOne({ roundId }, { $set: update });

  console.warn(
    `⚠️ [sandbox] ${roundId} armed: ${JSON.stringify({ forceStatus, forceScore, suppressCallback })}`,
  );

  const armed = await Round.findOne({ roundId });
  res.json({ roundId, sandbox: armed?.sandbox ?? {} });
}

/**
 * `POST /sandbox/rounds/{roundId}/finish`
 *
 * Drives a round straight to a terminal state, which is what makes the platform's ranking,
 * tie-break and payout paths testable without a human playing anything.
 */
export async function finishRoundForTesting(req: Request, res: Response): Promise<void> {
  const roundId = req.params.roundId ?? "";
  const status = readForceStatus(req.body?.status) ?? "completed";
  const score = readForceScore(req.body?.score);

  const round = await Round.findOne({ roundId });
  if (!round) throw unknownRound(roundId);

  if (score !== undefined) {
    await Round.updateOne({ roundId }, { $set: { "sandbox.forceScore": score } });
  }

  const outcome = await finishRound(roundId, {
    status,
    reason: status === "voided" ? "Voided by a sandbox control." : undefined,
  });
  if (!outcome) throw unknownRound(roundId);

  if (!outcome.transitioned) {
    throw new ApiError(
      409,
      "ROUND_CONFLICT",
      `Round '${roundId}' was already '${outcome.round.status}'.`,
    );
  }

  const delivery = await attemptDelivery(roundId);
  // Re-read after the delivery attempt, so the response shows the delivery record the attempt
  // actually wrote rather than the state it started from.
  const fresh = await Round.findOne({ roundId });

  res.json({
    result: buildResultBody(fresh ? fresh.toObject() : outcome.round),
    delivery,
  });
}

/**
 * `POST /sandbox/rounds/{roundId}/deliver`
 *
 * Retries a delivery on demand, so a suppressed or previously failed callback can be released
 * without waiting for the retry schedule. Used to prove the other half of the recovery rehearsal:
 * that a result which arrives late is still absorbed.
 */
export async function redeliver(req: Request, res: Response): Promise<void> {
  const roundId = req.params.roundId ?? "";
  const round = await Round.findOne({ roundId });
  if (!round) throw unknownRound(roundId);

  if (round.sandbox.suppressCallback) {
    await Round.updateOne({ roundId }, { $set: { "sandbox.suppressCallback": false } });
  }

  const outcome = await attemptDelivery(roundId);
  res.json({ roundId, delivery: outcome });
}
