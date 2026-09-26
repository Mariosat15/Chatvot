"use client";

import { Gift, Trophy } from "lucide-react";
import PrizeTable from "@/components/competitions/PrizeTable";
import ProviderLeaderboard from "@/components/games/ProviderLeaderboard";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import { NeonCountPill, NeonPanel } from "@/components/neon/Cards";
import { useArenaLive } from "@/components/games/arena/ArenaLiveStandings";
import { formatVolts } from "@/lib/utils/format-volts";
import type { ComponentProps } from "react";

/**
 * Live surfaces on the provider contest LOBBY — same standings poll as the arena.
 *
 * WHY THESE EXIST. `LiveContestRefresher` re-renders the whole page from
 * `getCompetitionLeaderboard`, which ranks on settled `participant.score` only. Mid-round
 * provisional ranks never move, joins wait up to 15s, and the prize table sits on frozen
 * server props. The arena already polls `GET /standings` with a contest snapshot and
 * `resolveLiveDisplayScores`; the lobby must consume that same answer so the two screens
 * cannot disagree after a join or a solved board.
 *
 * Declared as small client consumers rather than making the whole lobby a client component:
 * the lobby still does server reads (presentation, play state, terms) and only these tiles
 * need to re-render on each poll.
 */

/** `N / max` for the hero players tile. */
export function LobbyLivePlayersValue({
  initialCurrent,
  initialMax,
}: {
  initialCurrent: number;
  initialMax: number;
}) {
  const { contest } = useArenaLive();
  const current = contest.currentParticipants ?? initialCurrent;
  const max = contest.maxParticipants ?? initialMax;
  return <>{`${current} / ${max}`}</>;
}

/**
 * Hero prize-pool tile. Without this, seats and the prize panel move on join while the
 * headline pot stays frozen — one screen with two answers.
 */
export function LobbyLivePrizePoolValue({
  initialPool,
  creditSymbol,
}: {
  initialPool: number;
  creditSymbol?: string;
}) {
  const { contest } = useArenaLive();
  const pool = contest.prizePool ?? initialPool;
  return <>{formatVolts(pool ?? 0, { symbol: creditSymbol })}</>;
}

/** Minimum-players note under the hero tile — must move when someone joins before start. */
export function LobbyLivePlayersMinNote({
  minParticipants,
  playersLabel,
  initialCurrent,
}: {
  minParticipants: number;
  playersLabel: string;
  initialCurrent: number;
}) {
  const { contest } = useArenaLive();
  const current = contest.currentParticipants ?? initialCurrent;
  const short = current < minParticipants;
  return (
    <p
      className={`mt-2 text-xs ${short ? "text-orange-400" : "text-emerald-400"}`}
    >
      Minimum {minParticipants}
      {short
        ? ` - needs more ${playersLabel.toLowerCase()}`
        : " - reached"}
    </p>
  );
}

/** Caller's live display score (finished or provisional), never a coerced zero. */
export function LobbyLiveYourScoreValue({
  initialScore,
}: {
  initialScore?: number;
}) {
  const { rows, currentUserId } = useArenaLive();
  const mine = rows.find((row) => row.userId === currentUserId);
  const score =
    typeof mine?.score === "number"
      ? mine.score
      : typeof initialScore === "number"
        ? initialScore
        : undefined;
  return <>{typeof score === "number" ? score.toLocaleString() : "-"}</>;
}

export function LobbyLiveLeaderboard({
  scoreLabel,
  title,
}: {
  scoreLabel: string;
  title: string;
}) {
  const { rows, activity, currentUserId } = useArenaLive();
  return (
    <NeonPanel
      icon={Trophy}
      accent="prize"
      title={title}
      action={<NeonCountPill>{rows.length} players</NeonCountPill>}
      className="min-w-0"
    >
      <ProviderLeaderboard
        rows={rows}
        currentUserId={currentUserId}
        scoreLabel={scoreLabel}
        activity={activity}
      />
    </NeonPanel>
  );
}

export function LobbyLivePrizePanel({
   
  initialCompetition,
  creditSymbol,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialCompetition: any;
  creditSymbol?: string;
}) {
  const { contest } = useArenaLive();

  const competition = {
    ...initialCompetition,
    currentParticipants:
      contest.currentParticipants ?? initialCompetition?.currentParticipants,
    prizePool: contest.prizePool ?? initialCompetition?.prizePool,
    prizePoolCredits:
      contest.prizePoolCredits ?? initialCompetition?.prizePoolCredits,
    entryFee: contest.entryFee ?? initialCompetition?.entryFee,
    platformFeePercentage:
      contest.platformFeePercentage ??
      initialCompetition?.platformFeePercentage,
    prizeDistribution:
      contest.prizeDistribution ?? initialCompetition?.prizeDistribution,
  };

  const prizePositions = Array.isArray(competition.prizeDistribution)
    ? competition.prizeDistribution.length
    : 0;

  if (prizePositions === 0) return null;

  return (
    <NeonPanel icon={Gift} accent="prize" title="Prize distribution">
      <PrizeTable competition={competition} creditSymbol={creditSymbol} />
    </NeonPanel>
  );
}

/**
 * Entry control with a live `isFull`. Without this, the last seat can fill on someone
 * else's join while this screen still offers Join — the page refresher used to catch that
 * for trading; the standings poll must catch it here.
 */
export function LobbyLiveEntryButton(
  props: ComponentProps<typeof CompetitionEntryButton>,
) {
  const { contest } = useArenaLive();
  const max =
    contest.maxParticipants ?? props.competition?.maxParticipants ?? 0;
  const current =
    contest.currentParticipants ??
    props.competition?.currentParticipants ??
    0;
  const isFull =
    typeof max === "number" && max > 0 ? current >= max : props.isFull;

  const competition = {
    ...props.competition,
    currentParticipants: current,
    maxParticipants: max || props.competition?.maxParticipants,
    prizePool: contest.prizePool ?? props.competition?.prizePool,
    prizePoolCredits:
      contest.prizePoolCredits ?? props.competition?.prizePoolCredits,
  };

  return (
    <CompetitionEntryButton
      {...props}
      competition={competition}
      isFull={isFull}
    />
  );
}
