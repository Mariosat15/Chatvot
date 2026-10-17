"use client";

import type { ReactNode } from "react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { LobbyLiveYourScoreValue } from "@/components/games/LobbyLiveParts";
import { useArenaLive } from "@/components/games/arena/ArenaLiveStandings";
import type { PlayState } from "@/components/games/play-state";
import { MobileLobbyCard } from "@/components/competitions/lobby/mobile/MobileLobbyCard";

/**
 * The ONE action card on the phone game lobby (owner, 15 Oct 2026: "too busy, no flow").
 *
 * Before joining it is "Your entry" - the shared entry control and nothing else, exactly as
 * the trading phone lobby. After joining it is "Your run": a short list of facts with the
 * value beside its label, one sentence saying what to do next, then the Play control. No
 * second grid of boxed stats - the tiles above already hold the contest facts.
 */

function runMessage({
  isCompleted,
  isUpcoming,
  isCancelled,
  state,
}: {
  isCompleted: boolean;
  isUpcoming: boolean;
  isCancelled: boolean;
  state: PlayState | null;
}): string | null {
  if (isCancelled) return "This competition was cancelled.";
  if (isCompleted) return "The competition has finished. Your result is final.";
  if (state?.liveRound?.isLive) return "You have a round in progress. Resume to continue.";
  if (isUpcoming) return "You're in. Play unlocks when the competition starts.";
  if (state && state.attemptsRemaining <= 0) {
    return "All attempts used. Your best score stays on the leaderboard.";
  }
  if (state && state.attemptsUsed > 0) {
    return `${state.attemptsRemaining} attempt${state.attemptsRemaining === 1 ? "" : "s"} left. Play again to improve your score.`;
  }
  if (state) return "Start when you're ready. An attempt is used when the round opens.";
  return null;
}

export function MobileGameLobbyRunCard({
  isUserIn,
  isCompleted,
  isUpcoming,
  isCancelled,
  state,
  roundTimeLabel,
  scoringNote,
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
  scoringNote?: string | null;
  initialScore?: number;
  initialRank?: number;
  entryControl: ReactNode;
}) {
  if (!isUserIn) {
    // Reason: a finished contest offers no entry to a non-participant (trading does the same).
    if (isCompleted || isCancelled) return null;
    return (
      <MobileLobbyCard title="Your entry" iconSrc={COMPETITION_ICON.trophyGold}>
        <div className="min-w-0">{entryControl}</div>
        <GameFacts roundTimeLabel={roundTimeLabel} scoringNote={scoringNote} />
      </MobileLobbyCard>
    );
  }

  const message = runMessage({ isCompleted, isUpcoming, isCancelled, state });
  const round = roundTimeLabel?.trim();

  return (
    <MobileLobbyCard title="Your run" iconSrc={COMPETITION_ICON.trophyGold}>
      <dl className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/20">
        <FactRow label="Your score" value={<LobbyLiveYourScoreValue initialScore={initialScore} />} />
        <FactRow label="Your rank" value={<LiveRank initialRank={initialRank} />} />
        {state ? (
          <FactRow
            label="Attempts used"
            value={`${state.attemptsUsed} / ${state.attemptsPermitted}`}
          />
        ) : null}
        {round ? <FactRow label="Round time" value={round} /> : null}
      </dl>

      {message ? (
        <p className="mt-3 text-center text-[13px] leading-relaxed text-gray-300">{message}</p>
      ) : null}

      <div className="mt-3 min-w-0">{entryControl}</div>
    </MobileLobbyCard>
  );
}

/** Two facts a player needs before paying: how long a round is and how to win. */
function GameFacts({
  roundTimeLabel,
  scoringNote,
}: {
  roundTimeLabel?: string | null;
  scoringNote?: string | null;
}) {
  const round = roundTimeLabel?.trim();
  const win = scoringNote?.trim();
  if (!round && !win) return null;
  return (
    <dl className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/20">
      {win ? <FactRow label="How to win" value={win} /> : null}
      {round ? <FactRow label="Round time" value={round} /> : null}
    </dl>
  );
}

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5">
      <dt className="shrink-0 text-[12px] text-gray-400">{label}</dt>
      <dd className="min-w-0 text-right text-[14px] font-semibold text-white tabular-nums break-words">
        {value}
      </dd>
    </div>
  );
}

function LiveRank({ initialRank }: { initialRank?: number }) {
  const { yourRank } = useArenaLive();
  const rank = typeof yourRank === "number" ? yourRank : initialRank;
  if (typeof rank !== "number" || rank < 1) return <>-</>;
  return <>{`#${rank}`}</>;
}
