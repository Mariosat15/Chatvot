import { Gift, Info } from "lucide-react";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { NeonRankBadge } from "@/components/neon/LeaderboardRow";
import { NEON_FACE_TILE, NEON_FACE_TILE_MUTED } from "@/components/neon/tokens";
import { projectPrizeDistribution } from "@/lib/utils/prize-projection";
import { formatVolts } from "@/lib/utils/format-volts";
import PrizePager from "./PrizePager";

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
 * finished, so the note below says in plain words that empty spots and unfinished entries
 * are shared among the people who did finish - the same caution the admin sidebar carries
 * while it is still projecting.
 */

/**
 * `1st`, `2nd`, `3rd`, `4th`. Presentation only - the rank itself is the number the payout is
 * keyed on and is never derived from this.
 *
 * The teens are the whole reason this is a function rather than a lookup on the last digit:
 * 11, 12 and 13 take `th` while 21, 22 and 23 take `st`, `nd`, `rd`. A contest can pay more
 * than ten places, so "11st place" is reachable rather than theoretical.
 */
function ordinal(rank: number): string {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  const suffix = ["th", "st", "nd", "rd"][rank % 10] ?? "th";
  return `${rank}${suffix}`;
}

/**
 * The icon at the head of a showcase place card: a trophy for first, a numbered medal below.
 * Presentation only, like `ordinal`.
 */
function PlaceIcon({ rank, filled }: { rank: number; filled: boolean }) {
  if (rank === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fixed local icon art
      <img
        src={NEON_ICON("trophy-green")}
        alt=""
        draggable={false}
        className={`h-11 w-11 shrink-0 object-contain ${filled ? "" : "opacity-60"}`}
      />
    );
  }
  const tone =
    rank === 2
      ? "border-slate-300/50 bg-slate-400/15 text-slate-200"
      : rank === 3
        ? "border-orange-400/50 bg-orange-500/15 text-orange-200"
        : "border-sky-400/40 bg-sky-500/10 text-sky-200";
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-base font-black ${tone}`}
    >
      {rank}
    </span>
  );
}

export default function PrizeTable({
  competition,
  creditSymbol,
  size = "default",
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
  /**
   * `lg` is the trading lobby's showcase layout (owner reference, 12 Oct 2026): big place cards
   * and a glowing banner. Opt-in, so the game lobby and the arena keep the compact table. The
   * figures are the same `rows` either way - only the markup differs.
   */
  size?: "default" | "lg";
}) {
  const { rows, prizePositions, unclaimedPercentage, allFilled } =
    projectPrizeDistribution(competition);
  const currentParticipants = competition.currentParticipants || 0;
  const bannerText = allFilled
    ? `${currentParticipants} of ${prizePositions} paid positions filled`
    : `${currentParticipants} of ${prizePositions} filled - ${unclaimedPercentage}% still to share`;
  const caution =
    "Empty prize spots are shared among the winners. If someone enters but never finishes, their share is split among the people who did.";

  if (size === "lg") {
    return (
      <>
        <div
          className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
            allFilled
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.2)]"
              : "border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.25)]"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed local icon art */}
          <img
            src={NEON_ICON("gift")}
            alt=""
            draggable={false}
            className="h-10 w-10 shrink-0 object-contain"
          />
          <span>{bannerText}</span>
        </div>

        <PrizePager
          rows={rows.map((row, index) => (
            <div
              key={index}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 ${
                row.filled
                  ? "border-cyan-400/50 bg-gradient-to-r from-cyan-500/10 to-transparent shadow-[0_0_18px_rgba(34,211,238,0.22)]"
                  : NEON_FACE_TILE_MUTED
              }`}
            >
              <PlaceIcon rank={row.rank} filled={row.filled} />
              <span className="h-9 w-px shrink-0 bg-white/10" aria-hidden />
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate whitespace-nowrap text-sm font-bold leading-tight ${row.filled ? "text-gray-100" : "text-gray-400"}`}
                >
                  {ordinal(row.rank)} place
                </div>
                <div className="mt-1.5 flex items-center gap-1 whitespace-nowrap">
                  <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    {row.configuredPercentage}%
                  </span>
                  {row.bonusPercentage > 0 && (
                    <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      +{row.bonusPercentage.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`shrink-0 whitespace-nowrap text-lg font-black tabular-nums ${row.filled ? "text-amber-300" : "text-gray-500"}`}
              >
                {row.filled
                  ? formatVolts(row.netAmount, { symbol: creditSymbol })
                  : "-"}
              </span>
            </div>
          ))}
        />

        <div
          className={`mt-4 flex items-start gap-3 px-4 py-3 ${NEON_FACE_TILE}`}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <p className="text-xs leading-relaxed text-gray-300">{caution}</p>
        </div>
      </>
    );
  }

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
        <span>{bannerText}</span>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className={`flex items-center justify-between gap-2 px-3 py-2.5 ${
              row.filled ? NEON_FACE_TILE : NEON_FACE_TILE_MUTED
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <NeonRankBadge rank={row.rank} />
              <div className="min-w-0">
                {/*
                  The place, named. The medal alone says first, second and third and says
                  nothing at all from fourth down, where the badge is a bare number - so a
                  contest paying five places had two rows whose only label was a digit.
                */}
                <div
                  className={`text-sm font-semibold leading-tight ${
                    row.filled ? "text-gray-100" : "text-gray-500"
                  }`}
                >
                  {ordinal(row.rank)} place
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
                    {row.configuredPercentage}%
                  </span>
                  {row.bonusPercentage > 0 && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">
                      +{row.bonusPercentage.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span
              className={`shrink-0 text-base font-bold ${
                row.filled ? "text-amber-300" : "text-gray-500"
              }`}
            >
              {row.filled
                ? formatVolts(row.netAmount, { symbol: creditSymbol })
                : "-"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-auto pt-3 text-[11px] leading-relaxed text-gray-500">
        {caution}
      </p>
    </>
  );
}
