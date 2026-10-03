"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Gamepad2, Sparkles, Trophy, Users } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import { NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

interface Suggestion {
  gameKey: string;
  competitionId: string;
  name: string;
  entryFee: number;
  startTime: string;
  status: string;
  gameLabel?: string;
  artSrc?: string;
  prizePool?: number;
  currentParticipants?: number;
  maxParticipants?: number | null;
}

// Reason: same frame and card glow as "Play by game", so the two strips read as one
// dashboard rather than a styled section beside a plain list.
const SECTION_FRAME =
  "rounded-2xl border border-sky-400/35 bg-[#050B18]/40 p-3 shadow-[0_0_18px_-6px_rgba(56,189,248,0.45),inset_0_0_14px_rgba(56,189,248,0.06)]";
const CARD =
  "group relative flex h-full flex-col overflow-hidden rounded-xl border border-sky-400/45 bg-[#0A0F1F]/80 shadow-[0_0_12px_-2px_rgba(56,189,248,0.45)] transition hover:-translate-y-0.5 hover:border-sky-300/80 hover:shadow-[0_0_18px_0_rgba(56,189,248,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** "Starts in 2h 15m" / "Starts in 3d" / "Live now" — coarse on purpose; the lobby has the exact clock. */
function startLabel(startTime: string, status: string, now: number): string {
  const start = new Date(startTime).getTime();
  if (status === "active" || !Number.isFinite(start) || start <= now) return "Live now";
  const mins = Math.round((start - now) / 60000);
  if (mins < 60) return `Starts in ${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Starts in ${hours}h ${mins % 60}m`;
  return `Starts in ${Math.floor(hours / 24)}d`;
}

function SuggestionTile({
  c,
  creditSymbol,
  now,
}: {
  c: Suggestion;
  creditSymbol: string;
  now: number;
}) {
  const live = c.status === "active";
  const seats =
    c.maxParticipants && c.maxParticipants > 0
      ? `${c.currentParticipants ?? 0}/${c.maxParticipants}`
      : `${c.currentParticipants ?? 0}`;
  const fee = c.entryFee > 0 ? formatVolts(c.entryFee, { symbol: creditSymbol }) : "Free";

  return (
    <Link href={`/competitions/${c.competitionId}`} className={CARD} aria-label={`Open ${c.name}`}>
      {/*
        Reason: contest banners are operator artwork with baked-in copy
        (titles, icons, taglines). A fixed h-20 + object-cover box sliced
        those off (owner report, overview Suggested for you). Natural height
        + contain auto-supports whatever ratio the upload is — same fix as
        GamePageContests.
      */}
      <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-sky-900/40 to-indigo-900/30">
        {c.artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- unknown aspect; natural height must win
          <img
            src={c.artSrc}
            alt=""
            className="mx-auto block h-auto w-full object-contain object-center opacity-90 transition duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="aspect-[16/9]" aria-hidden />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0F1F] via-[#0A0F1F]/30 to-transparent" />
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${
            live
              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300"
              : "border-sky-400/50 bg-sky-500/15 text-sky-200"
          }`}
        >
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
          {live ? "Live" : "Upcoming"}
        </span>
        <span className="absolute right-2 top-2 rounded-full border border-amber-300/50 bg-black/50 px-2 py-0.5 text-[11px] font-bold text-amber-200 backdrop-blur-sm">
          {fee}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className={`${NEON_LABEL} truncate text-sky-300/80`}>{c.gameLabel ?? "Game"}</p>
          <p className="truncate text-sm font-semibold text-white">{c.name}</p>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-sky-400" aria-hidden />
            {startLabel(c.startTime, c.status, now)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 text-sky-400" aria-hidden />
            {seats}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 pt-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200">
            <Trophy className="h-3.5 w-3.5 text-amber-300" aria-hidden />
            {/* Reason: an absent pool is a dash, never 0 - a 0 reads as "nothing to win". */}
            {c.prizePool && c.prizePool > 0
              ? formatVolts(c.prizePool, { symbol: creditSymbol })
              : "-"}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 transition group-hover:text-sky-200">
            Join
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Contests suggested from games the player has actually played (X11.5).
 * Never invites anyone - suggestions only (X14).
 */
export default function GameSuggestionsCard({
  creditSymbol = "⚡",
}: {
  creditSymbol?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [contests, setContests] = useState<Suggestion[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/games/suggestions");
        const data = await res.json();
        if (cancelled || !res.ok || !data.success) return;
        setContests(Array.isArray(data.contests) ? data.contests : []);
        setInterests(Array.isArray(data.interests) ? data.interests : []);
        setNow(Date.now());
      } catch {
        // Silent - suggestions are additive chrome, not a required surface.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className={SECTION_FRAME} aria-busy="true">
        <div className="mb-3 h-4 w-40 animate-pulse rounded bg-sky-400/10" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[220px] animate-pulse rounded-xl border border-sky-400/15 bg-[#0A0F1F]/60" />
          ))}
        </div>
      </section>
    );
  }

  if (contests.length === 0) {
    if (interests.length === 0) return null;
    return (
      <section className={SECTION_FRAME}>
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/10 shadow-[0_0_14px_-2px_rgba(56,189,248,0.5)]">
            <Gamepad2 className="h-5 w-5 text-sky-300" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-white">No open contests for your games right now</p>
          <p className="max-w-sm text-xs text-gray-400">
            We will suggest contests here as soon as one opens for a game you play.
          </p>
          <Link
            href="/competitions"
            className="mt-1 inline-flex items-center gap-1 rounded-lg border border-sky-400/50 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:border-sky-300 hover:bg-sky-500/20"
          >
            Browse competitions
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="suggested-heading" className={SECTION_FRAME}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-400" aria-hidden />
          <h2 id="suggested-heading" className={NEON_HEADING}>
            Suggested for you
          </h2>
        </div>
        <Link
          href="/competitions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-sky-200"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <p className="mb-3 text-xs text-gray-400">Open contests for the games you play.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {contests.map((c) => (
          <SuggestionTile key={c.competitionId} c={c} creditSymbol={creditSymbol} now={now} />
        ))}
      </div>
    </section>
  );
}
