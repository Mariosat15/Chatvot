/**
 * The start and end a contest wizard opens with (owner, 2 Oct 2026: "always fill the default
 * date today in the calendar automatically so the user can change if he likes").
 *
 * TODAY, ABOUT AN HOUR AHEAD, rounded up to the next five minutes. An hour rather than "now"
 * because every create path refuses a start in the past, and a default the form then refuses
 * is worse than an empty field. Rounded so the time reads as chosen rather than as a clock
 * reading. After 23:00 UTC the hour ahead is tomorrow, which is the only honest answer.
 *
 * UTC WALL-CLOCK, never the browser's zone: every wizard joins these as `${date}T${time}:00Z`,
 * so a local calendar day would put the gun hours away from what the operator sees.
 *
 * Pure and model-free, so client components may import it (R58). Mirrored byte-for-byte into
 * `apps/admin/lib/utils/`; `check:mirrors` compares models only, so a test holds the two.
 */

export interface UtcDraftWindow {
  /** `YYYY-MM-DD`, UTC. */
  startDate: string;
  /** `HH:mm`, 24-hour UTC. */
  startTime: string;
  endDate: string;
  endTime: string;
}

const LEAD_MINUTES = 60;
const ROUND_TO_MINUTES = 5;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function hm(d: Date): string {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function defaultContestWindow(
  durationMinutes: number,
  now: Date = new Date(),
): UtcDraftWindow {
  const step = ROUND_TO_MINUTES * 60 * 1000;
  const startMs = Math.ceil((now.getTime() + LEAD_MINUTES * 60 * 1000) / step) * step;
  const start = new Date(startMs);
  const end = new Date(startMs + Math.max(1, durationMinutes) * 60 * 1000);
  return {
    startDate: ymd(start),
    startTime: hm(start),
    endDate: ymd(end),
    endTime: hm(end),
  };
}
