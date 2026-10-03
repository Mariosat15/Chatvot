"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Gamepad2 } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import { NEON_HEADING } from "@/components/neon/tokens";
import {
  OVERVIEW_ICON_ART,
  SUGGESTED_PRIZE_ART,
  SUGGESTED_UI_ART,
  suggestedPrizeArt,
} from "@/lib/services/games/overview-assets";

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
  blurb?: string;
  visibility?: "public" | "gm_private";
  fundingMode?: "player_paid" | "gm_funded";
}

const SECTION_FRAME =
  "rounded-2xl border border-sky-400/55 bg-[#050B18]/70 p-3.5 shadow-[0_0_28px_-6px_rgba(56,189,248,0.65),inset_0_0_20px_rgba(56,189,248,0.08)]";
const CARD =
  "group relative flex h-full flex-col overflow-hidden rounded-xl border border-sky-400/55 bg-[#070E1C]/95 shadow-[0_0_18px_-2px_rgba(56,189,248,0.55)] transition hover:-translate-y-0.5 hover:border-sky-300/90 hover:shadow-[0_0_26px_0_rgba(56,189,248,0.7)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Knock out the black canvas ChatGPT exports leave around neon plates. */
const KNOCK_BLACK = "mix-blend-screen";

/** "Starts in 2h 44m" / "Live now" — plain text, never a pill (owner 3 Oct 2026). */
function startLabel(startTime: string, status: string, now: number): string {
  const start = new Date(startTime).getTime();
  if (status === "active" || !Number.isFinite(start) || start <= now) {
    return "Live now";
  }
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
  const fee =
    c.fundingMode === "gm_funded" || c.entryFee <= 0
      ? "Free"
      : formatVolts(c.entryFee, { symbol: creditSymbol });
  const prizeArt = suggestedPrizeArt(c.gameKey);
  const isPrivate = c.visibility === "gm_private";
  const isGmFunded = c.fundingMode === "gm_funded";
  const isCubes = prizeArt.includes("prize-cubes");

  return (
    <Link
      href={`/competitions/${c.competitionId}`}
      className={CARD}
      aria-label={`Open ${c.name}`}
    >
      {/*
        Reason: contest banners are operator artwork with baked-in copy.
        Natural height + contain — same auto-fit as GamePageContests.
      */}
      <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-sky-900/40 to-indigo-900/30">
        {c.artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- unknown aspect; natural height must win
          <img
            src={c.artSrc}
            alt=""
            className="mx-auto block h-auto w-full object-contain object-center opacity-95 transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="aspect-[16/9]" aria-hidden />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070E1C] via-[#070E1C]/30 to-transparent" />
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${
            live
              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300"
              : "border-sky-400/60 bg-sky-500/20 text-sky-100"
          }`}
        >
          {live ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          ) : (
            <Clock className="h-3 w-3" aria-hidden />
          )}
          {live ? "Live" : "Upcoming"}
        </span>
        <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full border border-amber-300/60 bg-black/55 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-200 backdrop-blur-sm">
          {fee}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {/*
          Reason: owner supplied full neon badge plates — screen-blend drops the
          black export canvas so only the glowing pill remains.
        */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isGmFunded && (
            <Image
              src={SUGGESTED_UI_ART.badgeGmFunded}
              alt="GM Funded"
              width={118}
              height={28}
              className={`h-7 w-auto ${KNOCK_BLACK}`}
            />
          )}
          {isPrivate ? (
            <Image
              src={SUGGESTED_UI_ART.badgePrivate}
              alt="Private"
              width={100}
              height={28}
              className={`h-7 w-auto ${KNOCK_BLACK}`}
            />
          ) : (
            <Image
              src={SUGGESTED_UI_ART.badgePublic}
              alt="Public"
              width={100}
              height={28}
              className={`h-7 w-auto ${KNOCK_BLACK}`}
            />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300/90">
            {c.gameLabel ?? "Game"}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold leading-snug text-white">
            {c.name}
          </p>
          {c.blurb ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
              {c.blurb}
            </p>
          ) : null}
        </div>

        {/*
          Reason: owner — Starts in must not sit in a pill / coloured background.
          Clock plate is screen-blended so its black canvas vanishes.
        */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-sky-200">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Image
              src={SUGGESTED_UI_ART.clock}
              alt=""
              width={22}
              height={22}
              className={`h-[22px] w-[22px] shrink-0 object-contain ${KNOCK_BLACK}`}
            />
            {startLabel(c.startTime, c.status, now)}
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Image
              src={SUGGESTED_UI_ART.users}
              alt=""
              width={22}
              height={22}
              className={`h-[22px] w-[22px] shrink-0 object-contain ${KNOCK_BLACK}`}
            />
            {seats}
          </span>
        </div>

        <div
          className={`relative mt-auto min-h-[78px] overflow-hidden rounded-lg border px-3 py-2.5 ${
            isCubes
              ? "border-sky-400/55 shadow-[inset_0_0_20px_rgba(56,189,248,0.12)]"
              : "border-amber-300/50 shadow-[inset_0_0_20px_rgba(250,204,21,0.1)]"
          }`}
        >
          {/*
            Reason: owner — backround1/2 sit UNDER the prize amount (right plate),
            not as a separate card. Text stays above via relative z.
          */}
          <Image
            src={prizeArt}
            alt=""
            width={160}
            height={90}
            className={`pointer-events-none absolute inset-y-0 right-0 h-full w-[62%] object-contain object-right opacity-95 ${KNOCK_BLACK}`}
          />
          <div className="relative z-[1] max-w-[48%]">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
                isCubes ? "text-sky-300/85" : "text-amber-200/85"
              }`}
            >
              Prize
            </p>
            <p className="mt-0.5 text-xl font-extrabold tabular-nums text-white drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]">
              {c.prizePool && c.prizePool > 0
                ? formatVolts(c.prizePool, { symbol: creditSymbol })
                : "-"}
            </p>
          </div>
        </div>

        <span className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-full border border-sky-300/80 bg-gradient-to-r from-sky-600/90 via-sky-500/85 to-cyan-400/90 text-sm font-bold text-white shadow-[0_0_22px_-2px_rgba(56,189,248,0.9),inset_0_0_14px_rgba(125,211,252,0.35)] transition group-hover:from-sky-500 group-hover:to-cyan-300">
          Join
          <ArrowRight
            className="h-4 w-4 transition group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}

/**
 * Contests suggested from games the player has actually played (X11.5).
 * Layout matches owner Suggested-for-you mock (3 Oct 2026).
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
            <div
              key={i}
              className="h-[320px] animate-pulse rounded-xl border border-sky-400/15 bg-[#0A0F1F]/60"
            />
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
          <p className="text-sm font-semibold text-white">
            No open contests for your games right now
          </p>
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
      <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Reason: prize plates sit UNDER the star; black canvases are screened out. */}
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <span className="pointer-events-none absolute inset-0 opacity-45" aria-hidden>
              <Image
                src={SUGGESTED_PRIZE_ART.trophy}
                alt=""
                fill
                sizes="44px"
                className={`${KNOCK_BLACK} object-contain`}
              />
            </span>
            <span className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
              <Image
                src={SUGGESTED_PRIZE_ART.cubes}
                alt=""
                fill
                sizes="44px"
                className={`${KNOCK_BLACK} object-contain`}
              />
            </span>
            <span className="relative h-11 w-11">
              <Image
                src={OVERVIEW_ICON_ART.star}
                alt=""
                fill
                sizes="44px"
                className={`${KNOCK_BLACK} object-contain`}
              />
            </span>
          </span>
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
      <p className="mb-3 text-xs text-gray-400">
        Open contests for the games you play.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {contests.map((c) => (
          <SuggestionTile
            key={c.competitionId}
            c={c}
            creditSymbol={creditSymbol}
            now={now}
          />
        ))}
      </div>
    </section>
  );
}
