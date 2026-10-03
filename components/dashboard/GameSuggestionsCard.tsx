"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
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
  "rounded-2xl border border-cyan-400/65 bg-gradient-to-b from-[rgba(5,18,42,0.98)] to-[rgba(2,9,24,0.98)] p-5 shadow-[0_0_28px_-6px_rgba(0,200,255,0.35),inset_0_0_20px_rgba(56,189,248,0.08)] sm:p-6";

const CARD =
  "group relative flex h-full flex-col overflow-hidden rounded-xl border border-[rgba(0,220,255,0.65)] bg-gradient-to-b from-[rgba(5,18,42,0.98)] to-[rgba(2,9,24,0.98)] shadow-[0_0_18px_rgba(0,200,255,0.12)] transition hover:-translate-y-0.5 hover:border-cyan-300/90 hover:shadow-[0_0_22px_rgba(0,200,255,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Knock out the black canvas ChatGPT exports leave around neon plates. */
const KNOCK_BLACK = "mix-blend-screen";

/** Badge plates — 28–32px tall, never tiny. */
const BADGE_IMG = `h-8 w-auto shrink-0 ${KNOCK_BLACK}`;

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
  const seats =
    c.maxParticipants && c.maxParticipants > 0
      ? `${c.currentParticipants ?? 0}/${c.maxParticipants}`
      : `${c.currentParticipants ?? 0}`;
  const prizeArt = suggestedPrizeArt(c.gameKey);
  const isPrivate = c.visibility === "gm_private";
  const isGmFunded = c.fundingMode === "gm_funded";
  // Reason: prizePool is authoritative; absent/zero renders a dash, never entry fee.
  const prizeAmount =
    typeof c.prizePool === "number" && Number.isFinite(c.prizePool) && c.prizePool > 0
      ? formatVolts(c.prizePool, { symbol: creditSymbol })
      : "-";

  return (
    <Link
      href={`/competitions/${c.competitionId}`}
      className={CARD}
      aria-label={`Open ${c.name}`}
    >
      {/*
        1. Cover — clean hero only (Image 2). No Upcoming / entry-fee pills on
        the artwork; status lives in the badge row below.
      */}
      <div className="relative aspect-[16/8.5] w-full shrink-0 overflow-hidden bg-gradient-to-br from-sky-900/40 to-indigo-900/30">
        {c.artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- catalogue URLs vary by host
          <img
            src={c.artSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-95 transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020918] via-[#020918]/20 to-transparent" />
      </div>

      {/*
        Body order (Image 2): badges → game label → title → blurb → meta →
        prize strip → Join. Tight gaps, no stretched navy voids.
      */}
      <div className="flex flex-1 flex-col px-3.5 pb-3 pt-2.5">
        {/* 2. Status badges — GM Funded from fundingMode; Private/Public from visibility. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isGmFunded ? (
            <Image
              src={SUGGESTED_UI_ART.badgeGmFunded}
              alt="GM Funded"
              width={130}
              height={32}
              className={BADGE_IMG}
            />
          ) : null}
          {isPrivate ? (
            <Image
              src={SUGGESTED_UI_ART.badgePrivate}
              alt="Private"
              width={110}
              height={32}
              className={BADGE_IMG}
            />
          ) : (
            <Image
              src={SUGGESTED_UI_ART.badgePublic}
              alt="Public"
              width={110}
              height={32}
              className={BADGE_IMG}
            />
          )}
        </div>

        {/* 3–5. Game label → competition title → description */}
        <div className="mt-3 min-w-0">
          <p className="truncate text-[12px] font-bold uppercase tracking-[0.14em] text-cyan-300">
            {c.gameLabel ?? "Game"}
          </p>
          <p className="mt-1 line-clamp-2 text-[19px] font-bold leading-snug text-white">
            {c.name}
          </p>
          {c.blurb ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-slate-400">
              {c.blurb}
            </p>
          ) : null}
        </div>

        {/* 6. Meta — starts-in left / seats right (plain text, never pills). */}
        <div className="mt-3.5 flex items-center justify-between gap-2 text-[13px] font-semibold text-cyan-100">
          <span className="inline-flex min-w-0 items-center gap-1.5 tabular-nums">
            <Image
              src={SUGGESTED_UI_ART.clock}
              alt=""
              width={18}
              height={18}
              className={`h-[18px] w-[18px] shrink-0 object-contain ${KNOCK_BLACK}`}
            />
            <span className="truncate">{startLabel(c.startTime, c.status, now)}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 tabular-nums">
            <Image
              src={SUGGESTED_UI_ART.users}
              alt=""
              width={18}
              height={18}
              className={`h-[18px] w-[18px] shrink-0 object-contain ${KNOCK_BLACK}`}
            />
            {seats}
          </span>
        </div>

        {/*
          7. Prize strip — full banner plate is the background (art on the
          right by design). Small trophy icon + amount sit on the empty left.
          Never crop the banner into a framed 42% picture box.
        */}
        <div className="relative mt-3.5 h-[88px] overflow-hidden rounded-xl">
          <Image
            src={prizeArt}
            alt=""
            fill
            sizes="280px"
            className="object-cover object-right"
          />
          <div className="relative z-[1] flex h-full max-w-[58%] items-center gap-2.5 px-3.5">
            <span className="relative h-9 w-9 shrink-0">
              <Image
                src={SUGGESTED_PRIZE_ART.icon}
                alt=""
                fill
                sizes="36px"
                className={`object-contain ${KNOCK_BLACK}`}
              />
            </span>
            <div className="min-w-0">
              <p
                className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
                  isGmFunded ? "text-amber-200/90" : "text-cyan-300/90"
                }`}
              >
                Prize
              </p>
              <p className="mt-0.5 truncate text-[26px] font-extrabold leading-none tabular-nums text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                {prizeAmount}
              </p>
            </div>
          </div>
        </div>

        {/*
          8. Join CTA — plate already says "Join →". Never overlay that word
          again (that was the "JJoin" glitch on Image 1).
        */}
        <span className="relative mt-3.5 block h-[50px] w-full overflow-hidden transition group-hover:brightness-110">
          <Image
            src={SUGGESTED_UI_ART.join}
            alt="Join"
            fill
            sizes="280px"
            className={`object-contain ${KNOCK_BLACK}`}
          />
          <span className="sr-only">Join</span>
        </span>
      </div>
    </Link>
  );
}

/**
 * Contests suggested from games the player has actually played (X11.5).
 * Layout matches owner Image 2 (3 Oct 2026): clean cover, GM/Private/Public
 * badges, full prize-strip background, Join plate without double text.
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
        <div className="mb-3 h-5 w-48 animate-pulse rounded bg-cyan-400/10" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[380px] animate-pulse rounded-xl border border-cyan-400/15 bg-[#0A0F1F]/60"
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
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/10 shadow-[0_0_14px_-2px_rgba(56,189,248,0.5)]">
            <Gamepad2 className="h-5 w-5 text-cyan-300" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-white">
            No open contests for your games right now
          </p>
          <p className="max-w-sm text-[13px] text-gray-400">
            We will suggest contests here as soon as one opens for a game you play.
          </p>
          <Link
            href="/competitions"
            className="mt-1 inline-flex items-center gap-1 rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-[13px] font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/20"
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
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
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
          <div>
            <h2
              id="suggested-heading"
              className="text-[20px] font-bold uppercase tracking-[0.12em] text-[#16DFFF]"
            >
              Suggested for you
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-300">
              Open contests for the games you play.
            </p>
          </div>
        </div>
        <Link
          href="/competitions"
          className="inline-flex items-center gap-1 text-[14px] font-semibold text-cyan-300 hover:text-cyan-200"
        >
          View all
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
