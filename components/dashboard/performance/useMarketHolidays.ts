"use client";

import { useCallback, useEffect, useState } from "react";

export interface MarketHoliday {
  id: string;
  name: string;
  date: string;
  type: "automatic" | "manual";
  affectedAssets?: string[];
  exchange?: string;
  status?: string;
  isRecurring?: boolean;
  daysUntil?: number;
}

export type HolidayWindow = "30d" | "90d" | "all";

export interface MarketHolidaysState {
  holidays: MarketHoliday[];
  live: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetched once by the shell and handed to both layout trees, so the desktop and
 * mobile copies of the section do not each call the API.
 */
export function useMarketHolidays(): MarketHolidaysState {
  const [holidays, setHolidays] = useState<MarketHoliday[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trading/market-holidays");
      if (!res.ok) {
        setError("Failed to load holidays");
        return;
      }
      const body = (await res.json()) as { holidays?: MarketHoliday[]; mode?: string };
      setHolidays(Array.isArray(body.holidays) ? body.holidays : []);
      setLive(body.mode === "automatic");
      setError(null);
    } catch (err) {
      console.error("❌ Error fetching market holidays:", err);
      setError("Unable to load market holidays");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { holidays, live, loading, error, refresh: () => void refresh() };
}

/** Upcoming holidays inside the chosen look-ahead window, soonest first. */
export function upcomingHolidays(
  holidays: MarketHoliday[],
  window: HolidayWindow,
): MarketHoliday[] {
  const limit = window === "30d" ? 30 : window === "90d" ? 90 : Number.POSITIVE_INFINITY;
  return holidays
    .filter((h) => typeof h.daysUntil === "number" && h.daysUntil >= 0 && h.daysUntil <= limit)
    .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
}
