"use client";

import { Wallet, Target, Percent, Trophy } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import { NEON_PANEL, NEON_LABEL, NEON_HEADING } from "@/components/neon/tokens";

interface OverviewKpiRowProps {
  creditBalance: number;
  /** Contest win rate across every game; null when none completed. */
  contestWinRate: number | null;
  roi: number;
  totalPrizesWon: number;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  accent: string;
}) {
  return (
    <div className={`${NEON_PANEL} flex items-center gap-3 p-3.5 sm:p-4`}>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${accent}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className={NEON_LABEL}>{label}</p>
        <p className={`${NEON_HEADING} truncate text-lg sm:text-xl`}>{value}</p>
      </div>
    </div>
  );
}

/**
 * Four Overview KPIs. Win rate is the contest rate from UserGameStats overall
 * (cross-game), not the trading trade win rate.
 */
export default function OverviewKpiRow({
  creditBalance,
  contestWinRate,
  roi,
  totalPrizesWon,
}: OverviewKpiRowProps) {
  const winDisplay =
    contestWinRate == null ? "—" : `${contestWinRate.toFixed(1)}%`;
  const roiDisplay = `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`;

  return (
    <section
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-label="Key stats"
    >
      <KpiCard
        label="Credit balance"
        value={formatVolts(creditBalance)}
        icon={Wallet}
        accent="border-amber-500/30 bg-amber-500/10 text-amber-300"
      />
      <KpiCard
        label="Win rate"
        value={winDisplay}
        icon={Target}
        accent="border-violet-500/30 bg-violet-500/10 text-violet-300"
      />
      <KpiCard
        label="Net ROI"
        value={roiDisplay}
        icon={Percent}
        accent="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
      />
      <KpiCard
        label="Prizes won"
        value={formatVolts(totalPrizesWon)}
        icon={Trophy}
        accent="border-orange-500/30 bg-orange-500/10 text-orange-300"
      />
    </section>
  );
}
