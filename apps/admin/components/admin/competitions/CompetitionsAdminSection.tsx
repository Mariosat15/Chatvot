"use client";

import { useState } from "react";
import { Settings, Trophy } from "lucide-react";

import CompetitionsListSection from "@/components/admin/CompetitionsListSection";
import GameMasterCompetitionDefaultsSection from "@/components/admin/gamemaster/GameMasterCompetitionDefaultsSection";

type Tab = "list" | "settings";

interface CompetitionsAdminSectionProps {
  /** Granted by `competitions`; the list route refuses without it. */
  canViewList: boolean;
  /** Granted by `gm-competition-defaults`; the defaults route refuses without it. */
  canEditSettings: boolean;
  initialTab?: Tab;
}

const TAB_CLASS =
  "flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors";
const ACTIVE = "text-orange-400 border-b-2 border-orange-400 bg-orange-500/10";
const IDLE = "text-gray-400 hover:text-gray-200";

/**
 * The Competitions destination: the competitions list plus a Settings tab, the same shape as
 * 1v1 Challenges. Each tab is shown only to an employee holding its own section grant, so
 * folding the defaults screen in here widens nobody's access.
 */
export default function CompetitionsAdminSection({
  canViewList,
  canEditSettings,
  initialTab = "list",
}: CompetitionsAdminSectionProps) {
  const fallback: Tab = canViewList ? "list" : "settings";
  const [requested, setActiveTab] = useState<Tab>(initialTab);
  // Reason: a tab the employee cannot open would render a screen whose route refuses them.
  const activeTab =
    (requested === "list" && canViewList) || (requested === "settings" && canEditSettings)
      ? requested
      : fallback;

  return (
    <div className="space-y-6">
      {canViewList && canEditSettings && (
        <div className="flex border-b border-gray-700 rounded-t-xl bg-gray-900/40">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`${TAB_CLASS} ${activeTab === "list" ? ACTIVE : IDLE}`}
          >
            <Trophy className="h-4 w-4" />
            All Competitions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`${TAB_CLASS} ${activeTab === "settings" ? ACTIVE : IDLE}`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      )}

      {activeTab === "list" && <CompetitionsListSection />}
      {activeTab === "settings" && <GameMasterCompetitionDefaultsSection />}
    </div>
  );
}
