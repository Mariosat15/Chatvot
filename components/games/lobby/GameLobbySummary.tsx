"use client";

import type { ReactNode } from "react";
import { Clock, Link2, Trophy, Users } from "lucide-react";
import { StatCard } from "@/components/neon/Cards";
import InlineCountdown from "@/components/trading/InlineCountdown";
import UTCClock from "@/components/trading/UTCClock";
import { formatVolts } from "@/lib/utils/format-volts";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { DATA_ICON } from "@/lib/constants/data-icons";
import { LobbyFillBar } from "@/components/competitions/lobby/LobbyFillBar";
import { useArenaLive } from "@/components/games/arena/ArenaLiveStandings";

/**
 * Four showcase cards under the game hero - the same row the trading lobby draws
 * (`TradingLobbySummary`), owner reference 15 Oct 2026: prize pool, entry fee,
 * players and the clock, each with a plain-words caption.
 *
 * Client because the pool and the seat count move with the live standings poll; the
 * figures come from the poll's contest snapshot, never from example data.
 */
export function GameLobbySummary({
  initial,
  minParticipants,
  countdownTarget,
  isActive,
  isUpcoming,
  isCompleted,
  isCancelled,
  creditSymbol,
  prizePoolLabel,
  entryFeeLabel,
  playersLabel,
}: {
  initial: {
    prizePool?: number;
    prizePoolCredits?: number;
    entryFee?: number;
    currentParticipants?: number;
    maxParticipants?: number;
  };
  minParticipants?: number;
  countdownTarget?: string;
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  creditSymbol?: string;
  prizePoolLabel: string;
  entryFeeLabel: string;
  playersLabel: string;
}) {
  const { contest } = useArenaLive();
  const pool = Number(
    contest.prizePool ??
      contest.prizePoolCredits ??
      initial.prizePool ??
      initial.prizePoolCredits ??
      0,
  );
  const fee = Number(contest.entryFee ?? initial.entryFee ?? 0);
  const joined = Number(
    contest.currentParticipants ?? initial.currentParticipants ?? 0,
  );
  const max = Number(contest.maxParticipants ?? initial.maxParticipants ?? 0);
  const maxPool = fee > 0 && max > 0 ? pool + fee * Math.max(0, max - joined) : pool;
  const min = Number(minParticipants ?? 0);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 sm:gap-4">
      <StatCard
        size="showcase"
        icon={Trophy}
        imageSrc={DATA_ICON.prizePool}
        accent="prize"
        label={prizePoolLabel}
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
              The most the top places can share - grows with every player who joins
            </SummaryHint>
          </>
        }
      />
      <StatCard
        size="showcase"
        icon={Link2}
        imageSrc={COMPETITION_ICON.entryFee}
        accent="entry"
        label={entryFeeLabel}
        value={fee > 0 ? formatVolts(fee, { symbol: creditSymbol }) : "Free"}
        note={<SummaryHint>Paid once to grab your seat</SummaryHint>}
      />
      <StatCard
        size="showcase"
        icon={Users}
        imageSrc={COMPETITION_ICON.players}
        accent="players"
        label={playersLabel}
        value={max > 0 ? `${joined} / ${max}` : String(joined)}
        note={
          <>
            <LobbyFillBar current={joined} max={max} />
            {isUpcoming && min > 0 ? (
              <p
                className={`mt-2 text-xs ${
                  joined < min ? "text-orange-400" : "text-emerald-400"
                }`}
              >
                Minimum {min}
                {joined < min ? " to start - bring friends!" : " to start - good to go!"}
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
          ) : countdownTarget ? (
            <InlineCountdown
              targetDate={countdownTarget}
              type={isActive ? "end" : "start"}
            />
          ) : (
            "—"
          )
        }
        note={
          <div className="mt-1 border-t border-white/10 pt-3">
            <UTCClock variant="inline" />
          </div>
        }
      />
    </div>
  );
}

function SummaryHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 border-t border-white/10 pt-2 text-xs leading-snug text-gray-400">
      {children}
    </p>
  );
}
