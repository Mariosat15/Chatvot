"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Gamepad2 } from "lucide-react";
import { NeonAvatar, NeonRankBadge } from "@/components/neon/LeaderboardRow";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { GameMasterBadge } from "@/components/gamemaster/GameMasterBadge";
import { useArenaLive } from "@/components/games/arena/ArenaLiveStandings";
import {
  describeRoundActivity,
  formatRoundClock,
  roundActivityToneClass,
} from "@/lib/utils/round-activity";
import { formatGameScore } from "@/lib/utils/format-game-score";
import {
  MobileChip,
  MobileLobbyCard,
} from "@/components/competitions/lobby/mobile/MobileLobbyCard";

/**
 * The phone game lobby's leaderboard (owner, 15 Oct 2026: "big gap ... expand as users are
 * added, separate by pages of 5 ... some data are cut off").
 *
 * The desktop `ProviderLeaderboard` is a five-column grid measured against a 360px rail and
 * hosted in a `NeonPanel`; inside the phone tab it left a tall padded shell around a short
 * list and squeezed the name, activity line and score. This board is the trading phone
 * board's shape instead - one stacked card per player, on the same `MobileLobbyCard` - so
 * its height is exactly its rows.
 *
 * NOTHING IS TRUNCATED: the name and the activity line wrap; score and clock are fixed
 * figures stacked on the right and never shrink. Ranks, ties and order come from the server
 * (`calculateRankings`), never from the row index - see `ProviderLeaderboard`.
 *
 * Up to five players: one list, no pager. Above five: pages of five with Prev / Next.
 */
export const LEADERBOARD_PAGE_SIZE = 5;

export function MobileGameLobbyLeaderboard({
  title,
  scoreLabel,
  playersLabel,
}: {
  title: string;
  scoreLabel: string;
  playersLabel: string;
}) {
  const { rows, activity, currentUserId, scoreType } = useArenaLive();
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / LEADERBOARD_PAGE_SIZE));
  // Reason: the board polls; if players leave, the current page can fall past the end.
  const current = Math.min(page, pageCount - 1);
  const start = current * LEADERBOARD_PAGE_SIZE;
  const visible = rows.slice(start, start + LEADERBOARD_PAGE_SIZE);
  const myIndex = rows.findIndex((row) => row.userId === currentUserId);
  const myPage = myIndex >= 0 ? Math.floor(myIndex / LEADERBOARD_PAGE_SIZE) : -1;

  return (
    <MobileLobbyCard
      id="competition-leaderboard-mobile"
      iconSrc={NEON_ICON("trophy-blue")}
      title={title}
      action={
        <MobileChip>
          {rows.length} {playersLabel}
        </MobileChip>
      }
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center">
          <Gamepad2 className="mx-auto mb-2 h-8 w-8 text-gray-600" aria-hidden />
          <p className="text-sm text-gray-300">No one has played yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            Scores appear here as rounds are completed.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-1.5 flex items-center justify-between px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <span>Player</span>
            <span>
              {scoreLabel} · Time
            </span>
          </div>
          <ol className="flex min-w-0 flex-col gap-2">
            {visible.map((row) => {
              const isYou = row.userId === currentUserId;
              const entry = activity ? activity[row.userId] : undefined;
              const phrase = activity ? describeRoundActivity(entry) : undefined;
              const clock = formatRoundClock(entry?.durationMs);
              const name = row.username || "Anonymous";
              return (
                <li
                  key={row.userId}
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2.5 ${rowTint(row.currentRank, isYou)}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      row.isTied ? "ring-2 ring-amber-400" : ""
                    }`}
                  >
                    <NeonRankBadge rank={row.currentRank} size="sm" />
                  </span>
                  <NeonAvatar name={name} size="sm" src={row.profileImage} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <span
                        className={`min-w-0 break-words text-[14px] font-bold leading-tight ${
                          isYou ? "text-sky-200" : "text-white"
                        }`}
                      >
                        {name}
                      </span>
                      <GameMasterBadge userId={row.userId} compact />
                      {isYou ? (
                        <span className="rounded border border-sky-400/40 bg-sky-500/15 px-1 text-[10px] font-semibold text-sky-300">
                          You
                        </span>
                      ) : null}
                    </div>
                    {phrase ? (
                      <p className="mt-0.5 break-words text-[11px] leading-snug">
                        <span className={roundActivityToneClass(phrase.tone)}>
                          {phrase.headline}
                        </span>
                        {phrase.metrics.length > 0 ? (
                          <span className="text-gray-500">
                            {" · "}
                            {phrase.metrics
                              .map((metric) => `${metric.label} ${metric.value}`)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <span className="block whitespace-nowrap text-[14px] font-bold text-amber-300">
                      {row.isTied ? (
                        <span className="mr-0.5 text-amber-200" title={`Tied at #${row.currentRank}`}>
                          =
                        </span>
                      ) : null}
                      {formatGameScore(row.score, scoreType)}
                    </span>
                    <span className="block whitespace-nowrap text-[11px] text-gray-400">
                      {clock ?? "-"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {pageCount > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <PagerButton
                label="Previous"
                disabled={current === 0}
                onPress={() => setPage(current - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </PagerButton>
              <div className="flex min-w-0 flex-col items-center text-center">
                <span className="text-[12px] font-semibold text-gray-200">
                  {start + 1}–{start + visible.length} of {rows.length}
                </span>
                {myPage >= 0 && myPage !== current ? (
                  <button
                    type="button"
                    onClick={() => setPage(myPage)}
                    className="mt-0.5 text-[11px] font-semibold text-sky-300"
                  >
                    Go to my rank (#{rows.at(myIndex)?.currentRank})
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-500">
                    Page {current + 1} of {pageCount}
                  </span>
                )}
              </div>
              <PagerButton
                label="Next"
                disabled={current >= pageCount - 1}
                onPress={() => setPage(current + 1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </PagerButton>
            </div>
          ) : null}
        </>
      )}
    </MobileLobbyCard>
  );
}

function rowTint(rank: number, isYou: boolean): string {
  if (isYou) return "border-sky-400/40 bg-sky-500/[0.08]";
  if (rank === 1) return "border-amber-400/35 bg-amber-500/[0.08]";
  if (rank === 2) return "border-slate-300/30 bg-slate-300/[0.06]";
  if (rank === 3) return "border-orange-400/30 bg-orange-500/[0.06]";
  return "border-white/[0.06] bg-white/[0.02]";
}

function PagerButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-3 text-[12px] font-semibold ${
        disabled
          ? "border-white/[0.05] text-gray-600 opacity-50"
          : "border-cyan-300/30 bg-cyan-500/10 text-cyan-200"
      }`}
    >
      {children}
    </button>
  );
}
