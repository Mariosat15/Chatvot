"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { WALLET_PAGE_BG } from "./wallet/wallet-tokens";

/**
 * Shared mountain wash behind Wallet and Performance analytics.
 *
 * Reason: owner 6 Oct 2026 — both tabs are one product; a second backdrop would
 * make Performance look like a different app.
 */
export default function DashboardBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-w-0 overflow-x-clip rounded-2xl">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
        aria-hidden
        style={{ background: WALLET_PAGE_BG }}
      >
        <Image
          src={WALLET_ART.backdrop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_42%] opacity-55 sm:opacity-60"
        />
        <div className="absolute inset-0 bg-[#0A0F26]/45" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F26] via-[#0A0F26]/30 to-[#0A0F26]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0F26]/95 via-transparent to-[#0A0F26]/95" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#0A0F26] via-[#0A0F26]/75 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0A0F26] to-transparent" />
      </div>
      <div className="relative z-10 space-y-3.5 p-1 pb-10 sm:space-y-4 sm:p-2 sm:pb-14">
        {children}
      </div>
    </div>
  );
}
