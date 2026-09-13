import { Award, Trophy } from "lucide-react";
import {
  resolveSettledPrizeRows,
  resolvePrizeBasisNote,
  type PrizeBasis,
  type SettledLeaderboardEntry,
} from "@/lib/admin/contest-result-presentation";
import { projectPrizeDistribution } from "@/lib/utils/prize-projection";
import { formatVolts } from "@/lib/utils/format-volts";

/**
 * The operator's prize panel, which reports one of two genuinely different things.
 *
 * WHY THIS IS A COMPONENT. `/competitions/view/[id]/page.tsx` was 744 lines before this work
 * and is over the 500-line limit; this panel is the largest single block on it. Extracting is
 * also what makes the behaviour testable - a structural assertion over a page that renders both
 * branches can prove the file mentions a paid amount and cannot prove which branch produces it,
 * whereas the two helpers behind this can be called with a settled contest and an unsettled one
 * and compared.
 *
 * BEFORE SETTLEMENT the only honest answer is a projection, and it comes from
 * `lib/utils/prize-projection.ts` - the same module the player-facing prize table uses. That
 * shared module is the point: **the operator screen previously showed the bare configured
 * share while the player lobby showed the redistributed one**, so the two disagreed about what
 * rank 1 was worth, and the operator's figure was the one that then disagreed with the ledger.
 *
 * AFTER SETTLEMENT the amounts are a recorded fact and the projection must stop. Projecting
 * onto a finished contest divides by how many people *entered*, where settlement divided by how
 * many *placed* - a different number since R45 - so it would put a second, wrong figure beside
 * the right one with nothing on screen to distinguish them.
 *
 * THE BASIS IS KEYED ON THE RECORD EXISTING, never on `status === "completed"`. A contest can be
 * completed with no stored leaderboard: it predates the field, it was cancelled, or settlement
 * never ran. Reading the basis off the status would caption a column of blanks as the amounts
 * paid, which is worse than the projection it replaced.
 *
 * NOT MIRRORED. `apps/admin/components/` is admin-only.
 */
export default function ContestPrizePanel({
  distribution,
  finalLeaderboard,
  competition,
  creditSymbol,
  platformFeePercentage,
}: {
  distribution: { rank?: number | null; percentage: number }[];
  finalLeaderboard?: SettledLeaderboardEntry[] | null;
  /** Read only for the projection's four inputs; see `PrizeProjectionInput`. */
  competition: {
    prizeDistribution?: { percentage: number; rank?: number }[] | null;
    currentParticipants?: number | null;
    prizePool?: number | null;
    prizePoolCredits?: number | null;
    platformFeePercentage?: number | null;
  };
  /** `AppSettings.credits.symbol`. Pools and prizes are credits, never fiat. */
  creditSymbol?: string;
  platformFeePercentage: number;
}) {
  const settledRows = resolveSettledPrizeRows({
    distribution,
    finalLeaderboard,
  });
  const basis: PrizeBasis = settledRows ? "settled" : "projected";
  const projected = projectPrizeDistribution(competition);

  return (
    <div className="bg-gradient-to-br from-yellow-500/10 to-gray-900 border border-yellow-500/30 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        {/*
          THE HEADING CHANGES WITH THE BASIS, and that is not decoration. "Prize Distribution"
          above real payments reads as configuration, so an operator comparing it against the
          wallet credits assumes the two are meant to match and reports a defect when they do
          not. A projection and a record are different claims and must be labelled as such.
        */}
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Award className="h-5 w-5 text-yellow-400" />
          {basis === "settled" ? "Prizes Paid" : "Prize Distribution"}
        </h3>
        {platformFeePercentage > 0 && (
          <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <p className="text-xs font-semibold text-blue-300">
              Platform Fee: {platformFeePercentage}%
            </p>
          </div>
        )}
      </div>

      {/*
        The same headline the player lobby carries, so an operator looking at a half-full
        contest sees the figure the entrants see. Projected only: once settlement has run,
        "still to share" describes money that has already moved.
      */}
      {basis === "projected" && projected.prizePositions > 0 && (
        <div
          className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
            projected.allFilled
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/25 bg-amber-500/10 text-amber-300"
          }`}
        >
          {projected.allFilled
            ? `${projected.filledPositions} of ${projected.prizePositions} paid positions filled`
            : `${competition.currentParticipants || 0} of ${projected.prizePositions} filled - ${projected.unclaimedPercentage}% still to share`}
        </div>
      )}

      {basis === "settled" ? (
        <div className="space-y-2">
          {settledRows?.map((row, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border ${
                row.paidAmount === null
                  ? "bg-gray-800/30 border-gray-700/50"
                  : "bg-gray-800/50 border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RankTrophy index={index} />
                  <span className="text-sm font-bold text-gray-300">
                    Rank #{row.rank}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-semibold">
                    {row.configuredPercentage}%
                  </span>
                  {row.isTied && (
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-xs font-semibold">
                      TIED
                    </span>
                  )}
                </div>
                {/*
                  `-` and not `0`. A rank nobody placed in paid nothing because nobody held it,
                  and printing zero states that somebody was paid zero - the read-side form of
                  R45, and the same choice the score column makes one panel over.
                */}
                <p
                  className={`text-lg font-black ${
                    row.paidAmount === null
                      ? "text-gray-500"
                      : "text-yellow-500"
                  }`}
                >
                  {row.paidAmount === null
                    ? "-"
                    : formatVolts(row.paidAmount, { symbol: creditSymbol })}
                </p>
              </div>

              <p className="text-xs text-gray-500 pt-2 border-t border-gray-700/50">
                {row.names.length > 0
                  ? row.names.join(", ")
                  : "Nobody placed at this rank"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {projected.rows.map((row, index) => {
            // The fee split, which only this screen shows - an operator reconciling a payout
            // needs the gross and the deduction, where a player needs the one figure they
            // will receive.
            const grossAmount =
              (projected.prizePool *
                (row.configuredPercentage + row.bonusPercentage)) /
              100;
            const feeAmount = grossAmount - row.netAmount;

            return (
              <div
                key={index}
                className={`p-4 rounded-xl border ${
                  row.filled
                    ? "bg-gray-800/50 border-gray-700"
                    : "bg-gray-800/30 border-gray-700/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <RankTrophy index={index} />
                    <span className="text-sm font-bold text-gray-300">
                      Rank #{row.rank}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-semibold">
                      {row.configuredPercentage}%
                    </span>
                    {/*
                      THE REDISTRIBUTION, WHICH THIS SCREEN USED TO HIDE. The player lobby has
                      always shown it; the operator saw the bare configured share, so the two
                      screens quoted different amounts for the same rank and the operator's was
                      the one that disagreed with the ledger.
                    */}
                    {row.bonusPercentage > 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                        +{row.bonusPercentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {/*
                    The same unit as the Prize Pool stat, the "Won:" figure on each row, and the
                    player-facing prize table. This said the configured credit name while all
                    three of those said the currency symbol, so one screen labelled one quantity
                    two ways.
                  */}
                  <p
                    className={`text-lg font-black ${
                      row.filled ? "text-yellow-500" : "text-gray-500"
                    }`}
                  >
                    {row.filled
                      ? formatVolts(row.netAmount, { symbol: creditSymbol })
                      : "-"}
                  </p>
                </div>

                {platformFeePercentage > 0 && row.filled && (
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700/50">
                    <span>From pool: {grossAmount.toFixed(2)}</span>
                    <span className="text-red-400">
                      Fee: -{feeAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {platformFeePercentage > 0 && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-300">
            Winners receive net amounts after {platformFeePercentage}% platform
            fee. Total pool: {formatVolts(projected.prizePool, { symbol: creditSymbol })}.
          </p>
        </div>
      )}

      {/*
        ONE SLOT, TWO CAUTIONS, chosen by the basis. The "figures are a floor" note is right
        about a projection and FALSE beside real payments - telling an operator that a completed
        payout might be higher than the amount recorded is the same class of stale warning as
        the play screen's play-window note and the wizard's publishing note, both of which sent
        somebody looking for something that no longer existed.
      */}
      <p className="text-xs text-gray-500 mt-4 leading-relaxed">
        {resolvePrizeBasisNote(basis)}
      </p>
    </div>
  );
}

/** Extracted only because both branches render it, and a second copy would drift in colour. */
function RankTrophy({ index }: { index: number }) {
  return (
    <Trophy
      className={`h-5 w-5 ${
        index === 0
          ? "text-yellow-500"
          : index === 1
            ? "text-gray-400"
            : index === 2
              ? "text-orange-600"
              : "text-gray-600"
      }`}
    />
  );
}
