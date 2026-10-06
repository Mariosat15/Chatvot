"use client";

import Image from "next/image";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERF, type PerfAccent } from "./performance-assets";

const ACCENT_HEX = new Map<PerfAccent, string>([
  ["cyan", PERF.cyan],
  ["blue", PERF.blue],
  ["purple", PERF.purple],
  ["magenta", PERF.magenta],
  ["gold", PERF.gold],
  ["orange", PERF.orange],
  ["green", PERF.green],
  ["red", PERF.red],
]);

export function accentHex(accent: PerfAccent): string {
  return ACCENT_HEX.get(accent) ?? PERF.cyan;
}

/** Neon WebP identity. Never redrawn in CSS. */
export function NeonIcon({
  src,
  size = 40,
  className,
}: {
  src: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** The one glass card used by every Performance panel. */
export function PerfCard({
  accent = "cyan",
  className,
  children,
}: {
  accent?: PerfAccent;
  className?: string;
  children: React.ReactNode;
}) {
  const hex = accentHex(accent);
  return (
    <div
      className={cn("relative overflow-hidden rounded-[14px] border", className)}
      style={{
        background:
          "linear-gradient(135deg, rgba(6,20,45,.97), rgba(3,12,30,.96))",
        borderColor: `${hex}59`,
        boxShadow: `0 0 18px ${hex}14, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {children}
    </div>
  );
}

/** Section wrapper: neon icon, title, subtitle, optional controls. */
export function PerfSection({
  title,
  subtitle,
  icon,
  controls,
  children,
  className,
  testId,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn("min-w-0", className)} data-perf-section={testId}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <NeonIcon src={icon} size={34} />
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight text-[#f5f8ff] sm:text-base">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[11px] leading-snug text-[#8ea4c5] sm:text-xs">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {controls}
      </div>
      {children}
    </section>
  );
}

/** Section-level empty / quiet state. */
export function PerfEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[96px] items-center justify-center rounded-[14px] border border-dashed border-cyan-400/20 bg-[#041025]/70 px-4 py-6 text-center text-xs text-[#8ea4c5]">
      {children}
    </div>
  );
}

/**
 * Period-over-period change. Green up, red down, grey "— 0%".
 * `null` renders nothing — no comparison exists (all-time range, or no prior data).
 */
export function TrendDelta({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return null;
  if (Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500">
        <Minus className="h-3 w-3" aria-hidden /> 0%
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold",
        up ? "text-[#00e6a3]" : "text-[#ff4b67]",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)}%
    </span>
  );
}

/** Thin progress bar for the summary panels. */
export function PerfBar({
  value,
  accent,
}: {
  /** 0..100, or null for no data. */
  value: number | null;
  accent: PerfAccent;
}) {
  const hex = accentHex(accent);
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${hex}99, ${hex})`,
          boxShadow: `0 0 8px ${hex}80`,
        }}
      />
    </div>
  );
}
