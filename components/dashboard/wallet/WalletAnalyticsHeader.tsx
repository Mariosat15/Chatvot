"use client";

import { Calendar } from "lucide-react";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import WalletNeonIcon from "./WalletNeonIcon";
import { WALLET_CYAN } from "./wallet-tokens";

/**
 * Compact page header — neon credits tile + glass plate over the page backdrop.
 */
export default function WalletAnalyticsHeader({
  rangeLabel,
}: {
  rangeLabel: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-[16px] border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(9,22,45,0.65)_0%,rgba(3,10,25,0.72)_100%)] shadow-[0_0_28px_rgba(0,229,255,0.12)] backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden
        style={{
          backgroundImage: [
            `radial-gradient(ellipse 80% 120% at 88% 20%, ${WALLET_CYAN}33 0%, transparent 55%)`,
            `linear-gradient(115deg, transparent 40%, rgba(0,229,255,0.1) 50%, transparent 60%)`,
          ].join(", "),
        }}
      />
      <div className="relative flex min-h-[88px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:min-h-[100px] sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <WalletNeonIcon
            src={WALLET_ART.header}
            size={56}
            ringClass="ring-cyan-400/55"
            bgClass="bg-transparent"
            className="shadow-[0_0_22px_rgba(0,229,255,0.4)]"
          />
          <div className="min-w-0">
            <h2 className="text-[26px] font-bold tracking-tight text-white sm:text-[30px]">
              Wallet Analytics
            </h2>
            <p className="mt-0.5 max-w-xl text-[12px] text-slate-300 sm:text-[13px]">
              Track your credits, spending, earnings and overall wallet activity.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-black/45 px-3.5 py-2 text-xs font-medium text-cyan-100 shadow-[0_0_14px_rgba(0,229,255,0.25)]">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
          <span className="tabular-nums">{rangeLabel}</span>
        </div>
      </div>
    </header>
  );
}
