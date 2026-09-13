import { Swords } from "lucide-react";
import { NEON_LABEL, NEON_PANEL_LIT } from "@/components/neon/tokens";
import { NeonCountPill } from "@/components/neon/Cards";
import {
  describeRoundActivity,
  formatRoundClock,
  roundActivityToneClass,
  type RoundActivitySummary,
} from "@/lib/utils/round-activity";

/**
 * The two seats of a 1v1, in the arena's standings rail - the challenge-side answer to
 * `ArenaLeaderboardPanel`.
 *
 * WHY NOT `ArenaLeaderboardPanel` OR `ProviderLeaderboard`. Both are built around a RANK: they
 * render a rank plate, a crown on the leader, tie markers, and the competition panel fetches
 * `/api/competitions/[id]/standings` on a timer. A challenge has no rank until it settles -
 * `challenge-finalize` decides the winner from the two scores and the catalogue's score
 * direction - so a rail that ordered the pair itself would be a second place that direction is
 * decided, which is the exact shape of R37, where the board and the payout disagreed because
 * each had worked it out separately.
 *
 * SO IT REPORTS AND NEVER ORDERS. The viewer is first and the opponent second, always, and
 * neither carries a position. What a player wants here is the one thing a 1v1 asks - "what has
 * my opponent got" - and that is a comparison they make themselves from two numbers.
 *
 * AN ABSENT SCORE IS A DASH, NEVER A ZERO. R50's read side: a seat exists from the moment a
 * challenge is accepted, and a player who has not finished a round holds no score. Rendering
 * that as nought says they played and scored nothing.
 */

export interface ChallengeArenaSeat {
  userId: string;
  /** The stored name from the challenge. The viewer's own seat is labelled below, not here. */
  name: string;
  isViewer: boolean;
  /** `ChallengeParticipant.score`. Absent is not zero. */
  score?: number;
  /** Their latest ranked round, if they have taken one. */
  activity?: RoundActivitySummary;
}

interface Props {
  seats: ChallengeArenaSeat[];
  /** `Score` or `Time`, resolved from the catalogue by the caller. */
  scoreLabel: string;
}

export default function ChallengeStandingsPanel({ seats, scoreLabel }: Props) {
  return (
    <div className={`${NEON_PANEL_LIT} flex h-full min-h-[400px] flex-col`}>
      <div className="flex items-center justify-between gap-2 border-b border-[#161E36] px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-100">
          <Swords className="h-4 w-4 text-orange-300" />
          Head-to-head
        </span>
        <NeonCountPill>{seats.length} players</NeonCountPill>
      </div>

      {/*
        ONE `flex-1` CHILD, for the reason recorded on `ArenaLeaderboardPanel`: two of them
        divide the slack and the panel's own footer drifts up by whatever the list does not
        need, which is the empty area the owner rejected on the competition arena.
      */}
      <div className="flex-1 space-y-2.5 p-3">
        {seats.map((seat) => {
          const phrase = describeRoundActivity(seat.activity);
          const clock = formatRoundClock(seat.activity?.durationMs);

          return (
            <div
              key={seat.userId}
              className={`rounded-lg border px-3 py-2.5 ${
                seat.isViewer
                  ? "border-cyan-500/30 bg-cyan-500/5"
                  : "border-[#161E36] bg-[#080C18]/60"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`truncate text-sm font-semibold ${
                    seat.isViewer ? "text-cyan-200" : "text-gray-200"
                  }`}
                >
                  {seat.name}
                </span>
                <span className="shrink-0 text-base font-bold text-gray-100">
                  {typeof seat.score === "number" ? seat.score.toLocaleString() : "—"}
                </span>
              </div>

              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className={`truncate text-xs ${roundActivityToneClass(phrase.tone)}`}>
                  {phrase.headline}
                </span>
                <span className={NEON_LABEL}>{scoreLabel}</span>
              </div>

              {(phrase.metrics.length > 0 || clock) && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  {phrase.metrics.map((metric) => (
                    <span key={metric.label}>
                      {metric.label}: <span className="text-gray-300">{metric.value}</span>
                    </span>
                  ))}
                  {clock && (
                    <span>
                      Time taken: <span className="text-gray-300">{clock}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#161E36] px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-gray-500">
          Both scores are reported by the game. The winner is decided when the challenge
          settles, so no position is shown while it is being played.
        </p>
      </div>
    </div>
  );
}
