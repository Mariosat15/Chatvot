"use client";

import Image from "next/image";
import Link from "next/link";
import { BarChart3, ChevronRight, Target, Trophy } from "lucide-react";
import type {
  OverviewMission,
  OverviewStanding,
} from "@/lib/services/games/overview-types";
import {
  NEON_PANEL_LIT,
  NEON_HEADING,
  NEON_LABEL,
} from "@/components/neon/tokens";

const JOURNEY_HREF = "/profile?tab=journey";

interface OverviewProgressProps {
  globalRank: OverviewStanding["globalRank"];
  totalUsers: number;
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  progressPercent: number;
  title: string;
  journeyMapName: string;
  missions: OverviewMission[];
}

function MissionCard({
  mission,
  mapName,
}: {
  mission: OverviewMission;
  mapName: string;
}) {
  const pct =
    mission.target > 0
      ? Math.min(100, Math.round((mission.current / mission.target) * 100))
      : 0;
  const Icon = mission.name.toLowerCase().includes("win") ? Trophy : Target;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-cyan-400/25 bg-[#070E1C]/80 p-3.5 shadow-[0_0_18px_-8px_rgba(34,211,238,0.35)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/35 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(167,139,250,0.35)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-100">
              {mission.name}
            </p>
            <p className="truncate text-xs text-gray-500">
              {mission.description || (mapName ? `On ${mapName}` : "Journey milestone")}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
          +{mission.xp} XP
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.55)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-semibold text-gray-400">
          {mission.current} / {mission.target}
        </span>
      </div>
    </div>
  );
}

/**
 * Player Progress panel: Global Rank + XP + next journey milestones (max 4).
 */
export default function OverviewProgress({
  globalRank,
  totalUsers,
  level,
  currentXP,
  xpToNextLevel,
  progressPercent,
  title,
  journeyMapName,
  missions,
}: OverviewProgressProps) {
  const xpPct = Math.min(100, Math.max(0, progressPercent));
  const xpCap = currentXP + xpToNextLevel;

  return (
    <section
      className={`${NEON_PANEL_LIT} relative flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5`}
      aria-label="Player progress"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/40 bg-sky-500/15 text-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.4)]">
            <BarChart3 className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className={`${NEON_HEADING} text-sm tracking-[0.16em] text-white`}>
              Player Progress
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {journeyMapName
                ? `Next on ${journeyMapName}`
                : "Complete missions, earn XP and unlock new rewards."}
            </p>
          </div>
        </div>
        <Link
          href={JOURNEY_HREF}
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200"
        >
          View All Missions
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-start lg:grid-cols-[minmax(0,220px)_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className="relative aspect-square w-full max-w-[220px]">
            <Image
              src={globalRank.src}
              alt={
                globalRank.inTopN
                  ? `Global rank #${globalRank.rank}`
                  : "Unranked"
              }
              fill
              sizes="220px"
              className="object-contain drop-shadow-[0_0_28px_rgba(251,191,36,0.45)]"
              priority
            />
          </div>
          <p className={`${NEON_LABEL} text-amber-200/90`}>Global Rank</p>
          <p className="text-center text-xs text-gray-400">
            {globalRank.inTopN
              ? `Top ${globalRank.rank} of ${totalUsers.toLocaleString() || "—"}`
              : globalRank.rank > 0
                ? `#${globalRank.rank} · outside top 20`
                : "Unranked on the Global board"}
          </p>
          <Link
            href="/leaderboard"
            className="text-xs font-semibold text-sky-400 hover:text-sky-300"
          >
            View board
          </Link>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-cyan-100">
                Lv. {level}{" "}
                <span className="font-medium text-gray-400">{title}</span>
              </p>
              <p className="text-xs text-gray-400">
                {currentXP.toLocaleString()} / {xpCap.toLocaleString()} XP
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/5 ring-1 ring-cyan-400/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.55)]"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] text-gray-500">
              {xpPct}% Complete
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {missions.length === 0 ? (
              <div className="col-span-full rounded-xl border border-[#1B2540] bg-[#070E1C]/70 p-4 text-sm text-gray-400">
                No open missions right now.{" "}
                <Link href={JOURNEY_HREF} className="font-semibold text-sky-400">
                  Open journey
                </Link>
              </div>
            ) : (
              missions.map((m) => (
                <MissionCard key={m.id} mission={m} mapName={journeyMapName} />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
