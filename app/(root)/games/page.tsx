import { Gamepad2 } from "lucide-react";
import { NeonGridBackdrop } from "@/components/neon/Cards";
import { NEON_HEADING } from "@/components/neon/tokens";
import { GameCatalogueCard } from "@/components/games/catalogue/GameCatalogueCard";
import { listBrowsableGames } from "@/lib/services/games/player-catalogue.service";

export const dynamic = "force-dynamic";

/**
 * Games catalogue hub (X11 Slice 1 + thin merchandising).
 *
 * Server component only — listing is a read. Never launches a round.
 * Order / featured / coming-soon come from `game_catalogue_entry`.
 */

export default async function GamesCataloguePage() {
  const games = await listBrowsableGames();
  const featured = games.filter((g) => g.isFeatured);
  const rest = games.filter((g) => !g.isFeatured);

  return (
    <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <NeonGridBackdrop />
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/80">
          Catalogue
        </p>
        <h1 className={`${NEON_HEADING} text-3xl sm:text-4xl`}>Games</h1>
        <p className="max-w-2xl text-sm text-gray-400">
          Pick a game, read the rules, and join a contest from its page.
          Competitions stays available when you want everything starting soon
          in one list.
        </p>
      </header>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-[#1B2540] bg-[#0A0F1F]/80 p-8 text-center space-y-3">
          <Gamepad2 className="mx-auto h-8 w-8 text-gray-500" />
          <p className={`${NEON_HEADING} text-lg`}>No games available yet</p>
          <p className="text-sm text-gray-400">
            Check back soon, or open Competitions for contests that are already
            live.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {featured.length > 0 ? (
            <section className="space-y-4">
              <h2 className={`${NEON_HEADING} text-xl`}>Featured</h2>
              <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((game) => (
                  <GameCatalogueCard key={game.gameKey} game={game} />
                ))}
              </div>
            </section>
          ) : null}
          <section className="space-y-4">
            {featured.length > 0 ? (
              <h2 className={`${NEON_HEADING} text-xl`}>All games</h2>
            ) : null}
            <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(featured.length > 0 ? rest : games).map((game) => (
                <GameCatalogueCard key={game.gameKey} game={game} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
