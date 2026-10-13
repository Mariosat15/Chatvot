import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { projectPrizeDistribution } from "@/lib/utils/prize-projection";
import { formatVolts } from "@/lib/utils/format-volts";
import { MobileChip, MobileLobbyCard } from "./MobileLobbyCard";

/**
 * Who wins what - the top three places as one row of equal tiles, any further paid places
 * as short rows beneath (mobile fix guide).
 *
 * Layout only. Every figure is `projectPrizeDistribution`, the same arithmetic the desktop
 * `PrizeTable` and the admin sidebar read, so the phone cannot quote a different amount for
 * a rank. An unfilled place shows "-", never a guessed amount.
 */

const PLACE_TONES = new Map<number, string>([
  [1, "border-amber-400/35 bg-amber-500/[0.08] text-amber-200"],
  [2, "border-slate-300/30 bg-slate-300/[0.06] text-slate-200"],
  [3, "border-orange-400/30 bg-orange-500/[0.06] text-orange-200"],
]);

function ordinal(rank: number): string {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  const suffix = ["th", "st", "nd", "rd"].at(rank % 10) ?? "th";
  return `${rank}${suffix}`;
}

export function MobileLobbyRewards({
  competition,
  creditSymbol,
  id = "lobby-prizes",
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  creditSymbol?: string;
  id?: string;
}) {
  const { rows, prizePositions, unclaimedPercentage, allFilled } =
    projectPrizeDistribution(competition);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const joined = competition.currentParticipants || 0;
  const amount = (filled: boolean, net: number) =>
    filled ? formatVolts(net, { symbol: creditSymbol }) : "-";

  return (
    <MobileLobbyCard
      id={id}
      iconSrc={NEON_ICON("trophy-green")}
      title="Who wins what"
      action={
        competition.platformFeePercentage > 0 ? (
          <MobileChip tone="cyan">Fee {competition.platformFeePercentage}%</MobileChip>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No prize places are set for this contest.</p>
      ) : (
        <>
          <div
            className={`grid min-w-0 gap-2 ${
              podium.length === 1 ? "grid-cols-1" : podium.length === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {podium.map((row) => (
              <div
                key={row.rank}
                className={`min-w-0 rounded-xl border px-2 py-2.5 text-center ${
                  row.filled
                    ? (PLACE_TONES.get(row.rank) ?? "border-white/10 bg-white/[0.03] text-gray-200")
                    : "border-white/[0.06] bg-white/[0.02] text-gray-400"
                }`}
              >
                <div className="text-[12px] font-bold">{ordinal(row.rank)}</div>
                <div className="mt-0.5 text-[11px] text-gray-400">
                  {row.configuredPercentage}%
                  {row.bonusPercentage > 0 ? ` +${row.bonusPercentage.toFixed(1)}%` : ""}
                </div>
                <div className="mt-1 truncate text-[14px] font-black tabular-nums">
                  {amount(row.filled, row.netAmount)}
                </div>
              </div>
            ))}
          </div>

          {rest.length > 0 ? (
            <ul className="mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
              {rest.map((row) => (
                <li
                  key={row.rank}
                  className="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-[12px]"
                >
                  <span className="text-gray-300">
                    {ordinal(row.rank)} place
                    <span className="ml-1.5 text-gray-500">{row.configuredPercentage}%</span>
                  </span>
                  <span
                    className={`font-bold tabular-nums ${row.filled ? "text-amber-300" : "text-gray-500"}`}
                  >
                    {amount(row.filled, row.netAmount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className={`mt-3 text-[12px] ${allFilled ? "text-emerald-300" : "text-amber-300"}`}>
            {allFilled
              ? `${joined} of ${prizePositions} paid positions filled`
              : `${joined} of ${prizePositions} filled - ${unclaimedPercentage}% still to share`}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            Empty prize spots are shared among the winners. If someone enters but never
            finishes, their share is split among the people who did.
          </p>
        </>
      )}
    </MobileLobbyCard>
  );
}
