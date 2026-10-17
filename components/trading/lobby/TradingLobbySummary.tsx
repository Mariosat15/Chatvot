import type { ReactNode } from "react";
import { Clock, Link2, Trophy, Users } from "lucide-react";
import { StatCard } from "@/components/neon/Cards";
import InlineCountdown from "@/components/trading/InlineCountdown";
import UTCClock from "@/components/trading/UTCClock";
import { formatVolts } from "@/lib/utils/format-volts";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { DATA_ICON } from "@/lib/constants/data-icons";
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
  const pool = competition.prizePool || competition.prizePoolCredits || 0;
  const maxPool = maxPrizePool(competition, pool);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 sm:gap-4">
      <StatCard
        size="showcase"
        icon={Trophy}
        imageSrc={DATA_ICON.prizePool}
        accent="prize"
        label="Prize pool"
        value={formatVolts(maxPool, { symbol: creditSymbol })}
        note={
          <>
            <LobbyFillBar
              current={pool}
              max={maxPool}
              tone="amber"
              caption={
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-300/80">
                  {formatVolts(pool, { symbol: creditSymbol })} collected so far
                </p>
              }
            />
            <SummaryHint>
              The most the top places can share - grows with every trader who
              joins
            </SummaryHint>
          </>
        }
      />
      <StatCard
        size="showcase"
        icon={Link2}
        // Reason: owner art for the ticket cost (red wallet-up); wallet stays for Simulated funds.
        imageSrc={COMPETITION_ICON.entryFee}
        accent="entry"
        label="Entry fee"
        value={formatVolts(
          competition.entryFee || competition.entryFeeCredits || 0,
          { symbol: creditSymbol },
        )}
        note={<SummaryHint>Paid once to grab your seat</SummaryHint>}
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

/** A one-line plain-words caption under a figure, so a first-time player knows what it is. */
function SummaryHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 border-t border-white/10 pt-2 text-xs leading-snug text-gray-400">
      {children}
    </p>
  );
}

/**
 * The pool a full contest would hold. Every entrant adds their fee (`contest-entry.service.ts`
 * increments `prizePool` by `entryFee` per join), so the ceiling is today's pool plus one fee per
 * empty seat - which also keeps any operator seed. Falls back to today's pool when there is no
 * seat limit or no fee, because then nothing can grow it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maxPrizePool(competition: any, pool: number): number {
  const fee = Number(competition.entryFee || competition.entryFeeCredits || 0);
  const max = Number(competition.maxParticipants ?? 0);
  const joined = Number(competition.currentParticipants ?? 0);
  if (!(fee > 0) || !(max > 0)) return pool;
  return pool + fee * Math.max(0, max - joined);
}
