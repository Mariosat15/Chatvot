import { Gift } from "lucide-react";
import { NeonRankBadge } from "@/components/neon/LeaderboardRow";
import { projectPrizeDistribution } from "@/lib/utils/prize-projection";
import { formatVolts } from "@/lib/utils/format-volts";

/**
 * The ranked prize table, with the unclaimed-position redistribution the trading lobby has
 * always done.
 *
 * IT WAS `components/trading/lobby/TradingPrizeTable.tsx` UNTIL 7 SEP 2026, and the move is the
 * whole point of the rename: nothing in the calculation is about trading. It reads the prize
 * pool, the configured shares, the participant count and the platform fee, all four of which a
 * provider contest has in exactly the same fields.
 *
 * THE ARITHMETIC MOVED AGAIN, LATER ON 7 SEP 2026, into `lib/utils/prize-projection.ts`, and
 * for the same reason it moved here: the operator-facing prize sidebar needed the same answer,
 * the admin app cannot import a main-app component, and a second copy of a payout calculation
 * is the "one rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId` and
 * the Game Master `||`. **Two screens quoting different amounts for one rank is what an
 * operator reports as a payout defect.** The four expressions that decide what a winner is paid
 * travelled character for character, along with the four text assertions pinning them, which is
 * what makes the move provably behaviour-free - so this file is now layout only.
 *
 * ONE THING IT DOES NOT FIX, deliberately. `bonusPerWinner` divides the unclaimed share by the
 * number of *filled* positions, so a contest with paid positions and no participants at all
 * shows every row at its base percentage - which is correct - while the "bonus available"
 * message above still quotes the whole unclaimed figure. That is the pre-existing behaviour and
 * it is left alone: changing it here would be a payout-facing change smuggled into a move,
 * which is exactly the thing this file's separation is meant to prevent.
 *
 * WHAT IT DELIBERATELY DOES NOT KNOW, and why the caution line below matters. It redistributes
 * an unfilled *position*, which is a question about how many people entered. It cannot see a
 * player who entered and recorded no result: eligibility is settled at finalization by
 * `hasResult` (R45), so a contest with three entrants and one score pays differently from what
 * this table shows. Teaching it that would mean predicting a result before the contest has
 * finished, so the honest fix is to say the figures are a floor - the same caution the admin
 * sidebar carries while it is still projecting.
 */

export default function PrizeTable({
  competition,
  creditSymbol,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  /**
   * `AppSettings.credits.symbol`. Optional, because every amount here is a credit amount and
   * `formatVolts` already knows what a credit is called - the prop exists only so an operator
   * who renamed the unit sees their name. It replaced a `currSymbol` prop that was handed the
   * *fiat* symbol, so every prize in this table used to read `€33.33`.
   */
  creditSymbol?: string;
}) {
  const { rows, prizePositions, unclaimedPercentage, allFilled } =
    projectPrizeDistribution(competition);
  const currentParticipants = competition.currentParticipants || 0;

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
        {rows.map((row, index) => (
          <div
            key={index}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
              row.filled
                ? "border-[#1B2540] bg-[#080C18]/80"
                : "border-[#161E36] bg-[#080C18]/40 opacity-50"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <NeonRankBadge rank={row.rank} />
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
                {row.configuredPercentage}%
              </span>
              {row.bonusPercentage > 0 && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">
                  +{row.bonusPercentage.toFixed(1)}%
                </span>
              )}
            </div>
            <span
              className={`shrink-0 text-sm font-bold ${
                row.filled ? "text-amber-300" : "text-gray-500"
              }`}
            >
              {row.filled ? formatVolts(row.netAmount, { symbol: creditSymbol }) : "-"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
        Unclaimed positions are split equally among the winners. These figures
        are a floor: a player who records no result holds no rank, so a share
        left over is spread further.
      </p>
    </>
  );
}
