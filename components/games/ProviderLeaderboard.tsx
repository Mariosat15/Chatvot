import { GameIcon, RankIcon } from "@/components/ui/GameIcon";

/**
 * The leaderboard for a contest played through a game provider.
 *
 * A SEPARATE COMPONENT FROM `CompetitionLeaderboard`, and not because of styling.
 * That component's row type declares the virtual-capital fields, the profit figures and the
 * trade counts, and its props demand a `prizeDistribution` and a minimum-trades threshold.
 * Rendering it for a puzzle contest would put a column of zeroed profit and loss in front of a
 * player who has never traded, and a trade-count qualification note on a contest with no
 * trades - which is `05` section 10's binding rule broken in the most visible place available:
 * **no platform-wide figure may silently mean "trading only".**
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
 *
 * THE ROW TREATMENT IS THE TRADING BOARD'S (owner requirement, 6 Sep 2026): the same 3D rank
 * medals, the same tinted row cards, the same blue highlight and "You" chip on the player's own
 * row, the same uppercase column headings. Only the columns differ, which is the whole point -
 * two boards that look like one product and report different things, rather than one board
 * reporting a number it does not have.
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

export default function ProviderLeaderboard({
  rows,
  currentUserId,
  scoreLabel = "Score",
}: ProviderLeaderboardProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-gray-900/50 border border-gray-700/50 p-8 text-center">
        <div className="flex justify-center mb-3 opacity-40">
          <GameIcon name="joystick1" size={40} />
        </div>
        <p className="text-sm font-medium text-gray-300">
          No one has played yet.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Scores appear here as rounds are completed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
      <div className="min-w-[320px]">
        <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 md:px-4 pb-2 border-b border-gray-700 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="flex-shrink-0">Rank</div>
          <div className="min-w-0">Player</div>
          <div className="text-right flex-shrink-0 min-w-[80px]">
            {scoreLabel}
          </div>
        </div>

        <div className="space-y-1 pt-2">
          {rows.map((row) => {
            const isYou = row.userId === currentUserId;

            return (
              <div
                key={row.userId}
                className={`grid grid-cols-[auto_1fr_auto] gap-3 p-3 md:p-4 rounded-lg transition-colors ${
                  isYou
                    ? "bg-blue-500/10 border border-blue-500/30"
                    : row.currentRank <= 3
                      ? "bg-yellow-500/5 border border-yellow-500/20 hover:bg-yellow-500/10"
                      : "bg-gray-800/30 border border-transparent hover:bg-gray-800/50"
                }`}
              >
                {/*
                  The 3D medals the trading board uses, rather than a bare number. `RankIcon`
                  covers the first seven places and falls back to a star badge, so a large field
                  does not need a special case here.
                */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <RankIcon rank={row.currentRank} size={22} />
                  <span className="text-sm font-semibold text-gray-400">
                    {row.currentRank}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  {row.userTitleIcon && (
                    <span className="flex-shrink-0">{row.userTitleIcon}</span>
                  )}
                  <span
                    className={`text-sm font-medium truncate ${
                      isYou ? "text-blue-400" : "text-gray-100"
                    }`}
                  >
                    {row.username || "Anonymous"}
                  </span>
                  {isYou && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 flex-shrink-0">
                      You
                    </span>
                  )}
                  {row.isTied && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 flex-shrink-0 font-semibold">
                      = #{row.currentRank}
                    </span>
                  )}
                </div>

                {/*
                  `undefined` and `null` render a dash, never a zero. A player who has not
                  finished a round has no score, and rendering that as 0 puts them level with
                  someone who genuinely scored nothing. The two are different facts, and this is
                  the read-side form of the `score ?? 0` that made every provider participant
                  tie in R37.
                */}
                <div className="text-right flex-shrink-0 min-w-[80px] self-center">
                  {row.score === undefined || row.score === null ? (
                    <span className="text-sm text-gray-600">-</span>
                  ) : (
                    <span className="text-sm font-bold text-gray-100">
                      {row.score.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
