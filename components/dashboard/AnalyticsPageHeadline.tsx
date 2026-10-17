"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared dashboard page title: LEAD word in white, ACCENT word in the page colour.
 *
 * Reason: owner 6 Oct 2026 — Performance Analytics set the type (uppercase, heavy,
 * two-tone). Other analytics pages reuse this so a new tab cannot invent its own
 * heading. Colour is the only thing that changes per page.
 */
export type HeadlineAccent = "magenta" | "cyan" | "gold" | "orange" | "purple";

const ACCENT_HEX = new Map<HeadlineAccent, string>([
  ["magenta", "#ff36ca"],
  ["cyan", "#00d9ff"],
  ["gold", "#ffc51b"],
  ["orange", "#ff7b17"],
  ["purple", "#9d39ff"],
]);

export function AnalyticsPageHeadline({
  lead,
  accentWord,
  accent,
  subtitle,
  icon,
  compact = false,
  tag = "h2",
}: {
  lead: string;
  accentWord: string;
  accent: HeadlineAccent;
  subtitle?: string;
  icon?: ReactNode;
  compact?: boolean;
  /** Competitions / Challenges are the page title; dashboard tabs sit under a nav. */
  tag?: "h1" | "h2";
}) {
  const hex = ACCENT_HEX.get(accent) ?? "#00d9ff";
  const Title = tag;
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      {icon}
      <div className="min-w-0">
        <Title
          className={cn(
            "font-black uppercase leading-none tracking-tight text-[#f5f8ff]",
            compact ? "text-[22px] sm:text-[26px]" : "text-[28px] sm:text-[34px] lg:text-[40px]",
          )}
        >
          <span>{lead} </span>
          <span
            style={{
              color: hex,
              textShadow: `0 0 18px ${hex}99, 0 0 36px ${hex}40`,
            }}
          >
            {accentWord}
          </span>
        </Title>
        {subtitle ? (
          <p className="mt-1.5 text-xs leading-snug text-[#8ea4c5] sm:text-sm">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
