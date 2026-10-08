import { GameCard } from "./GameCatalogueCard";
import type { GameCardData } from "./catalogue-types";
import type { CatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";

/**
 * The catalogue grid: three equal columns on desktop, two on tablet, one on phone.
 *
 * Reason for fixed `minmax(0,1fr)` tracks rather than auto-fit: a lone card on the last row
 * keeps the width of the cards above it instead of stretching across the row (owner), and a
 * new title simply takes the next cell — no layout code per game.
 */
export function GamesGrid({
  games,
  statsByKey,
}: {
  games: GameCardData[];
  statsByKey?: Map<string, CatalogueCardStats>;
}) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-[18px] min-[720px]:grid-cols-[repeat(2,minmax(0,1fr))] min-[1100px]:grid-cols-[repeat(3,minmax(0,1fr))]">
      {games.map((game) => (
        <GameCard
          key={game.gameKey}
          game={game}
          stats={statsByKey?.get(game.gameKey)}
        />
      ))}
    </div>
  );
}
