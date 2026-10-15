"use client";

import Image from "next/image";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { LobbyLiveYourScoreValue } from "@/components/games/LobbyLiveParts";
import { useArenaLive } from "@/components/games/arena/ArenaLiveStandings";

/**
 * The player's own contest figures for the game arena lobby (right column / mobile):
 * round time, attempts, score and rank.
 *
 * Prize pool, entry fee and players moved to `GameLobbySummary` under the hero on
 * 15 Oct 2026 (owner: "the prize pool etc must be like trading lobby"), so the same
 * figure is never drawn twice on one screen. Values stay on the live standings poll.
 */

function StatTile({
  iconSrc,
  label,
  value,
  accent = "cyan",
}: {
  iconSrc: string;
  label: string;
  value: React.ReactNode;
  accent?: "cyan" | "gold" | "violet" | "emerald";
}) {
  const glow =
    accent === "gold"
      ? "border-amber-400/55 shadow-[0_0_22px_-4px_rgba(251,191,36,0.45),inset_0_0_14px_rgba(251,191,36,0.10)]"
      : accent === "violet"
        ? "border-violet-400/55 shadow-[0_0_22px_-4px_rgba(167,139,250,0.45),inset_0_0_14px_rgba(167,139,250,0.10)]"
        : accent === "emerald"
          ? "border-emerald-400/55 shadow-[0_0_22px_-4px_rgba(52,211,153,0.45),inset_0_0_14px_rgba(52,211,153,0.10)]"
          : "border-cyan-400/55 shadow-[0_0_22px_-4px_rgba(34,211,238,0.45),inset_0_0_14px_rgba(34,211,238,0.10)]";

  return (
    <div
      className={`flex min-h-[92px] flex-col justify-between rounded-xl border bg-gradient-to-b from-[#0A1630]/95 to-[#060B18]/95 p-3 ${glow}`}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <Image
            src={iconSrc}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]"
          />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
      </div>
      <p className="mt-2 text-lg font-bold leading-none text-white sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function LobbyLiveRankValue({ initialRank }: { initialRank?: number }) {
  const { yourRank } = useArenaLive();
  const rank = typeof yourRank === "number" ? yourRank : initialRank;
  if (typeof rank !== "number" || rank < 1) return <>—</>;
  return <>{`#${rank}`}</>;
}

export function LobbyContestStatsGrid({
  roundTimeLabel,
  attemptsLabel,
  initialScore,
  initialRank,
  showScore,
  scoringNote,
}: {
  roundTimeLabel: string;
  /** "2 of 3" once seated; the policy in words ("One attempt") before. Absent hides nothing - shows a dash. */
  attemptsLabel?: string;
  initialScore?: number;
  initialRank?: number;
  showScore: boolean;
  scoringNote?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile
          iconSrc={COMPETITION_ICON.clock}
          label="Round time"
          value={roundTimeLabel}
        />
        <StatTile
          iconSrc={COMPETITION_ICON.bolt}
          label="Attempts"
          accent="violet"
          value={attemptsLabel ?? "—"}
        />
        <StatTile
          iconSrc={COMPETITION_ICON.gamepad}
          label="Your score"
          accent="emerald"
          value={
            showScore ? (
              <LobbyLiveYourScoreValue initialScore={initialScore} />
            ) : (
              "—"
            )
          }
        />
        <StatTile
          iconSrc={COMPETITION_ICON.trophyGold}
          label="Rank"
          accent="gold"
          value={
            showScore ? (
              <LobbyLiveRankValue initialRank={initialRank} />
            ) : (
              "—"
            )
          }
        />
      </div>
      {scoringNote ? (
        <p className="text-center text-[11px] font-medium text-gray-400">
          {scoringNote}
        </p>
      ) : null}
    </div>
  );
}
