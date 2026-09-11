import { connectToDatabase } from "@/database/mongoose";
import GameRound from "@/database/models/games/game-round.model";
import { roundContributesScore } from "./participant-score.service";

/**
 * What each player on a contest's board has actually been doing.
 *
 * WHY IT EXISTS. The standings showed a rank, a name and a number, which is everything a
 * provider reports about a *result* and nothing about a player's *progress*. The owner asked
 * for what each player solved, and that data was already arriving: every game reports a
 * `scoreBreakdown` alongside its score - `{ boardsCompleted: 3, boardsAttempted: 5, ... }` for
 * this catalogue - and `game_round` has stored it since X3. Nothing read it except the player's
 * own results screen and the admin performance tab.
 *
 * THE PLATFORM DOES NOT CHOOSE AMONG A GAME'S METRICS, and that is the design rather than a
 * limitation. `01` section 3.2 declares the breakdown display-only, free-form and ordered by
 * the provider; a lookup table saying "for a puzzle show boardsCompleted" is a `switch` on game
 * code wearing a different hat, and it makes "a new game needs no additional coding" false for
 * the next title while every existing test still passes. So this hands over the entries in the
 * order the game declared them and the screen renders as many as it has room for. The game's
 * ordering is the game's statement of what matters; ours would be a guess.
 *
 * IT REPORTS, IT DOES NOT DECIDE. No rank is computed here and no score is aggregated: the
 * participant's contest score is `participant-score.service.ts`'s answer and the ranking is
 * `calculateRankings`'. This is the per-round record beside that, and a second opinion about
 * either would be the shape of R37, where the board and the payout disagreed.
 *
 * NOT MIRRORED. `apps/admin` answers the same question for one player across every contest, in
 * `player-game-performance.service.ts`, and has no contest board to put this on. A copy
 * mirrored before anything imports it is two files agreeing while one runs (R42).
 */

/** The round statuses a screen may describe. Wider than the scoring set on purpose. */
export interface ContestPlayerActivity {
  userId: string;
  /** `game_round.status`, as stored. The screen maps it to words, never the other way. */
  status: string;
  /** 1-based, and consumed on round CREATION rather than completion. */
  attemptNumber: number;
  /**
   * The round's own score, present ONLY when this round's status produces one.
   *
   * The status rule is applied here rather than being handed to the screen, because it is the
   * ingestion path's rule and a component re-deciding it is the second copy. A `voided` round
   * is stored with `rawScore: 0` deliberately - it is a support action's residue, not play -
   * so passing that zero through would put a number beside a cancelled round and, on a
   * lower-is-better title, the best one on the board.
   */
  score?: number;
  /** The game's own display metrics, in the order the game declared them. */
  breakdown?: Record<string, unknown>;
  /** When this happened. Falls back through the round's own timestamps. */
  at?: string;
  /**
   * How long this attempt has taken, in milliseconds.
   *
   * TWO DIFFERENT FACTS UNDER ONE NAME, AND THAT IS THE POINT. A reported round carries the
   * duration the GAME measured, which is the only authority on it - the platform never sees
   * the moment a player pressed Start inside the frame. A round still in flight has no such
   * figure, so this is the time since the round was created, which is when the player pressed
   * Play. Those differ by however long the frame took to load, a second or two.
   *
   * Reason a live round is measured at all rather than reading a dash: the board's Time column
   * is otherwise empty for every player in a contest that is actually being played, which is
   * precisely when somebody is looking at it. The lobby re-reads every fifteen seconds, so the
   * figure advances there; the arena's copy is rendered once and does not, which is the
   * already-recorded staleness of that sidebar rather than anything new here.
   */
  durationMs?: number;
}

export interface ContestActivity {
  /** Keyed by user id. A player with no rounds is simply absent. */
  latestByUser: Record<string, ContestPlayerActivity>;
  /** Newest first, across every player asked about. */
  recent: ContestPlayerActivity[];
}

interface ActivityRow {
  userId: string;
  status: string;
  attemptNumber: number;
  rawScore?: number;
  scoreBreakdown?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  durationMs?: number;
}

/** Statuses where the round is still in flight, so its clock is still running. */
const LIVE_STATUSES = new Set(["pending", "launched"]);

const EMPTY: ContestActivity = { latestByUser: {}, recent: [] };

/**
 * When a round's activity happened, from the timestamps the round actually carries.
 *
 * Three candidates rather than one, because the interesting moment moves with the status: a
 * finished round happened when it completed, a live one when it started, and a round created
 * but never opened has only its creation. MongoDB cannot sort on that coalesce without an
 * aggregation, so the ordering is done here - which is also why the query fetches by round
 * rather than trying to express "most recent activity" as an index.
 */
function activityAt(row: ActivityRow): Date | undefined {
  return row.completedAt ?? row.startedAt ?? row.createdAt;
}

/**
 * Every ranked round these players have taken in this contest, reduced to the latest per
 * player and a newest-first feed.
 *
 * SCOPED TO THE USERS ASKED ABOUT, deliberately, and that bounds the query: a contest's
 * attempts are capped by `attemptsAllowed`, so passing the board's rows gives a result set of
 * participants times attempts rather than an unbounded scan. The feed therefore covers the
 * players on the board, which is exactly the set the screen beside it shows - a feed naming
 * somebody absent from the board would send a player looking for a row that is not there.
 *
 * `contestId` is an ObjectId on this collection while `competition_participant.competitionId`
 * is a String, and neither the raw driver nor an aggregation casts between them. The caller
 * passes the contest's own `_id`, so the mismatch cannot arise here - but it is the third
 * place in this codebase that boundary has produced a query matching nothing, so it is worth
 * the sentence.
 */
export async function getContestActivity(
  contestId: unknown,
  userIds: string[],
  options: { recentLimit?: number } = {},
): Promise<ContestActivity> {
  if (!contestId || userIds.length === 0) return EMPTY;

  await connectToDatabase();

  const rows = await GameRound.find({
    contestId,
    userId: { $in: userIds },
    mode: "ranked",
  })
    .select(
      "userId status attemptNumber rawScore scoreBreakdown startedAt completedAt createdAt durationMs",
    )
    // Highest attempt first, so the first row seen for a player is their latest.
    .sort({ attemptNumber: -1 })
    .lean<ActivityRow[]>();

  const latestByUser: Record<string, ContestPlayerActivity> = {};

  for (const row of rows) {
    if (latestByUser[row.userId]) continue;
    latestByUser[row.userId] = toActivity(row);
  }

  const recent = rows
    .map((row) => ({ row, at: activityAt(row) }))
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, options.recentLimit ?? 8)
    .map(({ row }) => toActivity(row));

  return { latestByUser, recent };
}

function toActivity(row: ActivityRow): ContestPlayerActivity {
  const at = activityAt(row);

  return {
    userId: row.userId,
    status: row.status,
    attemptNumber: row.attemptNumber,
    // `Number.isFinite` rather than a null check, because `NaN` would render as "NaN" beside a
    // player's name. The same test the eligibility gate uses (R45).
    score:
      roundContributesScore(row.status) && Number.isFinite(row.rawScore)
        ? row.rawScore
        : undefined,
    // A voided round's stored figures are the residue of a support action, so they are withheld
    // for the same reason its score is. Every other status reports whatever the game sent.
    breakdown:
      row.status === "voided" || row.status === "unresolved"
        ? undefined
        : row.scoreBreakdown,
    at: at?.toISOString(),
    durationMs: attemptClock(row),
  };
}

/**
 * The attempt's clock - reported when the game reported one, running when it has not.
 *
 * A voided round is withheld for the same reason its score and its figures are: the attempt
 * was handed back, so its duration is the residue of a support action rather than play.
 *
 * The live branch is floored at zero rather than trusted, because a clock difference between
 * the database's `createdAt` and this process makes a negative elapsed time possible, and a
 * negative duration formats as something nobody can read.
 */
function attemptClock(row: ActivityRow): number | undefined {
  if (row.status === "voided") return undefined;

  if (typeof row.durationMs === "number" && Number.isFinite(row.durationMs)) {
    return row.durationMs;
  }

  if (!LIVE_STATUSES.has(row.status)) return undefined;

  const began = row.startedAt ?? row.createdAt;
  if (!began) return undefined;

  return Math.max(0, Date.now() - began.getTime());
}
