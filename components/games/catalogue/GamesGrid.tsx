import { GameCard } from "./GameCatalogueCard";
import type { GameCardData } from "./catalogue-types";

/**
 * The catalogue grid: three equal columns on a desktop, two on a tablet, one on a phone.
 *
 * Reason for fixed `minmax(0,1fr)` tracks rather than auto-fit: a lone card on the last row
 * keeps the width of the cards above it instead of stretching across the row (owner), and a
 * new title simply takes the next cell - no layout code per game.
 */
export function GamesGrid({ games }: { games: GameCardData[] }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(3,minmax(0,1fr))]">
      {games.map((game) => (
        <GameCard key={game.gameKey} game={game} />
      ))}
    </div>
  );
}
