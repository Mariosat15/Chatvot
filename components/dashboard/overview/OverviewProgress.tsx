"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Lock, Trophy } from "lucide-react";
import type {
  OverviewMission,
  OverviewStanding,
} from "@/lib/services/games/overview-types";
import {
  OVERVIEW_ICON_ART,
  OVERVIEW_KPI_ART,
} from "@/lib/services/games/overview-assets";
import {
  NEON_PANEL_LIT,
  NEON_HEADING,
  NEON_LABEL,
} from "@/components/neon/tokens";
import {
  OVERVIEW_ACTION_BUTTON,
  OVERVIEW_TEXT_LINK,
} from "@/components/dashboard/overview/overview-actions";

const JOURNEY_HREF = "/profile?tab=journey";
const LEADERBOARD_HREF = "/leaderboard";

/** Cap how many milestone squares we paint — matches the reference row. */
const MILESTONE_TILE_CAP = 12;

interface OverviewProgressProps {
  globalRank: OverviewStanding["globalRank"];
  totalUsers: number;
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  progressPercent: number;
  title: string;
  journeyMapName: string;
  journeyMilestonesDone: number;
  journeyMilestonesTotal: number;
  missions: OverviewMission[];
}

const MISSION_ICON_CYCLE = [
  OVERVIEW_ICON_ART.target,
  OVERVIEW_KPI_ART.credits,
  OVERVIEW_ICON_ART.trophy,
] as const;

const MISSION_ACCENT = [
  {
    border: "border-violet-400/45",
    glow: "shadow-[0_0_18px_-6px_rgba(167,139,250,0.45)]",
    iconRing: "border-violet-400/50 bg-violet-500/15 shadow-[0_0_14px_rgba(167,139,250,0.4)]",
  },
  {
    border: "border-cyan-400/45",
    glow: "shadow-[0_0_18px_-6px_rgba(34,211,238,0.45)]",
    iconRing: "border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_14px_rgba(34,211,238,0.4)]",
  },
  {
    border: "border-fuchsia-400/40",
    glow: "shadow-[0_0_18px_-6px_rgba(232,121,249,0.4)]",
    iconRing: "border-fuchsia-400/45 bg-fuchsia-500/10 shadow-[0_0_14px_rgba(232,121,249,0.35)]",
  },
] as const;

function MilestoneTiles({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.min(safeTotal, Math.max(0, done));
  const tileCount = Math.min(safeTotal, MILESTONE_TILE_CAP);

  if (tileCount <= 0) return null;

  return (
    <div aria-label={`${safeDone} of ${safeTotal} milestones completed`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className={`${NEON_LABEL} tracking-[0.14em] text-gray-300`}>
          Milestones
        </p>
        <p className="text-xs font-semibold text-amber-300/95">
          <span className="tabular-nums">{safeDone}</span> of{" "}
          <span className="tabular-nums">{safeTotal}</span> Completed
        </p>
      </div>
      <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-12">
        {Array.from({ length: tileCount }, (_, i) => {
          const n = i + 1;
          const isDone = i < safeDone;
          const isCurrent = i === safeDone && safeDone < safeTotal;
          const useTrophy = isDone && (n === 4 || n === 8 || n % 8 === 0);

          return (
            <li
              key={n}
              title={
                isDone
                  ? `Milestone ${n} complete`
                  : isCurrent
                    ? `Milestone ${n} — current`
                    : `Milestone ${n} locked`
              }
              className={`relative flex aspect-square items-center justify-center rounded-lg border bg-[#070E1C]/90 ${
                isCurrent
                  ? "border-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.65)] ring-1 ring-cyan-300/40"
                  : isDone
                    ? "border-amber-400/55 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                    : "border-white/10"
              }`}
            >
              {isDone || isCurrent ? (
                <span className="relative h-5 w-5 sm:h-6 sm:w-6">
                  <Image
                    src={useTrophy ? OVERVIEW_ICON_ART.trophyNeon : OVERVIEW_ICON_ART.star}
                    alt=""
                    fill
                    sizes="24px"
                    className="object-contain"
                  />
                </span>
              ) : (
                <Lock
                  className="h-3 w-3 text-gray-500 sm:h-3.5 sm:w-3.5"
                  aria-hidden
                />
              )}
              <span className="pointer-events-none absolute bottom-0.5 left-0 right-0 text-center text-[8px] font-semibold tabular-nums text-gray-500 sm:text-[9px]">
                {n}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MissionCard({
  mission,
  index,
}: {
  mission: OverviewMission;
  index: number;
}) {
  const pct =
    mission.target > 0
      ? Math.min(100, Math.round((mission.current / mission.target) * 100))
      : 0;
  const accent = MISSION_ACCENT[index % MISSION_ACCENT.length]!;
  const iconSrc = MISSION_ICON_CYCLE[index % MISSION_ICON_CYCLE.length]!;
  const done = pct >= 100;

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-xl border bg-[#070E1C]/85 p-3.5 ${accent.border} ${accent.glow}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={`relative flex h-11 w-11 shrink-0 overflow-hidden rounded-xl border ${accent.iconRing}`}
          >
            <Image
              src={iconSrc}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-100">
              {mission.name}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-400">
              {mission.description || "Journey milestone"}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
          +{mission.xp} XP
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/5">
          <div
            className={`h-full rounded-full ${
              done
                ? "bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_10px_rgba(251,191,36,0.65)]"
                : "bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-semibold tabular-nums text-gray-400">
          {mission.current} / {mission.target}
        </span>
      </div>
      <p
        className={`text-right text-[11px] font-semibold ${
          done ? "text-amber-200" : "text-gray-400"
        }`}
      >
        {pct}% Complete
      </p>

      {mission.requiredBadges.length > 0 && (
        <div className="mt-0.5 rounded-lg border border-violet-400/25 bg-[#0A1224]/90 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            Required badge
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="relative flex h-7 w-7 shrink-0 overflow-hidden rounded-full border border-amber-400/40 bg-amber-500/10">
              <Image
                src={OVERVIEW_ICON_ART.trophy}
                alt=""
                fill
                sizes="28px"
                className="object-cover"
              />
            </span>
            <p className="min-w-0 text-[11px] leading-snug text-gray-200">
              {mission.requiredBadges.join(" · ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Player Progress — desktop Overview panel matching the owner reference:
 * rank crest | level bar + milestone tiles + three active missions (2+1).
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
  journeyMilestonesDone,
  journeyMilestonesTotal,
  missions,
}: OverviewProgressProps) {
  // Reason: progressPercent can arrive as a long float from XP math — never
  // paint that raw into the UI (owner screenshot showed 78.692…%).
  const xpPct = Math.min(100, Math.max(0, Math.round(progressPercent)));
  const xpCap = currentXP + xpToNextLevel;

  return (
    <section
      className={`${NEON_PANEL_LIT} relative flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5`}
      aria-label="Player progress"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="relative mt-0.5 flex h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-amber-400/40 bg-transparent shadow-[0_0_14px_rgba(251,191,36,0.4)]">
            <Image
              src={OVERVIEW_ICON_ART.games}
              alt=""
              fill
              sizes="44px"
              // Reason: games plate is a black-canvas export — no fill behind it.
              className="object-contain"
            />
          </span>
          <div>
            <h2 className={`${NEON_HEADING} text-sm tracking-[0.16em] text-white`}>
              Player Progress
            </h2>
            <p className="mt-0.5 text-xs text-sky-300/80">
              {journeyMapName
                ? `Next on ${journeyMapName}`
                : "Complete missions, earn XP and unlock new rewards."}
            </p>
          </div>
        </div>
        <Link href={JOURNEY_HREF} className={OVERVIEW_TEXT_LINK}>
          View All Missions
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-[minmax(0,200px)_1fr] sm:items-start lg:grid-cols-[minmax(0,220px)_1fr]">
        {/* Left — Global Rank */}
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-cyan-400/20 bg-[#070E1C]/60 px-3 py-4">
          <div className="relative aspect-square w-full max-w-[200px]">
            <Image
              src={globalRank.src}
              alt={
                globalRank.inTopN
                  ? `Global rank #${globalRank.rank}`
                  : "Unranked"
              }
              fill
              sizes="200px"
              className="object-contain drop-shadow-[0_0_28px_rgba(251,191,36,0.45)]"
              priority
            />
          </div>
          <p className={`${NEON_LABEL} text-gray-400`}>Global Rank</p>
          <p className="text-center text-base font-bold text-white sm:text-lg">
            {globalRank.inTopN
              ? `Top ${globalRank.rank} of ${totalUsers.toLocaleString() || "—"}`
              : globalRank.rank > 0
                ? `#${globalRank.rank} · outside top 20`
                : "Unranked on the Global board"}
          </p>
          <Link
            href={LEADERBOARD_HREF}
            // Reason: owner, 5 Oct 2026 - same sharp cyan CTA as Challenge /
            // Matching Cards / Join; no PNG bloom or drop-shadow blur.
            className={`${OVERVIEW_ACTION_BUTTON} mt-1 max-w-[220px]`}
            aria-label="View Leaderboard"
          >
            <Trophy className="h-4 w-4 shrink-0" aria-hidden />
            View Leaderboard
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </Link>
        </div>

        {/* Right — level, milestones, missions */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                Lv. {level}{" "}
                <span className="font-medium text-cyan-300">{title}</span>
              </p>
              <p className="text-xs tabular-nums text-gray-400">
                {currentXP.toLocaleString()} / {xpCap.toLocaleString()} XP
              </p>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-white/5 ring-1 ring-cyan-400/25">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.55)]"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] text-gray-500">
              {xpPct}% Complete
            </p>
          </div>

          {journeyMilestonesTotal > 0 && (
            <MilestoneTiles
              done={journeyMilestonesDone}
              total={journeyMilestonesTotal}
            />
          )}

          <div>
            <p className={`${NEON_LABEL} mb-2.5 tracking-[0.14em] text-gray-300`}>
              Active Missions
            </p>
            {missions.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {missions.map((mission, index) => (
                  <div
                    key={mission.id}
                    className={
                      // Reason: reference is 2+1 — third mission spans full width.
                      index === 2 ? "sm:col-span-2" : undefined
                    }
                  >
                    <MissionCard mission={mission} index={index} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[#1B2540] bg-[#070E1C]/70 p-4 text-sm text-gray-400">
                No open missions right now.{" "}
                <Link href={JOURNEY_HREF} className="font-semibold text-sky-400">
                  Open journey
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
