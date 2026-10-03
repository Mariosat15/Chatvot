"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, UserRound } from "lucide-react";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";

/**
 * Compact mobile wallet header (~64px). No desktop analytics chrome.
 */
export default function MobileWalletHeader({ rangeLabel }: { rangeLabel: string }) {
  return (
    <header className="flex min-h-[64px] items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/45">
          <Image
            src={WALLET_ART.header}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-white">
            Wallet
          </h1>
          <p className="truncate text-[11px] text-slate-400">{rangeLabel}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 active:scale-95"
        >
          <Bell className="h-5 w-5" aria-hidden />
        </Link>
        <Link
          href="/profile"
          aria-label="Profile"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 active:scale-95"
        >
          <UserRound className="h-5 w-5" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
