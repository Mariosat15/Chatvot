"use client";

import Image from "next/image";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import {
  LobbyLivePlayersValue,
  LobbyLivePrizePoolValue,
  LobbyLiveYourScoreValue,
} from "@/components/games/LobbyLiveParts";
import { useArenaLive } from "@/components/games/arena/ArenaLiveStandings";
import { formatVolts } from "@/lib/utils/format-volts";

/**
 * Six contest statistic tiles for the game arena lobby (right column / mobile).
 *
 * Values stay on the live standings poll — never example data.
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
      ? "border-amber-400/40 shadow-[0_0_18px_rgba(251,191,36,0.12)]"
      : accent === "violet"
        ? "border-violet-400/35 shadow-[0_0_18px_rgba(167,139,250,0.12)]"
        : accent === "emerald"
          ? "border-emerald-400/35 shadow-[0_0_18px_rgba(52,211,153,0.12)]"
          : "border-cyan-400/35 shadow-[0_0_18px_rgba(34,211,238,0.12)]";

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
            className="h-7 w-7 object-contain"
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
  prizePool,
  entryFee,
  currentParticipants,
  maxParticipants,
  roundTimeLabel,
  creditSymbol,
  playersLabel,
  prizePoolLabel,
  entryFeeLabel,
  initialScore,
  initialRank,
  showScore,
  scoringNote,
}: {
  prizePool: number;
  entryFee: number;
  currentParticipants: number;
  maxParticipants: number;
  roundTimeLabel: string;
  creditSymbol?: string;
  playersLabel: string;
  prizePoolLabel: string;
  entryFeeLabel: string;
  initialScore?: number;
  initialRank?: number;
  showScore: boolean;
  scoringNote?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile
          iconSrc={COMPETITION_ICON.volts}
          label={prizePoolLabel}
          accent="gold"
          value={
            <LobbyLivePrizePoolValue
              initialPool={prizePool}
              creditSymbol={creditSymbol}
            />
          }
        />
        <StatTile
          iconSrc={COMPETITION_ICON.entryFee}
          label={entryFeeLabel}
          accent="violet"
          value={
            entryFee
              ? formatVolts(entryFee, { symbol: creditSymbol })
              : "Free"
          }
        />
        <StatTile
          iconSrc={COMPETITION_ICON.players}
          label={playersLabel}
          value={
            <LobbyLivePlayersValue
              initialCurrent={currentParticipants}
              initialMax={maxParticipants}
            />
          }
        />
        <StatTile
          iconSrc={COMPETITION_ICON.clock}
          label="Round time"
          value={roundTimeLabel}
        />
        <StatTile
          iconSrc={COMPETITION_ICON.gamepad}
          label="Your score"
          accent="cyan"
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
