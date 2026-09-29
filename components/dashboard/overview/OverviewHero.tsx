"use client";

import Image from "next/image";
import { OVERVIEW_HERO_BANNER } from "@/lib/services/games/overview-assets";
import { NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewHeroProps {
  name: string;
  accountActive: boolean;
}

/**
 * Welcome strip with full-bleed hero art and a left readability fade.
 */
export default function OverviewHero({ name, accountActive }: OverviewHeroProps) {
  const first = name?.trim().split(/\s+/)[0] || "Player";

  return (
    <section
      className="relative min-h-[168px] overflow-hidden rounded-xl border border-cyan-400/20 shadow-[0_0_48px_-20px_rgba(34,211,238,0.4)] sm:min-h-[200px]"
      aria-label="Welcome"
    >
      <Image
        src={OVERVIEW_HERO_BANNER}
        alt=""
        fill
        priority
        sizes="100vw"
        // Reason: art is taller than the strip so the standing figure stays in
        // frame; bias right so the mountain figure is visible, not cropped at the waist.
        className="object-cover object-[72%_28%]"
      />
      {/* Left wash keeps welcome copy readable over the art. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050B18] via-[#050B18]/75 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050B18]/55 via-transparent to-[#050B18]/20"
        aria-hidden
      />

      <div className="relative z-10 flex max-w-xl flex-col gap-2 p-4 sm:p-5">
        <p className={NEON_LABEL}>Overview</p>
        <h1 className={`${NEON_HEADING} text-2xl text-cyan-100 sm:text-3xl`}>
          Welcome back, {first}
        </h1>
        <p className="text-sm text-gray-300">
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
