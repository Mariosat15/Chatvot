"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Crown } from "lucide-react";
import GameMasterManagementSection from "./GameMasterManagementSection";
import GmReferredPlayersReport from "./gamemaster/GmReferredPlayersReport";
import { GM_TAB_PARAM, resolveGmTab, type GmTab } from "@/lib/admin/gm-report-query";

const TABS: ReadonlyArray<{ id: GmTab; label: string }> = [
  { id: "players", label: "Referred players" },
  { id: "masters", label: "Game Masters" },
];

/**
 * The admin Game Master area (`External game plans/24` s7 + Part 2 redesign): shared chrome
 * (title, live clock, Add), then the referred-players report and the Game Master list.
 *
 * Reason: a wrapper rather than a sixth tab inside `GameMasterManagementSection`, which is
 * already over 700 lines. The tab is in the URL (`gmTab`), and `gmId` - the deep link from a
 * player's detail panel into one Game Master - always opens the masters tab, so that link
 * keeps working. Leaving the masters tab drops `gmId`, or the detail view would reopen.
 *
 * Default tab is **Referred players** (the Part 2 screen). `gmId` still forces masters.
 */
export default function GameMasterProgramSection({
  initialGmId,
  canExport,
}: {
  initialGmId?: string;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = resolveGmTab(searchParams);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const select = (next: GmTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(GM_TAB_PARAM, next);
    if (next !== "masters") params.delete("gmId");
    // Reason: the dashboard keeps one query string for every section; preserve activeTab.
    if (!params.get("activeTab")) params.set("activeTab", "gamemaster-management");
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  const clockLabel = now.toLocaleTimeString(undefined, { hour12: false });
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Manage Game Masters</h2>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Track referred players, monitor performance and manage affiliations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            LIVE
          </span>
          <span className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 font-mono text-xs tabular-nums text-gray-300">
            {clockLabel} · {dateLabel}
          </span>
          <button
            type="button"
            onClick={() => select("masters")}
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-gray-950 hover:bg-orange-400"
            title="Open the Game Masters list to manage subscriptions"
          >
            <Plus className="h-4 w-4" />
            Add Game Master
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-700" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === id
                ? "border-amber-500 text-amber-300"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => select(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "masters" ? (
        <GameMasterManagementSection initialGmId={initialGmId} canExport={canExport} />
      ) : (
        <GmReferredPlayersReport canExport={canExport} />
      )}
    </div>
  );
}
