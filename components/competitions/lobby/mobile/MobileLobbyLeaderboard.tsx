"use client";

import { useState } from "react";
import { Ban, ChevronRight, Trophy } from "lucide-react";
import { NeonAvatar, NeonRankBadge } from "@/components/neon/LeaderboardRow";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { GameMasterBadge } from "@/components/gamemaster/GameMasterBadge";
import ProfileCard from "@/components/profile/ProfileCard";
import {
  isLeaderboardEntryDisqualified,
  leaderboardDisqualificationReason,
} from "@/components/trading/leaderboard-qualification";
import { MobileChip, MobileLobbyCard } from "./MobileLobbyCard";

/**
 * Compact stacked standings (mobile fix guide, point 7).
 *
 * Replaces the desktop table, which is 760px wide and was the main reason the phone page
 * looked cut off. Each player is one row card: rank, avatar, name and badges, score. The
 * same ranking, tie, prize-position and disqualification facts as the desktop board; the
 * disqualification rule is the shared helper, so the two screens cannot disagree.
 *
 * Trading rows carry no profile picture, so the avatar is the name's initials rather than
 * an invented image.
 */

const PREVIEW_ROWS = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Entry = any;

function rowTint({
  rank,
  isPrize,
  isCurrentUser,
  isDisqualified,
}: {
  rank: number;
  isPrize: boolean;
  isCurrentUser: boolean;
  isDisqualified: boolean;
}): string {
  if (isDisqualified) return "border-rose-500/30 bg-rose-500/[0.05] opacity-75";
  if (isPrize && rank === 1) return "border-amber-400/35 bg-amber-500/[0.08]";
  if (isPrize && rank === 2) return "border-slate-300/30 bg-slate-300/[0.06]";
  if (isPrize && rank === 3) return "border-orange-400/30 bg-orange-500/[0.06]";
  if (isPrize) return "border-amber-400/20 bg-amber-500/[0.04]";
  if (isCurrentUser) return "border-sky-400/40 bg-sky-500/[0.08]";
  return "border-white/[0.06] bg-white/[0.02]";
}

export function MobileLobbyLeaderboard({
  leaderboard,
  userParticipantId,
  prizeDistribution,
  minimumTrades,
  competitionStatus,
  playersLabel = "traders",
}: {
  leaderboard: Entry[];
  userParticipantId?: string;
  prizeDistribution?: { rank: number; percentage: number }[];
  minimumTrades: number;
  competitionStatus: string;
  playersLabel?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const rows = showAll ? leaderboard : leaderboard.slice(0, PREVIEW_ROWS);
  const canExpand = leaderboard.length > PREVIEW_ROWS;
  const qualification = { competitionStatus, minimumTrades };
  const prizeFor = (rank: number) =>
    (prizeDistribution ?? []).find((p) => p.rank === rank)?.percentage ?? 0;

  return (
    <MobileLobbyCard
      id="competition-leaderboard-mobile"
      iconSrc={NEON_ICON("trophy-blue")}
      title="Leaderboard"
      action={
        <MobileChip>
          {leaderboard.length} {playersLabel}
        </MobileChip>
      }
    >
      {leaderboard.length === 0 ? (
        <div className="py-8 text-center">
          <Trophy className="mx-auto mb-2 h-10 w-10 text-gray-600" aria-hidden />
          <p className="text-sm text-gray-400">
            No traders yet - be the first on the board!
          </p>
        </div>
      ) : (
        <ol className="flex min-w-0 flex-col gap-2">
          {rows.map((entry: Entry, index: number) => {
            const rank = entry.currentRank || index + 1;
            const isCurrentUser = entry._id === userParticipantId;
            const prize = prizeFor(rank);
            const isDisqualified = isLeaderboardEntryDisqualified(entry, qualification);
            const reason = isDisqualified
              ? leaderboardDisqualificationReason(entry, qualification)
              : "";
            const isTied = !!entry.isTied && !isDisqualified;
            const tiedCount = (entry.tiedWith?.length ?? 0) + 1;

            return (
              <li key={entry._id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelected(entry)}
                  className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left ${rowTint({
                    rank,
                    isPrize: prize > 0,
                    isCurrentUser,
                    isDisqualified,
                  })}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {isDisqualified ? (
                      <Ban className="h-5 w-5 text-red-500" aria-label="Disqualified" />
                    ) : (
                      <NeonRankBadge rank={rank} size="sm" />
                    )}
                  </span>
                  <NeonAvatar name={entry.username ?? "?"} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-1">
                      <span
                        className={`min-w-0 truncate text-[14px] font-bold ${
                          isDisqualified
                            ? "text-red-400/80 line-through"
                            : isCurrentUser
                              ? "text-sky-200"
                              : "text-white"
                        }`}
                      >
                        {entry.username}
                      </span>
                      <GameMasterBadge userId={entry.userId} compact />
                      {isCurrentUser ? (
                        <span className="rounded border border-sky-400/40 bg-sky-500/15 px-1 text-[10px] font-semibold text-sky-300">
                          You
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-gray-400">
                      {isDisqualified
                        ? `Disqualified - ${reason}`
                        : isTied
                          ? `#${entry.currentRank} (${tiedCount} equal)`
                          : prize > 0
                            ? `Prize position - ${prize}% of pool`
                            : entry.userTitle || `${entry.totalTrades ?? 0} trades`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block text-[14px] font-bold tabular-nums ${
                        isDisqualified ? "text-gray-500 line-through" : "text-white"
                      }`}
                    >
                      {Number(entry.currentCapital ?? 0).toLocaleString()}
                    </span>
                    <span className="block text-[10px] text-gray-500">pts</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {canExpand ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] text-[13px] font-semibold text-cyan-200"
        >
          {showAll ? "Show top 5" : `View all ${leaderboard.length} ${playersLabel}`}
        </button>
      ) : null}

      {selected ? (
        <ProfileCard
          show
          userId={selected._id}
          username={selected.username}
          stats={{
            rank: selected.currentRank,
            winRate:
              selected.totalTrades > 0
                ? (selected.winningTrades / selected.totalTrades) * 100
                : 0,
            totalTrades: selected.totalTrades,
            totalPnl: selected.pnl,
            userTitle: selected.userTitle,
            userTitleIcon: selected.userTitleIcon,
            userTitleColor: selected.userTitleColor,
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </MobileLobbyCard>
  );
}
