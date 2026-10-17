/**
 * The date filter for the Skill Evidence report: which settled contests count, by the day
 * each one ended.
 *
 * Model-free and client-reachable (R58), because the screen, the evidence route and the
 * PDF report must agree on what a range means. With a copy on each side, the screen would
 * caption one period while the PDF counts another, and the regulator receives the second.
 *
 * Dates are whole UTC days written `YYYY-MM-DD`. `to` includes the whole of its day, so a
 * contest that ended at 23:59 on the last day is in the period rather than silently left out.
 */

export interface EvidenceRange {
  /** Inclusive start, 00:00:00.000 UTC on the `from` day. */
  from?: Date;
  /** Inclusive end, 23:59:59.999 UTC on the `to` day. */
  to?: Date;
}

export type RangeParse =
  | { ok: true; range: EvidenceRange; from: string | null; to: string | null }
  | { ok: false; error: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string, endOfDay: boolean): Date | null {
  if (!DAY.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  // Reason: `new Date("2026-02-31")` rolls over to March rather than failing, so the day
  // must survive the round trip or a typo silently becomes a different period.
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

/** Empty or absent means unbounded on that side. Anything else must be a real day. */
export function parseEvidenceRange(
  from: string | null | undefined,
  to: string | null | undefined,
): RangeParse {
  const f = from?.trim() || null;
  const t = to?.trim() || null;
  const range: EvidenceRange = {};
  if (f) {
    const d = parseDay(f, false);
    if (!d) return { ok: false, error: "The start date is not a valid date (use YYYY-MM-DD)." };
    range.from = d;
  }
  if (t) {
    const d = parseDay(t, true);
    if (!d) return { ok: false, error: "The end date is not a valid date (use YYYY-MM-DD)." };
    range.to = d;
  }
  if (range.from && range.to && range.from > range.to) {
    return { ok: false, error: "The start date is after the end date." };
  }
  return { ok: true, range, from: f, to: t };
}

/** "1 Jan 2026 to 31 Mar 2026", or the open-ended wording, for headings and the PDF. */
export function describeEvidenceRange(from: string | null, to: string | null): string {
  const fmt = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  if (from && to) return `${fmt(from)} to ${fmt(to)}`;
  if (from) return `From ${fmt(from)} to date`;
  if (to) return `All contests up to ${fmt(to)}`;
  return "All settled contests to date";
}
