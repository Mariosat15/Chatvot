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
  weekDelta: {
    credits: number | null;
    winRate: number | null;
    roi: number | null;
    prizes: number | null;
  };
}

type KpiTone = "gold" | "violet" | "cyan" | "orange";

type KpiToneStyle = {
  border: string;
  outerGlow: string;
  glass: string;
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
      border: "border-amber-400/70",
      outerGlow:
        "shadow-[0_0_14px_rgba(251,191,36,0.18),inset_0_0_18px_rgba(251,191,36,0.06)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(251,191,36,0.14)_0%,#07101f_48%,rgba(180,120,20,0.1)_100%)]",
      iconRing: "ring-amber-400/55",
      iconBg: "bg-amber-500/15",
      spark: "#FBBF24",
      sparkFade: "rgba(251,191,36,0.45)",
    },
  ],
  [
    "violet",
    {
      border: "border-violet-400/70",
      outerGlow:
        "shadow-[0_0_14px_rgba(167,139,250,0.18),inset_0_0_18px_rgba(167,139,250,0.06)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(167,139,250,0.16)_0%,#07101f_48%,rgba(100,60,180,0.12)_100%)]",
      iconRing: "ring-violet-400/55",
      iconBg: "bg-violet-500/15",
      spark: "#A78BFA",
      sparkFade: "rgba(167,139,250,0.45)",
    },
  ],
  [
    "cyan",
    {
      border: "border-cyan-400/70",
      outerGlow:
        "shadow-[0_0_14px_rgba(34,211,238,0.18),inset_0_0_18px_rgba(34,211,238,0.06)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(34,211,238,0.14)_0%,#07101f_48%,rgba(20,120,160,0.12)_100%)]",
      iconRing: "ring-cyan-400/55",
      iconBg: "bg-cyan-500/15",
      spark: "#22D3EE",
      sparkFade: "rgba(34,211,238,0.45)",
    },
  ],
  [
    "orange",
    {
      border: "border-orange-400/70",
      outerGlow:
        "shadow-[0_0_14px_rgba(251,146,60,0.18),inset_0_0_18px_rgba(251,146,60,0.06)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(251,146,60,0.16)_0%,#07101f_48%,rgba(180,80,20,0.12)_100%)]",
      iconRing: "ring-orange-400/55",
      iconBg: "bg-orange-500/15",
      spark: "#FB923C",
      sparkFade: "rgba(251,146,60,0.45)",
    },
  ],
]);

const FALLBACK_TONE: KpiToneStyle = {
  border: "border-cyan-400/70",
  outerGlow:
    "shadow-[0_0_14px_rgba(34,211,238,0.18),inset_0_0_18px_rgba(34,211,238,0.06)]",
  glass:
    "bg-[linear-gradient(110deg,rgba(34,211,238,0.14)_0%,#07101f_48%,rgba(20,120,160,0.12)_100%)]",
  iconRing: "ring-cyan-400/55",
  iconBg: "bg-cyan-500/15",
  spark: "#22D3EE",
  sparkFade: "rgba(34,211,238,0.45)",
};

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
  const glowId = `kpi-glow-${uid}`;
  return (
    <svg
      viewBox="0 0 140 56"
      className="h-full w-full"
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fade} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M0 42 C16 40 24 22 38 28 C52 34 60 14 78 22 C96 30 108 12 124 18 C132 22 136 16 140 18 V56 H0 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M0 42 C16 40 24 22 38 28 C52 34 60 14 78 22 C96 30 108 12 124 18 C132 22 136 16 140 18"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${glowId})`}
      />
    </svg>
  );
}

function WeekDelta({ delta }: { delta: number | null }) {
  if (delta == null || !Number.isFinite(delta)) {
    return (
      <p className="text-[11px] text-gray-500">
        <span className="text-gray-400">—</span>
        <span className="ml-1.5">vs last week</span>
      </p>
    );
  }
  const up = delta >= 0;
  const abs = Math.abs(delta).toFixed(1);
  return (
    <p className="text-[11px] leading-tight">
      <span className={up ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
        {up ? "+" : "−"}
        {abs}%
      </span>
      <span className="ml-1.5 text-gray-500">vs last week</span>
    </p>
  );
}

function KpiCard({
  label,
  value,
  artSrc,
  tone,
  valueClass,
  sparkId,
  weekDelta,
}: {
  label: string;
  value: string;
  artSrc: string;
  tone: KpiTone;
  valueClass?: string;
  sparkId: string;
  weekDelta: number | null;
}) {
  const t = TONE.get(tone) ?? FALLBACK_TONE;
  return (
    <div
      className={`relative flex min-h-[96px] items-center overflow-hidden rounded-[13px] border ${t.border} ${t.glass} ${t.outerGlow} px-3.5 py-3.5 sm:px-4`}
    >
      {/* Watermark — depth only, never competes with type. */}
      <div
        className="pointer-events-none absolute -right-2 top-1/2 h-24 w-24 -translate-y-1/2 opacity-[0.07]"
        aria-hidden
      >
        <Image src={artSrc} alt="" fill sizes="96px" className="object-contain" />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`relative flex h-14 w-14 shrink-0 overflow-hidden rounded-[12px] ring-1 ${t.iconRing} ${t.iconBg} shadow-[0_0_14px_rgba(255,255,255,0.08)]`}
        >
          <span className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-br from-white/10 to-transparent" />
          {/* Reason: soft owner tiles look blurry when overscaled — contain at native
              framing with a light nudge so the glyph fills without mush. */}
          <Image
            src={artSrc}
            alt=""
            fill
            sizes="56px"
            className="scale-[1.08] object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-tight text-gray-300">
            {label}
          </p>
          <p
            className={`mt-0.5 truncate text-[22px] font-bold leading-none tracking-tight sm:text-[24px] ${
              valueClass ?? "text-white"
            }`}
          >
            {value}
          </p>
          <div className="mt-1.5">
            <WeekDelta delta={weekDelta} />
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[58%] w-[34%] opacity-95"
        aria-hidden
      >
        <SparkArea color={t.spark} fade={t.sparkFade} uid={sparkId} />
      </div>
    </div>
  );
}

/**
 * Four Overview KPIs rebuilt to the image-4 premium neon glass system.
 * Credit figures keep the platform credit symbol (⚡) — never strip it here.
 */
export default function OverviewKpiRow({
  creditBalance,
  contestWinRate,
  roi,
  totalPrizesWon,
  weekDelta,
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
        weekDelta={weekDelta.credits}
      />
      <KpiCard
        label="Win Rate"
        value={winDisplay}
        artSrc={OVERVIEW_KPI_ART.winRate}
        tone="violet"
        sparkId="win"
        weekDelta={weekDelta.winRate}
      />
      <KpiCard
        label="Net ROI"
        value={roiDisplay}
        artSrc={OVERVIEW_KPI_ART.roi}
        tone="cyan"
        valueClass={roi < 0 ? "text-rose-400" : "text-white"}
        sparkId="roi"
        weekDelta={weekDelta.roi}
      />
      <KpiCard
        label="Prizes Won"
        value={formatVolts(totalPrizesWon)}
        artSrc={OVERVIEW_KPI_ART.prizes}
        tone="orange"
        sparkId="prizes"
        weekDelta={weekDelta.prizes}
      />
    </section>
  );
}
