import type { Response } from "express";

/**
 * The error envelope of section 14.
 *
 * WHY EVERY FAILURE PATH GOES THROUGH HERE
 * ----------------------------------------
 * The specification asks for two things that are easy to agree with and easy to break: "always
 * return JSON, never an HTML error page", and a `retryable` flag telling the platform whether a
 * failure is transient.
 *
 * Both are broken the same way - by a framework default. Express answers an unhandled throw
 * with an HTML stack trace, and answers an unknown path with an HTML 404. Neither passes
 * through any route handler, so a service whose handlers are all careful can still return HTML
 * for the two cases most likely to happen in an incident. That is why `index.ts` installs a
 * catch-all and an error handler that both come back here.
 *
 * `retryable` deserves its own note, because getting it wrong is expensive in a specific
 * direction. The platform retries an idempotent call three times and then fails the round
 * "without consuming the player's attempt". So a fatal error wrongly marked retryable costs
 * three pointless calls; a transient error wrongly marked fatal costs a paying player their
 * round. When it is genuinely unclear, retryable is the kinder mistake.
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "SIGNATURE_INVALID"
  | "TIMESTAMP_REJECTED"
  | "INVALID_REQUEST"
  | "UNKNOWN_GAME"
  | "UNKNOWN_ROUND"
  | "ROUND_CONFLICT"
  | "ROUND_NOT_PLAYABLE"
  | "GAME_UNAVAILABLE"
  | "NOT_FOUND"
  | "INTERNAL";

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
  };
}

export function errorBody(
  code: ErrorCode,
  message: string,
  retryable: boolean,
): ErrorBody {
  return { error: { code, message, retryable } };
}

export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  retryable = false,
): void {
  res.status(status).json(errorBody(code, message, retryable));
}

/**
 * A refusal a route handler can throw, so the failure sits next to the check that found it.
 *
 * Reason for a class rather than returning a result object: this service's handlers are
 * genuinely nested - create-round resolves a title, then a config, then an idempotency
 * decision - and threading a result through every level is where a refusal gets dropped. The
 * platform's own server actions return result objects instead, and correctly so, because Next.js
 * strips thrown messages in production builds. That constraint does not exist here.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export const badRequest = (message: string) =>
  new ApiError(400, "INVALID_REQUEST", message);

export const unknownGame = (gameCode: string) =>
  new ApiError(404, "UNKNOWN_GAME", `Unknown gameCode '${gameCode}'.`);

export const unknownRound = (roundId: string) =>
  new ApiError(404, "UNKNOWN_ROUND", `Unknown roundId '${roundId}'.`);

/**
 * The `409` of the idempotency table: same `roundId`, different parameters.
 *
 * Never retryable. The platform's own reading of a 409 is "fail and alert - an identifier
 * collision", and retrying an identifier collision produces a second identical collision.
 */
export const roundConflict = (roundId: string) =>
  new ApiError(
    409,
    "ROUND_CONFLICT",
    `Round '${roundId}' already exists with different parameters.`,
  );
