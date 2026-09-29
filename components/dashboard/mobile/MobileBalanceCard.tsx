"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatVolts } from "@/lib/utils/format-volts";
import { MOBILE_OVERVIEW_ART } from "@/lib/services/games/overview-assets";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";
import { useDashboardOverview, useOverviewLive } from "@/hooks/useDashboardOverview";
import { MOBILE_CARD } from "./MobileSection";

/** Build an SVG polyline from the wallet history; null when there is nothing to draw. */
function sparkPoints(values: number[]): string | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  return finite
    .map((v, i) => {
      const x = (i / (finite.length - 1)) * 100;
      const y = 36 - ((v - min) / span) * 32;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Wallet / Volts card — the first thing a phone shows (spec s7).
 *
 * Balance polls the same light `/api/dashboard/overview-live` endpoint as the
 * desktop KPI row, but only while the mobile tree is the visible one.
 */
export default function MobileBalanceCard() {
  const { data } = useDashboardOverview();
  const liveEnabled = useOverviewLive("mobile");
  const initial = data.overview.creditBalance;
  const [balance, setBalance] = useState(initial);

  useEffect(() => setBalance(initial), [initial]);

  useEffect(() => {
    if (!liveEnabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (document.visibilityState !== "hidden") {
        try {
          const res = await fetch("/api/dashboard/overview-live", {
            cache: "no-store",
          });
          if (res.ok) {
            const body = (await res.json()) as { creditBalance?: number };
            if (!cancelled && typeof body.creditBalance === "number") {
              setBalance(body.creditBalance);
            }
          }
        } catch {
          // Keep the last good balance.
        }
      }
      if (!cancelled) {
        timer = setTimeout(poll, PERFORMANCE_INTERVALS.DASHBOARD_REFRESH);
      }
    };
    timer = setTimeout(poll, PERFORMANCE_INTERVALS.DASHBOARD_REFRESH);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [liveEnabled]);

  const history = data.charts.walletBalanceHistory;
  const points = useMemo(
    () => sparkPoints(history.map((h) => h.balance)),
    [history],
  );
  const weekDelta = data.overviewStanding.kpiWeekDelta.credits;
  const today = history.slice(-1)[0]?.change ?? null;

  return (
    <Link
      href="/wallet"
      className={`${MOBILE_CARD} relative flex min-h-[118px] items-center gap-3 overflow-hidden border-amber-400/60 p-4 shadow-[0_0_20px_-8px_rgba(251,191,36,0.55)]`}
      aria-label="Open wallet"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">
          <Image
            src={MOBILE_OVERVIEW_ART.volt}
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] object-contain"
          />
          Wallet / Volts
        </p>
        <p className="mt-1 truncate text-[28px] font-bold leading-tight tabular-nums text-white">
          {formatVolts(balance)}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums">
          {weekDelta != null && Number.isFinite(weekDelta) ? (
            <span className={weekDelta >= 0 ? "text-emerald-300" : "text-rose-300"}>
              {weekDelta >= 0 ? "+" : ""}
              {weekDelta.toFixed(1)}% this week
            </span>
          ) : (
            <span className="text-gray-500">- this week</span>
          )}
          {typeof today === "number" && today !== 0 && (
            <span className={today >= 0 ? "text-emerald-300/80" : "text-rose-300/80"}>
              {today >= 0 ? "+" : ""}
              {formatVolts(today)} today
            </span>
          )}
        </p>
      </div>

      <div className="relative h-16 w-24 shrink-0" aria-hidden>
        {points ? (
          <svg viewBox="0 0 100 40" className="h-full w-full" preserveAspectRatio="none">
            <polyline
              points={points}
              fill="none"
              stroke="#FBBF24"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <Image
            src={MOBILE_OVERVIEW_ART.walletChart}
            alt=""
            fill
            sizes="96px"
            className="object-contain opacity-80"
          />
        )}
      </div>
    </Link>
  );
}
