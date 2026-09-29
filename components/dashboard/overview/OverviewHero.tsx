"use client";

import Image from "next/image";
import { OVERVIEW_HERO_BANNER } from "@/lib/services/games/overview-assets";
import { NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewHeroProps {
  name: string;
  accountActive: boolean;
}

/**
 * Welcome strip over the panoramic ChartVolt hero (slogan + logo baked in).
 * Aspect matches the art so object-cover never crops the centre line or
 * ChartVolt mark — owner requirement 29 Sep 2026.
 */
export default function OverviewHero({ name, accountActive }: OverviewHeroProps) {
  const first = name?.trim().split(/\s+/)[0] || "Player";

  return (
    <section
      className="relative aspect-[1024/341] w-full overflow-hidden rounded-xl border border-cyan-400/20 shadow-[0_0_48px_-20px_rgba(34,211,238,0.4)]"
      aria-label="Welcome"
    >
      <Image
        src={OVERVIEW_HERO_BANNER}
        alt="Bigger traders, bolder players, a brighter you — ChartVolt"
        fill
        priority
        sizes="100vw"
        // Reason: container aspect equals the PNG (1024×341), so cover = full
        // frame — no crop of the baked slogan or ChartVolt neon logo.
        className="object-cover object-center"
      />
      {/* Narrow left wash only — keep centre slogan + right logo readable. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[42%] max-w-md bg-gradient-to-r from-[#050B18]/90 via-[#050B18]/55 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex h-full max-w-[min(100%,22rem)] flex-col justify-center gap-1.5 p-3 sm:max-w-sm sm:gap-2 sm:p-5">
        <p className={NEON_LABEL}>Overview</p>
        <h1 className={`${NEON_HEADING} text-xl text-cyan-100 sm:text-2xl lg:text-3xl`}>
          Welcome back, {first}
        </h1>
        <p className="text-xs text-gray-300 sm:text-sm">
          Higher skills, bigger rewards. Keep climbing the Global board.
        </p>
        <span
          className={`mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            accountActive
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40"
              : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/40"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              accountActive ? "bg-emerald-400" : "bg-amber-400"
            }`}
            aria-hidden
          />
          {accountActive ? "Account active" : "Account attention"}
        </span>
      </div>
    </section>
  );
}
