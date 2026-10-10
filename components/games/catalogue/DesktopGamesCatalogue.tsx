import { Suspense } from "react";
import { Gamepad2 } from "lucide-react";
import { NEON_HEADING } from "@/components/neon/tokens";
import { GamesHero } from "./GamesHero";
import { GamesGrid } from "./GamesGrid";
import {
  GameCatalogueFilters,
  type CatalogueFilterOption,
} from "./GameCatalogueFilters";
import type { GameCardData } from "./catalogue-types";
import type { CatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";

/**
 * Desktop Games Catalogue shell (md and up).
 *
 * Reason (8 Oct 2026, mobile launcher task): extracted from the page so phones get a
 * dedicated tree. Visuals and structure match the pre-split desktop page — do not
 * redesign this when changing mobile.
 */

export function DesktopGamesCatalogue({
  games,
  filterOptions,
  activeSlug,
  statsByKey,
}: {
  games: GameCardData[];
  filterOptions: CatalogueFilterOption[];
  activeSlug?: string;
  statsByKey: Map<string, CatalogueCardStats>;
}) {
  return (
    <div className="games-page-content relative mx-auto w-[min(1420px,calc(100%-32px))] px-2 pb-16 pt-1 sm:w-[min(1420px,calc(100%-48px))] sm:px-3 lg:w-[min(1420px,calc(100%-64px))]">
      <GamesHero>
        <Suspense fallback={null}>
          <GameCatalogueFilters options={filterOptions} activeSlug={activeSlug} />
        </Suspense>
      </GamesHero>

      <div className="mt-8 sm:mt-9">
        {games.length === 0 ? (
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
          <GamesGrid games={games} statsByKey={statsByKey} />
        )}
      </div>
    </div>
  );
}
