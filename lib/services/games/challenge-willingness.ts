/**
 * Whether a player is willing to be challenged AT A PARTICULAR GAME.
 *
 * Model-free by requirement, not by preference. The settings screen is a client
 * component and the challenge create route is a server route, and both have to
 * agree about what an absent row means - so the rule cannot live beside a
 * Mongoose model. See R58: a `"use client"` file may not name a driver-reaching
 * module in a value-import position.
 *
 * The distinction from `UserPresence.acceptingChallenges`, which already exists:
 * that is one master switch covering every game at once. This is per game, and
 * the two are read together rather than one replacing the other - a player who
 * has switched off challenges entirely is not asked which games they meant.
 */

/**
 * AN ABSENT ROW MEANS WILLING.
 *
 * Reason: nobody has ever been asked this question, so every player on the
 * platform has no rows at all. Reading absence as "not willing" would refuse
 * every challenge on the platform the moment this shipped - silently, because a
 * refusal is a 400 and not an error - while every structural test still passed.
 *
 * It also matches `UserPresence.acceptingChallenges`, which defaults to `true`
 * for the same reason, and `resolveAllowedGameTypes`'s reading of an empty
 * stored array. Note the deliberate contrast with `entryBlockThreshold` and
 * `canEnterChallenges`, where a stored value and an absent one are different
 * facts: there, the stored value was being over-trusted. Here the question is
 * whether any legitimate writer can produce the absent case, and the answer is
 * that every writer is a player pressing a switch - so absence only ever means
 * "nobody has said".
 */
export const WILLING_TO_BE_CHALLENGED_BY_DEFAULT = true;

/** The shape both the route and the settings screen read. */
export interface GameWillingnessDeclaration {
  gameKey: string;
  willingToBeChallenged: boolean;
}

/**
 * Index declarations by `gameKey` so a caller can answer for several games
 * without a query per game.
 *
 * A `Map`, never an object: the key is a stored `gameKey` and an object lookup
 * walks the prototype chain, so a row keyed `"__proto__"` would return a truthy
 * `Object.prototype` that survives a `!row` test. Fourth instance of that trap
 * after the round-inspector action map, `competition-update-fields.ts` and
 * `UNSCORED_CONTEST_POLICY_COPY`.
 */
export function indexWillingness(
  declarations: readonly GameWillingnessDeclaration[],
): Map<string, boolean> {
  const byGameKey = new Map<string, boolean>();
  for (const declaration of declarations) {
    const gameKey = declaration.gameKey?.trim();
    if (!gameKey) continue;
    byGameKey.set(gameKey, declaration.willingToBeChallenged !== false);
  }
  return byGameKey;
}

/**
 * Whether this player may be challenged at this game.
 *
 * Takes the indexed map rather than a row, so the caller cannot accidentally
 * ask about a game it did not fetch and read the default as an answer.
 */
export function isWillingToBeChallengedAt(
  byGameKey: Map<string, boolean>,
  gameKey: string,
): boolean {
  const stored = byGameKey.get(gameKey.trim());
  return stored ?? WILLING_TO_BE_CHALLENGED_BY_DEFAULT;
}

/**
 * The refusal an unwilling opponent produces.
 *
 * Deliberately distinct from the global "User is not accepting challenges", and
 * it names the game. Reason: the two refusals send the challenger to two
 * different places - one means give up, the other means try a different game,
 * which is the whole point of the per-game switch. A shared message makes the
 * finer setting indistinguishable from the master one, which is the failure the
 * `creationDecidedBy` work on Game Master limits was built to avoid.
 */
export function gameWillingnessRefusal(gameLabel: string): string {
  const label = gameLabel.trim();
  return label.length
    ? `This player is not accepting ${label} challenges`
    : "This player is not accepting challenges at this game";
}
