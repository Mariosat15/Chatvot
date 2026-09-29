"use client";

import Image from "next/image";
import { formatVolts } from "@/lib/utils/format-volts";
import { OVERVIEW_KPI_ART } from "@/lib/services/games/overview-assets";

interface OverviewKpiRowProps {
  creditBalance: number;
  /** Contest win rate across every game; null when none completed. */
  contestWinRate: number | null;
  roi: number;
  totalPrizesWon: number;
}

type KpiTone = "gold" | "violet" | "cyan" | "orange";

type KpiToneStyle = { border: string; glow: string; spark: string };

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const TONE = new Map<KpiTone, KpiToneStyle>([
  [
    "gold",
    {
      border: "border-amber-400/45",
      glow: "shadow-[0_0_22px_-6px_rgba(251,191,36,0.55)]",
      spark: "#FBBF24",
    },
  ],
  [
    "violet",
    {
      border: "border-violet-400/45",
      glow: "shadow-[0_0_22px_-6px_rgba(167,139,250,0.55)]",
      spark: "#A78BFA",
    },
  ],
  [
    "cyan",
    {
      border: "border-cyan-400/45",
      glow: "shadow-[0_0_22px_-6px_rgba(34,211,238,0.55)]",
      spark: "#22D3EE",
    },
  ],
  [
    "orange",
    {
      border: "border-orange-400/45",
      glow: "shadow-[0_0_22px_-6px_rgba(251,146,60,0.55)]",
      spark: "#FB923C",
    },
  ],
]);

const FALLBACK_TONE: KpiToneStyle = {
  border: "border-cyan-400/45",
  glow: "shadow-[0_0_22px_-6px_rgba(34,211,238,0.55)]",
  spark: "#22D3EE",
};

function Sparkline({ color }: { color: string }) {
  // Decorative only — Overview KPIs are point-in-time, not a time series.
  return (
    <svg
      viewBox="0 0 80 28"
      className="h-7 w-20 opacity-90"
      aria-hidden
      fill="none"
    >
      <path
        d="M0 20 C12 18 16 8 28 12 C40 16 44 6 56 10 C68 14 72 4 80 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M0 20 C12 18 16 8 28 12 C40 16 44 6 56 10 C68 14 72 4 80 8 V28 H0 Z"
        fill={color}
        opacity="0.18"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  artSrc,
  tone,
  valueClass,
}: {
  label: string;
  value: string;
  artSrc: string;
  tone: KpiTone;
  valueClass?: string;
}) {
  const t = TONE.get(tone) ?? FALLBACK_TONE;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${t.border} bg-[#070E1C]/90 p-3.5 sm:p-4 ${t.glow}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-11 w-11 shrink-0">
          <Image
            src={artSrc}
            alt=""
            fill
            sizes="44px"
            className="object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-300">{label}</p>
          <p
            className={`truncate text-xl font-bold tracking-tight sm:text-2xl ${
              valueClass ?? "text-white"
            }`}
          >
            {value}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-end">
        <Sparkline color={t.spark} />
      </div>
    </div>
  );
}

/**
 * Four Overview KPIs with neon plates (image 9). Win rate is the contest rate
 * from UserGameStats overall (cross-game), not the trading trade win rate.
 */
export default function OverviewKpiRow({
  creditBalance,
  contestWinRate,
  roi,
  totalPrizesWon,
}: OverviewKpiRowProps) {
  const winDisplay =
    contestWinRate == null ? "—" : `${contestWinRate.toFixed(1)}%`;
  const roiDisplay = `${roi >= 0 ? "" : ""}${roi.toFixed(1)}%`;

  return (
    <section
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-label="Key stats"
    >
      <KpiCard
        label="Credit Balance"
        value={formatVolts(creditBalance)}
        artSrc={OVERVIEW_KPI_ART.credits}
        tone="gold"
      />
      <KpiCard
        label="Win Rate"
        value={winDisplay}
        artSrc={OVERVIEW_KPI_ART.winRate}
        tone="violet"
      />
      <KpiCard
        label="Net ROI"
        value={roiDisplay}
        artSrc={OVERVIEW_KPI_ART.roi}
        tone="cyan"
        valueClass={roi < 0 ? "text-rose-400" : "text-white"}
      />
      <KpiCard
        label="Prizes Won"
        value={formatVolts(totalPrizesWon)}
        artSrc={OVERVIEW_KPI_ART.prizes}
        tone="orange"
      />
    </section>
  );
}
