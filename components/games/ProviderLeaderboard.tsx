import { Gamepad2 } from "lucide-react";
import {
  NeonAvatar,
  NeonPlayerName,
  NeonRankBadge,
  neonRowClasses,
} from "@/components/neon/LeaderboardRow";
import { NEON_TABLE_HEAD } from "@/components/neon/tokens";

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
 * THE ROW PIECES COME FROM `components/neon/LeaderboardRow`, WHICH THE TRADING BOARD ALSO USES:
 * the same rank medal, the same initials chip, the same "you" highlight, the same uppercase
 * column headings. Only the columns differ, which is the whole point - two boards that look
 * like one product and report different things, rather than one board reporting a number it
 * does not have.
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
      <div className="rounded-xl border border-[#161E36] bg-[#080C18]/60 p-8 text-center">
        <Gamepad2 className="mx-auto mb-3 h-8 w-8 text-gray-600" />
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
    <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <div className="min-w-[320px]">
        <div
          className={`grid grid-cols-[auto_1fr_auto] gap-3 px-3 pb-2 md:px-4 ${NEON_TABLE_HEAD}`}
        >
          <div className="w-8 shrink-0">#</div>
          <div className="min-w-0">Player</div>
          <div className="min-w-[80px] shrink-0 text-right">{scoreLabel}</div>
        </div>

        <div className="space-y-2 pt-2">
          {rows.map((row) => {
            const isYou = row.userId === currentUserId;

            return (
              <div
                key={row.userId}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 md:px-4 ${neonRowClasses(
                  { rank: row.currentRank, isCurrentUser: isYou },
                )}`}
              >
                {/*
                  The rank is rendered from the value the server computed, never from this row's
                  index in the array. Ranking is decided once by `calculateRankings`, which knows
                  whether the game scores upward or downward, so a board numbering its own rows
                  would quietly disagree with the payout for every lower-is-better game.
                */}
                <NeonRankBadge rank={row.currentRank} />

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <NeonAvatar name={row.username || "Anonymous"} />
                  {row.userTitleIcon && (
                    <span className="shrink-0">{row.userTitleIcon}</span>
                  )}
                  <NeonPlayerName
                    name={row.username || "Anonymous"}
                    isCurrentUser={isYou}
                  />
                  {row.isTied && (
                    <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-300">
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
                <div className="min-w-[80px] shrink-0 self-center text-right">
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
