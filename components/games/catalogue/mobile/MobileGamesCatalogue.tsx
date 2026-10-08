import { Suspense } from "react";
import { Gamepad2 } from "lucide-react";
import type { CatalogueFilterOption } from "../GameCatalogueFilters";
import type { GameCardData } from "../catalogue-types";
import type { CatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";
import { MobileGamesHeader } from "./MobileGamesHeader";
import { MobileGamesFilters } from "./MobileGamesFilters";
import { MobileGameCard } from "./MobileGameCard";

/**
 * Dedicated mobile Games Catalogue launcher (below md).
 *
 * Reason (8 Oct 2026): owner design-reference/game catalog mobile — one card per
 * row, featured first, swipe filters, full-width CTA. Not the desktop grid stacked.
 * Desktop tree is separate; this file must not be imported there.
 */

function orderForMobile(games: GameCardData[]): GameCardData[] {
  // Reason: featured first, otherwise keep catalogue order so future titles stay stable.
  return [...games].sort((a, b) => {
    if (a.isFeatured === b.isFeatured) return 0;
    return a.isFeatured ? -1 : 1;
  });
}

export function MobileGamesCatalogue({
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
  const ordered = orderForMobile(games);

  return (
    <div
      className="relative mx-auto w-full max-w-[430px] px-[max(14px,env(safe-area-inset-left))] pr-[max(14px,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))]"
      style={{
        // Reason: no phone bottom nav (layout, 29 Sep) — keep safe-area floor only,
        // not the 88px clearance the spec assumes when a bar exists.
        paddingBottom: "max(28px, env(safe-area-inset-bottom))",
      }}
    >
      <MobileGamesHeader />

      <div className="mt-4">
        <Suspense fallback={null}>
          <MobileGamesFilters options={filterOptions} activeSlug={activeSlug} />
        </Suspense>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {ordered.length === 0 ? (
          <div className="space-y-2 rounded-[17px] border border-[rgba(38,171,255,.28)] bg-[rgba(6,16,36,.78)] px-5 py-8 text-center backdrop-blur-md">
            <Gamepad2 className="mx-auto h-7 w-7 text-gray-500" />
            <p className="text-[15px] font-bold text-white">
              {activeSlug ? "No games in this category yet" : "No games available yet"}
            </p>
            <p className="text-[13px] leading-snug text-gray-400">
              {activeSlug
                ? "More challenges are coming soon. Try another genre."
                : "Check back soon, or open Competitions for live contests."}
            </p>
          </div>
        ) : (
          ordered.map((game, index) => (
            <MobileGameCard
              key={game.gameKey}
              game={game}
              stats={statsByKey.get(game.gameKey)}
              priority={index === 0}
            />
          ))
        )}
      </div>
    </div>
  );
}
