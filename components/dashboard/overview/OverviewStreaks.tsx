"use client";

import Link from "next/link";
import {
  Flame,
  Award,
  Trophy,
  Calendar,
  TrendingUp,
  BarChart2,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { OverviewStanding } from "@/lib/services/games/overview-types";
import { NEON_PANEL, NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewStreaksProps {
  streaks: OverviewStanding["streaks"];
}

interface StreakTile {
  key: keyof OverviewStanding["streaks"];
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  glow: string;
  format?: (n: number) => string;
  activeWhen: (n: number) => boolean;
}

/**
 * Six tiles from UserGameStats `_overall` — trading contests + every provider
 * game. Labels stay contest-shaped so a new title needs no Overview edit.
 * Trading-only day / P&L streaks stay on the Performance tab.
 */
function streakValue(
  streaks: OverviewStanding["streaks"],
  key: keyof OverviewStanding["streaks"],
): number {
  switch (key) {
    case "podiumStreak":
      return streaks.podiumStreak;
    case "bestStreak":
      return streaks.bestStreak;
    case "contestWins":
      return streaks.contestWins;
    case "contestsPlayed":
      return streaks.contestsPlayed;
    case "topThreeFinishes":
      return streaks.topThreeFinishes;
    case "weeksActive":
      return streaks.weeksActive;
    default:
      return 0;
  }
}

const TILES: StreakTile[] = [
  {
    key: "podiumStreak",
    label: "Podium streak",
    icon: Flame,
    color: "#F97316",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    glow: "rgba(249,115,22,0.28)",
    activeWhen: (n) => n > 0,
  },
  {
    key: "bestStreak",
    label: "Best streak",
    icon: Award,
    color: "#EAB308",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    glow: "rgba(234,179,8,0.28)",
    activeWhen: (n) => n > 2,
  },
  {
    key: "contestWins",
    label: "Contest wins",
    icon: TrendingUp,
    color: "#22C55E",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    glow: "rgba(34,197,94,0.28)",
    activeWhen: (n) => n > 0,
  },
  {
    key: "contestsPlayed",
    label: "Contests played",
    icon: Calendar,
    color: "#3B82F6",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    glow: "rgba(59,130,246,0.28)",
    activeWhen: (n) => n > 0,
  },
  {
    key: "topThreeFinishes",
    label: "Top 3 finishes",
    icon: Trophy,
    color: "#A855F7",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    glow: "rgba(168,85,247,0.28)",
    activeWhen: (n) => n > 0,
  },
  {
    key: "weeksActive",
    label: "Weeks active",
    icon: BarChart2,
    color: "#F43F5E",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    glow: "rgba(244,63,94,0.28)",
    activeWhen: (n) => n > 0,
  },
];

export default function OverviewStreaks({ streaks }: OverviewStreaksProps) {
  return (
    <section
      aria-labelledby="streaks-heading"
      className={`${NEON_PANEL} p-4 sm:p-5`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            id="streaks-heading"
            className={`${NEON_HEADING} text-sm uppercase tracking-[0.14em]`}
          >
            Streaks &amp; Consistency
          </h2>
          <p className="mt-1 text-xs text-gray-400 sm:text-sm">
            Keep showing up. Consistency leads to greatness.
          </p>
        </div>
        <Link
          href="/profile"
          className={`${NEON_LABEL} inline-flex shrink-0 items-center gap-1 text-[11px] transition-colors hover:text-cyan-300`}
        >
          View Details
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map(
          ({
            key,
            label,
            icon: Icon,
            color,
            bg,
            border,
            glow,
            format,
            activeWhen,
          }) => {
            const value = streakValue(streaks, key);
            const active = activeWhen(value);
            const display = format
              ? format(value)
              : value.toLocaleString();

            return (
              <li
                key={key}
                className={`relative overflow-hidden rounded-lg border ${border} ${bg} p-3 text-center transition-shadow`}
                style={
                  active
                    ? { boxShadow: `0 0 14px ${glow}` }
                    : undefined
                }
              >
                {active && key === "podiumStreak" ? (
                  <Flame
                    className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-orange-400/60"
                    aria-hidden
                  />
                ) : null}
                <Icon
                  className="mx-auto mb-1.5 h-5 w-5 opacity-80"
                  style={{ color }}
                  aria-hidden
                />
                <p
                  className={`${NEON_HEADING} text-xl`}
                  style={{ color }}
                >
                  {display}
                </p>
                <p className={`${NEON_LABEL} mt-0.5 leading-tight`}>{label}</p>
              </li>
            );
          },
        )}
      </ul>
    </section>
  );
}
