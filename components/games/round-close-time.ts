/**
 * Remaining milliseconds the "Round closes in" panel should show, or `null` when there is
 * nothing to count.
 *
 * Two inputs, measured on two clocks, and that is deliberate:
 *  - `expiresAtMs` is the server's hard deadline, measured against the SERVER's time.
 *  - `gameEndsAtMs` is what the game inside the frame says its own timer ends at (the optional
 *    `clock` frame message). The game paints `endsAt - Date.now()` on the BROWSER's clock, so
 *    to read the same digits as the game this half is measured on the browser's clock too.
 *
 * A frame is untrusted, so a frame claiming to end clearly later than the server's deadline is
 * ignored (see `GAME_CLOCK_TOLERANCE_MS`). Rounded up to a whole second, because the game rounds
 * up (`Math.ceil`) and `clock()` rounds down - left alone the two would disagree by one second,
 * every second.
 */
export function roundCloseRemainingMs(input: {
  expiresAtMs: number;
  serverNowMs: number;
  gameEndsAtMs?: number | null;
  browserNowMs: number;
}): number | null {
  const serverRemaining = Number.isFinite(input.expiresAtMs)
    ? input.expiresAtMs - input.serverNowMs
    : Number.POSITIVE_INFINITY;
  const gameRemaining =
    typeof input.gameEndsAtMs === "number" && Number.isFinite(input.gameEndsAtMs)
      ? input.gameEndsAtMs - input.browserNowMs
      : Number.POSITIVE_INFINITY;

  /*
    Reason for choosing ONE clock rather than taking the smaller on every tick (owner, 15 Oct
    2026: "going up and down"): when the competition ends before a full round, the game's end and
    the server's deadline are the same instant, measured on two clocks that tick at different
    rates and re-anchor on every poll. A per-tick `min` then swapped between them and the digits
    jumped a second up and down. The game wins unless it claims to end clearly AFTER the server's
    deadline; the tolerance lets the frame lengthen the display by at most a few seconds, and the
    round still ends when the server says so.
  */
  const followsGame =
    Number.isFinite(gameRemaining) &&
    gameRemaining <= serverRemaining + GAME_CLOCK_TOLERANCE_MS;
  const remaining = followsGame ? gameRemaining : serverRemaining;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  // Rounded up on both paths because the game rounds up and `clock()` rounds down.
  return Math.ceil(remaining / 1000) * 1000;
}

/** How far past the server's deadline a game's clock may claim before it is ignored. */
export const GAME_CLOCK_TOLERANCE_MS = 5_000;

/**
 * Before the game has reported its own clock, should the tile count to the server's deadline?
 * Only when that deadline leaves less than a whole round, because the deadline is capped at the
 * competition end and otherwise reads the COMPETITION's time rather than the round's (owner,
 * 15 Oct 2026). An unknown round length counts nothing: there is no round time to show.
 */
export function serverDeadlineCutsRoundShort(
  serverRemainingMs: number,
  roundSeconds: number | null | undefined,
): boolean {
  if (typeof roundSeconds !== "number" || !Number.isFinite(roundSeconds) || roundSeconds <= 0) {
    return false;
  }
  return Number.isFinite(serverRemainingMs) && serverRemainingMs < roundSeconds * 1000;
}
