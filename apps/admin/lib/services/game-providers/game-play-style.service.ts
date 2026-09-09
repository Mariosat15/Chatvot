import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import {
  canOverridePlayMode,
  PLAY_MODES,
  resolvePlayMode,
  type PlayMode,
} from "@/lib/services/games/play-shape";

/**
 * Set - or clear - our answer to "does everybody play this title at once?".
 *
 * WHY THIS EXISTS AT ALL. `playMode` arrives with the catalogue and is the provider's
 * statement about their own game, which is right for a third party: they know whether their
 * title is a race. It is wrong for us, because for ChartVolt Games we ARE the provider, and
 * the declaration lives in `games-service/src/games/titles.ts` - a TypeScript literal that
 * only changes on a rebuild and a redeploy. There was no way to answer this question from a
 * screen, which is the gap this closes.
 *
 * WHY IT WRITES A SECOND FIELD RATHER THAN `playMode`. `playMode` is a member of
 * `providerOwnedFields` in `catalogue.service.ts`, so writing there would be reverted by the
 * next catalogue pull - the operator sets a race to start together, watches it save, and
 * finds it staggered again after the next sync, with no error and nothing in a log. That is
 * the "control that appears to work and does nothing" shape already on record for a provider
 * enabled with no adapter, a `rankingMethod` a provider game ignores, and `isPaused` on a
 * provider contest. `playModeOverride` is in no sync list at all, which is a property of that
 * allow-list rather than of anything written here - so it is asserted by a test.
 *
 * ADMIN-ONLY AND NOT MIRRORED, matching `game-content.service.ts`. The player app resolves
 * the shape and must never write it; a second writer in the app with the widest reach and no
 * operator behind it is the door this deliberately does not build.
 */

export type PlayStyleResult =
  | {
      success: true;
      /** What the contest wizard will now offer for this title. */
      effective: PlayMode;
      /** `undefined` once the override is cleared and the provider decides again. */
      override?: PlayMode;
    }
  | { success: false; error: string };

/**
 * What the route may be handed.
 *
 * `null` is the CLEAR case and has to be expressible, because "follow the provider again" is
 * a decision an operator must be able to take back. An absent field would have to mean the
 * same thing, and then a malformed body reading `{}` would silently clear a setting - so the
 * key must be present and the value must be one of the three.
 */
export function parsePlayStyleInput(
  value: unknown,
): { ok: true; mode: PlayMode | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, mode: null };
  if (typeof value !== "string") {
    return {
      ok: false,
      error: "A play style must be a name, or null to follow the provider.",
    };
  }
  if (!PLAY_MODES.includes(value as PlayMode)) {
    return {
      ok: false,
      error: `"${value}" is not a play style. Expected ${PLAY_MODES.join(" or ")}, or null to follow the provider.`,
    };
  }
  return { ok: true, mode: value as PlayMode };
}

export async function setGamePlayStyle(
  providerKey: string,
  gameCode: string,
  mode: PlayMode | null,
): Promise<PlayStyleResult> {
  await connectToDatabase();

  // Matched on the pair rather than on `gameKey`, matching `updateGameContent`: it is the
  // unique index the catalogue is keyed by, and a caller-supplied `gameKey` would be a way to
  // edit a DIFFERENT provider's title through this provider's URL.
  const title = await ProviderGame.findOne({ providerKey, gameCode }).lean();
  if (!title) {
    return {
      success: false,
      error: "That game is not in this provider's catalogue.",
    };
  }

  // REFUSED, not stored and ignored. `resolvePlayMode` forces a `head_to_head` title to
  // `scheduled` ahead of any override, so a value written here would be read by nothing -
  // the class of declared, written, dead field found four times already in this programme
  // (`requiresSyncPlay`, `isPaused`, `lastSuccessfulRoundAt`, `family`). The control withholds
  // itself using the same helper, so reaching this refusal means somebody called the route
  // directly; it still has to name the reason rather than 400 with a shrug.
  if (!canOverridePlayMode(title)) {
    return {
      success: false,
      error:
        "This game needs an opponent, so it is always played by both players at once. There is nothing to choose.",
    };
  }

  await ProviderGame.updateOne(
    { providerKey, gameCode },
    // An absent override and a stored one are different facts, so clearing is `$unset` and
    // never a stored `""`: `resolvePlayMode` reads the field to decide whether we have taken
    // a decision at all, and an empty string satisfies `field !== undefined` while meaning
    // nothing. Same distinction as `entryBlockThreshold` and as clearing a tagline.
    mode === null
      ? { $unset: { playModeOverride: "" } }
      : { $set: { playModeOverride: mode } },
  );

  // Re-resolved from the values that will now be stored rather than returning `mode`, so the
  // caller is told what the wizard will actually offer. They are the same today for every row
  // that reaches here, and saying so through the resolver is what keeps them the same if the
  // precedence ever grows another step.
  const effective = resolvePlayMode({
    family: title.family,
    playMode: title.playMode,
    playModeOverride: mode,
  });

  return {
    success: true,
    effective,
    override: mode ?? undefined,
  };
}
