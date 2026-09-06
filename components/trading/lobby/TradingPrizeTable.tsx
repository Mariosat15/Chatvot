import { Gift } from "lucide-react";
import { NeonRankBadge } from "@/components/neon/LeaderboardRow";

/**
 * The ranked prize table, with the unclaimed-position redistribution the trading lobby has
 * always done.
 *
 * THE ARITHMETIC IS CARRIED OVER LINE FOR LINE and is the reason this is its own file rather
 * than more markup in the sidebar. It computes real money: an unfilled paid position has its
 * share split among the winners who did finish, and the figure shown is net of the platform fee.
 * A restyle is allowed to change how these numbers look and is not allowed to change them, so
 * keeping the calculation in one small file makes the diff reviewable - the alternative is a
 * money computation buried in the middle of a four-hundred-line layout change, where nobody can
 * tell the two kinds of edit apart.
 *
 * ONE THING IT DOES NOT FIX, deliberately. `bonusPerWinner` divides the unclaimed share by the
 * number of *filled* positions, so a contest with paid positions and no participants at all
 * shows every row at its base percentage - which is correct - while the "bonus available"
 * message above still quotes the whole unclaimed figure. That is the pre-existing behaviour and
 * it is left alone: changing it here would be a payout-facing change smuggled into a styling
 * commit, which is exactly the thing this file's separation is meant to prevent.
 */

export default function TradingPrizeTable({
  competition,
  currSymbol,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  currSymbol: string;
}) {
  const distribution: { percentage: number; rank?: number }[] =
    competition.prizeDistribution ?? [];
  const prizePositions = distribution.length;
  const currentParticipants = competition.currentParticipants || 0;
  const prizePool =
    competition.prizePool || competition.prizePoolCredits || 0;
  const platformFeePercentage = (competition.platformFeePercentage || 0) / 100;
  const filledPositions = Math.min(currentParticipants, prizePositions);

  let unclaimedPercentage = 0;
  if (currentParticipants < prizePositions) {
    distribution.forEach((prize, index) => {
      if (index >= currentParticipants) unclaimedPercentage += prize.percentage;
    });
  }
  const bonusPerWinner =
    filledPositions > 0 ? unclaimedPercentage / filledPositions : 0;

  const allFilled = currentParticipants >= prizePositions;

  return (
    <>
      <div
        className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
          allFilled
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
            : "border-amber-500/25 bg-amber-500/10 text-amber-300"
        }`}
      >
        <Gift className="h-3.5 w-3.5 shrink-0" />
        <span>
          {allFilled
            ? `${currentParticipants} of ${prizePositions} paid positions filled`
            : `${currentParticipants} of ${prizePositions} filled - ${unclaimedPercentage}% still to share`}
        </span>
      </div>

      <div className="space-y-2">
        {distribution.map((prize, index) => {
          const isFilled = index < currentParticipants;
          const adjustedPercentage =
            isFilled && bonusPerWinner > 0
              ? prize.percentage + bonusPerWinner
              : prize.percentage;
          const netAmount =
            ((prizePool * adjustedPercentage) / 100) *
            (1 - platformFeePercentage);

          return (
            <div
              key={index}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                isFilled
                  ? "border-[#1B2540] bg-[#080C18]/80"
                  : "border-[#161E36] bg-[#080C18]/40 opacity-50"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <NeonRankBadge rank={prize.rank ?? index + 1} />
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
                  {prize.percentage}%
                </span>
                {isFilled && bonusPerWinner > 0 && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">
                    +{bonusPerWinner.toFixed(1)}%
                  </span>
                )}
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${
                  isFilled ? "text-amber-300" : "text-gray-500"
                }`}
              >
                {isFilled ? `${currSymbol}${netAmount.toFixed(2)}` : "-"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
        Unclaimed positions are split equally among the winners.
      </p>
    </>
  );
}
