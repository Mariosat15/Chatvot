/**
 * Client-safe Overview types and constants.
 *
 * Reason (R58): `"use client"` Overview tiles must never import
 * `overview-standing.service.ts` — that file reaches mongoose / the Mongo
 * driver, and Turbopack then fails the browser build on `child_process` /
 * `dns` / `fs` / `net` / `tls`. Keep every type and the play-card cap here.
 */

import type { OverviewRankBadge } from "@/lib/utils/overview-rank-badge";

/** Cap on Play-by-Game cards — top N most-played only (owner, 29 Sep 2026). */
export const OVERVIEW_PLAY_CARD_LIMIT = 4;

export interface OverviewPlayCard {
  gameKey: string;
  slug: string;
  label: string;
  /** Catalogue tagline when present — shown under the title. */
  tagline?: string;
  isTrading: boolean;
  gameCode?: string;
  href: string;
  /**
   * Artwork from the game page catalogue (banner, then thumbnail), same source
   * as `/games` cards. Neon fallback only when the title has no admin art yet.
   */
  artSrc: string;
  contestsEntered: number;
  contestsCompleted: number;
  wins: number;
  bestRank: number;
  /**
   * Provider games: stored bestScore. Trading: totalPoints (no provider score).
   * Null only when both are absent/zero — UI shows a dash.
   */
  bestScore: number | null;
  /** Free-text unit for the activity count ("Trades" / "Races" / "Runs"). */
  activityLabel: string;
}

export interface OverviewMission {
  id: string;
  name: string;
  /** Short milestone description from the journey catalogue. */
  description: string;
  icon: string;
  xp: number;
  /** 0..target; when target is 0 the bar is empty. */
  current: number;
  target: number;
}

/** Cap on Overview mission tiles — next incomplete only (owner, 29 Sep 2026). */
export const OVERVIEW_MISSION_LIMIT = 1;

export interface OverviewActivityItem {
  id: string;
  title: string;
  detail: string;
  at: string;
  kind: "contest" | "trade" | "milestone";
}

export interface OverviewStreaksFacts {
  /** Consecutive top-3 finishes across every game including trading contests. */
  podiumStreak: number;
  /** Longest podium streak ever on `_overall`. */
  bestStreak: number;
  /** Contest wins (rank 1) across every game. */
  contestWins: number;
  /** Contests completed across every game. */
  contestsPlayed: number;
  /** Top-3 finishes across every game. */
  topThreeFinishes: number;
  /**
   * Coarse activity weeks hint from completed contests — not calendar weeks.
   * Agnostic: no trading-day / profitable-day metric.
   */
  weeksActive: number;
}

export interface OverviewStanding {
  globalRank: OverviewRankBadge;
  totalUsers: number;
  /** Contest win rate across every game including trading contests; null if none completed. */
  contestWinRate: number | null;
  playCards: OverviewPlayCard[];
  /** Active journey map display name (empty when no progress). */
  journeyMapName: string;
  /** Completed milestones on the active map (for the ring readout). */
  journeyMilestonesDone: number;
  /** Total active milestones on the active map. */
  journeyMilestonesTotal: number;
  missions: OverviewMission[];
  recentActivity: OverviewActivityItem[];
  streaks: OverviewStreaksFacts;
  /**
   * Week-over-week % change for Overview KPIs. Null when there is not enough
   * history to compare — UI shows a dash, never a fabricated number.
   */
  kpiWeekDelta: {
    credits: number | null;
    winRate: number | null;
    roi: number | null;
    prizes: number | null;
  };
}

export type { OverviewRankBadge };
