"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Package, TrendingUp } from "lucide-react";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import type { OverviewActivityItem } from "@/lib/services/games/overview-types";
import { OVERVIEW_ICON_ART } from "@/lib/services/games/overview-assets";
import { TILES, streakValue } from "@/components/dashboard/overview/OverviewStreaks";
import MobileSection, { MOBILE_CARD } from "./MobileSection";

/** Spec s15: 3-4 rows on a phone, not the desktop's full rail. */
const MOBILE_ACTIVITY_LIMIT = 4;

function relativeTime(iso: string, now: number | null): string {
  const t = Date.parse(iso);
  if (now == null || !Number.isFinite(t)) return "";
  const mins = Math.floor((now - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ActivityIcon({ kind }: { kind: OverviewActivityItem["kind"] }) {
  if (kind === "contest") {
    return (
      <span className="relative h-10 w-10 shrink-0">
        <Image src={OVERVIEW_ICON_ART.trophyGlass} alt="" fill sizes="40px" className="object-contain" />
      </span>
    );
  }
  const Icon = kind === "trade" ? TrendingUp : Package;
  const tone =
    kind === "trade"
      ? "border-orange-400/40 bg-orange-500/15 text-orange-300"
      : "border-sky-400/40 bg-sky-500/15 text-sky-300";
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

export function MobileRecentActivity() {
  const { data } = useDashboardOverview();
  const items = data.overviewStanding.recentActivity.slice(0, MOBILE_ACTIVITY_LIMIT);
  // Reason: relative times depend on the clock — resolve after hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  return (
    <MobileSection title="Recent activity" href="/dashboard?tab=contests">
      {items.length === 0 ? (
        <div className={`${MOBILE_CARD} p-4 text-sm text-gray-400`}>
          Nothing yet — join a contest and it will show up here.
        </div>
      ) : (
        <ul className={`${MOBILE_CARD} divide-y divide-cyan-400/10 px-3`}>
          {items.map((item) => (
            <li key={item.id} className="flex min-h-[60px] items-center gap-3 py-2">
              <ActivityIcon kind={item.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-100">{item.title}</p>
                <p className="truncate text-[11px] text-gray-400">{item.detail}</p>
              </div>
              {item.at && (
                <span className="shrink-0 text-[10px] text-gray-500">
                  {relativeTime(item.at, now)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </MobileSection>
  );
}

/** Streaks as a 2-column grid of the six desktop tiles (spec s16). */
export function MobileStreakGrid() {
  const { data } = useDashboardOverview();
  const streaks = data.overviewStanding.streaks;

  return (
    <MobileSection title="Streaks">
      <ul className="grid grid-cols-2 gap-2.5">
        {TILES.map((tile) => {
          const value = streakValue(streaks, tile.key);
          const active = tile.activeWhen(value);
          return (
            <li
              key={tile.key}
              className={`${MOBILE_CARD} flex min-h-[72px] items-center gap-2.5 p-3 ${tile.border} ${
                active ? "" : "opacity-60"
              }`}
            >
              <span className="relative h-10 w-10 shrink-0">
                <Image src={tile.artSrc} alt="" fill sizes="40px" className="object-contain" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold tabular-nums" style={{ color: tile.color }}>
                  {tile.format ? tile.format(value) : value}
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {tile.label}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </MobileSection>
  );
}
