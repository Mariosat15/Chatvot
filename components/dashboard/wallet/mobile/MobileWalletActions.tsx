"use client";

import Image from "next/image";
import Link from "next/link";
import { MOBILE_OVERVIEW_ART } from "@/lib/services/games/overview-assets";

/**
 * Deposit / Withdraw — large thumb targets. Both open `/wallet` because that
 * page has no deep-link action param (same rule as MobileQuickActions).
 */
export default function MobileWalletActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        href="/wallet"
        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-emerald-400/55 bg-gradient-to-b from-emerald-500/25 to-cyan-600/20 px-3 text-sm font-bold uppercase tracking-wide text-emerald-100 shadow-[0_0_18px_-6px_rgba(16,185,129,0.65)] active:scale-[0.98]"
      >
        <Image
          src={MOBILE_OVERVIEW_ART.deposit}
          alt=""
          width={22}
          height={22}
          className="h-[22px] w-[22px] object-contain"
        />
        Deposit
      </Link>
      <Link
        href="/wallet"
        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-fuchsia-400/50 bg-gradient-to-b from-fuchsia-600/30 to-violet-700/25 px-3 text-sm font-bold uppercase tracking-wide text-fuchsia-100 shadow-[0_0_18px_-6px_rgba(217,70,239,0.55)] active:scale-[0.98]"
      >
        <Image
          src={MOBILE_OVERVIEW_ART.withdraw}
          alt=""
          width={22}
          height={22}
          className="h-[22px] w-[22px] object-contain"
        />
        Withdraw
      </Link>
    </div>
  );
}
