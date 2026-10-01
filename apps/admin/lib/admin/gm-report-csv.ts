/**
 * CSV rendering for the referred-players export (`External game plans/24` s7.5, task 4).
 *
 * Pure and model-free so it is tested directly. Two rules live here and nowhere else:
 *   1. Formula injection. A spreadsheet treats a cell starting with `=`, `+`, `-` or `@` (and,
 *      in some, tab or carriage return) as a formula - a player who names themselves
 *      `=HYPERLINK(...)` gets code run on the operator's machine. Such cells are prefixed with
 *      a single quote, which every spreadsheet shows as text. Applied to STRING cells only:
 *      a negative number is data, and quoting it would turn it into text.
 *   2. The row cap. Above it the export is refused with a clear message rather than truncated,
 *      because a silently short file reads as the whole set.
 */

import type { ReferredPlayerRow } from "../services/gamemaster/referral-read-model";
import { REFERRAL_KIND_LABELS, REFERRAL_SURFACE_LABELS } from "../services/gamemaster/referral-kind";
import type { ReferredPlayersFilter } from "../services/gamemaster/referral-report-filter";

export const REFERRED_PLAYERS_EXPORT_CAP = 10_000;
export const EXPORT_BATCH_SIZE = 500;

export function exportCapMessage(total: number): string {
  return (
    `This export would contain ${total.toLocaleString("en-US")} rows, above the limit of ` +
    `${REFERRED_PLAYERS_EXPORT_CAP.toLocaleString("en-US")}. Narrow the filters (date range, ` +
    `Game Master, status) and export again.`
  );
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: formula-neutralised, then quoted when it holds a delimiter, quote or newline. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

interface Column {
  header: string;
  cell: (row: ReferredPlayerRow) => unknown;
}

// Reason: labels come from referral-kind.ts so the file says what the screen's badge says.
const surfaceLabel = (row: ReferredPlayerRow) =>
  row.surface ? REFERRAL_SURFACE_LABELS[row.surface] : "";

export const EXPORT_COLUMNS: readonly Column[] = [
  { header: "Player ID", cell: (r) => r.userId },
  { header: "Player name", cell: (r) => r.userName },
  { header: "Player email", cell: (r) => r.userEmail },
  { header: "Game Master ID", cell: (r) => r.gameMasterId },
  { header: "Game Master email", cell: (r) => r.gameMasterEmail },
  { header: "Referral type", cell: (r) => REFERRAL_KIND_LABELS[r.kind] },
  { header: "Joined via", cell: surfaceLabel },
  { header: "Via competition", cell: (r) => r.viaCompetitionId },
  { header: "Joined at", cell: (r) => r.joinedAt },
  { header: "Status", cell: (r) => (r.isCurrent ? "Current" : "Ended") },
  { header: "Ended at", cell: (r) => r.endedAt },
  { header: "Ended reason", cell: (r) => r.endedReason },
  { header: "Active (30 days)", cell: (r) => r.isActive },
  { header: "Last activity", cell: (r) => r.lastActivityAt },
  { header: "Competitions entered", cell: (r) => r.competitionsEntered },
  { header: "Challenges entered", cell: (r) => r.challengesEntered },
  { header: "Entry fees", cell: (r) => r.entryFees },
  { header: "GM earned", cell: (r) => r.earned },
  { header: "GM paid", cell: (r) => r.paid },
  { header: "GM pending", cell: (r) => r.pending },
  { header: "Terms accepted", cell: (r) => r.termsAccepted },
];

export function csvHeaderLine(): string {
  return EXPORT_COLUMNS.map((c) => escapeCsvCell(c.header)).join(",") + "\r\n";
}

export function csvRowLine(row: ReferredPlayerRow): string {
  return EXPORT_COLUMNS.map((c) => escapeCsvCell(c.cell(row))).join(",") + "\r\n";
}

/** The filters as plain JSON for the audit row - dates as ISO strings. */
export function describeFilterForAudit(filter: ReferredPlayersFilter): Record<string, unknown> {
  return {
    ...filter,
    joinedFrom: filter.joinedFrom?.toISOString(),
    joinedTo: filter.joinedTo?.toISOString(),
  };
}
