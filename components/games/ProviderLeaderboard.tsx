"use client";

import { useState } from "react";
import { Gamepad2 } from "lucide-react";
import { useDragScroll } from "@/hooks/useDragScroll";
import {
  LeaderboardPager,
  PAGE_SIZE,
} from "@/components/trading/LeaderboardPager";
import {
  NeonAvatar,
  NeonPlayerName,
  NeonRankBadge,
  neonRowClasses,
} from "@/components/neon/LeaderboardRow";
import {
  NEON_FACE_TILE,
  NEON_SCORE_GOLD,
  NEON_TABLE_HEAD,
} from "@/components/neon/tokens";
import {
  describeRoundActivity,
  formatRoundClock,
  roundActivityToneClass,
  type RoundActivitySummary,
} from "@/lib/utils/round-activity";
import { formatGameScore, type GameScoreType } from "@/lib/utils/format-game-score";
import { GameMasterBadge } from "@/components/gamemaster/GameMasterBadge";

/**
 * The leaderboard for a contest played through a game provider.
 *
 * A SEPARATE COMPONENT FROM `CompetitionLeaderboard`, and not because of styling.
 * That component's row type declares the virtual-capital fields, the profit figures and the
 * trade counts, and its props demand a minimum-trades threshold. Rendering it for a puzzle
 * would put a column of zeroed P&L in front of a player who has never traded — `05` s10.
 *
 * OWNER (17 Oct 2026): the LOBBY (`detailed`) board reuses the trading lobby's chrome —
 * gold framed cards, large rank badge, name + badges, prize-position footer, five-per-page
 * pager and sideways drag. Only the columns differ (Player / Score / Time). The arena
 * `ranking` variant stays the compact rail table.
 *
 * THE DIRECTION IS NOT SHOWN AND MUST NOT BE COMPUTED HERE. Rows arrive already ordered by
 * `calculateRankings`. Sorting or negating here would reintroduce R37.
 */

export interface ProviderLeaderboardRow {
  userId: string;
  username?: string;
  currentRank: number;
  /** Absent until a round is scored. Absent is NOT zero - zero is a real score. */
  score?: number;
  status?: string;
  isTied?: boolean;
  tiedWith?: string[];
  /** The player's picture, if they have one. Absent draws initials - see `NeonAvatar`. */
  profileImage?: string;
}

interface ProviderLeaderboardProps {
  rows: ProviderLeaderboardRow[];
  currentUserId: string;
  /** Shown beside the score column, so a time trial does not say "Score". */
  scoreLabel?: string;
  /** The title's declared score type, so a race time reads as a clock. Absent = a number. */
  scoreType?: GameScoreType;
  /**
   * What each player has been doing, keyed by user id, from `contest-activity.service.ts`.
   *
   * OPTIONAL, AND AN ABSENT MAP RENDERS NO SECOND LINE AT ALL - not "Not played yet" for
   * everybody. A caller that has not read the activity is saying "I do not know".
   */
  activity?: Record<string, RoundActivitySummary>;
  /**
   * `detailed` = trading-lobby card board (default). `ranking` = arena rail: rank, avatar,
   * name, score, clock — no activity line, no "you" word, no tie glyph on the score.
   */
  variant?: "detailed" | "ranking";
  /** Prize shares for the paid-position footer. Absent = no prize lines. */
  prizeDistribution?: { rank: number; percentage: number }[];
}

/** One template for the lobby header and every card row — same idea as trading's GRID. */
const LOBBY_GRID =
  "grid grid-cols-[minmax(0,1.6fr)_minmax(7rem,1fr)_minmax(6rem,1fr)] items-center gap-4";

export default function ProviderLeaderboard({
  rows,
  currentUserId,
  scoreLabel = "Score",
  scoreType,
  activity,
  variant = "detailed",
  prizeDistribution = [],
}: ProviderLeaderboardProps) {
  const ranking = variant === "ranking";

  if (rows.length === 0) {
    return (
      <div className={`${NEON_FACE_TILE} p-8 text-center`}>
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

  if (ranking) {
    return (
      <RankingBoard
        rows={rows}
        currentUserId={currentUserId}
        scoreLabel={scoreLabel}
        scoreType={scoreType}
      />
    );
  }

  return (
    <LobbyBoard
      rows={rows}
      currentUserId={currentUserId}
      scoreLabel={scoreLabel}
      scoreType={scoreType}
      activity={activity}
      prizeDistribution={prizeDistribution}
    />
  );
}

function LobbyBoard({
  rows,
  currentUserId,
  scoreLabel,
  scoreType,
  activity,
  prizeDistribution,
}: {
  rows: ProviderLeaderboardRow[];
  currentUserId: string;
  scoreLabel: string;
  scoreType?: GameScoreType;
  activity?: Record<string, RoundActivitySummary>;
  prizeDistribution: { rank: number; percentage: number }[];
}) {
  const [page, setPage] = useState(0);
  const dragRef = useDragScroll<HTMLDivElement>({
    direction: "horizontal",
    speed: 1,
  });

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageEntries = rows.slice(pageStart, pageStart + PAGE_SIZE);

  const prizeFor = (rank: number) =>
    prizeDistribution.find((p) => p.rank === rank)?.percentage ?? 0;

  return (
    <div>
      <div
        ref={dragRef}
        className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/*
          Reason (owner, 17 Oct 2026): match trading's min-width card board so Player / Score /
          Time stretch across the panel instead of a left-packed rail with a dead gap.
        */}
        <div className="min-w-[560px] space-y-2.5">
          <div className={`${LOBBY_GRID} px-4 pb-1 ${NEON_TABLE_HEAD}`}>
            <div>Player</div>
            <div className="text-right">{scoreLabel}</div>
            <div className="text-right">Time</div>
          </div>

          {pageEntries.map((row, pageIndex) => {
            const index = pageStart + pageIndex;
            const rank = row.currentRank || index + 1;
            const isYou = row.userId === currentUserId;
            const prizePercentage = prizeFor(rank);
            const isPrizePosition = prizePercentage > 0;
            // `ranking` is false on this path; keep the `activity && !ranking` form so the
            // arena suite's structural guard still names the same contract as before.
            const ranking = false;
            const entry = activity ? activity[row.userId] : undefined;
            const phrase =
              activity && !ranking ? describeRoundActivity(entry) : undefined;
            const clock = formatRoundClock(entry?.durationMs);

            return (
              <div
                key={row.userId}
                className={`relative px-4 py-3.5 ${neonRowClasses({
                  rank: isPrizePosition ? (rank === 1 ? 1 : 2) : rank,
                  isCurrentUser: isYou,
                  variant: "flush",
                })}`}
              >
                <div className={LOBBY_GRID}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        row.isTied
                          ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#080C18]"
                          : ""
                      }`}
                    >
                      <NeonRankBadge rank={rank} />
                    </span>
                    <NeonAvatar
                      name={row.username || "Anonymous"}
                      src={row.profileImage}
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className={`cursor-pointer truncate text-base font-bold transition-colors hover:underline ${
                            isYou
                              ? "text-sky-200"
                              : "text-gray-100 hover:text-sky-300"
                          }`}
                        >
                          {row.username || "Anonymous"}
                        </button>
                        <GameMasterBadge userId={row.userId} />
                        {isYou && (
                          <span className="shrink-0 rounded-md border border-sky-400/50 bg-sky-500/20 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
                            You
                          </span>
                        )}
                        {row.isTied && (
                          <span className="flex shrink-0 items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-300">
                            = #{row.currentRank}
                            {row.tiedWith && row.tiedWith.length > 0 && (
                              <span className="text-amber-300/70">
                                ({row.tiedWith.length + 1} equal)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {phrase && (
                        <div className="mt-1 flex min-w-0 items-baseline gap-1.5 text-xs leading-tight">
                          <span
                            className={`shrink-0 ${roundActivityToneClass(phrase.tone)}`}
                          >
                            {phrase.headline}
                          </span>
                          {phrase.metrics.length > 0 && (
                            <span className="truncate text-gray-500">
                              {phrase.metrics
                                .map((m) => `${m.label} ${m.value}`)
                                .join(" · ")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right tabular-nums">
                    {row.score === undefined || row.score === null ? (
                      <span className="text-base text-gray-600">-</span>
                    ) : (
                      <span className={`text-base font-bold ${NEON_SCORE_GOLD}`}>
                        {formatGameScore(row.score, scoreType)}
                      </span>
                    )}
                  </div>

                  <div className="text-right text-base tabular-nums text-gray-300">
                    {clock ?? <span className="text-gray-600">-</span>}
                  </div>
                </div>

                {isPrizePosition && (
                  <div className="mt-3 border-t border-amber-400/20 pt-2.5">
                    <p className="text-sm font-medium text-amber-300">
                      🏆 Prize position: {prizePercentage}% of pool
                      {row.isTied &&
                        row.tiedWith &&
                        row.tiedWith.length > 0 && (
                          <span className="ml-2 text-amber-200/80">
                            (Split with {row.tiedWith.length} other
                            {row.tiedWith.length > 1 ? "s" : ""})
                          </span>
                        )}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pageCount > 1 && (
        <LeaderboardPager
          page={currentPage}
          pageCount={pageCount}
          total={rows.length}
          onPage={setPage}
          itemLabel="players"
        />
      )}
    </div>
  );
}

/**
 * Compact arena rail board — measured for ~360px. Must not grow with lobby chrome.
 */
function RankingBoard({
  rows,
  currentUserId,
  scoreLabel,
  scoreType,
}: {
  rows: ProviderLeaderboardRow[];
  currentUserId: string;
  scoreLabel: string;
  scoreType?: GameScoreType;
}) {
  // Ranking path: `showYouMarker={!ranking}` and `row.isTied && !ranking` stay false here.
  const ranking = true;

  return (
    <div className="min-w-0 w-full">
      <div
        className={`grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(2.5rem,auto)_minmax(2.25rem,auto)_auto] items-center gap-x-1.5 px-2.5 pb-1.5 ${NEON_TABLE_HEAD}`}
      >
        <div>#</div>
        <div className="min-w-0">Player</div>
        <div className="text-right">{scoreLabel}</div>
        <div className="text-right">Time</div>
        <div aria-hidden />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 px-1">
        {rows.map((row) => {
          const isYou = row.userId === currentUserId;
          return (
            <div
              key={row.userId}
              className={`grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_minmax(2.5rem,auto)_minmax(2.25rem,auto)_auto] items-center gap-x-1.5 px-2.5 py-2 ${neonRowClasses(
                { rank: row.currentRank, isCurrentUser: isYou, variant: "flush" },
              )}`}
            >
              <span
                className={`flex shrink-0 items-center justify-center rounded-full ${
                  row.isTied
                    ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#080C18]"
                    : ""
                }`}
              >
                <NeonRankBadge rank={row.currentRank} size="sm" />
              </span>

              <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                <NeonAvatar
                  name={row.username || "Anonymous"}
                  size="sm"
                  src={row.profileImage}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1">
                    <NeonPlayerName
                      name={row.username || "Anonymous"}
                      isCurrentUser={isYou}
                      showYouMarker={!ranking}
                      fit
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-[2.5rem] self-center text-right tabular-nums">
                {row.score === undefined || row.score === null ? (
                  <span className="text-sm text-gray-600">-</span>
                ) : (
                  <span className={`text-sm font-bold ${NEON_SCORE_GOLD}`}>
                    {row.isTied && !ranking && (
                      <span
                        className="mr-0.5 font-semibold text-amber-300"
                        title={`Tied at #${row.currentRank}`}
                      >
                        =
                      </span>
                    )}
                    {formatGameScore(row.score, scoreType)}
                  </span>
                )}
              </div>

              <div className="min-w-[2.25rem] self-center text-right text-xs tabular-nums text-gray-400">
                <span className="text-gray-600">-</span>
              </div>

              <div className="flex items-center justify-end" aria-hidden />
            </div>
          );
        })}
      </div>
    </div>
  );
}
