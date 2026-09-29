"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, Loader2, TrendingUp, Trophy } from "lucide-react";
import ProfileImage from "@/components/ui/ProfileImage";
import ChallengeCreateDialog from "@/components/challenges/ChallengeCreateDialog";
import { OVERVIEW_COMPETE_MATCH_LIMIT } from "@/lib/services/games/overview-types";
import { OVERVIEW_COMPETE_ART } from "@/lib/services/games/overview-assets";
import { NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface CompeteMatch {
  userId: string;
  username: string;
  profileImage?: string;
  level: string;
  winRate: number;
  challengesWon: number;
  challengesEntered: number;
  matchScore: number;
  isOnline: boolean;
}

/**
 * Overview Compete strip — owner neon reference (29 Sep 2026).
 *
 * Layout and chrome match the Compete mock: swords header mark, Matching Cards
 * capsule art, cyan-framed player cards, avatar ring + crown, gold Challenge
 * plate. Client-fetched so the dashboard payload stays free of matchmaking I/O.
 */
export default function OverviewCompete() {
  const [matches, setMatches] = useState<CompeteMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeTarget, setChallengeTarget] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/matchmaking?action=ranked&limit=${OVERVIEW_COMPETE_MATCH_LIMIT}`,
        );
        if (!res.ok) throw new Error("matchmaking failed");
        const data = await res.json();
        const rows: CompeteMatch[] = (data.matches ?? [])
          .slice(0, OVERVIEW_COMPETE_MATCH_LIMIT)
          .map(
            (m: {
              matchScore?: number;
              trader: {
                userId: string;
                username: string;
                profileImage?: string;
                level: string;
                winRate: number;
                challengesWon: number;
                challengesEntered: number;
                isOnline: boolean;
              };
            }) => ({
              userId: m.trader.userId,
              username: m.trader.username,
              profileImage: m.trader.profileImage,
              level: m.trader.level,
              winRate: m.trader.winRate,
              challengesWon: m.trader.challengesWon,
              challengesEntered: m.trader.challengesEntered,
              matchScore: Math.round(m.matchScore ?? 0),
              isOnline: m.trader.isOnline,
            }),
          );
        if (!cancelled) setMatches(rows);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-[18px] border border-cyan-400/55 bg-[linear-gradient(165deg,rgba(8,24,48,0.92)_0%,rgba(4,10,22,0.96)_55%,rgba(10,20,40,0.9)_100%)] p-4 shadow-[0_0_28px_-6px_rgba(34,211,238,0.45),inset_0_0_40px_rgba(34,211,238,0.06)] sm:p-5"
      aria-label="Compete"
    >
      {/* Inner neon rail — matches the reference double frame. */}
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
                <div className="relative h-14 w-14 shrink-0">
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
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-100">
                    {m.username}
                  </p>
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
                    {m.level}
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

              <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-gray-300">
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/20 bg-[#07101f]/90 px-1.5 py-0.5">
                  <Trophy className="h-3 w-3 text-amber-300" aria-hidden />
                  WR {Math.round(m.winRate)}%
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/20 bg-[#07101f]/90 px-1.5 py-0.5">
                  <BarChart3 className="h-3 w-3 text-cyan-300" aria-hidden />
                  {m.challengesWon}/{m.challengesEntered || 0} chal wins
                </span>
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
    </section>
  );
}
