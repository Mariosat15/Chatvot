import type { Request, Response } from "express";

import { currentState, leaveRound, startOrResume, submitBoard } from "../rounds/play";
import { badRequest } from "./errors";

/**
 * The play surface, called by the game running inside the platform's iframe.
 *
 * A DIFFERENT CALLER, SO A DIFFERENT CREDENTIAL
 * --------------------------------------------
 * Everything under `/v1` is called by the platform's servers and authenticated with an API key and
 * an HMAC. Nothing here is: the caller is a browser the player controls, and it holds only the
 * single-use launch token from the URL the platform put in the frame.
 *
 * Keeping the two surfaces apart is what stops the weaker credential reaching the stronger
 * endpoints. A launch token can start and submit its own round and can do nothing else - it cannot
 * create a round, cannot read another round, and cannot force a score even in sandbox mode.
 *
 * THE TOKEN TRAVELS IN THE BODY AFTER THE FIRST LOAD
 * -------------------------------------------------
 * It has to arrive in the launch URL's query string, because that is the only channel the
 * specification gives a provider for authenticating an embedded frame. Everything afterwards sends
 * it in the request body instead, which keeps it out of `Referer` headers, out of access logs and
 * out of the browser history for every call but the first.
 */

function readToken(source: unknown, field = "t"): string {
  // The indexed KEY is the literal "t" from this signature, never anything from the request - only
  // the object being read is caller-supplied. `security/detect-object-injection` cannot tell the
  // two apart.
  // eslint-disable-next-line security/detect-object-injection
  const value = (source as Record<string, unknown> | undefined)?.[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest("Missing session token.");
  }
  return value.trim();
}

export async function postSession(req: Request, res: Response): Promise<void> {
  const state = await startOrResume(readToken(req.body));
  res.json(state);
}

export async function getState(req: Request, res: Response): Promise<void> {
  const state = await currentState(readToken(req.query));
  res.json(state);
}

export async function postSubmit(req: Request, res: Response): Promise<void> {
  const token = readToken(req.body);
  const outcome = await submitBoard(token, req.body?.boardIndex, req.body?.paths);
  // Always 200, including for a refused board.
  //
  // A refusal is a normal event in a puzzle - paths cross, a square is left unused - and it is
  // information for the player, not an error in the request. Returning 4xx would make ordinary
  // gameplay indistinguishable from a malformed call in every log and monitor the service has.
  res.json(outcome);
}

export async function postLeave(req: Request, res: Response): Promise<void> {
  const state = await leaveRound(readToken(req.body));
  res.json(state);
}
