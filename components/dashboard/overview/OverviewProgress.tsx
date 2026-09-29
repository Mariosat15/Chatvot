"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type {
  OverviewMission,
  OverviewRecentBadge,
  OverviewStanding,
} from "@/lib/services/games/overview-types";
import {
  OVERVIEW_RECENT_BADGE_LIMIT,
} from "@/lib/services/games/overview-types";
import { OVERVIEW_ICON_ART } from "@/lib/services/games/overview-assets";
import { GameIcon } from "@/components/ui/GameIcon";
import {
  isValidGameIconName,
  type GameIconName,
} from "@/lib/constants/game-icons";
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
  journeyMilestonesDone: number;
  journeyMilestonesTotal: number;
  missions: OverviewMission[];
  /** Up to 6 most recently earned badges — newest replaces oldest in the strip. */
  recentBadges: OverviewRecentBadge[];
}

function rarityRing(rarity: string): string {
  switch (rarity) {
    case "legendary":
      return "border-amber-400/60 shadow-[0_0_10px_rgba(251,191,36,0.45)]";
    case "epic":
      return "border-fuchsia-400/50 shadow-[0_0_8px_rgba(232,121,249,0.35)]";
    case "rare":
      return "border-sky-400/50 shadow-[0_0_8px_rgba(56,189,248,0.35)]";
    default:
      return "border-white/15";
  }
}

function RecentBadgesStrip({ badges }: { badges: OverviewRecentBadge[] }) {
  // Reason: pad to a fixed six slots so empty placeholders keep the layout stable;
  // Array.at avoids the object-injection lint on a numeric index.
  const slots: Array<OverviewRecentBadge | null> = Array.from(
    { length: OVERVIEW_RECENT_BADGE_LIMIT },
    (_, i) => badges.at(i) ?? null,
  );
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-1.5"
      aria-label="Recent badges"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
        Recent badges
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {slots.map((badge, i) =>
          badge ? (
            <span
              key={`${badge.id}-${i}`}
              title={badge.name}
              className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border bg-[#0A1224] ${rarityRing(badge.rarity)}`}
            >
              <GameIcon
                name={
                  (isValidGameIconName(badge.icon)
                    ? badge.icon
                    : "starBadge") as GameIconName
                }
                size={22}
                alt={badge.name}
              />
            </span>
          ) : (
            <span
              key={`empty-${i}`}
              className="flex h-9 w-9 rounded-lg border border-dashed border-white/10 bg-white/[0.02]"
              aria-hidden
            />
          ),
        )}
      </div>
    </div>
  );
}

function MilestoneRing({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.min(safeTotal, Math.max(0, done));
  const pct =
    safeTotal > 0 ? Math.round((safeDone / safeTotal) * 100) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className="flex shrink-0 items-center gap-3 rounded-xl border border-amber-400/25 bg-[#070E1C]/80 px-3 py-2.5"
      aria-label={`${safeDone} of ${safeTotal} milestones`}
    >
      <div className="relative h-[84px] w-[84px] shrink-0">
        <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90" aria-hidden>
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke="rgba(251,191,36,0.15)"
            strokeWidth="7"
          />
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke="#FBBF24"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-amber-300">
          {pct}%
        </span>
      </div>
      <div className="min-w-0 leading-tight">
        <p className="text-2xl font-bold text-emerald-400">{safeDone}</p>
        <p className="text-xs text-gray-400">of {safeTotal || "—"}</p>
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
          Milestones
        </p>
      </div>
    </div>
  );
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
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-cyan-400/25 bg-[#070E1C]/80 p-3 shadow-[0_0_18px_-8px_rgba(34,211,238,0.35)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-violet-400/35 bg-violet-500/10 shadow-[0_0_12px_rgba(167,139,250,0.35)]">
            <Image
              src={OVERVIEW_ICON_ART.target}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-100">
              {mission.name}
            </p>
            <p className="truncate text-xs text-gray-500">
              {mission.description ||
                (mapName ? `On ${mapName}` : "Journey milestone")}
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
      <p className="text-right text-[11px] font-semibold text-amber-200/90">
        {pct}% complete
      </p>
      {mission.requiredBadges.length > 0 && (
        <div className="rounded-lg border border-violet-400/20 bg-violet-500/5 px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            Required badges
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-300">
            {mission.requiredBadges.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Player Progress: Global Rank plate + XP + up to four next journey missions
 * (fills the Progress rail) + map milestone completion ring.
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
  recentBadges,
}: OverviewProgressProps) {
  // Reason: progressPercent can arrive as a long float from XP math — never
  // paint that raw into the UI (owner screenshot showed 78.692…%).
  const xpPct = Math.min(100, Math.max(0, Math.round(progressPercent)));
  const xpCap = currentXP + xpToNextLevel;
  const showMilestoneRow =
    journeyMilestonesTotal > 0 || recentBadges.length > 0;

  return (
    <section
      className={`${NEON_PANEL_LIT} relative flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5`}
      aria-label="Player progress"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="relative mt-0.5 flex h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-amber-400/40 bg-amber-500/10 shadow-[0_0_14px_rgba(251,191,36,0.4)]">
            <Image
              src={OVERVIEW_ICON_ART.progress}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
            />
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-start lg:grid-cols-[minmax(0,200px)_1fr]">
        <div className="flex flex-col items-center gap-2">
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
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

          {showMilestoneRow && (
            <div className="flex flex-wrap items-center gap-3">
              {journeyMilestonesTotal > 0 && (
                <MilestoneRing
                  done={journeyMilestonesDone}
                  total={journeyMilestonesTotal}
                />
              )}
              <div className="min-w-0 flex-1 rounded-xl border border-violet-400/20 bg-[#070E1C]/80 px-3 py-2.5">
                <RecentBadgesStrip badges={recentBadges} />
              </div>
            </div>
          )}

          {missions.length > 0 ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2">
              {missions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  mapName={journeyMapName}
                />
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
    </section>
  );
}
