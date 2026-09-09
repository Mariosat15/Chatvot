import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import { resolveGameCategory } from "./game-categories";

/**
 * The operator's presentation content for one catalogue title, for player-facing screens.
 *
 * READ-ONLY, AND THAT IS ENFORCED BY THERE BEING NO WRITER HERE. The admin app owns writing
 * this content (`game-content.service.ts`), and giving the player app a second writer would
 * put catalogue edits in the process with the widest reach and no operator behind them.
 *
 * NOT MIRRORED, for the same reason.
 *
 * EVERY FIELD IS OPTIONAL AND MUST STAY SO. A title synced before the content fields existed
 * carries none of them, and a provider that has just been registered carries none either. So
 * each consumer falls back or omits - a missing tagline renders no line, a missing banner
 * falls through to `components/neon/banners.ts`, a missing highlights list removes the whole
 * row. What must never happen is a screen printing an empty slot where the copy would go,
 * which is why `game-content.service.ts` unsets a cleared field rather than storing "".
 */

export interface GamePresentation {
  /** The player-facing name. Falls back to a neutral phrase, never to `gameKey`. */
  gameName: string;
  tagline?: string;
  description?: string;
  /**
   * The genre a PLAYER reads - "Puzzle", not `puzzle` (task document 9).
   *
   * Resolved from the stored slug rather than passed through, because the stored value is a
   * grouping key and a key is not copy. A custom genre stored as `sci-fi` renders "Sci Fi"
   * here and stays `sci-fi` everywhere something counts by it, which is the same separation
   * as `gameKey` versus `displayName`.
   */
  category?: string;
  logoUrl?: string;
  bannerUrl?: string;
  highlights: { title: string; detail: string }[];
  /** Declared capability, used to describe the game without naming it. */
  family?: string;
  scoreType?: string;
  scoreDirection?: string;
  maxDurationSeconds?: number;
}

const UNKNOWN_GAME_NAME = "this game";

/**
 * Read a title's presentation by the provider/code pair on a contest.
 *
 * A contest whose title has been removed from the catalogue still has to render, so a missing
 * row is a neutral presentation rather than a throw. That is not a hypothetical: the
 * catalogue sync REPORTS missing titles rather than deleting them precisely so this join
 * keeps working, but a provider row can be absent on a contest created before it was
 * registered, and a contest page that 500s on a settled competition is worse than one that
 * says less about the game.
 */
export async function getGamePresentation(
  providerKey: string | undefined,
  gameCode: string | undefined,
): Promise<GamePresentation> {
  if (!providerKey || !gameCode) {
    return { gameName: UNKNOWN_GAME_NAME, highlights: [] };
  }

  await connectToDatabase();

  const title = await ProviderGame.findOne({ providerKey, gameCode })
    .select(
      "displayName tagline description category thumbnailUrl bannerUrl highlights family scoreType scoreDirection maxDurationSeconds",
    )
    .lean<{
      displayName?: string;
      tagline?: string;
      description?: string;
      category?: string;
      thumbnailUrl?: string;
      bannerUrl?: string;
      highlights?: { title: string; detail: string }[];
      family?: string;
      scoreType?: string;
      scoreDirection?: string;
      maxDurationSeconds?: number;
    } | null>();

  if (!title) {
    return { gameName: UNKNOWN_GAME_NAME, highlights: [] };
  }

  return {
    gameName: title.displayName || UNKNOWN_GAME_NAME,
    // `|| undefined` rather than passing the value through: a document written before
    // `game-content.service.ts` learned to `$unset` a cleared field could hold a stored empty
    // string, and every consumer of this shape treats "" as present. Normalising once here
    // means no screen has to know that.
    tagline: title.tagline || undefined,
    description: title.description || undefined,
    // Reason: `resolveGameCategory` already answers `undefined` for an absent or empty value,
    // so no `|| undefined` is needed - and an unrecognised slug comes back with its own text
    // humanised rather than as a placeholder, because a badge reading "Uncategorised" on a
    // title that plainly has a genre is worse than a badge reading the provider's own word.
    category: resolveGameCategory(title.category)?.label,
    logoUrl: title.thumbnailUrl || undefined,
    bannerUrl: title.bannerUrl || undefined,
    highlights: Array.isArray(title.highlights) ? title.highlights : [],
    family: title.family || undefined,
    scoreType: title.scoreType || undefined,
    scoreDirection: title.scoreDirection || undefined,
    maxDurationSeconds: title.maxDurationSeconds,
  };
}
