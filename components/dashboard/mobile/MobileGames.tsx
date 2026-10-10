"use client";

import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import type { OverviewPlayCard } from "@/lib/services/games/overview-types";
import MobileSection, { MOBILE_CARD, MOBILE_CAROUSEL } from "./MobileSection";

function formatScore(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString();
}

/** Play by Game as a swipe carousel — one card ~80% wide (spec s11). */
export function MobileGameCarousel() {
  const { data } = useDashboardOverview();
  const cards = data.overviewStanding.playCards;

  if (cards.length === 0) {
    return (
      <MobileSection title="Play by game" href="/games">
        <div className={`${MOBILE_CARD} p-4 text-sm text-gray-400`}>
          No games are listed yet. Check the Games hub soon.
        </div>
      </MobileSection>
    );
  }

  return (
    <MobileSection title="Play by game" href="/games">
      <ul className={MOBILE_CAROUSEL}>
        {cards.map((card) => (
          <li key={card.gameKey} className="w-[80%] shrink-0 snap-start">
            <Link
              href={card.href}
              className={`${MOBILE_CARD} relative flex h-[150px] flex-col justify-end overflow-hidden border-cyan-400/40 p-3.5`}
            >
              <Image
                src={card.artSrc}
                alt=""
                fill
                sizes="80vw"
                className="object-cover object-center opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050B18] via-[#050B18]/55 to-transparent" />
              <div className="relative flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-white">
                    {card.label}
                  </p>
                  <p className="truncate text-[11px] text-gray-300">
                    {card.contestsEntered} {card.activityLabel.toLowerCase()} · Best{" "}
                    {formatScore(card.bestScore)}
                  </p>
                </div>
                <span className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-cyan-400 px-4 text-xs font-bold text-[#04121F]">
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  Play
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </MobileSection>
  );
}

/**
 * Featured Games — titles the player has not entered yet (spec s12).
 *
 * Reason: with no play history the carousel above already IS the featured
 * list (discovery fallback), so repeating it here would be the same four
 * cards twice. Only once the player has history do unplayed titles differ.
 */
export function MobileFeaturedGames() {
  const { data } = useDashboardOverview();
  const cards = data.overviewStanding.playCards;
  const hasHistory = cards.some((c) => c.contestsEntered > 0);
  const unplayed: OverviewPlayCard[] = hasHistory
    ? cards.filter((c) => c.contestsEntered === 0).slice(0, 3)
    : [];
  if (unplayed.length === 0) return null;

  return (
    <MobileSection title="Featured games" href="/games">
      <ul className="grid grid-cols-3 gap-2.5">
        {unplayed.map((card) => (
          <li key={card.gameKey}>
            <Link href={card.href} className="block">
              <span
                className={`${MOBILE_CARD} relative block aspect-square overflow-hidden border-violet-400/35`}
              >
                <Image
                  src={card.artSrc}
                  alt=""
                  fill
                  sizes="33vw"
                  className="object-cover"
                />
              </span>
              <span className="mt-1.5 block truncate text-center text-[11px] font-semibold text-gray-200">
                {card.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </MobileSection>
  );
}
