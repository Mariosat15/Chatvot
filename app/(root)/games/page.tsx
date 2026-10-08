import Image from "next/image";
import { Suspense } from "react";
import { Gamepad2 } from "lucide-react";
import { NEON_HEADING } from "@/components/neon/tokens";
import { GamesHero } from "@/components/games/catalogue/GamesHero";
import { GamesGrid } from "@/components/games/catalogue/GamesGrid";
import {
  GameCatalogueFilters,
  type CatalogueFilterOption,
} from "@/components/games/catalogue/GameCatalogueFilters";
import {
  listBrowsableGames,
  type BrowsableGame,
} from "@/lib/services/games/player-catalogue.service";
import { loadCatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";

export const dynamic = "force-dynamic";

/**
 * Games catalogue hub (X11 Slice 1 + thin merchandising + task 9 discovery filter).
 *
 * Server component only — listing is a read. Never launches a round.
 * Order / featured / coming-soon come from `game_catalogue_entry`. One grid in catalogue order:
 * featured is a badge on the card, not a separate section (owner, Rebuild theGame Area).
 *
 * Reason (8 Oct 2026): full-bleed arena + wide content so the page matches Image 1 scale.
 * Reason (polish, same day): fixed viewport arena + solid navy floor so a short filter
 * result or a long catalogue never reveals a hard edge under the artwork.
 */

/** Cache-busted arena plate from Menuitems `Neon Cyberpunk Trophy Arena.png`. */
const ARENA_BG = "/assets/neon/games-catalogue-arena-r1.webp";

interface GamesCataloguePageProps {
  searchParams: Promise<{ category?: string }>;
}

function collectFilterOptions(games: BrowsableGame[]): CatalogueFilterOption[] {
  const seen = new Map<string, string>();
  for (const game of games) {
    if (!game.categorySlug || !game.category) continue;
    if (!seen.has(game.categorySlug)) {
      seen.set(game.categorySlug, game.category);
    }
  }
  return [...seen.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default async function GamesCataloguePage({
  searchParams,
}: GamesCataloguePageProps) {
  const { category: rawCategory } = await searchParams;

  const games = await listBrowsableGames();
  const filterOptions = collectFilterOptions(games);
  // Reason: accept any slug that appears on a live card (including custom genres), refuse
  // invented ones so a bad bookmark does not look like an empty catalogue.
  const activeSlug =
    typeof rawCategory === "string" &&
    filterOptions.some((o) => o.slug === rawCategory)
      ? rawCategory
      : undefined;

  const filtered = activeSlug
    ? games.filter((g) => g.categorySlug === activeSlug)
    : games;

  const statsByKey = await loadCatalogueCardStats(filtered.map((g) => g.gameKey));

  return (
    <div className="games-catalogue-page relative isolate -mx-3 min-h-[100dvh] bg-[#020B1A] sm:-mx-4 md:-mx-5 lg:-mx-6">
      {/*
        Reason: fixed to the viewport, not the content height. A filtered short list used
        to end the absolute plate mid-page; a long list scrolled past it into empty black.
        The navy page fill + bottom gradient is the floor that continues forever.
      */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <Image
          src={ARENA_BG}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_28%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(1,8,25,.12)_0%,rgba(1,8,25,.28)_42%,rgba(2,11,26,.78)_78%,#020B1A_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_88%_8%,rgba(0,190,255,.12),transparent_70%),radial-gradient(40%_35%_at_12%_70%,rgba(152,92,255,.08),transparent_70%)]" />
      </div>

      <div className="games-page-content relative mx-auto w-[min(1420px,calc(100%-32px))] px-2 pb-16 pt-1 sm:w-[min(1420px,calc(100%-48px))] sm:px-3 lg:w-[min(1420px,calc(100%-64px))]">
        <GamesHero>
          <Suspense fallback={null}>
            <GameCatalogueFilters options={filterOptions} activeSlug={activeSlug} />
          </Suspense>
        </GamesHero>

        <div className="mt-8 sm:mt-9">
          {filtered.length === 0 ? (
            <div className="space-y-3 rounded-[18px] border border-[rgba(38,171,255,.28)] bg-[rgba(6,16,36,.72)] p-8 text-center backdrop-blur-md">
              <Gamepad2 className="mx-auto h-8 w-8 text-gray-500" />
              <p className={`${NEON_HEADING} text-lg`}>
                {activeSlug ? "No games in this genre" : "No games available yet"}
              </p>
              <p className="text-sm text-gray-400">
                {activeSlug
                  ? "Try another genre, or clear the filter to see every game."
                  : "Check back soon, or open Competitions for contests that are already live."}
              </p>
            </div>
          ) : (
            <GamesGrid games={filtered} statsByKey={statsByKey} />
          )}
        </div>
      </div>
    </div>
  );
}
