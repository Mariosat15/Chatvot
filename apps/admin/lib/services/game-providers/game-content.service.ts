import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import {
  validateGameContent,
  type GameContentInput,
} from "@/lib/admin/game-content-fields";

/**
 * Write the operator's presentation copy and artwork onto one catalogue title.
 *
 * ADMIN-ONLY AND NOT MIRRORED. The player app reads this content and must never write it;
 * mirroring this service would create a second writer of catalogue content in the app with
 * the widest reach and no operator behind it.
 *
 * Why a service rather than a `findOneAndUpdate` in the route: the field rules are worth
 * enforcing in one place that a test can call directly, and the "clear versus leave alone"
 * distinction below is the kind of thing that gets quietly reimplemented per route.
 */

export type ContentUpdateResult =
  | { success: true; content: GameContentInput }
  | { success: false; error: string };

/**
 * Build the Mongo update from a validated patch.
 *
 * An empty string means CLEAR, which has to become `$unset` rather than a stored `""`. The
 * difference is not cosmetic: every consumer of this content treats an ABSENT value as "say
 * less" and falls back - `banners.ts` answers from the game code when `bannerUrl` is unset,
 * and the arena omits the tagline line entirely rather than printing a blank. A stored empty
 * string satisfies `field !== undefined`, so those fallbacks stop firing and the screen
 * renders an empty slot where it should have rendered nothing at all. Same distinction as
 * `entryBlockThreshold`: a stored value and an absent one are different facts.
 */
function buildUpdate(content: GameContentInput) {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};

  // Reason: `field` cannot be caller-chosen. `content` is the output of
  // `validateGameContent`, which refuses any key that is not a member of
  // `EDITABLE_CONTENT_FIELDS`, so the only keys reaching here are the seven this module
  // owns - and both targets are fresh local objects, so there is nothing inherited to
  // overwrite. The rule flags the shape, which is correct of it, but not the risk.
  /* eslint-disable security/detect-object-injection */
  for (const [field, value] of Object.entries(content)) {
    if (value === "") {
      $unset[field] = "";
      continue;
    }
    // An empty highlights list is a real decision - "this game shows no cards" - so it is
    // removed rather than stored as `[]`, for the same reason as above.
    if (Array.isArray(value) && value.length === 0) {
      $unset[field] = "";
      continue;
    }
    $set[field] = value;
  }
  /* eslint-enable security/detect-object-injection */

  const update: Record<string, unknown> = {};
  if (Object.keys($set).length > 0) update.$set = $set;
  if (Object.keys($unset).length > 0) update.$unset = $unset;
  return update;
}

export async function updateGameContent(
  providerKey: string,
  gameCode: string,
  body: unknown,
): Promise<ContentUpdateResult> {
  const validated = validateGameContent(body);
  if (!validated.ok) return { success: false, error: validated.error };

  await connectToDatabase();

  // Reason: matched on the pair rather than on `gameKey`, because that is the unique index
  // the catalogue itself is keyed by and it does not require the caller to know how the
  // composite key is spelled. A caller-supplied `gameKey` would also be a way to edit a
  // DIFFERENT provider's title through this provider's URL.
  const updated = await ProviderGame.findOneAndUpdate(
    { providerKey, gameCode },
    buildUpdate(validated.content),
    { new: true },
  ).lean();

  if (!updated) {
    return { success: false, error: "That game is not in this provider's catalogue." };
  }

  return { success: true, content: validated.content };
}
