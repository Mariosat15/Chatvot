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

export const dynamic = "force-dynamic";

/**
 * Games catalogue hub (X11 Slice 1 + thin merchandising + task 9 discovery filter).
 *
 * Server component only — listing is a read. Never launches a round.
 * Order / featured / coming-soon come from `game_catalogue_entry`. One grid in catalogue order:
 * featured is a badge on the card, not a separate section, so the order an operator sets is the
 * order a player sees.
 * Genre filter is `?category=<slug>` — withheld when fewer than two genres are present.
 */

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
  return (
    <div className="relative isolate overflow-hidden rounded-2xl bg-[#020817]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_85%_0%,rgba(0,190,255,.16),transparent_70%),radial-gradient(50%_40%_at_10%_60%,rgba(0,110,255,.10),transparent_70%),radial-gradient(40%_30%_at_60%_100%,rgba(0,216,255,.08),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] bg-[linear-gradient(rgba(120,243,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(120,243,255,.6)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(180deg,#000,transparent_85%)]"
      />

      <GamesHero>
        <Suspense fallback={null}>
          <GameCatalogueFilters options={filterOptions} activeSlug={activeSlug} />
        </Suspense>
      </GamesHero>

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <div className="space-y-3 rounded-[18px] border border-[rgba(38,171,255,.30)] bg-[rgba(6,16,36,.85)] p-8 text-center">
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
          <GamesGrid games={filtered} />
        )}
      </div>
    </div>
  );
}