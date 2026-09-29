"use client";

import Image from "next/image";
import { OVERVIEW_HERO_BANNER } from "@/lib/services/games/overview-assets";
import { NEON_PANEL, NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewHeroProps {
  name: string;
  accountActive: boolean;
}

/**
 * Welcome strip + hero art. Status comes from the account-status payload
 * already on the dashboard — never invents "active".
 */
export default function OverviewHero({ name, accountActive }: OverviewHeroProps) {
  const first = name?.trim().split(/\s+/)[0] || "Player";

  return (
    <section
      className={`${NEON_PANEL} relative overflow-hidden p-4 sm:p-5`}
      aria-label="Welcome"
    >
      <div className="relative z-10 flex max-w-xl flex-col gap-2">
        <p className={NEON_LABEL}>Overview</p>
        <h1 className={`${NEON_HEADING} text-2xl sm:text-3xl`}>
          Welcome back, {first}
        </h1>
        <p className="text-sm text-gray-400">
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
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[45%] sm:block">
        <Image
          src={OVERVIEW_HERO_BANNER}
          alt=""
          fill
          sizes="40vw"
          className="object-contain object-right opacity-90"
          priority
        />
      </div>
    </section>
  );
}
