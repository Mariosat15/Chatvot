"use client";

import { useAppSettings } from "@/contexts/AppSettingsContext";

interface WalletBalanceDisplayProps {
  balance: number;
}

export default function WalletBalanceDisplay({
  balance,
}: WalletBalanceDisplayProps) {
  const { settings } = useAppSettings();

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-600/5 border border-yellow-500/30 shadow-lg h-[72px]">
      <span className="text-2xl text-yellow-500">{settings?.credits.symbol || "⚡"}</span>
      <div className="flex flex-col">
        <span className="text-[10px] text-yellow-400/80 font-semibold uppercase tracking-wider">
          Your Balance
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-yellow-500 tabular-nums">
            {balance.toFixed(settings?.credits.decimals || 2)}
          </span>
          <span className="text-xs font-bold text-yellow-400 uppercase">
            {settings?.credits.name || "Credits"}
          </span>
        </div>
        {settings?.credits.showEUREquivalent && (
          <span className="text-[10px] text-yellow-300/70 tabular-nums">
            ≈ {settings?.currency?.symbol || "€"}
            {(balance * (settings?.credits.valueInEUR || 1)).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
