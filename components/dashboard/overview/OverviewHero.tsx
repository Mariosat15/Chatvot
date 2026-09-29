"use client";

import Image from "next/image";
import { OVERVIEW_HERO_BANNER } from "@/lib/services/games/overview-assets";
import { NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewHeroProps {
  name: string;
  accountActive: boolean;
}

/**
 * Compact welcome strip over the panoramic ChartVolt hero.
 * Height is capped to the owner-marked band (29 Sep 2026) — shorter than the
 * native 1024×341 frame — with object-cover centred so the baked slogan and
 * ChartVolt mark stay in view.
 */
export default function OverviewHero({ name, accountActive }: OverviewHeroProps) {
  const first = name?.trim().split(/\s+/)[0] || "Player";

  return (
    <section
      className="relative h-[120px] w-full overflow-hidden rounded-xl border border-cyan-400/20 shadow-[0_0_48px_-20px_rgba(34,211,238,0.4)] sm:h-[136px] lg:h-[148px]"
      aria-label="Welcome"
    >
      <Image
        src={OVERVIEW_HERO_BANNER}
        alt="Bigger traders, bolder players, a brighter you — ChartVolt"
        fill
        priority
        sizes="100vw"
        // Reason: strip is shorter than the PNG; cover + slight vertical bias
        // keeps the centre slogan and right ChartVolt logo inside the red-marked band.
        className="object-cover object-[center_42%]"
      />
      {/* Narrow left wash only — keep centre slogan + right logo readable. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[40%] max-w-sm bg-gradient-to-r from-[#050B18]/92 via-[#050B18]/55 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex h-full max-w-[min(100%,20rem)] flex-col justify-center gap-0.5 p-3 sm:max-w-sm sm:gap-1 sm:p-4">
        <p className={`${NEON_LABEL} text-[10px] leading-none`}>Overview</p>
        <h1
          className={`${NEON_HEADING} text-lg leading-tight text-cyan-100 sm:text-xl lg:text-2xl`}
        >
          Welcome back, {first}
        </h1>
        <p className="hidden text-xs leading-snug text-gray-300 sm:block">
          Higher skills, bigger rewards. Keep climbing the Global board.
        </p>
        <span
          className={`mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:mt-1 sm:px-2.5 sm:py-1 sm:text-[11px] ${
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
