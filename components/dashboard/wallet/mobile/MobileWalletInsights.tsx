"use client";

import Image from "next/image";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { Sparkline } from "../AnalyticsCard";
import type { InsightItem } from "../WalletInsights";
import { WALLET_CATEGORY } from "../wallet-tokens";
import { MOBILE_CAROUSEL } from "@/components/dashboard/mobile/MobileSection";

const ART_BY_KEY: Record<string, string> = {
  deposits: WALLET_ART.deposits,
  withdrawals: WALLET_ART.withdrawals,
  purchases: WALLET_ART.purchases,
  gameEarnings: WALLET_ART.gameEarnings,
  bonuses: WALLET_ART.bonuses,
  prizes: WALLET_ART.prizes,
  net: WALLET_ART.netMovement,
};

const COLOR_BY_KEY: Record<string, string> = {
  deposits: WALLET_CATEGORY.deposits,
  withdrawals: WALLET_CATEGORY.withdrawals,
  purchases: WALLET_CATEGORY.purchases,
  gameEarnings: WALLET_CATEGORY.gameEarnings,
  bonuses: WALLET_CATEGORY.bonuses,
  prizes: WALLET_CATEGORY.prizes,
  net: WALLET_CATEGORY.net,
};

/**
 * Swipeable insight cards — ~70% viewport width, snap scrolling.
 */
export default function MobileWalletInsights({ items }: { items: InsightItem[] }) {
  return (
    <section aria-label="Wallet insights">
      <h2 className="mb-2.5 flex items-center gap-2 px-0 text-xs font-semibold uppercase tracking-[0.16em] text-white">
        <Image
          src={WALLET_ART.insights}
          alt=""
          width={22}
          height={22}
          className="h-[22px] w-[22px] object-contain mix-blend-screen"
        />
        Wallet Insights
      </h2>
      <div className={MOBILE_CAROUSEL}>
        {items.map((item) => {
          const color = COLOR_BY_KEY[item.key] ?? WALLET_CATEGORY.net;
          const up = (item.deltaPct ?? 0) >= 0;
          return (
            <article
              key={item.key}
              className="w-[72%] shrink-0 snap-start rounded-[18px] border border-[#1E2A4D] bg-[linear-gradient(160deg,rgba(12,22,44,0.92)_0%,rgba(5,10,22,0.96)_100%)] p-4"
            >
              <div className="flex items-center gap-2">
                <Image
                  src={ART_BY_KEY[item.key] ?? WALLET_ART.insights}
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] object-contain mix-blend-screen"
                />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  {item.label}
                </p>
              </div>
              <p className="mt-2.5 truncate text-xl font-bold tabular-nums text-white">
                {formatVolts(item.value)}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                {item.deltaPct != null && Number.isFinite(item.deltaPct) ? (
                  <span
                    className={`text-xs tabular-nums ${up ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {up ? "+" : ""}
                    {item.deltaPct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
                <Sparkline points={item.spark} color={color} width={80} height={28} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
