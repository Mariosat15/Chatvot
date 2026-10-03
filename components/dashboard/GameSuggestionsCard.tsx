"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Gamepad2 } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import {
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
  "rounded-2xl border border-cyan-400/65 bg-gradient-to-b from-[rgba(5,18,42,0.98)] to-[rgba(2,9,24,0.98)] p-3.5 shadow-[0_0_28px_-6px_rgba(0,200,255,0.35),inset_0_0_20px_rgba(56,189,248,0.08)] sm:p-6";

const CARD =
  "group relative flex h-full flex-col overflow-hidden rounded-xl border border-[rgba(0,220,255,0.65)] bg-gradient-to-b from-[rgba(5,18,42,0.98)] to-[rgba(2,9,24,0.98)] shadow-[0_0_18px_rgba(0,200,255,0.12)] transition hover:-translate-y-0.5 hover:border-cyan-300/90 hover:shadow-[0_0_22px_rgba(0,200,255,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/**
 * Phone: a swipe row of Image-2-sized cards. From `sm`: 2 columns, `xl`: 4.
 * Reason: stacking six full-width covers inside a padded frame on a 390px
 * screen is what made this section "not look ok" on mobile (owner 3 Oct 2026).
 */
const TILE_ROW =
  "-mx-3.5 mt-4 flex snap-x snap-proximity scroll-px-3.5 gap-3 overflow-x-auto overscroll-x-contain px-3.5 pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4";
const TILE_SLOT = "w-[82%] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none";

/** Badge plates are transparent and cropped, so the height IS the badge. */
const BADGE_IMG = "h-7 w-auto shrink-0";

/** Overlay pill on the cover — translucent tint, never a black block. */
const COVER_PILL =
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold uppercase tracking-wide backdrop-blur-sm";

/**
 * Prize-art box. Reason: one fixed box on every card is what makes the art
 * "inline, all the same height and width" - both cut-outs are ~2.15:1.
 */
const PRIZE_ART_BOX = "relative h-[52px] w-[112px] shrink-0";

/** "Starts in 2h 44m" / "Live now". */
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
  const isStackArt = prizeArt === SUGGESTED_PRIZE_ART.cubes;
  const isPrivate = c.visibility === "gm_private";
  const isGmFunded = c.fundingMode === "gm_funded";
  const isLive = c.status === "active";
  // Reason: prizePool is authoritative; absent/zero renders a dash, never entry fee.
  const prizeAmount =
    typeof c.prizePool === "number" && Number.isFinite(c.prizePool) && c.prizePool > 0
      ? formatVolts(c.prizePool, { symbol: creditSymbol })
      : "-";
  const feeLabel =
    c.entryFee > 0 ? formatVolts(c.entryFee, { symbol: creditSymbol }) : "Free";

  return (
    <Link
      href={`/competitions/${c.competitionId}`}
      className={CARD}
      aria-label={`Open ${c.name}`}
    >
      {/*
        1. Cover — the competition's own image, else its game's catalogue art
        (resolved server-side). Upcoming/Live pill top-left, entry fee top-right.
      */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gradient-to-br from-sky-900/40 to-indigo-900/30">
        {c.artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- competition / catalogue URLs vary by host
          <img
            src={c.artSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#020918]/90 to-transparent" />
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          <span
            className={`${COVER_PILL} ${
              isLive
                ? "border-emerald-300/70 bg-emerald-500/25 text-emerald-100"
                : "border-cyan-300/70 bg-cyan-500/20 text-cyan-50"
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {isLive ? "Live" : "Upcoming"}
          </span>
          <span
            className={`${COVER_PILL} border-amber-300/70 bg-amber-500/20 text-amber-50 tabular-nums`}
          >
            {feeLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        {/* 2. Badges — GM Funded from fundingMode; Private/Public from visibility. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isGmFunded ? (
            <Image
              src={SUGGESTED_UI_ART.badgeGmFunded}
              alt="GM Funded"
              width={118}
              height={28}
              className={BADGE_IMG}
            />
          ) : null}
          {isPrivate ? (
            <Image
              src={SUGGESTED_UI_ART.badgePrivate}
              alt="Private"
              width={95}
              height={28}
              className={BADGE_IMG}
            />
          ) : (
            <Image
              src={SUGGESTED_UI_ART.badgePublic}
              alt="Public"
              width={94}
              height={28}
              className={BADGE_IMG}
            />
          )}
        </div>

        {/* 3–5. Game label → competition title → description */}
        <div className="mt-2.5 min-w-0">
          <p className="truncate text-[12px] font-bold uppercase tracking-[0.14em] text-cyan-300">
            {c.gameLabel ?? "Game"}
          </p>
          <p className="mt-1 line-clamp-2 text-[18px] font-bold leading-snug text-white">
            {c.name}
          </p>
          {c.blurb ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-400">
              {c.blurb}
            </p>
          ) : null}
        </div>

        {/* 6. Meta — starts-in left / seats right. mt-auto pins the bottom block level across cards. */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[13px] font-semibold text-cyan-100">
          <span className="inline-flex min-w-0 items-center gap-1.5 tabular-nums">
            <Image
              src={SUGGESTED_UI_ART.clock}
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0 object-contain"
            />
            <span className="truncate">{startLabel(c.startTime, c.status, now)}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 tabular-nums">
            <Image
              src={SUGGESTED_UI_ART.users}
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0 object-contain"
            />
            {seats}
          </span>
        </div>

        {/*
          7. Prize strip — CSS frame, fixed height; trophy, label + amount, then
          the art in one fixed box on the right. Same size on every card.
        */}
        <div
          className={`mt-3 flex h-[72px] items-center gap-2.5 rounded-xl border px-3 ${
            isStackArt
              ? "border-cyan-400/60 bg-cyan-500/[0.07] shadow-[inset_0_0_16px_rgba(34,211,238,0.12)]"
              : "border-amber-400/60 bg-amber-500/[0.07] shadow-[inset_0_0_16px_rgba(251,191,36,0.12)]"
          }`}
        >
          <span className="relative h-9 w-9 shrink-0">
            <Image
              src={SUGGESTED_PRIZE_ART.icon}
              alt=""
              fill
              sizes="36px"
              className="object-contain"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
                isStackArt ? "text-cyan-300" : "text-amber-200"
              }`}
            >
              Prize
            </p>
            <p className="mt-0.5 truncate text-[22px] font-extrabold leading-none tabular-nums text-white">
              {prizeAmount}
            </p>
          </div>
          <span className={PRIZE_ART_BOX}>
            <Image
              src={prizeArt}
              alt=""
              fill
              sizes="112px"
              className="object-contain object-right"
            />
          </span>
        </div>

        {/*
          8. Join — a CSS button, never an image plate, so it can never carry a
          black canvas. It is a span: the whole card is already the link.
        */}
        <span className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/80 bg-gradient-to-r from-cyan-500/30 via-sky-500/20 to-cyan-500/30 text-[15px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_0_16px_rgba(0,220,255,0.4),inset_0_0_12px_rgba(56,189,248,0.25)] transition group-hover:border-cyan-200 group-hover:shadow-[0_0_22px_rgba(0,220,255,0.6),inset_0_0_14px_rgba(56,189,248,0.35)]">
          Join
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/**
 * Contests suggested from games the player has actually played (X11.5).
 * Layout matches owner Image 2 (3 Oct 2026): competition cover with Upcoming
 * and fee pills, GM/Private/Public badges, fixed prize strip, CSS Join button.
 * Every image is a transparent PNG - nothing renders on a black canvas.
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
        <div className={TILE_ROW}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={TILE_SLOT}>
              <div className="h-[420px] animate-pulse rounded-xl border border-cyan-400/15 bg-[#0A0F1F]/60" />
            </div>
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
          <span className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
            <Image
              src={SUGGESTED_UI_ART.star}
              alt=""
              fill
              sizes="44px"
              className="object-contain"
            />
          </span>
          <div>
            <h2
              id="suggested-heading"
              className="text-[17px] font-bold uppercase tracking-[0.12em] text-[#16DFFF] sm:text-[20px]"
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
          className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-cyan-300 hover:text-cyan-200"
        >
          View all
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className={TILE_ROW}>
        {contests.map((c) => (
          <div key={c.competitionId} className={TILE_SLOT}>
            <SuggestionTile c={c} creditSymbol={creditSymbol} now={now} />
          </div>
        ))}
      </div>
    </section>
  );
}
