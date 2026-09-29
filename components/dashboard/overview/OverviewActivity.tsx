"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Package, TrendingUp } from "lucide-react";
import type { OverviewActivityItem } from "@/lib/services/games/overview-types";
import { OVERVIEW_ICON_ART } from "@/lib/services/games/overview-assets";
import { NEON_PANEL_LIT, NEON_HEADING } from "@/components/neon/tokens";

interface OverviewActivityProps {
  items: OverviewActivityItem[];
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function ActivityIcon({ kind }: { kind: OverviewActivityItem["kind"] }) {
  if (kind === "contest") {
    return (
      <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-[10px] drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]">
        <Image
          src={OVERVIEW_ICON_ART.trophyGlass}
          alt=""
          fill
          sizes="40px"
          className="object-contain"
        />
      </span>
    );
  }
  if (kind === "trade") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-400/40 bg-orange-500/15 text-orange-300 shadow-[0_0_12px_rgba(251,146,60,0.35)]">
        <TrendingUp className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-400/40 bg-sky-500/15 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.35)]">
      <Package className="h-4 w-4" aria-hidden />
    </span>
  );
}

/**
 * Recent Activity rail. Header uses the owner calendar glass tile (transparent
 * black keyed out). Contest rows use the neon trophy glass plate.
 */
export default function OverviewActivity({ items }: OverviewActivityProps) {
  return (
    <section
      className={`${NEON_PANEL_LIT} flex h-full min-h-0 flex-col p-4 sm:p-5`}
      aria-labelledby="activity-heading"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Reason: tile already paints its own neon frame — no black fill behind it. */}
          <span className="relative flex h-14 w-14 shrink-0 drop-shadow-[0_0_16px_rgba(56,189,248,0.6)]">
            <Image
              src={OVERVIEW_ICON_ART.activity}
              alt=""
              fill
              sizes="56px"
              className="object-contain"
            />
          </span>
          <h2
            id="activity-heading"
            className={`${NEON_HEADING} text-sm tracking-[0.14em] text-white`}
          >
            Recent Activity
          </h2>
        </div>
        <Link
          href="/dashboard?tab=contests"
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200"
        >
          View All
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">
          Finish a contest and your results will land here.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-[#070E1C]/75 px-3 py-2.5 shadow-[0_0_14px_-8px_rgba(34,211,238,0.4)] transition hover:border-cyan-400/40"
            >
              <ActivityIcon kind={item.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-100">
                  {item.title}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {item.detail}
                  {item.at ? ` · ${relativeTime(item.at)}` : ""}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-gray-600"
                aria-hidden
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
