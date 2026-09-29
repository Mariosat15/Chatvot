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

type KpiToneStyle = {
  border: string;
  glow: string;
  iconRing: string;
  iconBg: string;
  spark: string;
  sparkFade: string;
};

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const TONE = new Map<KpiTone, KpiToneStyle>([
  [
    "gold",
    {
      border: "border-amber-400/50",
      glow: "shadow-[0_0_28px_-8px_rgba(251,191,36,0.55)]",
      iconRing: "ring-amber-400/40",
      iconBg: "bg-amber-500/10",
      spark: "#FBBF24",
      sparkFade: "rgba(251,191,36,0.35)",
    },
  ],
  [
    "violet",
    {
      border: "border-violet-400/50",
      glow: "shadow-[0_0_28px_-8px_rgba(167,139,250,0.55)]",
      iconRing: "ring-violet-400/40",
      iconBg: "bg-violet-500/10",
      spark: "#A78BFA",
      sparkFade: "rgba(167,139,250,0.35)",
    },
  ],
  [
    "cyan",
    {
      border: "border-cyan-400/50",
      glow: "shadow-[0_0_28px_-8px_rgba(34,211,238,0.55)]",
      iconRing: "ring-cyan-400/40",
      iconBg: "bg-cyan-500/10",
      spark: "#22D3EE",
      sparkFade: "rgba(34,211,238,0.35)",
    },
  ],
  [
    "orange",
    {
      border: "border-orange-400/50",
      glow: "shadow-[0_0_28px_-8px_rgba(251,146,60,0.55)]",
      iconRing: "ring-orange-400/40",
      iconBg: "bg-orange-500/10",
      spark: "#FB923C",
      sparkFade: "rgba(251,146,60,0.35)",
    },
  ],
]);

const FALLBACK_TONE: KpiToneStyle = {
  border: "border-cyan-400/50",
  glow: "shadow-[0_0_28px_-8px_rgba(34,211,238,0.55)]",
  iconRing: "ring-cyan-400/40",
  iconBg: "bg-cyan-500/10",
  spark: "#22D3EE",
  sparkFade: "rgba(34,211,238,0.35)",
};

/** Wide area chart for the right half of each KPI (image 2). Decorative only. */
function SparkArea({
  color,
  fade,
  uid,
}: {
  color: string;
  fade: string;
  uid: string;
}) {
  const gradId = `kpi-spark-${uid}`;
  return (
    <svg
      viewBox="0 0 160 64"
      className="h-full w-full"
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fade} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 48 C18 46 28 28 42 34 C56 40 64 18 82 26 C100 34 110 14 128 22 C142 28 150 16 160 20 V64 H0 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M0 48 C18 46 28 28 42 34 C56 40 64 18 82 26 C100 34 110 14 128 22 C142 28 150 16 160 20"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
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
  sparkId,
}: {
  label: string;
  value: string;
  artSrc: string;
  tone: KpiTone;
  valueClass?: string;
  sparkId: string;
}) {
  const t = TONE.get(tone) ?? FALLBACK_TONE;
  return (
    <div
      className={`relative flex min-h-[108px] overflow-hidden rounded-xl border ${t.border} bg-[#070E1C]/88 ${t.glow}`}
    >
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-2 p-3.5 sm:p-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ${t.iconRing} ${t.iconBg}`}
          >
            <Image
              src={artSrc}
              alt=""
              width={28}
              height={28}
              className="object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
            />
          </span>
          <p className="truncate text-xs font-medium text-gray-300">{label}</p>
        </div>
        <p
          className={`truncate text-2xl font-bold tracking-tight sm:text-[1.65rem] ${
            valueClass ?? "text-white"
          }`}
        >
          {value}
        </p>
        {/*
          Reason: image 2 shows week deltas — we have no honest week series here,
          so we omit fabricated % rather than invent “vs last week” numbers.
        */}
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[48%] opacity-90"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#070E1C]/88" />
        <SparkArea color={t.spark} fade={t.sparkFade} uid={sparkId} />
      </div>
    </div>
  );
}

/**
 * Four Overview KPIs in the image-2 horizontal neon layout: icon tile + value
 * on the left, wide spark area on the right. Win rate is contest rate from
 * UserGameStats overall (cross-game), not trading trade win rate.
 */
export default function OverviewKpiRow({
  creditBalance,
  contestWinRate,
  roi,
  totalPrizesWon,
}: OverviewKpiRowProps) {
  const winDisplay =
    contestWinRate == null ? "—" : `${contestWinRate.toFixed(1)}%`;
  const roiDisplay = `${roi.toFixed(1)}%`;

  return (
    <section
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Key stats"
    >
      <KpiCard
        label="Credit Balance"
        value={formatVolts(creditBalance)}
        artSrc={OVERVIEW_KPI_ART.credits}
        tone="gold"
        sparkId="credits"
      />
      <KpiCard
        label="Win Rate"
        value={winDisplay}
        artSrc={OVERVIEW_KPI_ART.winRate}
        tone="violet"
        sparkId="win"
      />
      <KpiCard
        label="Net ROI"
        value={roiDisplay}
        artSrc={OVERVIEW_KPI_ART.roi}
        tone="cyan"
        valueClass={roi < 0 ? "text-rose-400" : "text-white"}
        sparkId="roi"
      />
      <KpiCard
        label="Prizes Won"
        value={formatVolts(totalPrizesWon)}
        artSrc={OVERVIEW_KPI_ART.prizes}
        tone="orange"
        sparkId="prizes"
      />
    </section>
  );
}
