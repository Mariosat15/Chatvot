"use client";

import Image from "next/image";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import type { KpiItem } from "../WalletKpiGrid";
import type { InsightItem } from "../WalletInsights";

type Props = {
  kpis: KpiItem[];
  netInsight: InsightItem | undefined;
};

const CARD =
  "rounded-[16px] border border-[#1E2A4D] bg-[linear-gradient(160deg,rgba(12,22,44,0.92)_0%,rgba(5,10,22,0.96)_100%)] p-3.5 min-h-[92px]";

function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="text-[11px] text-slate-500">—</span>;
  }
  const up = pct >= 0;
  return (
    <span className={`text-[11px] tabular-nums ${up ? "text-emerald-300" : "text-rose-300"}`}>
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

/**
 * Compact 2×2 wallet overview — Total Spent / Game Earnings / Prizes / Net.
 */
export default function MobileWalletOverview({ kpis, netInsight }: Props) {
  const spend = kpis.find((k) => k.key === "spend");
  const game = kpis.find((k) => k.key === "game");
  const prizes = kpis.find((k) => k.key === "prizes");

  const tiles = [
    {
      key: "spend",
      label: "Total Spent",
      value: spend?.value ?? 0,
      deltaPct: spend?.deltaPct,
      art: WALLET_ART.spend,
      tone: "text-pink-200",
    },
    {
      key: "game",
      label: "Game Earnings",
      value: game?.value ?? 0,
      deltaPct: game?.deltaPct,
      art: WALLET_ART.gameEarnings,
      tone: "text-cyan-200",
    },
    {
      key: "prizes",
      label: "Prizes Won",
      value: prizes?.value ?? 0,
      deltaPct: prizes?.deltaPct,
      art: WALLET_ART.prizes,
      tone: "text-orange-200",
    },
    {
      key: "net",
      label: "Net Movement",
      value: netInsight?.value ?? 0,
      deltaPct: netInsight?.deltaPct,
      art: WALLET_ART.netMovement,
      tone: "text-emerald-200",
    },
  ];

  return (
    <section aria-label="Wallet overview">
      <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white">
        Wallet Overview
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <div key={t.key} className={CARD}>
            <div className="flex items-center gap-1.5">
              <Image
                src={t.art}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain mix-blend-screen"
              />
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${t.tone}`}>
                {t.label}
              </p>
            </div>
            <p className="mt-2 truncate text-lg font-bold tabular-nums text-white">
              {formatVolts(t.value)}
            </p>
            <div className="mt-1">
              <Delta pct={t.deltaPct} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
