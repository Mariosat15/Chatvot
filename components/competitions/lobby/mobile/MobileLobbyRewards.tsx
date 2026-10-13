import { Crown, Medal } from "lucide-react";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { projectPrizeDistribution } from "@/lib/utils/prize-projection";
import { formatVolts } from "@/lib/utils/format-volts";
import { MobileChip, MobileLobbyCard } from "./MobileLobbyCard";

/**
 * Who wins what - a podium (2nd, 1st, 3rd, bottom-aligned, 1st tallest) with any further
 * paid places as centred rows beneath (owner, 13 Oct 2026: "prettier, better graphics,
 * centred fonts").
 *
 * Layout only. Every figure is `projectPrizeDistribution`, the same arithmetic the desktop
 * `PrizeTable` and the admin sidebar read, so the phone cannot quote a different amount for
 * a rank. An unfilled place shows "-", never a guessed amount.
 */

type PlaceStyle = { frame: string; badge: string; text: string; height: string };

const PLACE_STYLES = new Map<number, PlaceStyle>([
  [
    1,
    {
      frame:
        "border-amber-300/60 bg-gradient-to-b from-amber-400/25 via-amber-500/10 to-transparent shadow-[0_0_22px_-6px_rgba(251,191,36,0.75)]",
      badge: "border-amber-300/70 bg-amber-400/20 text-amber-200",
      text: "text-amber-200",
      height: "min-h-[132px]",
    },
  ],
  [
    2,
    {
      frame: "border-slate-300/40 bg-gradient-to-b from-slate-300/15 to-transparent",
      badge: "border-slate-300/60 bg-slate-300/15 text-slate-100",
      text: "text-slate-100",
      height: "min-h-[112px]",
    },
  ],
  [
    3,
    {
      frame: "border-orange-400/40 bg-gradient-to-b from-orange-500/15 to-transparent",
      badge: "border-orange-400/60 bg-orange-500/15 text-orange-200",
      text: "text-orange-200",
      height: "min-h-[104px]",
    },
  ],
]);

const UNFILLED_STYLE: PlaceStyle = {
  frame: "border-white/[0.07] bg-white/[0.02]",
  badge: "border-white/15 bg-white/[0.04] text-gray-400",
  text: "text-gray-400",
  height: "min-h-[104px]",
};

/** Podium display order: second on the left, the winner in the middle, third on the right. */
const PODIUM_ORDER = [2, 1, 3];

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
  const podium = PODIUM_ORDER.map((rank) => rows.find((row) => row.rank === rank)).filter(
    (row): row is (typeof rows)[number] => row !== undefined
  );
  const rest = rows.filter((row) => row.rank > 3);
  const joined = competition.currentParticipants || 0;
  const filledPercent =
    prizePositions > 0 ? Math.min(100, Math.round((joined / prizePositions) * 100)) : 0;
  const amount = (filled: boolean, net: number) =>
    filled ? formatVolts(net, { symbol: creditSymbol }) : "-";

  return (
    <MobileLobbyCard
      id={id}
      iconSrc={NEON_ICON("trophy-green")}
      title="Who wins what"
      action={
        competition.platformFeePercentage > 0 ? (
          <MobileChip tone="cyan">Platform fee {competition.platformFeePercentage}%</MobileChip>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="text-center text-sm text-gray-400">No prize places are set for this contest.</p>
      ) : (
        <>
          <div
            className={`grid min-w-0 items-end gap-2 ${
              podium.length === 1 ? "grid-cols-1" : podium.length === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {podium.map((row) => {
              const style = row.filled ? (PLACE_STYLES.get(row.rank) ?? UNFILLED_STYLE) : UNFILLED_STYLE;
              const Icon = row.rank === 1 ? Crown : Medal;
              return (
                <div
                  key={row.rank}
                  className={`flex min-w-0 flex-col items-center justify-end rounded-xl border px-1.5 pb-3 pt-3 text-center ${style.frame} ${
                    PLACE_STYLES.get(row.rank)?.height ?? UNFILLED_STYLE.height
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-full border ${style.badge} ${
                      row.rank === 1 ? "h-9 w-9" : "h-7 w-7"
                    }`}
                  >
                    <Icon className={row.rank === 1 ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
                  </span>
                  <span className={`mt-1.5 text-[13px] font-black uppercase ${style.text}`}>
                    {ordinal(row.rank)}
                  </span>
                  <span
                    className={`mt-0.5 max-w-full truncate font-black tabular-nums text-white ${
                      row.rank === 1 ? "text-[17px]" : "text-[14px]"
                    }`}
                  >
                    {amount(row.filled, row.netAmount)}
                  </span>
                  <span className="mt-0.5 text-[10px] text-gray-400">
                    {row.configuredPercentage}%
                    {row.bonusPercentage > 0 ? ` +${row.bonusPercentage.toFixed(1)}%` : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {rest.length > 0 ? (
            <ul className="mt-2.5 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
              {rest.map((row) => (
                <li
                  key={row.rank}
                  className="grid min-w-0 grid-cols-3 items-center gap-2 px-3 py-2 text-center text-[12px]"
                >
                  <span className="font-semibold text-gray-300">{ordinal(row.rank)}</span>
                  <span className="text-gray-500">{row.configuredPercentage}%</span>
                  <span
                    className={`font-bold tabular-nums ${row.filled ? "text-amber-300" : "text-gray-500"}`}
                  >
                    {amount(row.filled, row.netAmount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3.5 flex flex-col items-center gap-1.5 text-center">
            <p className={`text-[12px] font-semibold ${allFilled ? "text-emerald-300" : "text-amber-300"}`}>
              {allFilled
                ? `${joined} of ${prizePositions} paid positions filled`
                : `${joined} of ${prizePositions} filled - ${unclaimedPercentage}% still to share`}
            </p>
            <div className="h-1.5 w-3/4 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${
                  allFilled ? "bg-emerald-400" : "bg-gradient-to-r from-amber-400 to-amber-200"
                }`}
                style={{ width: `${filledPercent}%` }}
              />
            </div>
            <p className="mt-1 max-w-[300px] text-[11px] leading-relaxed text-gray-500">
              Empty prize spots are shared among the winners. If someone enters but never
              finishes, their share is split among the people who did.
            </p>
          </div>
        </>
      )}
    </MobileLobbyCard>
  );
}
