"use client";

import type { ReactNode } from "react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import {
  LobbyLiveYourScoreValue,
} from "@/components/games/LobbyLiveParts";
import { useArenaLive } from "@/components/games/arena/ArenaLiveStandings";
import type { PlayState } from "@/components/games/play-state";
import {
  MobileLobbyCard,
  MobileIcon,
} from "@/components/competitions/lobby/mobile/MobileLobbyCard";

/**
 * YOUR RUN — primary phone section (guide §6–§8). Score / rank / attempts /
 * round limit, one clear state message, then the shared entry/play control.
 */

function runMessage({
  isUserIn,
  isCompleted,
  isUpcoming,
  isCancelled,
  state,
}: {
  isUserIn: boolean;
  isCompleted: boolean;
  isUpcoming: boolean;
  isCancelled: boolean;
  state: PlayState | null;
}): string | null {
  if (isCancelled) return "This competition was cancelled.";
  if (isCompleted) return "The competition has finished. Check your results below.";
  if (!isUserIn) return "Join to claim a seat, then start your round when play opens.";
  if (state?.liveRound?.isLive) return "You have a round in progress — resume to continue.";
  if (isUpcoming) return "You're in. Get ready — play unlocks when the competition starts.";
  if (state && state.attemptsRemaining <= 0) {
    return "You've used all your attempts. Your best score stays on the leaderboard.";
  }
  if (state && state.attemptsUsed > 0 && state.attemptsRemaining > 0) {
    return `${state.attemptsRemaining} attempt${state.attemptsRemaining === 1 ? "" : "s"} left — play again to improve your score.`;
  }
  if (state && state.attemptsRemaining > 0) {
    return "Start a round when you're ready. An attempt is used when the round opens.";
  }
  return null;
}

export function MobileGameLobbyRunCard({
  isUserIn,
  isCompleted,
  isUpcoming,
  isCancelled,
  state,
  roundTimeLabel,
  initialScore,
  initialRank,
  entryControl,
}: {
  isUserIn: boolean;
  isCompleted: boolean;
  isUpcoming: boolean;
  isCancelled: boolean;
  state: PlayState | null;
  roundTimeLabel?: string | null;
  initialScore?: number;
  initialRank?: number;
  entryControl: ReactNode;
}) {
  const message = runMessage({
    isUserIn,
    isCompleted,
    isUpcoming,
    isCancelled,
    state,
  });
  const attemptsLabel = state
    ? `${state.attemptsUsed} / ${state.attemptsPermitted}`
    : "—";

  return (
    <MobileLobbyCard title="Your run" iconSrc={COMPETITION_ICON.trophyGold}>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat
          iconSrc={COMPETITION_ICON.bolt}
          label="Your score"
          value={
            isUserIn ? (
              <LobbyLiveYourScoreValue initialScore={initialScore} />
            ) : (
              "—"
            )
          }
        />
        <Stat
          iconSrc={COMPETITION_ICON.starbox}
          label="Your rank"
          value={<LiveRank initialRank={initialRank} show={isUserIn} />}
        />
        <Stat
          iconSrc={COMPETITION_ICON.gamepad}
          label="Attempts"
          value={attemptsLabel}
        />
        <Stat
          iconSrc={COMPETITION_ICON.clock}
          label="Round limit"
          value={roundTimeLabel?.trim() || "—"}
        />
      </div>

      {message ? (
        <p className="mt-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5 text-center text-[13px] leading-relaxed text-gray-300">
          {message}
        </p>
      ) : null}

      <div className="mt-3 min-w-0">{entryControl}</div>
    </MobileLobbyCard>
  );
}

function LiveRank({
  initialRank,
  show,
}: {
  initialRank?: number;
  show: boolean;
}) {
  const { yourRank } = useArenaLive();
  if (!show) return <>—</>;
  const rank = typeof yourRank === "number" ? yourRank : initialRank;
  if (typeof rank !== "number" || rank < 1) return <>—</>;
  return <>{`#${rank}`}</>;
}

function Stat({
  iconSrc,
  label,
  value,
}: {
  iconSrc: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-cyan-400/25 bg-[#071225]/90 p-3">
      <div className="flex items-center gap-1.5">
        <MobileIcon src={iconSrc} className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
      </div>
      <p className="mt-1.5 break-words text-[18px] font-bold leading-none text-white">
        {value}
      </p>
    </div>
  );
}
