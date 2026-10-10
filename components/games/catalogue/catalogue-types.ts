import type { BrowsableGame } from "@/lib/services/games/player-catalogue.service";

/**
 * What one catalogue card reads, and nothing more.
 *
 * A `Pick` of the service's row rather than a mapped copy, so every browsable game already is a
 * card and a new title flows into the grid with no mapping code to forget.
 */
export type GameCardData = Pick<
  BrowsableGame,
  | "slug"
  | "gameKey"
  | "gameCode"
  | "kind"
  | "displayName"
  | "tagline"
  | "description"
  | "category"
  | "categorySlug"
  | "thumbnailUrl"
  | "bannerUrl"
  | "isFeatured"
  | "comingSoon"
>;
