import { Trophy, Ticket, Users, Timer, Target, Info } from "lucide-react";
import { NEON_LABEL } from "@/components/neon/tokens";
import { NeonHeadedPanel, NeonStatStrip } from "@/components/neon/Cards";
import type { PlayState } from "@/components/games/play-state";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";
import { attemptProgress, clock, scoreText, scoringSummary } from "./arena-facts";
import { formatVolts } from "@/lib/utils/format-volts";

/**
 * The contest's own facts, beside the board: pot, entry, size, clock, attempts, your score.
 *
 * WHY THIS IS ON THE PLAY SCREEN AT ALL. Until now every one of these numbers lived on the
 * lobby only, so a player who pressed Play could no longer see what they were playing for.
 * The reference design puts them beside the board for exactly that reason, and none of it is
 * new data - it is the contest record the lobby already reads.
 *
 * WHAT IT DELIBERATELY OMITS, because the reference shows figures this platform has no source
 * for and inventing them would be worse than leaving them out: a "qualified 8/16" knockout
 * count (there are no knockout rounds), an "up next" bracket, a live event ticker, and a
 * credits balance. Each would need a data source that does not exist; a panel filled with a
 * number nothing maintains is the failure this codebase keeps recording.
 *
 * NO MONEY FIGURE IS DERIVED HERE. The pot and the entry fee are read from the contest as
 * stored. What each winner is paid is `components/competitions/PrizeTable.tsx`'s question and
 * is rendered by the caller, so there is exactly one implementation of that calculation.
 */

export interface ArenaContestFacts {
  prizePool?: number;
  entryFee?: number;
  currentParticipants?: number;
  maxParticipants?: number;
  /** `AppSettings.credits.symbol`. Replaced a `currencySymbol` field handed the fiat symbol. */
  creditSymbol?: string;
}

interface Props {
  facts: ArenaContestFacts;
  state: PlayState;
  presentation: GamePresentation;
}

export function ArenaContestPanel({ facts, state, presentation }: Props) {
  const attempt = attemptProgress(state.attemptsUsed, state.attemptsPermitted);
  // The round clock is the CONFIGURED playing time for one attempt, which is what a player
  // wants to know before pressing Play. `maxRoundSeconds` is resolved server-side from the
  // title's schema, never from anything the browser sends.
  const roundClock = clock(state.maxRoundSeconds ?? presentation.maxDurationSeconds);
  const scoring = scoringSummary(presentation.scoreType, presentation.scoreDirection);

  return (
    <NeonHeadedPanel icon={Info} title="Contest info">
      <NeonStatStrip
        items={[
          {
            icon: Trophy,
            accent: "prize",
            label: "Prize pool",
            value: formatVolts(facts.prizePool, { symbol: facts.creditSymbol }),
          },
          {
            icon: Ticket,
            accent: "entry",
            label: "Entry",
            value: formatVolts(facts.entryFee, { symbol: facts.creditSymbol }),
          },
          {
            icon: Users,
            accent: "players",
            label: "Players",
            value:
              typeof facts.currentParticipants === "number"
                ? `${facts.currentParticipants}${facts.maxParticipants ? ` / ${facts.maxParticipants}` : ""}`
                : "—",
          },
          {
            icon: Timer,
            accent: "waiting",
            label: "Round time",
            // An absent round length says nothing rather than guessing. A default would be
            // an invented deadline in front of a paying player.
            value: roundClock ?? "—",
          },
        ]}
      />

      <div className="space-y-3 border-t border-[#16203C] px-4 py-3">
        {attempt && (
          <div>
            <div className="flex items-baseline justify-between">
              <span className={NEON_LABEL}>Attempt</span>
              <span className="text-xs font-semibold text-gray-200">
                {attempt.current} of {attempt.total}
              </span>
            </div>
            <div className="mt-1.5 flex gap-1" aria-hidden>
              {Array.from({ length: attempt.total }, (_, index) => (
                <div
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${
                    index < state.attemptsUsed
                      ? "bg-violet-500"
                      : index === state.attemptsUsed
                        ? "bg-violet-500/40"
                        : "bg-[#161E36]"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className={NEON_LABEL}>Your score</span>
          <span className="text-lg font-bold text-violet-300">
            {scoreText(state.participantScore)}
          </span>
        </div>

        {scoring && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            {scoring}
          </div>
        )}
      </div>
    </NeonHeadedPanel>
  );
}
