"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { OVERVIEW_BACKDROP } from "@/lib/services/games/overview-assets";

/**
 * Full-bleed neon mountain backdrop for the Overview tab only.
 *
 * Fades are load-bearing: without them cards fight the art and the page
 * reads as wallpaper. Keep washes navy so panels stay readable.
 */
export default function OverviewBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate rounded-2xl">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
        aria-hidden
      >
        <Image
          src={OVERVIEW_BACKDROP}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_40%] opacity-50 sm:opacity-55"
        />
        {/* Base dim — art is atmosphere, not the primary surface. */}
        <div className="absolute inset-0 bg-[#050B18]/50" />
        {/* Vertical vignette into page chrome. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050B18] via-[#050B18]/25 to-[#050B18]" />
        {/* Side vignette so the busy ridge line softens at the rails. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050B18]/95 via-transparent to-[#050B18]/95" />
        {/* Stronger bottom fade under KPI / streak / progress cards. */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#050B18] via-[#050B18]/70 to-transparent" />
        {/* Soft top under the sticky Header. */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#050B18] to-transparent" />
      </div>

      <div className="relative z-10 space-y-4 p-1 sm:p-2">{children}</div>
    </div>
  );
}
