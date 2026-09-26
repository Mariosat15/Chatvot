import {
  Trophy,
  Ticket,
  Users,
  Timer,
  Target,
  Info,
  Gauge,
  Medal,
} from "lucide-react";
import { NEON_DIVIDER, NEON_LABEL } from "@/components/neon/tokens";
import { NeonHeadedPanel, NeonStatTiles } from "@/components/neon/Cards";
import type { PlayState } from "@/components/games/play-state";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";
import { attemptProgress, clock, scoreText, scoringSummary } from "./arena-facts";
import { formatVolts } from "@/lib/utils/format-volts";
import type { TerminologyPack } from "@/lib/constants/terminology";

/**
 * Contest info tiles beside the board (sync view).
 *
 * Terms arrive as a PROP so this file stays model-free and client-safe (R58). The page or
 * `ArenaLiveSidebar` resolves vocabulary once on the server / from props.
 *
 * See `ArenaContestPanel.tsx` for the server entry that still calls `getTerms()`.
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
  terms: TerminologyPack;
  /**
   * Where the player currently stands, taken from the row the server already ranked.
   *
   * IT IS NOT COMPUTED HERE AND MUST NOT BE. Absent renders a dash (R50 read-side).
   */
  rank?: number;
}

const STATUS_PILL: ReadonlyMap<string, { label: string; classes: string }> = new Map([
  ["active", { label: "Live", classes: "text-emerald-300 bg-emerald-400" }],
  ["upcoming", { label: "Not started", classes: "text-sky-300 bg-sky-400" }],
  ["finalizing", { label: "Settling", classes: "text-amber-300 bg-amber-400" }],
]);

function StatePill({ contestStatus, isPaused }: { contestStatus: string; isPaused: boolean }) {
  const pill = isPaused
    ? { label: "Paused", classes: "text-amber-300 bg-amber-400" }
    : (STATUS_PILL.get(contestStatus) ?? {
        label: "Closed",
        classes: "text-gray-400 bg-gray-500",
      });

  const [text, dot] = pill.classes.split(" ");

  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {pill.label}
    </span>
  );
}

export function ArenaContestPanelView({
  facts,
  state,
  presentation,
  terms,
  rank,
}: Props) {
  const attempt = attemptProgress(state.attemptsUsed, state.attemptsPermitted);
  const roundClock = clock(state.maxRoundSeconds ?? presentation.maxDurationSeconds);
  const scoring = scoringSummary(presentation.scoreType, presentation.scoreDirection);

  return (
    <NeonHeadedPanel
      icon={Info}
      title="Contest info"
      action={
        <StatePill
          contestStatus={state.contestStatus}
          isPaused={state.isPaused}
        />
      }
    >
      <div className="space-y-2.5 px-4 py-3">
        <NeonStatTiles
          items={[
            {
              icon: Trophy,
              accent: "prize",
              label: terms.prizePool,
              value: formatVolts(facts.prizePool, {
                symbol: facts.creditSymbol,
              }),
            },
            {
              icon: Ticket,
              accent: "entry",
              label: terms.entryFee,
              value: formatVolts(facts.entryFee, {
                symbol: facts.creditSymbol,
              }),
            },
            {
              icon: Users,
              accent: "players",
              label: terms.players,
              value:
                typeof facts.currentParticipants === "number"
                  ? `${facts.currentParticipants}${facts.maxParticipants ? ` / ${facts.maxParticipants}` : ""}`
                  : "—",
            },
            {
              icon: Timer,
              accent: "waiting",
              label: `${terms.round} time`,
              value: roundClock ?? "—",
            },
          ]}
        />

        <NeonStatTiles
          items={[
            {
              icon: Gauge,
              accent: "score",
              label: `Your ${terms.score.toLowerCase()}`,
              value: scoreText(state.participantScore),
            },
            {
              icon: Medal,
              accent: "prize",
              label: terms.rank,
              value: typeof rank === "number" ? `#${rank}` : "—",
            },
          ]}
        />
      </div>

      <div className={`space-y-3 border-t ${NEON_DIVIDER} px-4 pb-3 pt-3`}>
        {attempt && (
          <div>
            <div className="flex items-baseline justify-between">
              <span className={NEON_LABEL}>{terms.attempt}</span>
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
