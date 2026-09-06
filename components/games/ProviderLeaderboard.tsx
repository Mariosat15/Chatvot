import { Medal } from "lucide-react";

/**
 * The leaderboard for a contest played through a game provider.
 *
 * A SEPARATE COMPONENT FROM `CompetitionLeaderboard`, and not because of styling.
 * That component's row type declares `currentCapital`, `startingCapital`, `pnl`,
 * `pnlPercentage`, `totalTrades`, `winningTrades` and `losingTrades`, and its props demand a
 * `prizeDistribution` and a `minimumTrades`. Rendering it for a puzzle contest would put a
 * column of zeroed profit and loss in front of a player who has never traded, and a "minimum
 * trades" qualification note on a contest with no trades - which is `05` section 10's binding
 * rule broken in the most visible place available: **no platform-wide figure may silently mean
 * "trading only".**
 *
 * IT DELIBERATELY SHOWS THE RANK AND THE SCORE AND NOTHING ELSE. There is exactly one number a
 * provider reports, and inventing derived columns from it would be the same mistake as offering
 * six `rankingMethod` options to a game that honours none of them - controls and figures that
 * look like information and are not.
 *
 * THE DIRECTION IS NOT SHOWN AND MUST NOT BE COMPUTED HERE. Rows arrive already ordered by
 * `calculateRankings`, which resolves the contest's `scoreDirection` once from the catalogue.
 * Sorting or negating here would be a second place for the direction to be decided - the exact
 * defect R37 closed, where the board and the payout disagreed because each worked it out
 * separately. The raw score is displayed as stored, because a persisted race time shown as a
 * negative number is unexplainable to a player.
 */

export interface ProviderLeaderboardRow {
  userId: string;
  username?: string;
  currentRank: number;
  /** Absent until a round is scored. Absent is NOT zero - zero is a real score. */
  score?: number;
  status?: string;
  isTied?: boolean;
  userTitleIcon?: string;
}

interface ProviderLeaderboardProps {
  rows: ProviderLeaderboardRow[];
  currentUserId: string;
  /** Shown beside the score column, so a time trial does not say "Score". */
  scoreLabel?: string;
}

function rankTone(rank: number): string {
  if (rank === 1) return "text-amber-300";
  if (rank === 2) return "text-gray-300";
  if (rank === 3) return "text-orange-300";
  return "text-gray-500";
}

export default function ProviderLeaderboard({
  rows,
  currentUserId,
  scoreLabel = "Score",
}: ProviderLeaderboardProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 text-center">
        <p className="text-sm text-gray-400">No one has played yet.</p>
        <p className="mt-1 text-xs text-gray-500">
          Scores appear here as rounds are completed.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/40">
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <Medal className="h-4 w-4 text-amber-300" />
        <h2 className="text-sm font-medium text-gray-200">Leaderboard</h2>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-xs text-gray-500">
            <th className="px-4 py-2 text-left font-medium">#</th>
            <th className="px-4 py-2 text-left font-medium">Player</th>
            <th className="px-4 py-2 text-right font-medium">{scoreLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isYou = row.userId === currentUserId;
            return (
              <tr
                key={row.userId}
                className={`border-b border-gray-800/60 last:border-0 ${
                  isYou ? "bg-blue-500/10" : ""
                }`}
              >
                <td
                  className={`px-4 py-2.5 font-semibold ${rankTone(row.currentRank)}`}
                >
                  {row.currentRank}
                  {row.isTied && (
                    <span className="ml-1 text-[10px] font-normal text-gray-500">
                      tied
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-200">
                  {row.userTitleIcon && (
                    <span className="mr-1.5">{row.userTitleIcon}</span>
                  )}
                  {row.username || "Anonymous"}
                  {isYou && (
                    <span className="ml-2 text-[10px] text-blue-300">you</span>
                  )}
                </td>
                {/*
                  `?? undefined` rather than `?? 0`: a player who has not finished a round has no
                  score, and rendering that as a zero puts them level with someone who genuinely
                  scored nothing. The two are different facts, and this is the read-side form of
                  the `score ?? 0` that made every provider participant tie in R37.
                */}
                <td className="px-4 py-2.5 text-right font-medium text-gray-200">
                  {row.score === undefined || row.score === null ? (
                    <span className="text-gray-600">-</span>
                  ) : (
                    row.score.toLocaleString()
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
