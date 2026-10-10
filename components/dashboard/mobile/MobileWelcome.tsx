"use client";

import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import AccountStatusCard from "../AccountStatusCard";
import { OVERVIEW_HERO_BANNER } from "@/lib/services/games/overview-assets";

/**
 * Welcome block (spec s6: ≤140px). Replaces the desktop hero banner on phones.
 */
export default function MobileWelcome() {
  const { data } = useDashboardOverview();
  const { accountStatus, player } = data;
  const firstName = (data.user.name || "Player").split(" ")[0];

  return (
    <div className="space-y-3">
      {/* Reason: owner, 29 Sep 2026 - the old status pill duplicated this card
          (and sat under the fixed logo bar). The card renders only when there
          is an issue, and decides that itself, exactly as on desktop. */}
      <AccountStatusCard accountStatus={accountStatus} />

      <div className="relative max-h-[140px] overflow-hidden rounded-[18px] border border-cyan-400/30 px-4 py-4">
        {/* Reason: decorative plate, dimmed hard so the copy stays readable at 360px. */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url(${OVERVIEW_HERO_BANNER})` }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050B18] via-[#050B18]/85 to-transparent"
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs text-gray-400">Welcome back,</p>
          <p className="truncate text-2xl font-bold text-white">{firstName}</p>
          <p className="mt-1 text-xs text-gray-400">Continue your journey.</p>
          <p className="mt-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
            Account Level {player.level}
          </p>
        </div>
      </div>
    </div>
  );
}
