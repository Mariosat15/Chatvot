/**
 * The one rule for when a Game Master contest may be scheduled.
 *
 * A start already behind the server clock creates a contest whose entry closed before it was
 * listed, so nobody can join it. Model-free so the wizard and the create routes share it, and
 * mirrored into `apps/admin` (byte-identical, pinned by a test).
 */

/**
 * Slack on the server only. The browser refuses a past start outright; the server allows this
 * much so a start chosen "now" on a browser a few seconds behind is not refused in transit.
 */
export const START_IN_PAST_TOLERANCE_MS = 60_000;

export function gameMasterScheduleError(
  start: Date | null | undefined,
  end: Date | null | undefined,
  now: Date,
  toleranceMs = 0,
): string | null {
  const startMs = start ? start.getTime() : Number.NaN;
  const endMs = end ? end.getTime() : Number.NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return "Set a valid start and end date and time (UTC).";
  }
  if (startMs < now.getTime() - toleranceMs) {
    return "The start time has already passed. Choose a start after the current server time (UTC).";
  }
  if (endMs <= startMs) {
    return "The end must be after the start (UTC).";
  }
  return null;
}
