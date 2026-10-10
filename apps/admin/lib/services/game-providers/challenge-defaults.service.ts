import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import ChallengeSettings from "@/database/models/trading/challenge-settings.model";
import { parseConfigSchema } from "@/lib/services/games/config-schema";
import {
  parseChallengeDefaults,
  resolveChallengeDefaults,
  type ChallengeDefaults,
  type ChallengeDefaultsSubmission,
  type ChallengeDurationBounds,
} from "@/lib/services/games/challenge-defaults";

/**
 * Set - or clear - what a player's challenge form opens pre-filled with for one title.
 *
 * WHY THIS EXISTS. A player creating a 1v1 was being asked a game's own questions with no
 * answers in them: how long the challenge runs, and every setting the provider's `configSchema`
 * declares - a board size, a difficulty, a lives count. An operator knows what a good 1v1 of a
 * title looks like and a player does not, which is the owner's request of 13 September 2026.
 *
 * WHY IT WRITES `challengeDefaults` AND NOT THE FIELDS IT MIRRORS. `configSchema`, `playMode`
 * and `maxDurationSeconds` are all in `providerOwnedFields` in `catalogue.service.ts`, so an
 * operator's answer written there would be reverted by the next catalogue pull - they save it,
 * see it saved, and find it gone after the next sync with no error and nothing in a log. That is
 * the "control that appears to work and does nothing" shape already on record for a provider
 * enabled with no adapter, a `rankingMethod` a provider game ignores, and `isPaused` on a
 * provider contest. `challengeDefaults` is in no sync list at all, which is a property of that
 * allow-list rather than of anything written here - so it is asserted by a test, and the test
 * runs a real sync rather than reading the list, because a list that no longer matches the code
 * reading it is exactly what a structural check cannot see.
 *
 * ADMIN-ONLY AND NOT MIRRORED, matching `game-play-style.service.ts` and `game-content.service.ts`.
 * The player app RESOLVES these and must never write them; a second writer in the app with the
 * widest reach and no operator behind it is the door this deliberately does not build.
 *
 * THE VALIDATION LIVES IN THE MIRRORED `challenge-defaults.ts`, not here, because the player app
 * has to read the same stored value and the two must not disagree about what a valid one is.
 * This file supplies the two facts that function cannot know without I/O - the platform's own
 * duration bounds and the title's parsed schema - and does the writing.
 */

export type ChallengeDefaultsResult =
  | {
      success: true;
      /** What a player's dialog will now open with - resolved, not echoed back. */
      effective: {
        durationMinutes: number;
        roundStartPolicy: string;
        settings: Record<string, unknown>;
      };
      /** `undefined` once the defaults are cleared and the platform decides again. */
      stored?: ChallengeDefaults;
    }
  | { success: false; error: string };

/**
 * What the route may be handed.
 *
 * `null` is the CLEAR case and has to be expressible, because "go back to the platform's own
 * answers" is a decision an operator must be able to take back - the same reason
 * `parsePlayStyleInput` accepts `null`. An absent key would have to mean the same thing, and
 * then a malformed body reading `{ gameCode }` silently clears a title's defaults.
 */
export function parseChallengeDefaultsBody(
  value: unknown,
): { ok: true; submitted: ChallengeDefaultsSubmission | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, submitted: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error: "Challenge defaults must be an object, or null to clear them.",
    };
  }

  const body = value as Record<string, unknown>;
  const settings = body.settings;
  if (
    settings !== undefined &&
    (typeof settings !== "object" || settings === null || Array.isArray(settings))
  ) {
    return { ok: false, error: "Game settings must be an object." };
  }

  return {
    ok: true,
    submitted: {
      durationMinutes: body.durationMinutes,
      roundStartPolicy: body.roundStartPolicy,
      settings: (settings as Record<string, unknown> | undefined) ?? {},
    },
  };
}

/**
 * The platform's own challenge duration bounds, and the length a title that says nothing gets.
 *
 * READ RATHER THAN ASSUMED, and read here rather than inside the validator, because the
 * validator is mirrored into the player app and importing a model there would put a database
 * read inside a pure function two apps call.
 *
 * AN UNSAVED DOCUMENT SUPPLIES THE FALLBACKS, never numbers written out here. Mongoose applies a
 * schema default when it HYDRATES, so `new ChallengeSettings()` carries exactly what the schema
 * declares without ever being saved - which means there is one definition of what the platform
 * permits even before an administrator has opened that screen. Writing 15, 1440 and 60 out again
 * is the "one rule, two copies" shape, and it fails in the quiet direction: the two disagree
 * only after somebody edits the schema, and the symptom is a refusal naming a range no screen
 * shows.
 */
export async function challengeDurationBounds(): Promise<
  ChallengeDurationBounds & { fallbackMinutes: number }
> {
  const settings = await ChallengeSettings.findOne()
    .select("minDurationMinutes maxDurationMinutes defaultDurationMinutes")
    .lean<{
      minDurationMinutes?: number;
      maxDurationMinutes?: number;
      defaultDurationMinutes?: number;
    } | null>();

  const declared = new ChallengeSettings();

  return {
    minMinutes: settings?.minDurationMinutes ?? declared.minDurationMinutes,
    maxMinutes: settings?.maxDurationMinutes ?? declared.maxDurationMinutes,
    fallbackMinutes: settings?.defaultDurationMinutes ?? declared.defaultDurationMinutes,
  };
}

export async function setGameChallengeDefaults(
  providerKey: string,
  gameCode: string,
  submitted: ChallengeDefaultsSubmission | null,
): Promise<ChallengeDefaultsResult> {
  await connectToDatabase();

  // Matched on the pair rather than on `gameKey`, matching `updateGameContent` and
  // `setGamePlayStyle`: it is the unique index the catalogue is keyed by, and a caller-supplied
  // `gameKey` would be a way to edit a DIFFERENT provider's title through this provider's URL.
  const title = await ProviderGame.findOne({ providerKey, gameCode }).lean();
  if (!title) {
    return { success: false, error: "That game is not in this provider's catalogue." };
  }

  // REFUSED, not stored for a title nobody can challenge on. `supportsOneVsOne` is the
  // provider's declaration that their game can be played one against one, and `03` has always
  // treated it as the way to say "this title cannot be challenged" - so defaults here would be
  // written, transported and read by nothing, which is the declared-written-dead field class
  // found five times already (`requiresSyncPlay`, `isPaused`, `lastSuccessfulRoundAt`, `family`,
  // `playModeOverride` on a head-to-head title).
  if (!title.supportsOneVsOne) {
    return {
      success: false,
      error:
        "This game cannot be played one against one, so a challenge on it is never created. There is nothing to pre-fill.",
    };
  }

  const parsedSchema = parseConfigSchema(title.configSchema);
  if (!parsedSchema.ok) {
    // Reason: refused rather than saved with no settings. A malformed schema means we cannot
    // tell a valid answer from an invalid one, so storing the duration alone would leave an
    // operator believing they had chosen a board size they had not - and the fields would not
    // even have rendered. Fail closed, exactly as the wizard's own parser does.
    return {
      success: false,
      error: `This game's settings are not supported: ${parsedSchema.error}`,
    };
  }

  const bounds = await challengeDurationBounds();

  if (submitted === null) {
    await ProviderGame.updateOne(
      { providerKey, gameCode },
      // `$unset`, never a stored `{}`. An absent default and an empty one are different facts:
      // `resolveChallengeDefaults` reads the field to decide whether we have taken a decision at
      // all, and an empty object satisfies every truthiness test while meaning nothing. Same
      // distinction as clearing a play-style override or a tagline.
      { $unset: { challengeDefaults: "" } },
    );

    return {
      success: true,
      effective: resolveChallengeDefaults({
        fields: parsedSchema.fields,
        stored: undefined,
        bounds,
        fallbackMinutes: bounds.fallbackMinutes,
      }),
    };
  }

  const parsed = parseChallengeDefaults({
    fields: parsedSchema.fields,
    submitted,
    bounds,
    maxDurationSeconds: title.maxDurationSeconds,
  });
  if (!parsed.ok) {
    // Every refusal, not the first: an operator fixing one per submission gives up. Same rule
    // as the contest pre-flight's accumulating hard refusals.
    return { success: false, error: parsed.errors.join(" ") };
  }

  await ProviderGame.updateOne(
    { providerKey, gameCode },
    Object.keys(parsed.defaults).length === 0
      ? { $unset: { challengeDefaults: "" } }
      : { $set: { challengeDefaults: parsed.defaults } },
  );

  // Re-resolved from what will now be stored rather than echoing the submission back, so the
  // caller is told what a player's dialog will actually open with. They agree today for every
  // row that reaches here, and saying so through the resolver is what keeps them agreeing if
  // the precedence ever grows another step - the same reasoning as `setGamePlayStyle`.
  return {
    success: true,
    effective: resolveChallengeDefaults({
      fields: parsedSchema.fields,
      stored: parsed.defaults,
      bounds,
      fallbackMinutes: bounds.fallbackMinutes,
    }),
    stored: Object.keys(parsed.defaults).length === 0 ? undefined : parsed.defaults,
  };
}
