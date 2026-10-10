/**
 * One page of the Gamemaster leaderboard for one viewer (`External game plans/24` s6.1).
 *
 * The figures come from the cached snapshot; the viewer's own affiliation is read FRESH on
 * every request. Reason: the figures may lag by minutes without harm, but a Join button
 * shown to a player who joined someone else a minute ago is a button the server refuses,
 * and that reads as the platform contradicting itself.
 */

import UserReferral from "@/database/models/user-referral.model";
import { findSubscriptionForUser, toFacts } from "./affiliation.service";
import type { AffiliationGameMasterFacts } from "./affiliation-rules";
import { getGmLeaderboardMetrics } from "./gm-leaderboard-metrics";
import {
  GM_LEADERBOARD_ROW_KEYS,
  joinGmRowState,
  sortGmRows,
  type GmLeaderboardRow,
  type GmLeaderboardSort,
} from "./gm-leaderboard-rules";

export interface GmLeaderboardViewer {
  /** The Game Master the viewer is affiliated to, when that Game Master is still listed. */
  affiliatedGameMasterName?: string;
  /** True when D1 forbids the viewer joining anybody else. */
  locked: boolean;
}

export interface GmLeaderboardPage {
  rows: GmLeaderboardRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: GmLeaderboardSort;
  asOf: string;
  viewer: GmLeaderboardViewer;
}

/**
 * Builds the row from an explicit key list rather than a spread. Reason: a spread is how
 * the next field arrives, and on a board every signed-in player can read the field after
 * that is `totalEarnings`.
 */
function toPublicRow(row: GmLeaderboardRow): GmLeaderboardRow {
  const source = new Map<string, unknown>(Object.entries(row));
  const out = Object.fromEntries(GM_LEADERBOARD_ROW_KEYS.map((key) => [key, source.get(key)]));
  return out as unknown as GmLeaderboardRow;
}

export async function getGmLeaderboardPage(input: {
  viewerUserId: string;
  sort: GmLeaderboardSort;
  page: number;
  pageSize: number;
}): Promise<GmLeaderboardPage> {
  const snapshot = await getGmLeaderboardMetrics();

  // Reason: the ACTIVE referral row only, exactly the row `affiliate()` decides against -
  // not the `user` document's fallback copy, which `affiliate()` does not consult.
  const activeRow = await UserReferral.findOne({ userId: input.viewerUserId, isActive: true })
    .select({ gameMasterId: 1 })
    .lean<{ gameMasterId: string }>();
  const activeGameMasterId = activeRow?.gameMasterId;
  const activeGameMaster: AffiliationGameMasterFacts | undefined = activeGameMasterId
    ? toFacts(await findSubscriptionForUser(activeGameMasterId))
    : undefined;

  const withState: GmLeaderboardRow[] = snapshot.rows.map((row) => ({
    ...row,
    joinState: joinGmRowState({
      viewerUserId: input.viewerUserId,
      // Reason: every listed row passed the listing filter (active, not paused, not leaving)
      // when the snapshot was taken. If that has changed since, the join route re-reads the
      // subscription live and refuses, so a stale "Join" can never create a wrong link.
      row: { userId: row.gameMasterUserId, userName: row.gameMasterName, status: "active" },
      activeGameMasterId,
      activeGameMaster,
    }),
  }));

  const sorted = sortGmRows(withState, input.sort);
  const start = (input.page - 1) * input.pageSize;
  const rows = sorted.slice(start, start + input.pageSize).map(toPublicRow);

  const locked = withState.some((r) => r.joinState === "locked");
  const mine = withState.find((r) => r.joinState === "your_gm");

  return {
    rows,
    total: sorted.length,
    page: input.page,
    pageSize: input.pageSize,
    sort: input.sort,
    asOf: snapshot.asOf.toISOString(),
    viewer: { affiliatedGameMasterName: mine?.gameMasterName, locked },
  };
}
