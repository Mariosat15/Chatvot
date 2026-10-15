import type { ReactNode } from "react";
import InlineCountdown from "@/components/trading/InlineCountdown";
import { formatVolts } from "@/lib/utils/format-volts";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { DATA_ICON } from "@/lib/constants/data-icons";
import { contestPlayersLabel } from "@/components/competitions/lobby/contest-lobby-copy";
import { MobileIcon } from "./MobileLobbyCard";

/**
 * Essentials as four EQUAL tiles in a 2×2 grid (mobile fix guide, point 4).
 *
 * Every tile has the same shape: icon box, label, value, one short line underneath. The
 * row stretches each pair to the taller tile so the grid never looks ragged. Volts only,
 * never EUR. A sponsored seat reads FREE when the contest is GM-funded.
 *
 * Reason: do not import `isFundedContest` from free-private-entry - that module pulls
 * mongoose and must not sit in a tree that can reach a client boundary (R58).
 */

type Tone = "gold" | "red" | "blue" | "purple";

const TONE_BOX = new Map<Tone, string>([
  ["gold", "border-amber-400/25 bg-amber-500/10"],
  ["red", "border-rose-400/25 bg-rose-500/10"],
  ["blue", "border-sky-400/25 bg-sky-500/10"],
  ["purple", "border-violet-400/25 bg-violet-500/10"],
]);

const TONE_VALUE = new Map<Tone, string>([
  ["gold", "text-amber-200"],
  ["red", "text-white"],
  ["blue", "text-white"],
  ["purple", "text-white"],
]);

export function MobileLobbyMetrics({
  competition,
  creditSymbol,
  kind,
  isActive,
  isUpcoming,
  isCompleted,
  isCancelled,
  formatUTCDate,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  creditSymbol?: string;
  kind: "trading" | "game";
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  formatUTCDate: (date: Date) => string;
}) {
  const pool = competition.prizePool || competition.prizePoolCredits || 0;
  const maxPool = maxPrizePool(competition, pool);
  const fee = Number(competition.entryFee || competition.entryFeeCredits || 0);
  // Reason: same predicate as isFundedContest, without importing the mongoose-backed service.
  const funded = competition.fundingMode === "gm_funded";
  const joined = Number(competition.currentParticipants ?? 0);
  const minPlayers = Number(competition.minParticipants ?? 0);
  const maxSeats = Number(competition.maxParticipants ?? 0);
  // Reason: "filled" means seats taken. Measured on money, a fixed sponsor pool would read
  // as nearly full before anybody had joined.
  const filledPct = maxSeats > 0 ? Math.min(100, Math.round((joined / maxSeats) * 100)) : 0;
  const clockTarget = isActive ? competition.endTime : competition.startTime;

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3">
      <Tile
        tone="gold"
        iconSrc={DATA_ICON.prizePool}
        label="Prize pool"
        value={formatVolts(maxPool, { symbol: creditSymbol })}
        sub={`${filledPct}% filled`}
      />
      <Tile
        tone="red"
        iconSrc={COMPETITION_ICON.entryFee}
        label="Entry fee"
        value={funded ? "FREE" : formatVolts(fee, { symbol: creditSymbol })}
        sub={funded ? "GM pays your seat" : "Paid once for your seat"}
      />
      <Tile
        tone="blue"
        iconSrc={COMPETITION_ICON.players}
        label={contestPlayersLabel(kind)}
        value={`${joined} / ${maxSeats}`}
        sub={
          isUpcoming && minPlayers > 0 ? (
            <span className={joined < minPlayers ? "text-orange-300" : "text-emerald-300"}>
              Min {minPlayers} to start
            </span>
          ) : (
            `${joined} joined`
          )
        }
      />
      <Tile
        tone="purple"
        iconSrc={COMPETITION_ICON.clock}
        label={isCancelled || isCompleted ? "Status" : isActive ? "Ends in" : "Starts in"}
        value={
          isCancelled ? (
            "Cancelled"
          ) : isCompleted ? (
            "Completed"
          ) : (
            <InlineCountdown targetDate={clockTarget} type={isActive ? "end" : "start"} />
          )
        }
        sub={isCancelled || isCompleted ? null : formatUTCDate(new Date(clockTarget))}
      />
    </div>
  );
}

function Tile({
  tone,
  iconSrc,
  label,
  value,
  sub,
}: {
  tone: Tone;
  iconSrc: string;
  label: string;
  value: ReactNode;
  sub: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[92px] min-w-0 flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-[#0A1024]/85 p-3 text-center">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${TONE_BOX.get(tone) ?? ""}`}
      >
        <MobileIcon src={iconSrc} className="h-6 w-6" />
      </span>
      <div className="min-w-0 w-full">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <div
          className={`mt-0.5 text-[15px] font-bold leading-tight tabular-nums break-words min-[390px]:text-[16px] ${TONE_VALUE.get(tone) ?? "text-white"}`}
        >
          {value}
        </div>
        {sub ? (
          <p className="mt-1 text-[11px] leading-snug text-gray-400 break-words">{sub}</p>
        ) : null}
      </div>
    </div>
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
