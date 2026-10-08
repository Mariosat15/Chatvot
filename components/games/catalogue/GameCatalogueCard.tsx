import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { providerBanner } from "@/components/neon/banners";
import type { CatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";
import { GameCategoryBadge } from "./GameCategoryBadge";
import { GameStatistics } from "./GameStatistics";
import { resolveGameCardAccent } from "./game-card-accent";
import type { GameCardData } from "./catalogue-types";

/**
 * One card on the `/games` hub — esports launcher tile, not a blog card.
 *
 * Links to `/games/[slug]` only — never a round-launch URL (13 s1.1a).
 * Reason (8 Oct 2026, Rebuild theGame Area): large artwork, per-game accent, stats, CTA.
 * Reason (polish): taller 16/9 art so banners are less cropped; lighter rim/glow so the
 * grid does not feel heavy; tighter body padding so stats fill the footer.
 */

export function GameCard({
  game,
  stats,
}: {
  game: GameCardData;
  stats?: CatalogueCardStats | null;
}) {
  const banner =
    game.bannerUrl || game.thumbnailUrl
      ? {
          src: (game.bannerUrl || game.thumbnailUrl) as string,
          alt: `${game.displayName} artwork`,
        }
      : providerBanner(game.gameCode);
  const blurb = game.tagline || game.description;
  const accent = resolveGameCardAccent(game);

  return (
    <Link
      href={`/games/${game.slug}`}
      aria-label={`Open ${game.displayName}`}
      className="group flex h-full rounded-[16px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8ff]/70 touch-manipulation"
      style={
        {
          "--game-accent": accent.accent,
          "--game-accent-soft": accent.accentSecondary,
        } as CSSProperties
      }
    >
      <article
        className="flex h-full w-full flex-col overflow-hidden rounded-[16px] border bg-[linear-gradient(180deg,rgba(7,20,50,.88),rgba(2,12,32,.94))] transition-[transform,box-shadow] duration-[220ms] ease-out group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
        style={{
          borderColor: "color-mix(in srgb, var(--game-accent) 55%, transparent)",
          boxShadow: `
            0 12px 32px rgba(0,0,0,.28),
            0 0 10px color-mix(in srgb, var(--game-accent) 14%, transparent),
            inset 0 1px 0 rgba(255,255,255,.04)
          `,
        }}
      >
        {/*
          Reason: 16/9 cinematic frame (Image 4) — taller than the old 190px box so
          wide banners show more of the plate instead of a tight centre crop.
        */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[#07101F]">
          <Image
            src={banner.src}
            alt={banner.alt}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 460px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            style={{ objectPosition: accent.objectPosition }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_58%,rgba(3,10,25,.55))]" />
          {game.category ? (
            <div className="absolute left-3 top-3">
              <GameCategoryBadge slug={game.categorySlug} label={game.category} />
            </div>
          ) : null}
          {game.isFeatured || game.comingSoon ? (
            <div className="absolute right-3 top-3 flex gap-1.5">
              {game.isFeatured ? (
                <span className="inline-flex h-7 items-center rounded-lg border border-[#FFD447]/55 bg-[rgba(3,14,35,.8)] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#FFD447] backdrop-blur-md">
                  Featured
                </span>
              ) : null}
              {game.comingSoon ? (
                <span className="inline-flex h-7 items-center rounded-lg border border-[rgba(0,220,255,.45)] bg-[rgba(3,14,35,.75)] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#78f3ff] backdrop-blur-md">
                  Coming soon
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 px-4 pb-4 pt-3.5 sm:px-5">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-[20px] font-extrabold uppercase tracking-[0.05em] text-white sm:text-[22px]">
              {game.displayName}
            </h2>
            {/* Reason: always reserve two lines so short and long copy give equal cards. */}
            <p className="min-h-[2.5rem] text-[13px] leading-5 text-gray-400 line-clamp-2 sm:text-[14px]">
              {blurb || "Open the game page to read the rules and join a contest."}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0 flex-1">
              <GameStatistics stats={stats} />
            </div>
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-[rgba(0,0,0,.2)] text-white transition-[transform,background-color,box-shadow] duration-[220ms] group-hover:scale-105 motion-reduce:transition-none sm:h-14 sm:w-14 sm:border-2"
              style={{
                borderColor: "var(--game-accent)",
                boxShadow: "0 0 14px color-mix(in srgb, var(--game-accent) 32%, transparent)",
                color: "var(--game-accent-soft)",
              }}
            >
              <ArrowRight className="h-5 w-5 transition-transform duration-[220ms] group-hover:translate-x-[3px] motion-reduce:transition-none sm:h-6 sm:w-6" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

/** The name the hub and the tests have always used. */
export const GameCatalogueCard = GameCard;
