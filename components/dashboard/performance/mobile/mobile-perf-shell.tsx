"use client";

import { cn } from "@/lib/utils";
import { NeonIcon, accentHex } from "../PerformanceChrome";
import { type PerfAccent } from "../performance-assets";
import type { PerfRange } from "../performance-model";

export function perfRangeLabel(range: PerfRange): string {
  if (range === "all") return "All time";
  if (range === "7d") return "Last 7 days";
  if (range === "90d") return "Last 90 days";
  return "Last 30 days";
}

/** Quiet glass plate — glow only on the active / highlighted pieces. */
export function MobilePerfPlate({
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
      className={cn("overflow-hidden rounded-[18px] border p-4", className)}
      style={{
        background: "linear-gradient(135deg, rgba(5,17,41,.97), rgba(3,8,22,.98))",
        borderColor: `${hex}40`,
      }}
    >
      {children}
    </div>
  );
}

export function MobilePerfHeading({
  title,
  subtitle,
  icon,
  controls,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  controls?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <NeonIcon src={icon} size={28} />
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold tracking-tight text-[#f5f8ff]">{title}</h2>
          {subtitle ? <p className="text-[11px] leading-snug text-[#8ea4c5]">{subtitle}</p> : null}
        </div>
      </div>
      {controls}
    </div>
  );
}