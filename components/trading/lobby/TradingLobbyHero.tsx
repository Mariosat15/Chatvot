import { CandlestickChart, Clock, Link2, Trophy, Users } from "lucide-react";
import { NeonHero, NeonStatusBadge } from "@/components/neon/Hero";
import { tradingBanner } from "@/components/neon/banners";
import { StatCard } from "@/components/neon/Cards";
import InlineCountdown from "@/components/trading/InlineCountdown";

/**
 * The trading lobby's header, on the shared neon kit.
 *
 * EXTRACTED FROM `app/(root)/competitions/[id]/page.tsx` IN THE SAME CHANGE THAT RESTYLED IT,
 * which is normally the thing not to do - an extraction's whole value is that green tests prove
 * nothing moved, and a behaviour change in the same commit destroys that proof. It is
 * deliberate here for two reasons. The restyle *is* the change, so there is no "nothing moved"
 * claim to protect; and the page was 1,227 lines against a 500-line limit, so leaving the markup
 * in place would have pushed it past 1,300 while making it harder to read. What is preserved
 * exactly is every value and every condition: the same fallback chain for the prize pool and
 * entry fee, the same four labels chosen by the same lifecycle tests, the same countdown target.
 *
 * THE FIGURES ARE CONTEST FACTS, NOT TRADING FACTS, and that is why this hero and the game
 * lobby's hero show the same four things. The sheet's trading-specific figures - total value,
 * profit and loss, win rate, position - belong to the participant's own performance panel,
 * which is a different component and a different question. Putting a player's profit in the
 * page header would also mean the header of a contest they have not joined has a hole in it.
 */

export interface TradingLobbyHeroProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  currSymbol: string;
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
}

export default function TradingLobbyHero({
  competition,
  currSymbol,
  isActive,
  isUpcoming,
  isCompleted,
  isCancelled,
}: TradingLobbyHeroProps) {
  return (
    <NeonHero
      banner={tradingBanner()}
      badge={{ icon: CandlestickChart, label: "Trading" }}
      title={competition.name}
      subtitle={competition.description}
      status={
        <>
          <NeonStatusBadge status={String(competition.status ?? "")} />
          {/*
            The cancellation reason is kept, and kept next to the badge. It is the only place a
            player is ever told why a contest they paid to enter is not happening, and a restyle
            that dropped it would look like an improvement in review.
          */}
          {isCancelled && competition.cancellationReason && (
            <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              <strong className="font-semibold">Reason:</strong>{" "}
              {competition.cancellationReason}
            </p>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 sm:gap-4">
        <StatCard
          icon={Trophy}
          accent="prize"
          label="Prize pool"
          value={`${currSymbol}${(
            competition.prizePool ||
            competition.prizePoolCredits ||
            0
          ).toFixed(0)}`}
        />
        <StatCard
          icon={Link2}
          accent="entry"
          label="Entry fee"
          value={`${currSymbol}${
            competition.entryFee || competition.entryFeeCredits || 0
          }`}
        />
        <StatCard
          icon={Users}
          accent="players"
          label="Participants"
          value={`${competition.currentParticipants} / ${competition.maxParticipants}`}
          note={
            isUpcoming && competition.minParticipants > 0 ? (
              <p
                className={`mt-2 text-xs ${
                  competition.currentParticipants < competition.minParticipants
                    ? "text-orange-400"
                    : "text-emerald-400"
                }`}
              >
                Minimum {competition.minParticipants}
                {competition.currentParticipants < competition.minParticipants
                  ? " - needs more traders"
                  : " - reached"}
              </p>
            ) : undefined
          }
        />
        <StatCard
          icon={Clock}
          accent={isCancelled ? "ended" : isActive ? "entry" : "waiting"}
          label={
            isCancelled || isCompleted
              ? "Status"
              : isActive
                ? "Time remaining"
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
        />
      </div>
    </NeonHero>
  );
}
