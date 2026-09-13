/**
 * The decision half of the R50 phantom-score cleanup, separated from the CLI so it can be
 * tested against a real database.
 *
 * SPLIT FOR THE REASON THE LABEL BACKFILL WAS: **the most important property of a migration is
 * what it refuses to touch**, and "it only clears rows that never scored" is an assertion about
 * a query filter - which is exactly the thing people get wrong. A file whose `main()` runs at
 * module scope cannot be imported by a test at all, so the filter would only ever be read.
 */

import type { Connection, Types } from "mongoose";
import { TRADING_GAME_TYPE } from "../../lib/games/types";
import { SCORING_ROUND_STATUSES } from "../../lib/services/games/participant-score.service";

/** Statuses whose stored `finalLeaderboard` is the authoritative record of what was paid. */
export const SETTLED_STATUSES = ["completed", "cancelled", "emergency_ended"];

export interface ContestReport {
  contestId: string;
  name: string;
  status: string;
  /** Seats holding a phantom zero that this script would clear. */
  clearable: number;
  /** Seats mislabelled as trading on a provider contest. Reported, never touched - see R7. */
  mislabelled: number;
  cleared: number;
}

export interface CleanupOutcome {
  contests: ContestReport[];
  totalClearable: number;
  totalCleared: number;
}

interface CandidateRow {
  _id: Types.ObjectId;
  gameKey?: string;
}

/**
 * Reason the handle is typed off mongoose's own `Connection` rather than as `Db` from
 * "mongodb": mongoose bundles its own copy of the driver, so `node_modules/mongodb` and
 * `node_modules/mongoose/node_modules/mongodb` are two different types with the same name.
 * Importing the outer one puts eleven `Db is not assignable to Db` errors on every caller.
 */
type MongoDb = NonNullable<Connection["db"]>;

export async function clearPhantomScores(
  db: MongoDb,
  options: { apply: boolean },
): Promise<CleanupOutcome> {
  const contests = db.collection("competitions");
  const participants = db.collection("competitionparticipants");
  const rounds = db.collection("gamerounds");

  /*
    Scoped to OPEN provider contests, and both halves of that matter.

    Provider, because trading's module answers `hasResult` with an unconditional `true` - the
    field is inert there, so touching trading history would be a platform-wide write to no
    effect. Open, because a settled contest's `finalLeaderboard` is what was actually paid, and
    clearing scores underneath it would make the board read differently from the money.
  */
  const openProviderContests = await contests
    .find({ gameType: "provider", status: { $nin: SETTLED_STATUSES } })
    .project({ _id: 1, name: 1, status: 1 })
    .toArray();

  const report: ContestReport[] = [];
  let totalClearable = 0;
  let totalCleared = 0;

  for (const contest of openProviderContests) {
    const contestId = contest._id;

    /*
      WHO HAS A CONTRIBUTING ROUND, read from `game_round` using the SHARED status list.

      Never a local copy of those statuses: R48 widened them from `completed` alone to include
      `abandoned` and `expired`, and a migration holding its own copy would have kept clearing
      the scores of players whose cut-short runs now count - every row looking correctly
      handled. Import it, so a future change to the rule reaches here too.

      The id shapes are the trap. `game_round.contestId` is an ObjectId while
      `competition_participant.competitionId` is declared `String`; the raw driver casts
      neither, so a query written for one shape returns nothing and logs happily.
    */
    const scoringPlayers = await rounds.distinct("userId", {
      contestId,
      contestType: "competition",
      status: { $in: SCORING_ROUND_STATUSES },
    });

    // Only an exact `0`, never `$lte` or a truthiness test. A real score is a result, and a
    // script that can clear one is a script that can quietly rewrite who won.
    const candidates = (await participants
      .find({
        competitionId: contestId.toString(),
        score: 0,
        userId: { $nin: scoringPlayers },
      })
      .project({ _id: 1, gameKey: 1 })
      .toArray()) as unknown as CandidateRow[];

    const isTrading = (row: CandidateRow) =>
      (row.gameKey || TRADING_GAME_TYPE) === TRADING_GAME_TYPE;

    // A trading-labelled seat on a provider contest is an R7 mislabel rather than a scoring
    // problem, and `gameKey` is immutable - so it is surfaced for a human, not repaired here.
    const mislabelled = candidates.filter(isTrading);
    const clearable = candidates.filter((row) => !isTrading(row));

    totalClearable += clearable.length;
    let cleared = 0;

    if (options.apply && clearable.length > 0) {
      const result = await participants.updateMany(
        {
          _id: { $in: clearable.map((row) => row._id) },
          // Re-asserted at write time so a score that arrived between the read and the write
          // survives. The whole purpose of the script is that a real result is never lost.
          score: 0,
        },
        { $unset: { score: "" } },
      );
      cleared = result.modifiedCount;
      totalCleared += cleared;
    }

    report.push({
      contestId: contestId.toString(),
      name: String(contest.name ?? "(unnamed)"),
      status: String(contest.status ?? "unknown"),
      clearable: clearable.length,
      mislabelled: mislabelled.length,
      cleared,
    });
  }

  return { contests: report, totalClearable, totalCleared };
}
