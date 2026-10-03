"use client";

import Image from "next/image";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { Sparkline } from "../AnalyticsCard";
import { WALLET_GOLD } from "../wallet-tokens";

type Props = {
  balance: number;
  periodAmount: number;
  periodPct: number | null;
  spark: number[];
};

/**
 * Hero Volt balance — the first answer on a phone wallet screen.
 */
export default function MobileWalletBalanceCard({
  balance,
  periodAmount,
  periodPct,
  spark,
}: Props) {
  const up = periodAmount >= 0;
  return (
    <section
      aria-label="Wallet balance"
      className="relative overflow-hidden rounded-[22px] border border-amber-400/55 bg-[linear-gradient(155deg,rgba(28,22,8,0.95)_0%,rgba(8,14,32,0.98)_55%,rgba(6,12,28,0.99)_100%)] p-5 shadow-[0_0_36px_-10px_rgba(250,204,21,0.45)]"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-amber-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-6 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl"
        aria-hidden
      />

      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
        <Image
          src={WALLET_ART.balance}
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px] object-contain mix-blend-screen"
        />
        Wallet Balance
      </p>

      <p className="mt-2 truncate text-[34px] font-bold leading-none tabular-nums text-white">
        {formatVolts(balance)}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 text-sm tabular-nums">
          <p className={up ? "text-emerald-300" : "text-rose-300"}>
            {up ? "+" : ""}
            {formatVolts(periodAmount)} this period
          </p>
          {periodPct != null && Number.isFinite(periodPct) ? (
            <p className={`mt-0.5 text-xs ${up ? "text-emerald-300/80" : "text-rose-300/80"}`}>
              {periodPct >= 0 ? "+" : ""}
              {periodPct.toFixed(1)}%
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">—</p>
          )}
        </div>
        <Sparkline points={spark} color={WALLET_GOLD} width={96} height={36} />
      </div>
    </section>
  );
}
