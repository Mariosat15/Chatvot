"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Shield, TrendingUp } from "lucide-react";
import ProfileImage from "@/components/ui/ProfileImage";
import ProfileCard from "@/components/profile/ProfileCard";
import ChallengeCreateDialog from "@/components/challenges/ChallengeCreateDialog";
import { OVERVIEW_COMPETE_MATCH_LIMIT } from "@/lib/services/games/overview-types";
import {
  OVERVIEW_COMPETE_ART,
} from "@/lib/services/games/overview-assets";
import { NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";
import { ART_BUTTON_HOVER, PRESS_EFFECT } from "@/components/ui/press-effect";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";

const MATCHING_CARDS_HREF = "/leaderboard?board=trading&view=cards";

// Reason: owner, 29 Sep 2026 - card footer uses the supplied neon button art
// (Challenge + Matching Cards), not CSS pills. Hover brightens, press shrinks,
// always a hand cursor.
// Reason: owner, 3 Oct 2026 - "make sure both buttons have the same size". The
// two arts have different shapes (Challenge 1000x251, Matching Cards 1021x316),
// so a fixed h-12 box made Matching Cards hit the height first and draw
// narrower. A box no wider than 16:5 is narrower than BOTH arts' ratios, so
// each fills the full column width and the two read as one size.
const ART_ACTION =
  `relative block aspect-[16/5] w-full min-w-0 cursor-pointer ${PRESS_EFFECT} ${ART_BUTTON_HOVER}`;

const COMPETE_TILE =
  "flex min-h-[58px] items-center gap-3 rounded-lg border border-cyan-400/30 bg-[#07101f]/90 px-3 py-2 shadow-[inset_0_0_12px_rgba(34,211,238,0.06)]";

export interface CompeteMatch {
  userId: string;
  username: string;
  profileImage?: string;
  /** Matchmaking skill-band — kept for challenge dialogs, not shown as Level. */
  level: string;
  /** Real XP level from UserLevel / profile. */
  profileLevel: number;
  overallScore: number;
  winRate: number;
  totalTrades: number;
  totalPnl: number;
  competitionsEntered: number;
  competitionsWon: number;
  challengesEntered: number;
  challengesWon: number;
  totalBadges: number;
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
  matchScore: number;
  isOnline: boolean;
}

export function mapMatches(data: {
  matches?: Array<{
    matchScore?: number;
    trader: {
      userId: string;
      username: string;
      profileImage?: string;
      level: string;
      profileLevel?: number;
      overallScore?: number;
      winRate: number;
      totalTrades?: number;
      totalPnl?: number;
      competitionsEntered?: number;
      competitionsWon?: number;
      challengesWon: number;
      challengesEntered: number;
      totalBadges?: number;
      userTitle?: string;
      userTitleIcon?: string;
      userTitleColor?: string;
      isOnline: boolean;
    };
  }>;
}): CompeteMatch[] {
  return (data.matches ?? []).slice(0, OVERVIEW_COMPETE_MATCH_LIMIT).map((m) => {
    const raw = Number(m.trader.profileLevel);
    const profileLevel =
      Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
    return {
      userId: m.trader.userId,
      username: m.trader.username,
      profileImage: m.trader.profileImage,
      level: m.trader.level,
      profileLevel,
      overallScore: Math.round(m.trader.overallScore ?? 0),
      winRate: m.trader.winRate,
      totalTrades: m.trader.totalTrades ?? 0,
      totalPnl: m.trader.totalPnl ?? 0,
      competitionsEntered: m.trader.competitionsEntered ?? 0,
      competitionsWon: m.trader.competitionsWon ?? 0,
      challengesWon: m.trader.challengesWon,
      challengesEntered: m.trader.challengesEntered,
      totalBadges: m.trader.totalBadges ?? 0,
      userTitle: m.trader.userTitle,
      userTitleIcon: m.trader.userTitleIcon,
      userTitleColor: m.trader.userTitleColor,
      matchScore: Math.round(m.matchScore ?? 0),
      isOnline: m.trader.isOnline,
    };
  });
}

/**
 * Overview Compete strip — owner neon reference (29 Sep 2026).
 *
 * Stats match Matching Cards: Score, Level, Competitions and 1v1
 * (won · entered). Names open ProfileCard like the leaderboard.
 *
 * Live online dots poll `/api/user/presence?userIds=` (light). Match list
 * rematches every 60s. Never re-fetches the full dashboard payload.
 */
export default function OverviewCompete({
  liveEnabled = true,
}: {
  liveEnabled?: boolean;
}) {
  const [matches, setMatches] = useState<CompeteMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeTarget, setChallengeTarget] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [profileTarget, setProfileTarget] = useState<CompeteMatch | null>(null);

  const matchIdsKey = useMemo(
    () => matches.map((m) => m.userId).join(","),
    [matches],
  );

  useEffect(() => {
    if (!liveEnabled) return;
    let cancelled = false;
    let rematchTimer: ReturnType<typeof setInterval> | null = null;

    const loadMatches = async () => {
      try {
        const res = await fetch(
          `/api/matchmaking?action=ranked&limit=${OVERVIEW_COMPETE_MATCH_LIMIT}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("matchmaking failed");
        const data = await res.json();
        if (!cancelled) setMatches(mapMatches(data));
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMatches();
    rematchTimer = setInterval(() => {
      if (document.visibilityState === "visible") void loadMatches();
    }, 60_000);

    return () => {
      cancelled = true;
      if (rematchTimer) clearInterval(rematchTimer);
    };
  }, [liveEnabled]);

  useEffect(() => {
    if (!liveEnabled || !matchIdsKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ids = matchIdsKey.split(",").filter(Boolean);

    const tick = async () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(tick, PERFORMANCE_INTERVALS.DASHBOARD_REFRESH);
        return;
      }
      try {
        const res = await fetch(
          `/api/user/presence?userIds=${encodeURIComponent(ids.join(","))}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            statuses?: Array<{ userId: string; isOnline: boolean }>;
          };
          const map = new Map(
            (data.statuses ?? []).map((s) => [s.userId, s.isOnline]),
          );
          if (!cancelled && map.size > 0) {
            setMatches((prev) =>
              prev.map((m) =>
                map.has(m.userId)
                  ? { ...m, isOnline: Boolean(map.get(m.userId)) }
                  : m,
              ),
            );
          }
        }
      } catch {
        // keep last
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, PERFORMANCE_INTERVALS.DASHBOARD_REFRESH);
        }
      }
    };

    timer = setTimeout(tick, PERFORMANCE_INTERVALS.DASHBOARD_REFRESH);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [liveEnabled, matchIdsKey]);

  return (
    <section
      className="relative overflow-hidden rounded-[18px] border border-cyan-400/55 bg-[linear-gradient(165deg,rgba(8,24,48,0.92)_0%,rgba(4,10,22,0.96)_55%,rgba(10,20,40,0.9)_100%)] p-4 shadow-[0_0_28px_-6px_rgba(34,211,238,0.45),inset_0_0_40px_rgba(34,211,238,0.06)] sm:p-5"
      aria-label="Compete"
    >
      <div
        className="pointer-events-none absolute inset-2 rounded-[14px] border border-cyan-300/25"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 text-cyan-300"
        aria-hidden
      >
        <span className="block h-full w-full rotate-45 bg-cyan-300/80 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
      </div>

      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative h-11 w-11 shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.65)]">
            <Image
              src={OVERVIEW_COMPETE_ART.swords}
              alt=""
              fill
              sizes="44px"
              className="object-contain"
            />
          </span>
          <div className="min-w-0">
            <h2
              className={`${NEON_HEADING} text-sm tracking-[0.16em] text-white`}
            >
              Compete
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Best-matched players for a 1v1 challenge.
            </p>
          </div>
        </div>

        {/* Reason: Matching Cards lives on each card when matches exist; the
            header copy survives only for the empty state, same as mobile. */}
        {matches.length === 0 && !loading && (
          <Link
            href={MATCHING_CARDS_HREF}
            className={`relative inline-flex h-10 w-[184px] shrink-0 cursor-pointer drop-shadow-[0_0_14px_rgba(139,92,246,0.6)] ${PRESS_EFFECT} ${ART_BUTTON_HOVER} sm:h-11 sm:w-[204px]`}
            aria-label="Matching Cards"
          >
            <Image
              src={OVERVIEW_COMPETE_ART.matchingCards}
              alt="Matching Cards"
              fill
              unoptimized
              sizes="204px"
              className="object-contain"
            />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="relative z-10 flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Finding matches…
        </div>
      ) : matches.length === 0 ? (
        <div className="relative z-10 rounded-xl border border-cyan-400/25 bg-[#070E1C]/70 px-4 py-6 text-center text-sm text-gray-400">
          No challenge matches yet. Play contests to build a standing, then
          check Matching Cards.
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {matches.map((m) => (
            <article
              key={m.userId}
              className="relative flex flex-col gap-3 rounded-[16px] border border-cyan-400/55 bg-[linear-gradient(160deg,rgba(12,28,52,0.95)_0%,rgba(6,12,28,0.98)_100%)] p-3.5 shadow-[0_0_22px_-8px_rgba(34,211,238,0.6),inset_0_0_24px_rgba(34,211,238,0.06)] sm:p-4"
            >
              {/* Reason: owner, 29 Sep 2026 - no corner brackets or notches; the
                  cut-off look read as broken borders. One clean rounded edge. */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setProfileTarget(m)}
                  className="relative h-16 w-16 shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 sm:h-[72px] sm:w-[72px]"
                  aria-label={`Open ${m.username}'s card`}
                >
                  <div className="absolute inset-[10%] overflow-hidden rounded-full bg-[#0A1528]">
                    <ProfileImage
                      src={m.profileImage}
                      alt={m.username}
                      fallbackLetter={(m.username || "?").charAt(0).toUpperCase()}
                      size="md"
                      className="!h-full !w-full"
                    />
                  </div>
                  <Image
                    src={OVERVIEW_COMPETE_ART.avatarRing}
                    alt=""
                    fill
                    sizes="72px"
                    className="pointer-events-none object-contain drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]"
                  />
                  <span
                    className={`absolute bottom-[2px] right-[2px] z-10 h-2.5 w-2.5 rounded-full border border-[#070E1C] ${
                      m.isOnline ? "bg-emerald-400" : "bg-gray-500"
                    }`}
                    aria-label={m.isOnline ? "Online" : "Offline"}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setProfileTarget(m)}
                    className="block max-w-full truncate text-left text-[15px] font-semibold text-gray-100 transition-colors hover:text-cyan-300 hover:underline cursor-pointer"
                  >
                    {m.username}
                  </button>
                  <p
                    className={`${NEON_LABEL} mt-1 flex items-center gap-1.5 truncate text-[11px] text-cyan-200/90`}
                  >
                    <Shield className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                    Lv. {m.profileLevel}
                  </p>
                </div>

                <div className="shrink-0 rounded-lg border border-cyan-400/60 bg-cyan-500/10 px-3 py-1.5 text-center shadow-[0_0_14px_-2px_rgba(34,211,238,0.55),inset_0_0_12px_rgba(34,211,238,0.12)]">
                  <p className="flex items-center justify-center gap-1 text-2xl font-bold leading-none tabular-nums text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]">
                    {m.matchScore}%
                    <TrendingUp
                      className="h-4 w-4 text-cyan-300"
                      aria-hidden
                    />
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/85">
                    Match
                  </p>
                </div>
              </div>

              {/* Reason: same four tiles as Matching Cards — Score, Level, Competitions, 1v1.
                  Level is profile XP (`profileLevel`), never the matchmaking skill-band. */}
              {/* Reason: reference tiles put the icon on the left and the figure +
                  caption beside it; same four facts, all real. */}
              <div className="grid grid-cols-2 gap-2">
                <div className={COMPETE_TILE}>
                  <span className="relative h-11 w-11 shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                    <Image
                      src={OVERVIEW_COMPETE_ART.score}
                      alt=""
                      fill
                      sizes="88px"
                      className="object-contain"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold leading-tight tabular-nums text-white">
                      {m.overallScore}
                    </p>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Score
                    </span>
                  </div>
                </div>
                <div className={COMPETE_TILE}>
                  <span className="relative h-11 w-11 shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                    <Image
                      src={OVERVIEW_COMPETE_ART.level}
                      alt=""
                      fill
                      sizes="88px"
                      className="object-contain"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold leading-tight tabular-nums text-amber-200">
                      {m.profileLevel}
                    </p>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Level
                    </span>
                  </div>
                </div>
                <div className={COMPETE_TILE}>
                  <span className="relative h-11 w-11 shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                    <Image
                      src={OVERVIEW_COMPETE_ART.competitions}
                      alt=""
                      fill
                      sizes="88px"
                      className="object-contain"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold leading-tight tabular-nums text-amber-200">
                      {m.competitionsWon}
                      <span className="mx-0.5 font-semibold text-gray-500">/</span>
                      {m.competitionsEntered}
                    </p>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Competitions
                    </span>
                    <span className="block text-[11px] font-semibold tracking-wide text-gray-400">
                      won · entered
                    </span>
                  </div>
                </div>
                <div className={COMPETE_TILE}>
                  <span className="relative h-11 w-11 shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                    <Image
                      src={OVERVIEW_COMPETE_ART.oneVsOne}
                      alt=""
                      fill
                      sizes="88px"
                      className="object-contain"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold leading-tight tabular-nums text-violet-200">
                      {m.challengesWon}
                      <span className="mx-0.5 font-semibold text-gray-500">/</span>
                      {m.challengesEntered}
                    </p>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      1v1
                    </span>
                    <span className="block text-[11px] font-semibold tracking-wide text-gray-400">
                      won · entered
                    </span>
                  </div>
                </div>
              </div>

              {/* Reason: owner, 29 Sep 2026 - Matching Cards beside Challenge on
                  every card. Supplied neon art (transparent back) replaces the
                  CSS pills; both share one height so the row stays even. */}
              <div className="mt-auto grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setChallengeTarget({
                      userId: m.userId,
                      username: m.username,
                    })
                  }
                  className={`${ART_ACTION} drop-shadow-[0_0_12px_rgba(251,146,60,0.55)] hover:drop-shadow-[0_0_18px_rgba(251,146,60,0.85)]`}
                  aria-label={`Challenge ${m.username}`}
                >
                  <Image
                    src={OVERVIEW_COMPETE_ART.challenge}
                    alt=""
                    fill
                    unoptimized
                    sizes="200px"
                    className="object-contain"
                  />
                  <span className="sr-only">Challenge</span>
                </button>
                <Link
                  href={MATCHING_CARDS_HREF}
                  className={`${ART_ACTION} drop-shadow-[0_0_12px_rgba(139,92,246,0.55)] hover:drop-shadow-[0_0_18px_rgba(139,92,246,0.85)]`}
                  aria-label="Matching Cards"
                >
                  <Image
                    src={OVERVIEW_COMPETE_ART.matchingCards}
                    alt=""
                    fill
                    unoptimized
                    sizes="200px"
                    className="object-contain"
                  />
                  <span className="sr-only">Matching Cards</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <ChallengeCreateDialog
        open={!!challengeTarget}
        onOpenChange={(open) => {
          if (!open) setChallengeTarget(null);
        }}
        challengedUser={challengeTarget}
      />

      {profileTarget && (
        <ProfileCard
          show={!!profileTarget}
          userId={profileTarget.userId}
          username={profileTarget.username}
          stats={{
            winRate: profileTarget.winRate,
            totalTrades: profileTarget.totalTrades,
            totalPnl: profileTarget.totalPnl,
            competitionsEntered: profileTarget.competitionsEntered,
            competitionsWon: profileTarget.competitionsWon,
            challengesEntered: profileTarget.challengesEntered,
            challengesWon: profileTarget.challengesWon,
            totalBadges: profileTarget.totalBadges,
            overallScore: profileTarget.overallScore,
            userTitle: profileTarget.userTitle,
            userTitleIcon: profileTarget.userTitleIcon,
            userTitleColor: profileTarget.userTitleColor,
          }}
          showChallengeButton
          onChallenge={() => {
            setChallengeTarget({
              userId: profileTarget.userId,
              username: profileTarget.username,
            });
            setProfileTarget(null);
          }}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </section>
  );
}
