/**
 * Gamemaster leaderboard rules - pure, no database access (`External game plans/24` s6.1).
 *
 * Model-free on purpose (R58): the leaderboard component is `"use client"` and imports the
 * types and the sort list from here, so nothing in this file may reach a Mongoose model.
 * `affiliation-rules.ts` is model-free too, which is what lets the row state below be
 * decided by the SAME function `affiliate()` uses rather than by a second copy of it.
 */

import { decideAffiliation, type AffiliationGameMasterFacts } from "./affiliation-rules";

export const GM_LEADERBOARD_SORTS = [
  "activeAffiliates",
  "affiliates",
  "competitionsCreated",
  "competitionsCompleted",
  "participants",
  "entryVolts",
] as const;

export type GmLeaderboardSort = (typeof GM_LEADERBOARD_SORTS)[number];

export const DEFAULT_GM_LEADERBOARD_SORT: GmLeaderboardSort = "activeAffiliates";

export const GM_LEADERBOARD_DEFAULT_PAGE_SIZE = 20;
export const GM_LEADERBOARD_MAX_PAGE_SIZE = 50;

// Reason: a Set, never an object lookup - the sort key comes from the query string, and
// `"constructor"` would pass an `in` check on an object (fourth instance of that rule here).
const SORT_SET: ReadonlySet<string> = new Set(GM_LEADERBOARD_SORTS);

/**
 * `null` means the caller sent something we do not sort by - the route refuses it rather
 * than silently falling back, so a typo in a link reads as a typo and not as a board that
 * ignores the operator's choice.
 */
export function parseGmLeaderboardSort(value: string | null | undefined): GmLeaderboardSort | null {
  if (value === null || value === undefined || value === "") return DEFAULT_GM_LEADERBOARD_SORT;
  return SORT_SET.has(value) ? (value as GmLeaderboardSort) : null;
}

/** Whole numbers only; `limit` is capped so one request cannot pull the whole board. */
export function parseGmLeaderboardPage(
  page: string | null | undefined,
  limit: string | null | undefined,
): { page: number; pageSize: number } | null {
  const toInt = (v: string | null | undefined, fallback: number) => {
    if (v === null || v === undefined || v === "") return fallback;
    if (!/^\d+$/.test(v)) return NaN;
    return Number(v);
  };
  const p = toInt(page, 1);
  const size = toInt(limit, GM_LEADERBOARD_DEFAULT_PAGE_SIZE);
  if (!Number.isSafeInteger(p) || p < 1) return null;
  if (!Number.isSafeInteger(size) || size < 1 || size > GM_LEADERBOARD_MAX_PAGE_SIZE) return null;
  return { page: p, pageSize: size };
}

/** The cached, public figures for one Game Master. Never money earned (owner decision). */
export interface GmLeaderboardMetrics {
  subscriptionId: string;
  gameMasterUserId: string;
  gameMasterName: string;
  rank: number;
  affiliates: number;
  activeAffiliates: number;
  competitionsCreated: number;
  competitionsCompleted: number;
  participants: number;
  entryVolts: number;
}

/**
 * The exact key set a row may carry to the browser. A test asserts every response row has
 * these keys and no others, which is what keeps earnings, emails and pending balances off
 * a board every signed-in player can read.
 */
export const GM_LEADERBOARD_ROW_KEYS = [
  "subscriptionId",
  "gameMasterUserId",
  "gameMasterName",
  "rank",
  "affiliates",
  "activeAffiliates",
  "competitionsCreated",
  "competitionsCompleted",
  "participants",
  "entryVolts",
  "joinState",
] as const;

/**
 * What the Join GM control on a row should be:
 * - `own`: the viewer IS this Game Master - no button;
 * - `your_gm`: already affiliated here - a badge, no button;
 * - `locked`: affiliated to another Game Master who has not left (D1) - greyed out;
 * - `joinable`: the join would create an affiliation;
 * - `unavailable`: anything else the rules refuse (never expected on a listed row).
 */
export type JoinGmRowState = "own" | "your_gm" | "locked" | "joinable" | "unavailable";

export interface GmLeaderboardRow extends GmLeaderboardMetrics {
  joinState: JoinGmRowState;
}

/**
 * Decided by `decideAffiliation`, the function `affiliate()` itself calls, never by a
 * second set of conditions. Reason: a button that says "Join" on a row the server then
 * refuses - or greys out a join the server would allow - is the "one rule, two copies"
 * shape, and it reads to a player as the platform contradicting itself.
 */
export function joinGmRowState(input: {
  viewerUserId: string;
  row: AffiliationGameMasterFacts;
  activeGameMasterId?: string;
  activeGameMaster?: AffiliationGameMasterFacts;
}): JoinGmRowState {
  const decision = decideAffiliation({
    userId: input.viewerUserId,
    channel: "chartvolt_join_gm",
    gm: input.row,
    activeGameMasterId: input.activeGameMasterId,
    activeGameMaster: input.activeGameMaster,
  });
  if (decision.kind === "create") return "joinable";
  if (decision.kind === "already_affiliated") return "your_gm";
  if (decision.code === "self") return "own";
  if (decision.code === "already_affiliated_other") return "locked";
  return "unavailable";
}

/**
 * Join refusal code -> HTTP status, for `POST /api/gamemasters/[subscriptionId]/join`.
 * Lives here because a Next.js route file may export only its handlers. A `Map`, because
 * the key is a value the service returned and an object lookup walks the prototype chain.
 * An unlisted code falls through to 500 with the generic message - the safe direction,
 * since it can never read as success.
 */
export const JOIN_GM_REFUSAL_STATUS: ReadonlyMap<string, number> = new Map([
  ["invalid_input", 400],
  ["self", 400],
  ["terms_not_accepted", 400],
  ["gm_not_found", 404],
  ["user_not_found", 404],
  ["gm_not_joinable", 409],
  ["already_affiliated_other", 409],
  ["terms_outdated", 409],
  ["terms_unavailable", 503],
]);

/**
 * Rank by the default metric (active affiliates, then all affiliates), ties sharing a
 * rank. The rank does not move when the viewer re-sorts - it is the board's standing, and
 * the sort is only how the viewer chooses to read it.
 */
export function rankGmMetrics<T extends Omit<GmLeaderboardMetrics, "rank">>(
  rows: readonly T[],
): Array<T & { rank: number }> {
  const ordered = [...rows].sort(
    (a, b) =>
      b.activeAffiliates - a.activeAffiliates ||
      b.affiliates - a.affiliates ||
      a.gameMasterName.localeCompare(b.gameMasterName),
  );
  let rank = 0;
  return ordered.map((row, i) => {
    const prev = ordered[i - 1];
    if (!prev || prev.activeAffiliates !== row.activeAffiliates || prev.affiliates !== row.affiliates) {
      rank = i + 1;
    }
    return { ...row, rank };
  });
}

/** Descending by the chosen metric; the standing breaks ties so the order is stable. */
export function sortGmRows<T extends GmLeaderboardMetrics>(rows: readonly T[], sort: GmLeaderboardSort): T[] {
  const metric = (row: T): number => {
    switch (sort) {
      case "activeAffiliates":
        return row.activeAffiliates;
      case "affiliates":
        return row.affiliates;
      case "competitionsCreated":
        return row.competitionsCreated;
      case "competitionsCompleted":
        return row.competitionsCompleted;
      case "participants":
        return row.participants;
      case "entryVolts":
        return row.entryVolts;
    }
  };
  return [...rows].sort((a, b) => metric(b) - metric(a) || a.rank - b.rank || a.gameMasterName.localeCompare(b.gameMasterName));
}
