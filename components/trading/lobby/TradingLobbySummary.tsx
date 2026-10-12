import { Clock, Link2, Trophy, Users } from "lucide-react";
import { StatCard } from "@/components/neon/Cards";
import InlineCountdown from "@/components/trading/InlineCountdown";
import UTCClock from "@/components/trading/UTCClock";
import { formatVolts } from "@/lib/utils/format-volts";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { LobbyFillBar } from "@/components/competitions/lobby/LobbyFillBar";
import { contestPlayersLabel } from "@/components/competitions/lobby/contest-lobby-copy";

/**
 * Four large summary cards under the trading hero (spec §14–15).
 */

export function TradingLobbySummary({
  competition,
  creditSymbol,
  isActive,
  isUpcoming,
  isCompleted,
  isCancelled,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  creditSymbol?: string;
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 sm:gap-4">
      <StatCard
        size="showcase"
        icon={Trophy}
        imageSrc={COMPETITION_ICON.volts}
        accent="prize"
        label="Prize pool"
        value={formatVolts(
          competition.prizePool || competition.prizePoolCredits || 0,
          { symbol: creditSymbol },
        )}
      />
      <StatCard
        size="showcase"
        icon={Link2}
        imageSrc={COMPETITION_ICON.wallet}
        accent="entry"
        label="Entry fee"
        value={formatVolts(
          competition.entryFee || competition.entryFeeCredits || 0,
          { symbol: creditSymbol },
        )}
      />
      <StatCard
        size="showcase"
        icon={Users}
        imageSrc={COMPETITION_ICON.players}
        accent="players"
        label={contestPlayersLabel("trading")}
        value={`${competition.currentParticipants} / ${competition.maxParticipants}`}
        note={
          <>
            <LobbyFillBar
              current={competition.currentParticipants ?? 0}
              max={competition.maxParticipants ?? 0}
            />
            {isUpcoming && competition.minParticipants > 0 ? (
              <p
                className={`mt-2 text-xs ${
                  competition.currentParticipants < competition.minParticipants
                    ? "text-orange-400"
                    : "text-emerald-400"
                }`}
              >
                Minimum {competition.minParticipants}
                {competition.currentParticipants < competition.minParticipants
                  ? " to start - bring friends!"
                  : " to start - good to go!"}
              </p>
            ) : null}
          </>
        }
      />
      <StatCard
        size="showcase"
        icon={Clock}
        imageSrc={COMPETITION_ICON.clock}
        accent={isCancelled ? "ended" : isActive ? "entry" : "waiting"}
        label={
          isCancelled || isCompleted
            ? "Status"
            : isActive
              ? "Time left"
              : "Starts in"
        }
        value={
          isCancelled ? (
            "Cancelled"
          ) : isCompleted ? (
            "Completed"
          ) : (
            <InlineCountdown
              targetDate={
                isActive ? competition.endTime : competition.startTime
              }
              type={isActive ? "end" : "start"}
            />
          )
        }
        // Reason: the server clock moved here from the top bar (owner, 12 Oct 2026) so the
        // countdown and the time it counts against sit in one card.
        note={
          <div className="mt-1 border-t border-white/10 pt-3">
            <UTCClock variant="inline" />
          </div>
        }
      />
    </div>
  );
}
