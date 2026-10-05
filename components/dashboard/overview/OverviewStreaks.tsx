"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { OverviewStanding } from "@/lib/services/games/overview-types";
import {
  OVERVIEW_ICON_ART,
  OVERVIEW_STREAK_ART,
} from "@/lib/services/games/overview-assets";
import { NEON_PANEL, NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface OverviewStreaksProps {
  streaks: OverviewStanding["streaks"];
}

export interface StreakTile {
  key: keyof OverviewStanding["streaks"];
  label: string;
  artSrc: string;
  color: string;
  border: string;
  glow: string;
  format?: (n: number) => string;
  activeWhen: (n: number) => boolean;
}

/**
 * Six tiles from UserGameStats `_overall` — trading contests + every provider
 * game. Labels stay contest-shaped so a new title needs no Overview edit.
 * Icons are owner game art (image 7), not Lucide placeholders.
 */
export function streakValue(
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

export const TILES: StreakTile[] = [
  {
    key: "podiumStreak",
    label: "Podium streak",
    artSrc: OVERVIEW_STREAK_ART.podiumStreak,
    color: "#F97316",
    border: "border-orange-400/45",
    glow: "rgba(249,115,22,0.4)",
    activeWhen: (n) => n > 0,
  },
  {
    key: "bestStreak",
    label: "Best streak",
    artSrc: OVERVIEW_STREAK_ART.bestStreak,
    color: "#EAB308",
    border: "border-yellow-400/45",
    glow: "rgba(234,179,8,0.4)",
    activeWhen: (n) => n > 2,
  },
  {
    key: "contestWins",
    label: "Contest wins",
    artSrc: OVERVIEW_STREAK_ART.contestWins,
    color: "#22C55E",
    border: "border-green-400/45",
    glow: "rgba(34,197,94,0.4)",
    activeWhen: (n) => n > 0,
  },
  {
    key: "contestsPlayed",
    label: "Contests played",
    artSrc: OVERVIEW_STREAK_ART.contestsPlayed,
    color: "#3B82F6",
    border: "border-blue-400/45",
    glow: "rgba(59,130,246,0.4)",
    activeWhen: (n) => n > 0,
  },
  {
    key: "topThreeFinishes",
    label: "Top 3 finishes",
    artSrc: OVERVIEW_STREAK_ART.topThreeFinishes,
    color: "#A855F7",
    border: "border-purple-400/45",
    glow: "rgba(168,85,247,0.4)",
    activeWhen: (n) => n > 0,
  },
  {
    key: "weeksActive",
    label: "Weeks active",
    artSrc: OVERVIEW_STREAK_ART.weeksActive,
    color: "#F43F5E",
    border: "border-rose-400/45",
    glow: "rgba(244,63,94,0.4)",
    activeWhen: (n) => n > 0,
  },
];

export default function OverviewStreaks({ streaks }: OverviewStreaksProps) {
  return (
    <section
      aria-labelledby="streaks-heading"
      className={`${NEON_PANEL} border-cyan-400/25 p-4 shadow-[0_0_28px_-12px_rgba(34,211,238,0.45)] sm:p-5`}
    >
      {/* Reason: owner, 5 Oct 2026 - remove View all / View Details from Streaks. */}
      <div className="mb-4 flex items-start gap-2.5">
        <span className="relative mt-0.5 flex h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-orange-400/40 bg-transparent shadow-[0_0_14px_rgba(251,146,60,0.45)]">
          <Image
            src={OVERVIEW_ICON_ART.fire}
            alt=""
            fill
            sizes="40px"
            className="object-contain mix-blend-screen"
          />
        </span>
        <div>
          <h2
            id="streaks-heading"
            className={`${NEON_HEADING} text-sm uppercase tracking-[0.14em] text-white`}
          >
            Streaks &amp; Consistency
          </h2>
          <p className="mt-1 text-xs text-gray-400 sm:text-sm">
            Keep showing up. Consistency leads to greatness.
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map(
          ({ key, label, artSrc, color, border, glow, format, activeWhen }) => {
            const value = streakValue(streaks, key);
            const active = activeWhen(value);
            const display = format ? format(value) : value.toLocaleString();

            return (
              <li
                key={key}
                className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl border ${border} bg-[#070E1C]/85 px-2.5 py-3 transition-shadow`}
                style={
                  active
                    ? { boxShadow: `0 0 18px ${glow}` }
                    : { boxShadow: `0 0 10px ${glow}` }
                }
              >
                <div className="relative h-9 w-9 shrink-0">
                  <Image
                    src={artSrc}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-contain mix-blend-screen"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-lg font-bold leading-none"
                    style={{ color }}
                  >
                    {display}
                  </p>
                  <p className={`${NEON_LABEL} mt-1 leading-tight`}>{label}</p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-gray-600"
                  aria-hidden
                />
              </li>
            );
          },
        )}
      </ul>
    </section>
  );
}
