/**
 * URL state for the admin Game Master area (`External game plans/24` s7.3). Pure and
 * model-free, because the screen that uses it is `"use client"` (R58).
 *
 * Reason: tab and filter state live in the URL, never only in `useState`, so a bookmark or a
 * link pasted into a ticket reopens the same report. The filters are PREFIXED with `rp_`
 * because the dashboard keeps one query string for every section - an unprefixed `status`
 * or `search` would be inherited by whichever section the operator opens next.
 */

export const GM_TABS = ["masters", "players"] as const;
export type GmTab = (typeof GM_TABS)[number];
export const GM_TAB_PARAM = "gmTab";

export const REPORT_PARAM_PREFIX = "rp_";

/** The report's filter keys, spelled exactly as `parseReferredPlayersQuery` reads them. */
export const REPORT_FILTER_KEYS = [
  "gameMasterId",
  "kind",
  "surface",
  "status",
  "activity",
  "joinedFrom",
  "joinedTo",
  "search",
  "page",
] as const;
export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];
export type ReportState = Partial<Record<ReportFilterKey, string>>;

export const REPORT_PAGE_SIZE = 25;

interface ReadableParams {
  get(name: string): string | null;
}

/**
 * Which tab to open. `gmId` is the existing deep link into one Game Master's details
 * (`UserFullDetailPanel` links to it), so it always wins and opens the masters tab -
 * otherwise a stale `gmTab=players` in the URL would swallow that link silently.
 *
 * Default (no `gmTab`, no `gmId`) is **players** - Part 2 made the referred-players report
 * the primary Manage Game Masters screen. An explicit `gmTab=masters` still opens the list.
 */
export function resolveGmTab(params: ReadableParams): GmTab {
  if (params.get("gmId")) return "masters";
  const raw = params.get(GM_TAB_PARAM);
  if (raw === "masters") return "masters";
  if (raw === "players") return "players";
  return "players";
}

export function readReportState(params: ReadableParams): ReportState {
  const state: ReportState = {};
  for (const key of REPORT_FILTER_KEYS) {
    const value = params.get(REPORT_PARAM_PREFIX + key);
    // Reason: `key` iterates the fixed REPORT_FILTER_KEYS constant; only the VALUE is input.
    // eslint-disable-next-line security/detect-object-injection
    if (value) state[key] = value;
  }
  return state;
}

/** Returns a copy of `current` with the report's keys replaced by `state`. */
export function writeReportState(current: URLSearchParams, state: ReportState): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const key of REPORT_FILTER_KEYS) {
    // eslint-disable-next-line security/detect-object-injection -- key from REPORT_FILTER_KEYS
    const value = state[key]?.trim();
    if (value) next.set(REPORT_PARAM_PREFIX + key, value);
    else next.delete(REPORT_PARAM_PREFIX + key);
  }
  return next;
}

/**
 * The query string the report and export routes parse. `page` and `limit` are left out
 * when `forExport` is set, because the export always takes the WHOLE filtered set - a file
 * that silently holds only the page on screen is a report that lies about its size.
 */
export function toApiQuery(state: ReportState, options: { forExport?: boolean } = {}): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of REPORT_FILTER_KEYS) {
    if (key === "page") continue;
    // eslint-disable-next-line security/detect-object-injection -- key from REPORT_FILTER_KEYS
    const value = state[key]?.trim();
    if (value) query.set(key, value);
  }
  if (options.forExport) {
    query.set("format", "csv");
  } else {
    query.set("page", state.page && /^\d+$/.test(state.page) ? state.page : "1");
    query.set("limit", String(REPORT_PAGE_SIZE));
  }
  return query;
}
