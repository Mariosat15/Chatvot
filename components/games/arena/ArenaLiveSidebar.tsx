"use client";

import { Gift } from "lucide-react";
import { NeonCountPill, NeonHeadedPanel } from "@/components/neon/Cards";
import PrizeTable from "@/components/competitions/PrizeTable";
import {
  ArenaContestPanelView,
  type ArenaContestFacts,
} from "./ArenaContestPanelView";
import { useArenaLive } from "./ArenaLiveStandings";
import type { PlayState } from "@/components/games/play-state";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";
import type { TerminologyPack } from "@/lib/constants/terminology";

/**
 * Contest info + prize breakdown that stay current while the arena is open.
 *
 * WHY ONE CONSUMER. The standings poll already carries the contest snapshot (seats, pot,
 * prize shares) and `yourRank`. Fetching those in two places is two answers; reading them
 * here once keeps the players tile, the prize floor and the board in agreement after a join.
 *
 * Static props seed the first paint; every poll thereafter overlays the live snapshot.
 * Fields the poll does not own (entry fee symbol, play state, presentation, terms) stay
 * on the props - the poll is not a second source for those.
 */

interface Props {
  /** Server-rendered contest facts; used until the first successful poll. */
  initialFacts: ArenaContestFacts;
  /** Contest fields PrizeTable needs that may also move with joins (pool + seats + shares). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialCompetition: any;
  state: PlayState;
  presentation: GamePresentation;
  terms: TerminologyPack;
  /** First-paint rank from `getArenaStandings`. */
  initialRank?: number;
  creditSymbol?: string;
}

export function ArenaLiveSidebar({
  initialFacts,
  initialCompetition,
  state,
  presentation,
  terms,
  initialRank,
  creditSymbol,
}: Props) {
  const { contest, yourRank } = useArenaLive();

  const facts: ArenaContestFacts = {
    ...initialFacts,
    prizePool: contest.prizePool ?? initialFacts.prizePool,
    entryFee: contest.entryFee ?? initialFacts.entryFee,
    currentParticipants:
      contest.currentParticipants ?? initialFacts.currentParticipants,
    maxParticipants: contest.maxParticipants ?? initialFacts.maxParticipants,
    creditSymbol: creditSymbol ?? initialFacts.creditSymbol,
  };

  // Merge only the fields the poll owns. Spreading the whole snapshot over the contest
  // document would wipe name/id and anything else PrizeTable does not use but a future
  // consumer might.
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

  const rank = yourRank ?? initialRank;

  return (
    <>
      <ArenaContestPanelView
        facts={facts}
        state={state}
        presentation={presentation}
        terms={terms}
        rank={rank}
      />
      {prizePositions > 0 && (
        <NeonHeadedPanel
          icon={Gift}
          title="Prize breakdown"
          action={<NeonCountPill>Top {prizePositions} win</NeonCountPill>}
          bodyClassName="flex h-full flex-col p-4"
        >
          <PrizeTable competition={competition} creditSymbol={creditSymbol} />
        </NeonHeadedPanel>
      )}
    </>
  );
}
