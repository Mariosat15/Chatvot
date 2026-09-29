"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Swords, Sparkles } from "lucide-react";
import ProfileImage from "@/components/ui/ProfileImage";
import ChallengeCreateDialog from "@/components/challenges/ChallengeCreateDialog";
import { OVERVIEW_COMPETE_MATCH_LIMIT } from "@/lib/services/games/overview-types";
import {
  NEON_PANEL_LIT,
  NEON_HEADING,
  NEON_LABEL,
} from "@/components/neon/tokens";

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
 * Overview Compete strip — best challenge matches from matchmaking.
 *
 * Client-fetched so the dashboard payload stays free of matchmaking I/O.
 * Challenge opens the shared create dialog; Matching Cards deep-links the
 * trading leaderboard Match Cards view.
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
      className={`${NEON_PANEL_LIT} relative overflow-hidden p-4 sm:p-5`}
      aria-label="Compete"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`${NEON_HEADING} text-sm tracking-[0.16em] text-white`}>
            Compete
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Best-matched players for a 1v1 challenge.
          </p>
        </div>
        <Link
          href="/leaderboard?board=trading&view=cards"
          className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Matching Cards
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Finding matches…
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-xl border border-[#1B2540] bg-[#070E1C]/70 px-4 py-6 text-center text-sm text-gray-400">
          No challenge matches yet. Play contests to build a standing, then
          check Matching Cards.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {matches.map((m) => (
            <article
              key={m.userId}
              className="flex flex-col gap-3 rounded-xl border border-cyan-400/25 bg-[#070E1C]/80 p-3 shadow-[0_0_18px_-8px_rgba(34,211,238,0.3)]"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <ProfileImage
                    src={m.profileImage}
                    alt={m.username}
                    fallbackLetter={(m.username || "?").charAt(0).toUpperCase()}
                    size="md"
                    className="ring-1 ring-cyan-400/30"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#070E1C] ${
                      m.isOnline ? "bg-emerald-400" : "bg-gray-500"
                    }`}
                    aria-label={m.isOnline ? "Online" : "Offline"}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-100">
                    {m.username}
                  </p>
                  <p className={`${NEON_LABEL} truncate text-[10px] text-gray-500`}>
                    {m.level}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold tabular-nums text-emerald-400">
                    {m.matchScore}%
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">
                    Match
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-gray-400">
                <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
                  WR {Math.round(m.winRate)}%
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
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
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/25"
              >
                <Swords className="h-3.5 w-3.5" aria-hidden />
                Challenge
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
