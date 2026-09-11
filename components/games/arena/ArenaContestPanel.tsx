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
  /**
   * Where the player currently stands, taken from the row the server already ranked.
   *
   * IT IS NOT COMPUTED HERE AND MUST NOT BE. `calculateRankings` resolves the contest's score
   * direction once from the catalogue, so a screen working out its own position would be a
   * second place the direction is decided - the exact shape of R37, where the board and the
   * payout disagreed because each had worked it out separately. Absent renders a dash: a
   * player with no result holds no rank, and rendering that as `#1` is the read-side form of
   * the phantom zero R50 removed.
   */
  rank?: number;
}

/**
 * The contest's own state, as a pill on the heading - the reference's green `LIVE` dot.
 *
 * DERIVED FROM TWO FIELDS, NEVER FROM THE FACT THAT THIS SCREEN RENDERED. A paused contest is
 * still stored as `active`, which is precisely why `PlayState` carries `isPaused` separately,
 * and a player can legitimately be on this screen before a contest opens. A pill that said
 * `LIVE` because the page loaded would be a status indicator that is right most of the time,
 * which is worse than none: the one moment it matters is the moment it would be wrong.
 *
 * A `Map`, because the key is a stored status. Anything unrecognised falls through to the
 * neutral phrase rather than resolving to something truthy off the prototype chain.
 */
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

  // One string holding both a text colour and a dot colour, split rather than stored twice:
  // the two must agree, and two fields is two chances for them not to.
  const [text, dot] = pill.classes.split(" ");

  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {pill.label}
    </span>
  );
}

export function ArenaContestPanel({ facts, state, presentation, rank }: Props) {
  const attempt = attemptProgress(state.attemptsUsed, state.attemptsPermitted);
  // The round clock is the CONFIGURED playing time for one attempt, which is what a player
  // wants to know before pressing Play. `maxRoundSeconds` is resolved server-side from the
  // title's schema, never from anything the browser sends.
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
      {/*
        Two groups rather than one six-cell grid, separated by a rule. The reference separates
        the contest's own facts from the player's own two figures, which is the difference
        between "what is this contest" and "how am I doing in it" - and merging them makes the
        score just another tile.

        Cards rather than the hairline strip, which is the owner's reference and is also the
        reason this panel now reads at a glance: the strip packed six figures into six flush
        cells of identical weight, so nothing on it was more important than anything else.
      */}
      <div className="space-y-2.5 px-4 py-3">
        <NeonStatTiles
          items={[
            {
              icon: Trophy,
              accent: "prize",
              label: "Prize pool",
              value: formatVolts(facts.prizePool, {
                symbol: facts.creditSymbol,
              }),
            },
            {
              icon: Ticket,
              accent: "entry",
              label: "Entry",
              value: formatVolts(facts.entryFee, {
                symbol: facts.creditSymbol,
              }),
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
              // An absent round length says nothing rather than guessing. A default
              // would be an invented deadline in front of a paying player.
              value: roundClock ?? "—",
            },
          ]}
        />

        <NeonStatTiles
          items={[
            {
              icon: Gauge,
              accent: "score",
              label: "Your score",
              value: scoreText(state.participantScore),
            },
            {
              icon: Medal,
              accent: "prize",
              label: "Rank",
              // A dash, never `#—` and never a position. See the `rank` prop.
              value: typeof rank === "number" ? `#${rank}` : "—",
            },
          ]}
        />
      </div>

      <div className={`space-y-3 border-t ${NEON_DIVIDER} px-4 pb-3 pt-3`}>
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
