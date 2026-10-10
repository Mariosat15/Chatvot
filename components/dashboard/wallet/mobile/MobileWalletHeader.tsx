"use client";

import Image from "next/image";
import { AnalyticsPageHeadline } from "@/components/dashboard/AnalyticsPageHeadline";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";

/**
 * Compact mobile wallet header (~64px). No desktop analytics chrome.
 *
 * Reason: owner 6 Oct 2026 — notifications live in the ChartVolt bar; a second
 * Bell here squeezed the title the same way Performance Analytics did.
 */
export default function MobileWalletHeader({ rangeLabel }: { rangeLabel: string }) {
  return (
    <header className="flex min-h-[64px] items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent ring-1 ring-amber-400/45">
          <Image
            src={WALLET_ART.header}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
        </span>
        <div className="min-w-0">
          <AnalyticsPageHeadline
            lead="Wallet"
            accentWord="Analytics"
            accent="cyan"
            compact
            tag="h1"
          />
          <p className="truncate text-[11px] text-slate-400">{rangeLabel}</p>
        </div>
      </div>
    </header>
  );
}
