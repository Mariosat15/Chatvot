"use client";

import Image from "next/image";
import Link from "next/link";
import type {
  OverviewMission,
  OverviewStanding,
} from "@/lib/services/games/overview-standing.service";
import { NEON_PANEL, NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewProgressProps {
  globalRank: OverviewStanding["globalRank"];
  totalUsers: number;
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  progressPercent: number;
  title: string;
  missions: OverviewMission[];
}

function MissionCard({ mission }: { mission: OverviewMission }) {
  const pct =
    mission.target > 0
      ? Math.min(100, Math.round((mission.current / mission.target) * 100))
      : 0;
  return (
    <div className={`${NEON_PANEL} flex flex-col gap-2 p-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`${NEON_HEADING} truncate text-sm`}>{mission.name}</p>
          <p className="text-xs text-gray-500">+{mission.xp} XP</p>
        </div>
        <span className="text-lg" aria-hidden>
          {mission.icon}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-sky-400/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Global Rank badge (top-20 overlay or dash) + XP bar + up to two missions.
 */
export default function OverviewProgress({
  globalRank,
  totalUsers,
  level,
  currentXP,
  xpToNextLevel,
  progressPercent,
  title,
  missions,
}: OverviewProgressProps) {
  const xpPct = Math.min(100, Math.max(0, progressPercent));

  return (
    <section
      className="grid grid-cols-1 gap-3 lg:grid-cols-3"
      aria-label="Progress"
    >
      <div
        className={`${NEON_PANEL} flex flex-col items-center justify-center gap-2 p-5`}
      >
        <p className={NEON_LABEL}>Global rank</p>
        <div className="relative h-28 w-28">
          <Image
            src={globalRank.src}
            alt=""
            fill
            sizes="112px"
            className="object-contain"
          />
          {globalRank.overlay ? (
            <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-amber-200 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
              {globalRank.overlay}
            </span>
          ) : null}
        </div>
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

      <div className={`${NEON_PANEL} flex flex-col justify-center gap-3 p-5`}>
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <p className={NEON_LABEL}>Level</p>
            <p className={`${NEON_HEADING} text-2xl`}>
              {level}{" "}
              <span className="text-sm font-medium text-gray-400">{title}</span>
            </p>
          </div>
          <p className="text-xs text-gray-500">
            {currentXP.toLocaleString()} /{" "}
            {(currentXP + xpToNextLevel).toLocaleString()} XP
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className={`${NEON_LABEL} px-0.5`}>Missions</p>
        {missions.length === 0 ? (
          <div className={`${NEON_PANEL} p-4 text-sm text-gray-400`}>
            No open missions right now.{" "}
            <Link href="/journey" className="font-semibold text-sky-400">
              Open journey
            </Link>
          </div>
        ) : (
          missions.slice(0, 2).map((m) => <MissionCard key={m.id} mission={m} />)
        )}
      </div>
    </section>
  );
}
