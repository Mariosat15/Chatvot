/**
 * How a provider game's score is written on screen.
 *
 * Decided by the title's declared `scoreType` and nothing else, so a new title needs no code
 * here (the no-developer-needed claim). DISPLAY ONLY: ranking, eligibility and settlement read
 * the raw stored number, and nothing here may feed back into them.
 *
 * Model-free and client-reachable (R58) - every leaderboard and panel imports it.
 *
 * `duration_ms` is written as a clock. A race time of 172,666.998 is 2:52.667: the fraction is
 * a tie-break below one millisecond that the provider folds into the score so equal times do
 * not tie, and printing it reads as a points total with too many decimals. Rounded to the
 * nearest millisecond, never truncated, so a time just under a millisecond boundary is not
 * shown one millisecond slower than the one the provider recorded.
 */
export type GameScoreType = "integer" | "decimal" | "duration_ms" | string;

export function formatGameScore(
  score: number | null | undefined,
  scoreType?: GameScoreType,
  empty = "-",
): string {
  // Reason: an absent score is not a zero (R50). A dash is the only honest rendering.
  if (typeof score !== "number" || !Number.isFinite(score)) return empty;

  if (scoreType === "duration_ms") return formatDurationMs(score);
  if (scoreType === "integer") {
    return Math.round(score).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return score.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** `m:ss.mmm`, or `h:mm:ss.mmm` from one hour. */
export function formatDurationMs(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const total = Math.round(Math.abs(ms));
  const millis = total % 1000;
  const totalSeconds = Math.floor(total / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  if (hours > 0) {
    return `${sign}${hours}:${String(minutes).padStart(2, "0")}:${ss}.${mmm}`;
  }
  return `${sign}${minutes}:${ss}.${mmm}`;
}
