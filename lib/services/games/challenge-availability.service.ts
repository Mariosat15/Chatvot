import { connectToDatabase } from "@/database/mongoose";
import UserGamePreference from "@/database/models/games/user-game-preference.model";
import UserPresence from "@/database/models/user-presence.model";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import {
  indexWillingness,
  WILLING_TO_BE_CHALLENGED_BY_DEFAULT,
} from "@/lib/services/games/challenge-willingness";
import { listChallengeableTitles } from "@/lib/services/games/challengeable-titles.service";

/**
 * The per-game challenge willingness a player has declared, plus the list of
 * games they can declare anything about.
 *
 * The RULES live in `challenge-willingness.ts`, which is model-free so a client
 * component can import them (R58). This module is the database half and nothing
 * else - it must not answer "is this player willing", only fetch the rows the
 * shared predicate answers from.
 */

export interface ChallengeGameAvailability {
  gameKey: string;
  label: string;
  willing: boolean;
  /**
   * Whether the game can be challenged at all today. A title whose provider has
   * been switched off is still listed, with the reason, rather than vanishing -
   * a setting that disappears reads as lost rather than as inapplicable, the
   * same reasoning as `ChallengeGamePicker` disabling a row instead of hiding it.
   */
  unavailableReason?: string;
}

export interface ChallengeAvailability {
  /** `UserPresence.acceptingChallenges` - the master switch, every game at once. */
  acceptingChallenges: boolean;
  games: ChallengeGameAvailability[];
}

/**
 * The games a player may express a preference about.
 *
 * TRADING IS ALWAYS FIRST AND IS NEVER FETCHED, matching `ChallengeGamePicker`.
 * It has no catalogue row, so a version that built this list from
 * `listChallengeableTitles` alone would silently offer no way to opt out of the
 * one game every player on the platform can already be challenged at.
 */
export async function listChallengeableGameKeys(): Promise<
  { gameKey: string; label: string; unavailableReason?: string }[]
> {
  const titles = await listChallengeableTitles();
  return [
    { gameKey: TRADING_GAME_TYPE, label: "Trading" },
    ...titles.map((title) => ({
      gameKey: title.gameKey,
      label: title.displayName,
      unavailableReason: title.supportsOneVsOne
        ? undefined
        : "This game cannot be played one against one",
    })),
  ];
}

/** Every declaration this player has made, indexed by `gameKey`. */
export async function getWillingnessByGameKey(
  userId: string,
): Promise<Map<string, boolean>> {
  await connectToDatabase();
  const rows = await UserGamePreference.find({ userId })
    .select({ gameKey: 1, willingToBeChallenged: 1 })
    .lean()
    .exec();
  return indexWillingness(
    rows.map((row) => ({
      gameKey: String(row.gameKey ?? ""),
      willingToBeChallenged: row.willingToBeChallenged !== false,
    })),
  );
}

/** What the settings screen renders. */
export async function getChallengeAvailability(
  userId: string,
): Promise<ChallengeAvailability> {
  await connectToDatabase();
  const [presence, byGameKey, games] = await Promise.all([
    UserPresence.findOne({ userId })
      .select({ acceptingChallenges: 1 })
      .lean()
      .exec(),
    getWillingnessByGameKey(userId),
    listChallengeableGameKeys(),
  ]);

  return {
    // Reason: a player with no presence document has never been online, which is
    // not a statement about challenges - so it reads as the schema default does.
    acceptingChallenges:
      (presence as { acceptingChallenges?: boolean } | null)
        ?.acceptingChallenges !== false,
    games: games.map((game) => ({
      ...game,
      willing:
        byGameKey.get(game.gameKey) ?? WILLING_TO_BE_CHALLENGED_BY_DEFAULT,
    })),
  };
}

export type SetWillingnessResult =
  | { success: true; willing: boolean }
  | { success: false; error: string };

/**
 * Record a declaration for one game.
 *
 * The `gameKey` is validated against the list above and an unrecognised one is
 * REFUSED, never stored. Reason: `gameKey` is the join key for every historical
 * statistic and it is immutable, so a row under a key nothing can resolve is a
 * setting the player can see, toggle and never have honoured - and it would be
 * indistinguishable from a game that had been retired. Same rule as the contest
 * edit allow-list refusing an unknown field rather than dropping it.
 */
export async function setGameWillingness(
  userId: string,
  gameKey: string,
  willing: boolean,
): Promise<SetWillingnessResult> {
  const requested = gameKey?.trim();
  if (!requested) {
    return { success: false, error: "A game is required" };
  }

  await connectToDatabase();
  const games = await listChallengeableGameKeys();
  if (!games.some((game) => game.gameKey === requested)) {
    return { success: false, error: "That game cannot be challenged" };
  }

  await UserGamePreference.findOneAndUpdate(
    { userId, gameKey: requested },
    {
      $set: { willingToBeChallenged: willing, declaredAt: new Date() },
      $setOnInsert: { userId, gameKey: requested },
    },
    { upsert: true, new: true },
  ).exec();

  return { success: true, willing };
}
