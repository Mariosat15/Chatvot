"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Gamepad2 } from "lucide-react";
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
  const live = c.status === "active";
  const seats =
    c.maxParticipants && c.maxParticipants > 0
      ? `${c.currentParticipants ?? 0}/${c.maxParticipants}`
      : `${c.currentParticipants ?? 0}`;
  // Reason: entry fee (top-right) is not the prize — GM-funded seats read Free.
  const fee =
    c.fundingMode === "gm_funded" || c.entryFee <= 0
      ? "Free"
      : formatVolts(c.entryFee, { symbol: creditSymbol });
  const prizeArt = suggestedPrizeArt(c.gameKey);
  const isPrivate = c.visibility === "gm_private";
  const isGmFunded = c.fundingMode === "gm_funded";
  const prizeAmount =
    c.prizePool && c.prizePool > 0
      ? formatVolts(c.prizePool, { symbol: creditSymbol })
      : "-";

  return (
    <Link
      href={`/competitions/${c.competitionId}`}
      className={CARD}
      aria-label={`Open ${c.name}`}
    >
      {/* 1. Artwork — fixed 16/8.5 so the hero stays ~40% of the card (Image 1). */}
      <div className="relative aspect-[16/8.5] w-full shrink-0 overflow-hidden bg-gradient-to-br from-sky-900/40 to-indigo-900/30">
        {c.artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- catalogue URLs vary by host
          <img
            src={c.artSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-95 transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020918] via-[#020918]/25 to-transparent" />
        <span
          className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm ${
            live
              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300"
              : "border-cyan-400/60 bg-black/55 text-white"
          }`}
        >
          {live ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
          )}
          {live ? "Live" : "Upcoming"}
        </span>
        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-0.5 rounded-full border border-amber-300/70 bg-black/55 px-2.5 py-1 text-[12px] font-bold tabular-nums text-amber-200 backdrop-blur-sm">
          {fee}
        </span>
      </div>

      {/*
        Body rhythm (Image 1): badges 10px under art, then label/title/desc,
        meta, prize, join — tight gaps, no stretched navy voids.
      */}
      <div className="flex flex-1 flex-col px-3.5 pb-3 pt-2.5">
        {/* 2. Status badges — GM Funded when fundingMode says so; never hidden. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isGmFunded && (
            <Image
              src={SUGGESTED_UI_ART.badgeGmFunded}
              alt="GM Funded"
              width={130}
              height={32}
              className={BADGE_IMG}
            />
          )}
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
        <div className="mt-3.5 min-w-0">
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

        {/* 6. Meta — one row, starts-in left / seats right */}
        <div className="mt-4 flex items-center justify-between gap-2 text-[13px] font-semibold text-cyan-100">
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
          7. Prize panel — one integrated strip. Panel chrome follows funding
          (gold for GM funded, cyan otherwise). Decorative art is absolute on
          the right, never a framed picture box. Amount is entry-fee-independent.
        */}
        <div
          className={`relative mt-4 h-[88px] overflow-hidden rounded-xl border px-3.5 ${
            isGmFunded
              ? "border-amber-300/65 bg-gradient-to-r from-amber-950/80 via-[#2a1a08]/90 to-amber-950/40 shadow-[inset_0_0_24px_rgba(250,204,21,0.12)]"
              : "border-cyan-400/55 bg-gradient-to-r from-[#041828]/95 via-[#061a2e]/90 to-[#041428]/50 shadow-[inset_0_0_24px_rgba(56,189,248,0.12)]"
          }`}
        >
          <Image
            src={prizeArt}
            alt=""
            width={180}
            height={100}
            className={`pointer-events-none absolute inset-y-0 right-0 h-full w-[42%] object-contain object-right opacity-95 ${KNOCK_BLACK}`}
          />
          <div className="relative z-[1] flex h-full max-w-[58%] items-center gap-2.5">
            <span className="relative h-9 w-9 shrink-0">
              <Image
                src={SUGGESTED_PRIZE_ART.trophy}
                alt=""
                fill
                sizes="36px"
                className={`object-contain ${KNOCK_BLACK}`}
              />
            </span>
            <div className="min-w-0">
              <p
                className={`text-[12px] font-bold uppercase tracking-[0.16em] ${
                  isGmFunded ? "text-amber-200/90" : "text-cyan-300/90"
                }`}
              >
                Prize
              </p>
              <p className="mt-0.5 truncate text-[28px] font-extrabold leading-none tabular-nums text-white drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]">
                {prizeAmount}
              </p>
            </div>
          </div>
        </div>

        {/* 8. Join CTA — compact premium strip, not a tall flat pill */}
        <span className="relative mt-3.5 inline-flex h-[50px] w-full items-center justify-center overflow-hidden rounded-[14px] border border-cyan-300/85 bg-gradient-to-r from-[#0a4a8a] via-[#0e6bb8] to-[#14b8e0] text-[16px] font-bold text-white shadow-[0_0_20px_-2px_rgba(0,200,255,0.75),inset_0_0_14px_rgba(125,211,252,0.28)] transition group-hover:brightness-110">
          <span
            className="pointer-events-none absolute inset-0 opacity-35"
            aria-hidden
          >
            <Image
              src={SUGGESTED_UI_ART.join}
              alt=""
              fill
              sizes="280px"
              className={`object-cover ${KNOCK_BLACK}`}
            />
          </span>
          <span className="relative z-[1] inline-flex items-center gap-1.5">
            Join
            <ArrowRight
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </span>
      </div>
    </Link>
  );
}

/**
 * Contests suggested from games the player has actually played (X11.5).
 * Layout matches owner Image 1 densify pass (3 Oct 2026) — tighter cards,
 * fixed art ratio, strong badges, integrated prize strip.
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
