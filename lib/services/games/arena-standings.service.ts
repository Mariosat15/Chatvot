import { getCompetitionLeaderboard } from "@/lib/actions/trading/competition.actions";
import { getContestActivity } from "./contest-activity.service";
import type { RoundActivitySummary } from "@/lib/utils/round-activity";

/**
 * Everything the arena's standings rail renders: who is ahead, what each of them has been
 * doing, and where the caller stands.
 *
 * WHY IT IS A SERVICE RATHER THAN TWO READS IN THE PAGE. The arena renders its standings once,
 * on the server, and then hosts a live round in an iframe - so making the board live means a
 * second reader, and a second reader is where two screens start disagreeing. The page and the
 * polling route call THIS, so there is one composition and the figure a player sees fifteen
 * seconds after the page loaded is produced by the same code that drew the first one.
 *
 * That is the `dashboard-live` lesson in a new place, and it is worth restating because the
 * instinct is to make the refresh cleverer: THE PROPERTY ENGINEERED FOR IS AGREEMENT WITH THE
 * FIRST RENDER, never maximal liveness. Any field where the poll and the server render differ
 * reads to the player as the value having changed.
 *
 * THE TWO READS ARE ORDERED, NOT PARALLEL, AND THAT IS DELIBERATE. The activity query is scoped
 * to the user ids the board returned, so it is bounded by the players on screen rather than by
 * everybody who has ever entered - which means it cannot start until the board has answered.
 * One extra round trip is the price of that bound, and it is the right way round: an unscoped
 * read grows with the contest for ever.
 */

export interface ArenaFeedEntry {
  userId: string;
  username?: string;
  activity: RoundActivitySummary;
}

export interface ArenaStandings {
  rows: Awaited<ReturnType<typeof getCompetitionLeaderboard>>;
  /** What each player on the board has been doing, keyed by user id. */
  activity: Record<string, RoundActivitySummary>;
  /** The most recent rounds across the contest, newest first, with names attached. */
  feed: ArenaFeedEntry[];
  /**
   * The caller's own position, READ off the row the server already ranked.
   *
   * Never worked out here. `calculateRankings` resolves the contest's score direction once from
   * the catalogue; a second place deciding a position is the shape of R37, where the board and
   * the payout disagreed because each had computed it separately. Absent when they hold none.
   */
  yourRank?: number;
}

export async function getArenaStandings(
  competitionId: string,
  userId: string,
  options?: { limit?: number; recentLimit?: number },
): Promise<ArenaStandings> {
  const limit = options?.limit ?? 25;
  const recentLimit = options?.recentLimit ?? 6;

  /*
    The id goes in as the string from the URL because this is a Mongoose query underneath and
    Mongoose casts it when the query executes. The raw driver does NOT, which is the boundary
    that has now produced three separate defects, so the distinction is worth keeping in view
    rather than relying on.
  */
  const leaderboard = await getCompetitionLeaderboard(competitionId, limit);
  const rows = Array.isArray(leaderboard) ? leaderboard : [];

  const activity = await getContestActivity(
    competitionId,
    rows.map((row) => row.userId),
    { recentLimit },
  );

  // The feed's names come from the board that has already been read, not from a second user
  // lookup: every player in the feed is by construction a player in the standings.
  const nameByUser = new Map(rows.map((row) => [row.userId, row.username]));

  return {
    rows,
    activity: activity.latestByUser,
    feed: activity.recent.map((entry) => ({
      userId: entry.userId,
      username: nameByUser.get(entry.userId),
      activity: entry,
    })),
    yourRank: rows.find((row) => row.userId === userId)?.currentRank,
  };
}
