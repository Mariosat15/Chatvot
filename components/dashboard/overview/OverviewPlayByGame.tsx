"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gamepad2 } from "lucide-react";
import type { OverviewPlayCard } from "@/lib/services/games/overview-types";
import { OVERVIEW_PLAY_CARD_LIMIT } from "@/lib/services/games/overview-types";
import { NEON_PANEL, NEON_HEADING, NEON_LABEL } from "@/components/neon/tokens";

// Reason: 29 Sep 2026 - the owner could not tell the strip was one section, or
// where one game's artwork ended and the next began. A fine neon frame bounds
// the section; each card carries its own brighter edge and glow.
const PLAY_SECTION_FRAME =
  "rounded-2xl border border-sky-400/35 bg-[#050B18]/40 p-3 shadow-[0_0_18px_-6px_rgba(56,189,248,0.45),inset_0_0_14px_rgba(56,189,248,0.06)]";
const PLAY_CARD =
  "rounded-xl border border-sky-400/45 bg-[#0A0F1F]/80 backdrop-blur-sm shadow-[0_0_12px_-2px_rgba(56,189,248,0.45)] hover:border-sky-300/80 hover:shadow-[0_0_18px_0_rgba(56,189,248,0.6)]";

interface OverviewPlayByGameProps {
  cards: OverviewPlayCard[];
}

function formatScore(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

/**
 * Play-by-game strip: most-played titles once the player has history;
 * catalogue top N (featured + sortOrder) when they have not played yet.
 */
export default function OverviewPlayByGame({ cards }: OverviewPlayByGameProps) {
  // Reason: zero contests on every card means the discovery fallback — caption
  // must not claim "most played" for a player who has never entered.
  const hasPlayHistory = cards.some((c) => c.contestsEntered > 0);

  return (
    <section aria-labelledby="play-by-game-heading" className={PLAY_SECTION_FRAME}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-sky-400" aria-hidden />
          <h2
            id="play-by-game-heading"
            className={`${NEON_HEADING} text-sm uppercase tracking-[0.14em]`}
          >
            Play by game
          </h2>
        </div>
        <p className="text-xs text-gray-500">
          {hasPlayHistory
            ? `Your top ${OVERVIEW_PLAY_CARD_LIMIT} most played. Each game builds different skills.`
            : `Featured games to get started. Each builds different skills.`}
        </p>
      </div>

      {cards.length === 0 ? (
        <div
          className={`${NEON_PANEL} flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div>
            <p className={NEON_HEADING}>No games available yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Check the Games hub once titles are listed — your most-played
              will show here with your stats.
            </p>
          </div>
          <Link
            href="/games"
            className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-300 ring-1 ring-sky-400/40 transition hover:bg-sky-500/25"
          >
            Browse games
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <li key={card.gameKey}>
              <Link
                href={card.href}
                className={`group ${PLAY_CARD} relative flex h-full min-h-[148px] overflow-hidden transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60`}
                aria-label={`Open ${card.label}`}
              >
                <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between p-3.5 pr-24 sm:pr-28">
                  <div>
                    <p className={`${NEON_HEADING} text-base`}>{card.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">
                      {card.tagline || "Open the game page to play."}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-300">
                    <span>
                      <span className="font-semibold text-white">
                        {card.contestsEntered.toLocaleString()}
                      </span>{" "}
                      <span className="text-gray-500">{card.activityLabel}</span>
                    </span>
                    <span>
                      <span className={NEON_LABEL}>Best score</span>{" "}
                      <span className="font-semibold text-white">
                        {formatScore(card.bestScore)}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%]">
                  <Image
                    src={card.artSrc}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover object-center opacity-90 transition duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#050B18]/20 to-[#050B18]" />
                </div>
                <span className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40 transition group-hover:bg-sky-500/35">
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
