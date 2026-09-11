import { Gamepad2 } from "lucide-react";
import {
  NeonAvatar,
  NeonPlayerName,
  NeonRankBadge,
  neonRowClasses,
} from "@/components/neon/LeaderboardRow";
import { NEON_DIVIDE, NEON_TABLE_HEAD } from "@/components/neon/tokens";
import { GameIcon } from "@/components/ui/GameIcon";
import { GAME_ICONS, type GameIconName } from "@/lib/constants/game-icons";
import {
  describeRoundActivity,
  formatRoundClock,
  roundActivityToneClass,
  type RoundActivitySummary,
} from "@/lib/utils/round-activity";

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
 *
 * ----------------------------------------------------------------------------------------
 * IT SHOWS EACH PLAYER'S PROGRESS SINCE 11 SEPTEMBER 2026, on the owner's reference.
 *
 * It used to show a rank, a name and one number, and the header of this file argued that was
 * all a provider reports. That was WRONG, and the correction is worth leaving visible: a
 * provider reports one number it is RANKED on, and separately a free-form `scoreBreakdown`
 * that `01` section 3.2 declares display-only. `game_round` has stored it since X3. Nobody had
 * read it onto a board, so a player watching a contest could see that somebody was ahead and
 * nothing about what either of them had done.
 *
 * THE PROGRESS GOES ON A SECOND LINE UNDER THE NAME, and the sentence that used to be here was
 * wrong about why. It read: "NOT A FOURTH COLUMN. The reference draws SCORE and TIME side by
 * side, which works at its width; this board also renders in the arena's 300px standings rail,
 * where a fourth column is what turned player names into 'M...'." The fourth column was not what
 * squeezed the names - the rail was, and the row's own furniture was. The reference's TIME column
 * exists here now, and the names fit, because the rail was measured against the reference rather
 * than argued about and the plates, avatars and padding all shrank. The correction is left
 * visible because the reasoning was plausible and cost a second rejection.
 *
 * The breakdown still belongs on the second line rather than in columns of its own, for a
 * different reason: a game declares however many metrics it likes, in its own order, so there is
 * no fixed number of columns to draw.
 *
 * AND THE METRIC IS NOT CHOSEN HERE. `describeRoundActivity` hands over the game's entries in
 * the order the game declared them - see its header for why picking one by name would make the
 * "no additional coding" claim false for the next title.
 * ----------------------------------------------------------------------------------------
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
  /**
   * What each player has been doing, keyed by user id, from `contest-activity.service.ts`.
   *
   * OPTIONAL, AND AN ABSENT MAP RENDERS NO SECOND LINE AT ALL - not "Not played yet" for
   * everybody. A caller that has not read the activity is saying "I do not know", and a board
   * that answers "nobody has played" on its behalf is stating something false about every row.
   * A player present in the map with no rounds is a different fact and does read as not played.
   */
  activity?: Record<string, RoundActivitySummary>;
}

export default function ProviderLeaderboard({
  rows,
  currentUserId,
  scoreLabel = "Score",
  activity,
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

  /*
    NO MINIMUM WIDTH AND NO SIDEWAYS SCROLL. This board is rendered in two places whose widths
    are nothing like each other - the lobby's main column, and the arena's standings rail - and
    it used to force `min-w-[320px]` inside a horizontal scroller. In the rail that produced
    exactly what a scrollbar always produces on a leaderboard: the score column pushed out of
    sight, so the one number the board exists to show was the one thing a player could not see
    without dragging.

    It compresses instead. The rank marker, the score and the clock are fixed, the name column
    takes what is left and truncates, and the row never wraps - a wrapping row is what turned
    the rail into a stack of three-line entries with the avatar on its own line.

    THE ROW IS A TABLE ROW, NOT A CARD, and that was the owner's complaint about this board.
    Each entry used to be a padded, bordered, rounded tile with a gap beneath it, so twenty
    players filled a screen and a half and every one of them was mostly empty space and border.
    The reference draws them flush and close: one hairline between rows, a tint only on the
    podium and on your own row, and the vertical rhythm tight enough that the shape of the
    contest is visible without scrolling.
  */
  return (
    <div>
      <div
        className={`grid grid-cols-[1.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 px-2 pb-1.5 ${NEON_TABLE_HEAD}`}
      >
        <div>#</div>
        <div className="min-w-0">Player</div>
        <div className="w-14 text-right">{scoreLabel}</div>
        <div className="w-12 text-right">Time</div>
      </div>

      <div className={NEON_DIVIDE}>
        {rows.map((row) => {
          const isYou = row.userId === currentUserId;
          /*
            `undefined` when the caller passed no map at all, so the row renders exactly as it
            did before this feature - see the `activity` prop. When the map IS present, an
            absent entry is a real answer: this player holds a seat and has not played.
          */
          const entry = activity ? activity[row.userId] : undefined;
          const phrase = activity ? describeRoundActivity(entry) : undefined;
          const clock = formatRoundClock(entry?.durationMs);

          return (
            <div
              key={row.userId}
              className={`grid grid-cols-[1.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 px-2 py-2 ${neonRowClasses(
                { rank: row.currentRank, isCurrentUser: isYou, variant: "flush" },
              )}`}
            >
              {/*
                The rank is rendered from the value the server computed, never from this row's
                index in the array. Ranking is decided once by `calculateRankings`, which knows
                whether the game scores upward or downward, so a board numbering its own rows
                would quietly disagree with the payout for every lower-is-better game.
              */}
              <NeonRankBadge rank={row.currentRank} size="sm" />

              <div className="flex min-w-0 flex-nowrap items-center gap-2">
                <NeonAvatar name={row.username || "Anonymous"} size="sm" />

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {/*
                      `userTitleIcon` is TWO different things depending on the level, which is
                      why rendering it raw was wrong rather than merely plain. Most levels store
                      an artwork KEY - level 2 is literally `"guideBook"` - and a few store an
                      emoji. Printed as text, a player's rank badge read "guideBook" beside
                      their name.

                      The resolution rule is not invented here: `LeaderboardContent.tsx` has
                      always done exactly this, so the provider board was the copy that never
                      learned it. `Object.hasOwn` rather than `in`, because `in` walks the
                      prototype chain and would resolve a title of "toString" to a missing
                      artwork file.
                    */}
                    {row.userTitleIcon &&
                      (Object.hasOwn(GAME_ICONS, row.userTitleIcon) ? (
                        <GameIcon
                          name={row.userTitleIcon as GameIconName}
                          size={16}
                        />
                      ) : (
                        <span className="shrink-0">{row.userTitleIcon}</span>
                      ))}
                    <NeonPlayerName
                      name={row.username || "Anonymous"}
                      isCurrentUser={isYou}
                      isLeader={row.currentRank === 1}
                    />
                    {row.isTied && (
                      <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">
                        = #{row.currentRank}
                      </span>
                    )}
                  </div>

                  {phrase && (
                    <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-[11px] leading-tight">
                      <span
                        className={`shrink-0 ${roundActivityToneClass(phrase.tone)}`}
                      >
                        {phrase.headline}
                      </span>
                      {phrase.metrics.length > 0 && (
                        <span className="truncate text-gray-500">
                          {/*
                            Joined with a middot rather than rendered as separate chips: the
                            rail is narrow and a chip per metric wraps the row, which is the
                            one thing this grid is built not to do.
                          */}
                          {phrase.metrics
                            .map((metric) => `${metric.label} ${metric.value}`)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/*
                `undefined` and `null` render a dash, never a zero. A player who has not
                finished a round has no score, and rendering that as 0 puts them level with
                someone who genuinely scored nothing. The two are different facts, and this is
                the read-side form of the `score ?? 0` that made every provider participant
                tie in R37.
              */}
              <div className="w-14 self-center text-right tabular-nums">
                {row.score === undefined || row.score === null ? (
                  <span className="text-sm text-gray-600">-</span>
                ) : (
                  <span
                    className={`text-sm font-bold ${
                      row.currentRank <= 3 ? "text-amber-300" : "text-gray-100"
                    }`}
                  >
                    {row.score.toLocaleString()}
                  </span>
                )}
              </div>

              {/*
                THE CLOCK IS NOT A SECOND SCORE, and it is quieter than the score deliberately.
                Under a multi-attempt policy the score is combined across attempts while this
                is the clock of the one attempt the line beneath the name describes, which the
                line's own "attempt 2" wording makes visible. Drawn at the same weight as the
                score, the two would read as one pair of figures about one run.

                A dash for an unknown clock, never `0:00` - see `formatRoundClock`.
              */}
              <div className="w-12 self-center text-right text-xs tabular-nums text-gray-400">
                {clock ?? <span className="text-gray-600">-</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
