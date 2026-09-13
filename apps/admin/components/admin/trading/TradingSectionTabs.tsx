"use client";

import {
  Calendar,
  Database,
  Gauge,
  History,
  HeartPulse,
  LineChart,
  TrendingUp,
} from "lucide-react";
import { TRADING_SECTION_TABS } from "@/lib/admin/game-sections";

const TAB_ICONS: Record<string, React.ReactNode> = {
  symbols: <TrendingUp className="h-4 w-4" />,
  market: <Calendar className="h-4 w-4" />,
  "market-data": <Database className="h-4 w-4" />,
  "trading-risk": <Gauge className="h-4 w-4" />,
  "price-health": <HeartPulse className="h-4 w-4" />,
  "trading-history": <History className="h-4 w-4" />,
};

interface TradingSectionTabsProps {
  activeSection: string;
  onSelect: (sectionId: string) => void;
  /** Same per-section permission check the sidebar uses.
   *  Reason: collapsing six sidebar entries into one destination must not widen
   *  access — a tab is only offered if the employee holds that section grant. */
  hasAccess: (sectionId: string) => boolean;
}

/**
 * Tab strip shown above every trading screen.
 *
 * Each tab is an existing admin section id, so `?activeTab=<id>` still deep
 * links straight to it and every bookmark keeps working.
 */
export default function TradingSectionTabs({
  activeSection,
  onSelect,
  hasAccess,
}: TradingSectionTabsProps) {
  const visibleTabs = TRADING_SECTION_TABS.filter((tab) => hasAccess(tab.id));

  // Reason: a single reachable screen needs no switcher, and an employee granted
  // one trading section should not learn the names of the five they cannot open.
  if (visibleTabs.length < 2) return null;

  return (
    <div className="mb-6 rounded-2xl border border-gray-700/50 bg-gray-900/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4">
        <LineChart className="h-4 w-4 text-orange-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Trading
        </span>
      </div>
      <div className="mt-3 flex flex-wrap border-b border-gray-700">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={activeSection === tab.id ? "page" : undefined}
            className={`px-5 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeSection === tab.id
                ? "text-orange-400 border-b-2 border-orange-400 bg-orange-500/10"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {TAB_ICONS[tab.id]}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
