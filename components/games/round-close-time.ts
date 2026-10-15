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
 * Reason for the `min`: a frame is untrusted, so its number may only ever SHORTEN the panel. A
 * frame claiming a later end than the server's deadline is ignored. Rounded up to a whole
 * second when the game's figure is used, because the game rounds up (`Math.ceil`) and
 * `CountdownPanel` rounds down - left alone the two would disagree by one second, every second.
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

  const remaining = Math.min(serverRemaining, gameRemaining);
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  return gameRemaining <= serverRemaining ? Math.ceil(remaining / 1000) * 1000 : remaining;
}
