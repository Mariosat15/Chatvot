import type { ReactNode } from "react";
import { Clock, Link2, Trophy, Users } from "lucide-react";
import { StatCard } from "@/components/neon/Cards";
import InlineCountdown from "@/components/trading/InlineCountdown";
import UTCClock from "@/components/trading/UTCClock";
import { formatVolts } from "@/lib/utils/format-volts";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { LobbyFillBar } from "@/components/competitions/lobby/LobbyFillBar";
import { contestPlayersLabel } from "@/components/competitions/lobby/contest-lobby-copy";

/**
 * Essentials 2×2 grid (Complobyymobile §6). Never four-across; never desktop `showcase`.
 * Volts only — never EUR. Sponsored seats show FREE when the contest is GM-funded.
 *
 * Reason: do not import `isFundedContest` from free-private-entry — that module pulls
 * mongoose and must not sit in a tree that can reach a client boundary (R58).
 */

export function MobileLobbyMetrics({
  competition,
  creditSymbol,
  kind,
  isActive,
  isUpcoming,
  isCompleted,
  isCancelled,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  creditSymbol?: string;
  kind: "trading" | "game";
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
}) {
  const pool = competition.prizePool || competition.prizePoolCredits || 0;
  const maxPool = maxPrizePool(competition, pool);
  const fee = Number(competition.entryFee || competition.entryFeeCredits || 0);
  // Reason: same predicate as isFundedContest, without importing the mongoose-backed service.
  const funded = competition.fundingMode === "gm_funded";

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5">
      <StatCard
        size="lg"
        icon={Trophy}
        imageSrc={COMPETITION_ICON.volts}
        accent="prize"
        label="Prize pool"
        value={formatVolts(maxPool, { symbol: creditSymbol })}
        note={
          <>
            <LobbyFillBar current={pool} max={maxPool} tone="amber" />
            <Hint>
              {formatVolts(pool, { symbol: creditSymbol })} collected
            </Hint>
          </>
        }
      />
      <StatCard
        size="lg"
        icon={Link2}
        imageSrc={COMPETITION_ICON.entryFee}
        accent="entry"
        label="Entry fee"
        value={
          funded
            ? "FREE"
            : formatVolts(fee, { symbol: creditSymbol })
        }
        note={
          <Hint>
            {funded ? "GM pays your seat" : "Paid once for your seat"}
          </Hint>
        }
      />
      <StatCard
        size="lg"
        icon={Users}
        imageSrc={COMPETITION_ICON.players}
        accent="players"
        label={contestPlayersLabel(kind)}
        value={`${competition.currentParticipants ?? 0} / ${competition.maxParticipants ?? 0}`}
        note={
          <>
            <LobbyFillBar
              current={competition.currentParticipants ?? 0}
              max={competition.maxParticipants ?? 0}
            />
            {isUpcoming && competition.minParticipants > 0 ? (
              <p
                className={`mt-1.5 text-[11px] ${
                  (competition.currentParticipants ?? 0) <
                  competition.minParticipants
                    ? "text-orange-400"
                    : "text-emerald-400"
                }`}
              >
                Min {competition.minParticipants} to start
              </p>
            ) : null}
          </>
        }
      />
      <StatCard
        size="lg"
        icon={Clock}
        imageSrc={COMPETITION_ICON.clock}
        accent={isCancelled ? "ended" : isActive ? "entry" : "waiting"}
        label={
          isCancelled || isCompleted
            ? "Status"
            : isActive
              ? "Ends in"
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
        note={
          <div className="mt-1 border-t border-white/10 pt-2">
            <UTCClock variant="inline" />
          </div>
        }
      />
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 text-[11px] leading-snug text-gray-400">{children}</p>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maxPrizePool(competition: any, pool: number): number {
  const fee = Number(competition.entryFee || competition.entryFeeCredits || 0);
  const max = Number(competition.maxParticipants ?? 0);
  const joined = Number(competition.currentParticipants ?? 0);
  if (!(fee > 0) || !(max > 0)) return pool;
  return pool + fee * Math.max(0, max - joined);
}
