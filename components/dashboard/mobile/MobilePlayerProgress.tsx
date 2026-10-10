"use client";

import Image from "next/image";
import Link from "next/link";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { OVERVIEW_ICON_ART } from "@/lib/services/games/overview-assets";
import MobileSection, { MOBILE_CARD } from "./MobileSection";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * One strong Player Progress card (spec s10): rank badge, level, a full-width
 * XP bar, the milestone count and the first active mission. Everything else
 * lives behind "View Progress".
 */
export default function MobilePlayerProgress() {
  const { data } = useDashboardOverview();
  const { player, overviewStanding } = data;
  const { globalRank, totalUsers, missions } = overviewStanding;
  const percent = clampPercent(player.progressPercent);
  const xpGoal = player.currentXP + Math.max(0, player.xpToNextLevel);
  const mission = missions[0];
  const missionPct =
    mission && mission.target > 0
      ? clampPercent((mission.current / mission.target) * 100)
      : 0;
  const milestonesTotal = overviewStanding.journeyMilestonesTotal;

  return (
    <MobileSection
      title="Player progress"
      href="/dashboard?tab=performance"
      linkLabel="View progress"
      iconSrc={OVERVIEW_ICON_ART.games}
    >
      <div className={`${MOBILE_CARD} border-cyan-400/40 p-4`}>
        <div className="flex items-center gap-4">
          <span className="relative h-[92px] w-[92px] shrink-0 drop-shadow-[0_0_14px_rgba(251,191,36,0.45)]">
            <Image
              src={globalRank.src}
              alt={globalRank.inTopN ? `Global rank #${globalRank.rank}` : "Global rank"}
              fill
              sizes="92px"
              className="object-contain"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold text-white">Level {player.level}</p>
            {player.title && (
              <p className="truncate text-xs font-semibold text-amber-200/90">
                {player.title}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">
              {globalRank.inTopN
                ? `Top ${globalRank.rank} of ${totalUsers.toLocaleString()}`
                : globalRank.rank > 0
                  ? `Global #${globalRank.rank}`
                  : "Unranked"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-300">Progress</span>
            <span className="font-bold tabular-nums text-cyan-300">
              {Math.round(percent)}%
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-[#0A1528]"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] tabular-nums text-gray-400">
            {player.currentXP.toLocaleString()} / {xpGoal.toLocaleString()} XP
          </p>
        </div>

        {milestonesTotal > 0 && (
          <p className="mt-3 text-xs text-amber-300/95">
            <span className="tabular-nums">
              {overviewStanding.journeyMilestonesDone}
            </span>{" "}
            of <span className="tabular-nums">{milestonesTotal}</span> milestones
            completed
          </p>
        )}

        {mission && (
          <Link
            href="/profile?tab=journey"
            className="mt-3 flex min-h-[56px] items-center gap-3 rounded-xl border border-violet-400/35 bg-violet-500/10 px-3 py-2"
          >
            <span className="relative h-9 w-9 shrink-0">
              <Image
                src={OVERVIEW_ICON_ART.target}
                alt=""
                fill
                sizes="36px"
                className="object-contain"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">
                {mission.name}
              </span>
              <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[#0A1528]">
                <span
                  className="block h-full rounded-full bg-violet-400"
                  style={{ width: `${missionPct}%` }}
                />
              </span>
            </span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-violet-200">
              {mission.current}/{mission.target}
            </span>
          </Link>
        )}
      </div>
    </MobileSection>
  );
}
