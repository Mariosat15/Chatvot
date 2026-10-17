import InlineCountdown from "@/components/trading/InlineCountdown";
import { formatVolts } from "@/lib/utils/format-volts";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { DATA_ICON } from "@/lib/constants/data-icons";
import {
  LobbyLivePlayersValue,
  LobbyLivePrizePoolValue,
} from "@/components/games/LobbyLiveParts";
import { MobileLobbyTile } from "@/components/competitions/lobby/mobile/MobileLobbyMetrics";

/**
 * The four contest facts as the SAME 2×2 tiles the trading phone lobby uses (owner,
 * 15 Oct 2026: "consistency with other pages"). Prize pool, Entry fee, Players, and the
 * one clock on the phone (Ends in / Starts in, or the final status). Round time lives in
 * the run card, never twice.
 */

const UTC_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function utcLabel(value?: Date | string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  // Reason: an unparseable date must not render "Invalid Date" under the clock.
  return Number.isNaN(date.getTime()) ? null : `${UTC_LABEL.format(date)} UTC`;
}

export function MobileGameLobbyMetrics({
  prizePool,
  entryFee,
  currentParticipants,
  maxParticipants,
  minParticipants,
  playersLabel,
  creditSymbol,
  funded = false,
  isActive,
  isUpcoming,
  isCompleted,
  isCancelled,
  countdownTarget,
}: {
  prizePool: number;
  entryFee: number;
  currentParticipants: number;
  maxParticipants: number;
  minParticipants: number;
  playersLabel: string;
  creditSymbol?: string;
  funded?: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  countdownTarget?: Date | string | null;
}) {
  const finished = isCompleted || isCancelled;
  const target =
    countdownTarget instanceof Date
      ? countdownTarget.toISOString()
      : (countdownTarget ?? null);

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3">
      <MobileLobbyTile
        tone="gold"
        iconSrc={DATA_ICON.prizePool}
        label="Prize pool"
        value={<LobbyLivePrizePoolValue initialPool={prizePool} creditSymbol={creditSymbol} />}
        sub="Shared by the winners"
      />
      <MobileLobbyTile
        tone="red"
        iconSrc={COMPETITION_ICON.entryFee}
        label="Entry fee"
        value={funded ? "FREE" : formatVolts(entryFee, { symbol: creditSymbol })}
        sub={funded ? "GM pays your seat" : "Paid once for your seat"}
      />
      <MobileLobbyTile
        tone="blue"
        iconSrc={COMPETITION_ICON.players}
        label={playersLabel}
        value={
          <LobbyLivePlayersValue
            initialCurrent={currentParticipants}
            initialMax={maxParticipants}
          />
        }
        sub={isUpcoming && minParticipants > 0 ? `Min ${minParticipants} to start` : "Seats taken"}
      />
      <MobileLobbyTile
        tone="purple"
        iconSrc={COMPETITION_ICON.clock}
        label={finished ? "Status" : isActive ? "Ends in" : "Starts in"}
        value={
          isCancelled ? (
            "Cancelled"
          ) : isCompleted ? (
            "Completed"
          ) : target ? (
            <InlineCountdown
              targetDate={target}
              type={isActive ? "end" : "start"}
              zeroLabel={isActive ? "Ending…" : "Starting…"}
              className="block whitespace-nowrap text-[12px] tracking-tight min-[390px]:text-[13px]"
            />
          ) : (
            "-"
          )
        }
        sub={finished ? (isCompleted ? "Results are final" : null) : utcLabel(target)}
      />
    </div>
  );
}
