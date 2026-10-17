"use client";

import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isSponsoredContest,
  sponsoredContestCopy,
} from "@/lib/utils/sponsored-contest-copy";

/**
 * The "Sponsored competition by <Game Master>" banner on a Game Master-funded contest.
 *
 * Renders nothing for a player-paid contest. `compact` is the one-line form for list rows;
 * the default is the full banner with the free-entry explanation.
 */
export default function SponsoredContestBanner({
  fundingMode,
  gameMasterName,
  compact = false,
  className,
}: {
  fundingMode: unknown;
  gameMasterName: unknown;
  compact?: boolean;
  className?: string;
}) {
  if (!isSponsoredContest(fundingMode)) return null;
  const copy = sponsoredContestCopy(gameMasterName);

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-200",
          className,
        )}
      >
        <Gift className="h-3 w-3" aria-hidden />
        {copy.headline} · Free entry
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 border-emerald-400/60 bg-gradient-to-r from-emerald-500/25 via-teal-500/15 to-emerald-500/25 px-4 py-3 shadow-lg shadow-emerald-500/20",
        className,
      )}
    >
      <Gift className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
      <div className="min-w-0 text-left">
        <p className="text-sm font-black uppercase tracking-wide text-emerald-100">
          {copy.headline}
        </p>
        <p className="mt-0.5 text-xs text-emerald-200/90">{copy.detail}</p>
      </div>
    </div>
  );
}
