"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Shield, Swords, TrendingUp, Trophy } from "lucide-react";
import ProfileImage from "@/components/ui/ProfileImage";
import ProfileCard from "@/components/profile/ProfileCard";
import ChallengeCreateDialog from "@/components/challenges/ChallengeCreateDialog";
import { OVERVIEW_COMPETE_MATCH_LIMIT } from "@/lib/services/games/overview-types";
import { OVERVIEW_COMPETE_ART } from "@/lib/services/games/overview-assets";
import { NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";

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

        <Link
          href="/leaderboard?board=trading&view=cards"
          className="relative inline-flex h-14 w-[260px] shrink-0 cursor-pointer drop-shadow-[0_0_16px_rgba(139,92,246,0.55)] transition-transform duration-200 ease-out hover:scale-110 active:scale-95 sm:h-16 sm:w-[300px]"
          aria-label="Matching Cards"
        >
          <Image
            src={OVERVIEW_COMPETE_ART.matchingCards}
            alt="Matching Cards"
            fill
            sizes="300px"
            className="object-contain"
          />
        </Link>
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
              className="flex flex-col gap-3 rounded-[16px] border border-cyan-400/50 bg-[linear-gradient(160deg,rgba(12,28,52,0.95)_0%,rgba(6,12,28,0.98)_100%)] p-3.5 shadow-[0_0_22px_-8px_rgba(34,211,238,0.55),inset_0_0_24px_rgba(34,211,238,0.05)]"
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setProfileTarget(m)}
                  className="relative h-14 w-14 shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
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
                    sizes="56px"
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
                    className="block max-w-full truncate text-left text-sm font-semibold text-gray-100 transition-colors hover:text-cyan-300 hover:underline cursor-pointer"
                  >
                    {m.username}
                  </button>
                  <p
                    className={`${NEON_LABEL} flex items-center gap-1 truncate text-[10px] text-cyan-300/90`}
                  >
                    <Image
                      src={OVERVIEW_COMPETE_ART.crown}
                      alt=""
                      width={12}
                      height={12}
                      className="h-3 w-3 object-contain"
                    />
                    Lv. {m.profileLevel}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1 text-right">
                  <div>
                    <p className="text-lg font-bold tabular-nums text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.65)]">
                      {m.matchScore}%
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/85">
                      Match
                    </p>
                  </div>
                  <TrendingUp
                    className="h-4 w-4 text-emerald-400"
                    aria-hidden
                  />
                </div>
              </div>

              {/* Reason: same four tiles as Matching Cards — Score, Level, Competitions, 1v1.
                  Level is profile XP (`profileLevel`), never the matchmaking skill-band. */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-cyan-400/20 bg-[#07101f]/90 px-2 py-1.5 text-center">
                  <Shield
                    className="mx-auto mb-0.5 h-3 w-3 text-cyan-300/90"
                    aria-hidden
                  />
                  <p className="text-sm font-bold tabular-nums text-cyan-200">
                    {m.overallScore}
                  </p>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                    Score
                  </span>
                </div>
                <div className="rounded-lg border border-cyan-400/20 bg-[#07101f]/90 px-2 py-1.5 text-center">
                  <Image
                    src={OVERVIEW_COMPETE_ART.crown}
                    alt=""
                    width={12}
                    height={12}
                    className="mx-auto mb-0.5 h-3 w-3 object-contain"
                  />
                  <p className="truncate text-sm font-bold tabular-nums text-amber-200">
                    {m.profileLevel}
                  </p>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                    Level
                  </span>
                </div>
                <div className="rounded-lg border border-cyan-400/20 bg-[#07101f]/90 px-2 py-1.5 text-center">
                  <Trophy
                    className="mx-auto mb-0.5 h-3 w-3 text-amber-300"
                    aria-hidden
                  />
                  <p className="text-sm font-bold tabular-nums text-amber-200">
                    {m.competitionsWon}
                    <span className="mx-0.5 font-semibold text-gray-500">/</span>
                    {m.competitionsEntered}
                  </p>
                  <span className="block text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                    Competitions
                  </span>
                  <span className="block text-[9px] font-semibold tracking-wide text-gray-400">
                    won · entered
                  </span>
                </div>
                <div className="rounded-lg border border-cyan-400/20 bg-[#07101f]/90 px-2 py-1.5 text-center">
                  <Swords
                    className="mx-auto mb-0.5 h-3 w-3 text-violet-300"
                    aria-hidden
                  />
                  <p className="text-sm font-bold tabular-nums text-violet-200">
                    {m.challengesWon}
                    <span className="mx-0.5 font-semibold text-gray-500">/</span>
                    {m.challengesEntered}
                  </p>
                  <span className="block text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                    1v1
                  </span>
                  <span className="block text-[9px] font-semibold tracking-wide text-gray-400">
                    won · entered
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setChallengeTarget({
                    userId: m.userId,
                    username: m.username,
                  })
                }
                className="relative mt-auto h-14 w-full cursor-pointer drop-shadow-[0_0_18px_rgba(251,146,60,0.55)] transition-transform duration-200 ease-out hover:scale-105 active:scale-95 sm:h-16"
                aria-label={`Challenge ${m.username}`}
              >
                <Image
                  src={OVERVIEW_COMPETE_ART.challenge}
                  alt=""
                  fill
                  sizes="320px"
                  className="object-contain"
                />
                <span className="sr-only">Challenge</span>
              </button>
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
