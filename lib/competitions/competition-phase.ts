/**
 * Where a competition is in time, as a card should show it.
 *
 * Reason (owner, 15 Oct 2026, screenshot of a finished contest reading "STARTING SOON",
 * "Starts in: Starting now" and a greyed Join button): the stored `status` only moves when the
 * every-minute cron starts, cancels or finalizes the contest. Between the scheduled moment and
 * that pass - longer when the cron is behind or the contest is waiting on results - a card that
 * trusts the stored value tells a player a finished contest is about to begin. The stored status
 * still wins for every settled state; the clock only answers "has the moment already passed?".
 */
export type CompetitionPhase =
  | "settled" // completed or cancelled - the stored status says everything
  | "upcoming" // before the start
  | "running" // between start and end (stored status may still read "upcoming")
  | "ended"; // past the end, not finalized yet - results pending

export function resolveCompetitionPhase(
  c: { status: string; startTime?: string; endTime?: string },
  nowMs: number,
): CompetitionPhase {
  if (c.status === "completed" || c.status === "cancelled") return "settled";
  const start = c.startTime ? Date.parse(c.startTime) : Number.NaN;
  const end = c.endTime ? Date.parse(c.endTime) : Number.NaN;
  if (Number.isFinite(end) && nowMs >= end) return "ended";
  if (c.status === "active") return "running";
  if (Number.isFinite(start) && nowMs >= start) return "running";
  return "upcoming";
}
