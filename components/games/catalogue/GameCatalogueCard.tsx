import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { providerBanner } from "@/components/neon/banners";
import { GameCategoryBadge } from "./GameCategoryBadge";
import type { GameCardData } from "./catalogue-types";

/**
 * One card on the `/games` hub.
 *
 * Links to `/games/[slug]` only - never to a round-launch URL. Prefetching a launch URL would
 * spend a paying player's attempt (13 s1.1a).
 *
 * The whole card is the link, so the arrow is decoration inside it rather than a second
 * control. Nothing here names a game: artwork, genre and copy all come from the catalogue row.
 */
export function GameCard({ game }: { game: GameCardData }) {
  const banner =
    game.bannerUrl || game.thumbnailUrl
      ? {
          src: (game.bannerUrl || game.thumbnailUrl) as string,
          alt: `${game.displayName} artwork`,
        }
      : providerBanner(game.gameCode);
  const blurb = game.tagline || game.description;

  return (
    <Link
      href={`/games/${game.slug}`}
      aria-label={`Open ${game.displayName}`}
      className="group flex h-full rounded-[18px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8ff]/70 touch-manipulation"
    >
      {/*
        Reason: grid rows stretch by default, but the card must also be h-full flex-col or a
        one-line tagline leaves a shorter box beside a two-line neighbour (owner: boxes must
        always match).
      */}
      <article className="flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-[rgba(38,171,255,.30)] bg-[linear-gradient(180deg,rgba(10,23,48,.96),rgba(4,12,29,.98))] shadow-[0_18px_50px_rgba(0,0,0,.35),inset_0_1px_0_rgba(255,255,255,.03)] transition-[transform,border-color,box-shadow] duration-[220ms] ease-out group-hover:-translate-y-1 group-hover:border-[rgba(0,220,255,.8)] group-hover:shadow-[0_18px_50px_rgba(0,0,0,.35),0_0_30px_rgba(0,190,255,.10),inset_0_1px_0_rgba(255,255,255,.03)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <div className="relative aspect-[16/8.5] w-full shrink-0 overflow-hidden bg-[#07101F]">
          {/*
            Reason: the owner asked (28 Sep 2026) for the artwork to fill the whole image area.
            The card art is authored for this shape, so cover crops only its margins.
          */}
          <Image
            src={banner.src}
            alt={banner.alt}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 460px"
            className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgba(3,10,25,.65))]" />
          {game.category ? (
            <div className="absolute left-3 top-3">
              <GameCategoryBadge slug={game.categorySlug} label={game.category} />
            </div>
          ) : null}
          {game.isFeatured || game.comingSoon ? (
            <div className="absolute right-3 top-3 flex gap-1.5">
              {game.isFeatured ? (
                <span className="inline-flex h-7 items-center rounded-lg border border-amber-400/50 bg-[rgba(3,14,35,.75)] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300 backdrop-blur-md">
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

        <div className="flex flex-1 items-center justify-between gap-4 px-5 pb-5 pt-[18px]">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="truncate text-[17px] font-bold uppercase tracking-[0.08em] text-[#00d8ff] sm:text-[18px]">
              {game.displayName}
            </h2>
            {/* Reason: always reserve two lines so short and long copy give equal cards. */}
            <p className="min-h-[2.5rem] text-[14px] leading-5 text-gray-400 line-clamp-2">
              {blurb || "Open the game page to read the rules and join a contest."}
            </p>
          </div>
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#00d8ff] bg-[rgba(0,216,255,.08)] text-[#78f3ff] shadow-[0_0_14px_rgba(0,216,255,.25)] transition-[transform,background-color,box-shadow] duration-[220ms] group-hover:scale-105 group-hover:bg-[rgba(0,216,255,.18)] group-hover:shadow-[0_0_22px_rgba(0,216,255,.45)] motion-reduce:transition-none"
          >
            <ArrowRight className="h-5 w-5 transition-transform duration-[220ms] group-hover:translate-x-[3px] motion-reduce:transition-none" />
          </span>
        </div>
      </article>
    </Link>
  );
}

/** The name the hub and the tests have always used. */
export const GameCatalogueCard = GameCard;
