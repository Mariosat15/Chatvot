/**
 * Turns the rows assembled by `GET /api/users/[userId]/history` into a CSV an
 * operator can open in Excel. Pure: no database, no request.
 */

export interface ActivityRow {
  id: string;
  type: string;
  category: string;
  description: string;
  status?: string;
  amount?: number;
  createdAt: Date | string;
  details?: Record<string, unknown>;
}

const HEADERS = [
  "Date (UTC)",
  "Type",
  "Category",
  "Description",
  "Status",
  "Amount",
  "Details",
  "Record ID",
];

// Reason: a cell starting with = + - @ is executed as a formula by Excel and
// Sheets. Descriptions and details include player-supplied text (competition
// names, note content, user agents), so they are neutralised with a leading quote.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  const isPlainNumber = s.trim() !== "" && Number.isFinite(Number(s));
  if (FORMULA_PREFIX.test(s) && !isPlainNumber) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function formatDetails(details?: Record<string, unknown>): string {
  if (!details) return "";
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("; ");
}

export function buildUserActivityCsv(rows: ActivityRow[]): string {
  const lines = rows.map((row) =>
    [
      formatDate(row.createdAt),
      row.type,
      row.category,
      row.description,
      row.status ?? "",
      typeof row.amount === "number" && Number.isFinite(row.amount) ? row.amount : "",
      formatDetails(row.details),
      row.id,
    ]
      .map(csvCell)
      .join(","),
  );
  // Reason: BOM tells Excel the file is UTF-8, so accented names and the emoji
  // in descriptions render instead of turning into mojibake.
  return "\uFEFF" + [HEADERS.join(","), ...lines].join("\r\n");
}
