"use client";

import { Calendar, Wallet } from "lucide-react";
import { WALLET_CYAN } from "./wallet-tokens";

/**
 * Compact page header (~90–110px) — rebuild guide §3.
 * Subtle neon backdrop only; no tall hero banner.
 */
export default function WalletAnalyticsHeader({
  rangeLabel,
}: {
  rangeLabel: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-[16px] border border-cyan-400/25 bg-[linear-gradient(135deg,rgba(9,22,45,0.98)_0%,rgba(3,10,25,0.98)_100%)] shadow-[0_0_20px_rgba(0,229,255,0.06)]">
      {/* Subtle geometric energy wave — header only */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage: [
            `radial-gradient(ellipse 80% 120% at 88% 20%, ${WALLET_CYAN}22 0%, transparent 55%)`,
            `linear-gradient(115deg, transparent 40%, rgba(0,229,255,0.06) 50%, transparent 60%)`,
            `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='120' fill='none'%3E%3Cpath d='M0 90 Q120 40 240 70 T480 50 T800 80' stroke='%2300E5FF' stroke-opacity='.25' stroke-width='1.5'/%3E%3Cpath d='M0 100 Q160 55 320 85 T640 60 T800 95' stroke='%2300E5FF' stroke-opacity='.12' stroke-width='1'/%3E%3C/svg%3E")`,
          ].join(", "),
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right center, center, right bottom",
          backgroundSize: "100% 100%, 100% 100%, min(720px, 90%) 100%",
        }}
      />
      <div className="relative flex min-h-[88px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:min-h-[100px] sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_18px_rgba(0,229,255,0.35)] sm:h-14 sm:w-14"
            style={{ boxShadow: `0 0 22px ${WALLET_CYAN}55` }}
          >
            <Wallet className="h-6 w-6 text-cyan-200 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-[26px] font-bold tracking-tight text-white sm:text-[30px]">
              Wallet Analytics
            </h2>
            <p className="mt-0.5 max-w-xl text-[12px] text-slate-400 sm:text-[13px]">
              Track your credits, spending, earnings and overall wallet activity.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-black/45 px-3.5 py-2 text-xs font-medium text-cyan-100 shadow-[0_0_12px_rgba(0,229,255,0.18)]">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
          <span className="tabular-nums">{rangeLabel}</span>
        </div>
      </div>
    </header>
  );
}
