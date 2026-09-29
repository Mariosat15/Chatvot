"use client";

import Image from "next/image";
import { OVERVIEW_HERO_BANNER } from "@/lib/services/games/overview-assets";
import { NEON_PANEL, NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewHeroProps {
  name: string;
  accountActive: boolean;
}

/**
 * Welcome strip. Hero art is full-bleed behind the copy and fades left so
 * text stays readable (owner mark-up, 29 Sep 2026).
 */
export default function OverviewHero({ name, accountActive }: OverviewHeroProps) {
  const first = name?.trim().split(/\s+/)[0] || "Player";

  return (
    <section
      className={`${NEON_PANEL} relative min-h-[168px] overflow-hidden p-4 sm:min-h-[200px] sm:p-5`}
      aria-label="Welcome"
    >
      {/* Full-bleed art — cover the whole panel, fade out toward the left. */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={OVERVIEW_HERO_BANNER}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-right"
          priority
        />
        {/* Reason: left-heavy wash so "Welcome back" stays legible on every width. */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#050B18] via-[#050B18]/92 to-[#050B18]/15 sm:via-[#050B18]/85 sm:to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#050B18]/80 via-transparent to-[#050B18]/40"
          aria-hidden
        />
      </div>

      <div className="relative z-10 flex max-w-xl flex-col gap-2">
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
