import type { RoundStartPolicy } from "./round-types";
import {
  defaultConfigValues,
  resolveAttemptSeconds,
  validateConfigValues,
  type ConfigField,
} from "./config-schema";

/**
 * Per-title challenge defaults: what a player's challenge form opens pre-filled with, and the
 * one place the two readings of a stored default live.
 *
 * OWNER REQUEST, 13 SEPTEMBER 2026: "we need to be able to specify the default settings for
 * challenges for each specific game... when users can join, like any time or specific, the size
 * of the board etc, so it's easier for the user to create challenges." A player creating a 1v1
 * is not an operator drafting a contest - they have no view of a catalogue, no reason to hold an
 * opinion about a board size, and no way to tell a sensible answer from a bad one - so every
 * game-shaped question on that form wants an answer already in it.
 *
 * NOTHING HERE IS A SECOND SOURCE OF TRUTH. The provider's `configSchema` still decides which
 * settings exist, what they are called, their types and their ranges; this only chooses among
 * the answers that schema already permits, and every value is validated against it twice - once
 * when an operator saves and once when a player reads. There is deliberately no field an
 * operator can invent here, which is what keeps "a new title needs no code" true: adding a
 * title with a board size, a difficulty and a lives count needs no change to this file.
 *
 * THE TWO HALVES ARE ASYMMETRIC ON PURPOSE, and that is the load-bearing design decision.
 *
 *  - `parseChallengeDefaults` is STRICT. An operator is sitting in front of the form, so an
 *    out-of-range duration or a setting the schema rejects is refused with the reason named. A
 *    silent clamp there would store a number they did not choose and read back as their own.
 *
 *  - `resolveChallengeDefaults` is LENIENT. A provider may narrow their own `configSchema` on
 *    a scheduled sync, and an administrator may narrow the global duration bounds, months after
 *    these were stored. Refusing then would take the challenge dialog down for a title that is
 *    otherwise perfectly playable, for a reason no player can act on - so a stored setting that
 *    no longer validates is DROPPED back to the schema's own default, which is exactly what the
 *    dialog contained before this field existed, and a stored duration outside the bounds is
 *    CLAMPED rather than discarded, because "as long as possible" is closer to the operator's
 *    intent than the platform default they never chose.
 *
 * Both directions are cheap only because `validateConfigValues` already drops undeclared keys,
 * fills a missing field from its declared default and skips a value it cannot accept. Nothing
 * here reimplements any of that; a second copy of "what does a valid settings object look like"
 * is the shape behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||`.
 */

/**
 * How late a player may start a round in a challenge when nothing says otherwise: always, for
 * as long as the window is open.
 *
 * OWNER DECISION, 13 SEPTEMBER 2026 (R73), AND THE ONE DEFINITION OF IT. A challenge does not
 * reserve a whole round out of its own window by default; a player who presses Play late gets a
 * round shortened by `resolveExpiry`'s clamp to `playWindowEnd`, which `RoundPreflight`
 * discloses, rather than a refusal. Four writers agree by importing this rather than by
 * remembering: `challengeRoundConfig`, the pre-flight in `challenge-provider-resolution.ts`, the
 * create route that stores the field, and `resolveChallengeDefaults` below. Written out in each
 * of them, a challenge could be created under one rule and played under another, and the
 * disagreement reads as a clock problem rather than a settings one.
 *
 * IT LIVES HERE RATHER THAN IN `challenge-round-config.ts`, WHICH NOW RE-EXPORTS IT, because
 * that file is main-app only and this module is mirrored - and a constant defined twice is the
 * one thing this whole file exists to avoid.
 */
export const CHALLENGE_ROUND_START_POLICY: RoundStartPolicy = "until_window_closes";

/**
 * Reads a stored round-start policy the challenge way: only an explicit `reserve_full_round`
 * reserves, and everything else - absent, empty, a value from an older vocabulary - is
 * permissive.
 *
 * THE ONE DEFINITION OF IT, and it exists because there were three: `challengeRoundConfig`
 * reading a stored challenge, `resolveChallengeDefaults` reading a stored title, and now the
 * create-time resolver deciding what to store. All three were the same ternary, which is the
 * "one rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId` and the Game
 * Master `||` - and the drift here is the quiet kind: a challenge created under one reading and
 * played under the other, where the refusal names the clock rather than the setting behind it.
 *
 * ABSENT MEANS PERMISSIVE, which is the OPPOSITE of `contest-config.ts`'s reading of the same
 * field name and is deliberate. A competition's policy is an operator's choice with a schema
 * default behind it; a challenge has no operator, so an unset value is a challenge created
 * before there was a rule rather than one whose players chose the strict one.
 */
export function resolveChallengeStartPolicy(
  stored: { roundStartPolicy?: string | null } | null | undefined,
): RoundStartPolicy {
  return stored?.roundStartPolicy === "reserve_full_round"
    ? "reserve_full_round"
    : CHALLENGE_ROUND_START_POLICY;
}

export interface ChallengeDefaults {
  durationMinutes?: number;
  roundStartPolicy?: RoundStartPolicy;
  settings?: Record<string, unknown>;
}

/** The platform-wide bounds from `ChallengeSettings`, passed in rather than read here. */
export interface ChallengeDurationBounds {
  minMinutes: number;
  maxMinutes: number;
}

export interface ChallengeDefaultsSubmission {
  durationMinutes?: unknown;
  roundStartPolicy?: unknown;
  settings?: Record<string, unknown>;
}

export type ParseChallengeDefaultsResult =
  | { ok: true; defaults: ChallengeDefaults }
  | { ok: false; errors: string[] };

/**
 * The strict half - an operator saving defaults for one title.
 *
 * REFUSES A RESERVATION THE TITLE CANNOT HONOUR, and this is the guard that stops the new
 * control quietly recreating R73. Reserving a whole round only means anything when the platform
 * knows how long a round is; with no declared clock and no catalogue ceiling the gate reserves
 * nothing, so the switch would be a control that appears to work and does nothing - the same
 * shape as enabling a provider with no adapter, or a `rankingMethod` a provider game ignores.
 * And when the reservation is at least as long as the whole challenge, every round is refused
 * from the first second, which is precisely the defect the owner reported: both players pay,
 * neither can play, and the refusal names the clock rather than the setting behind it.
 */
export function parseChallengeDefaults(input: {
  fields: ConfigField[];
  submitted: ChallengeDefaultsSubmission;
  bounds: ChallengeDurationBounds;
  /** The catalogue ceiling, for the reservation checks. Absent means the title declared none. */
  maxDurationSeconds?: number;
}): ParseChallengeDefaultsResult {
  const errors: string[] = [];
  const defaults: ChallengeDefaults = {};

  const rawDuration = input.submitted.durationMinutes;
  if (rawDuration !== undefined && rawDuration !== null && rawDuration !== "") {
    const minutes = typeof rawDuration === "number" ? rawDuration : Number(String(rawDuration).trim());
    if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
      errors.push("The challenge length must be a whole number of minutes.");
    } else if (minutes < input.bounds.minMinutes || minutes > input.bounds.maxMinutes) {
      // Reason: the range is named, not merely rejected. The bounds live in the platform's own
      // challenge settings, which is a different screen, so an operator cannot see them here.
      errors.push(
        `The challenge length must be between ${input.bounds.minMinutes} and ${input.bounds.maxMinutes} minutes.`,
      );
    } else {
      defaults.durationMinutes = minutes;
    }
  }

  const rawPolicy = input.submitted.roundStartPolicy;
  if (rawPolicy !== undefined && rawPolicy !== null && rawPolicy !== "") {
    if (rawPolicy !== "until_window_closes" && rawPolicy !== "reserve_full_round") {
      errors.push("Unrecognised join rule.");
    } else {
      defaults.roundStartPolicy = rawPolicy;
    }
  }

  // ONLY THE KEYS THE OPERATOR ACTUALLY SENT ARE STORED, which is why the result is filtered
  // rather than taken whole. `validateConfigValues` fills a missing field from its declared
  // default - correct for reading, wrong for writing: storing what it filled in would freeze the
  // provider's own defaults onto the title, and the frozen copy would then win for ever, even
  // after a later sync changes them. That is the second source of truth this module exists to
  // avoid. An empty `settings` object therefore stores nothing, the same reading
  // `resolveAllowedGameTypes` gives an empty array - nothing offers "answer none of the
  // questions", so nothing means it. The unfiltered values are still needed below, because the
  // reservation check has to ask how long a round would actually be.
  const validated = validateConfigValues(input.fields, input.submitted.settings ?? {});
  if (!validated.ok) errors.push(...validated.errors);
  else {
    const sentKeys = Object.keys(input.submitted.settings ?? {});
    const chosen = Object.fromEntries(
      Object.entries(validated.values).filter(([key]) => sentKeys.includes(key)),
    );
    if (Object.keys(chosen).length > 0) defaults.settings = chosen;
  }

  if (defaults.roundStartPolicy === "reserve_full_round") {
    const attemptSeconds = resolveAttemptSeconds(
      input.fields,
      validated.values,
      input.maxDurationSeconds,
    );
    if (attemptSeconds === undefined || attemptSeconds <= 0) {
      errors.push(
        "This game does not declare how long a round lasts, so there is nothing to reserve. Leave the join rule as any time.",
      );
    } else {
      const minutes = defaults.durationMinutes ?? input.bounds.minMinutes;
      if (attemptSeconds >= minutes * 60) {
        errors.push(
          `A round of this game lasts ${attemptSeconds} seconds, which is the whole of a ${minutes}-minute challenge, so no player could ever start one. Lengthen the challenge or leave the join rule as any time.`,
        );
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, defaults };
}

export interface ResolvedChallengeDefaults {
  durationMinutes: number;
  roundStartPolicy: RoundStartPolicy;
  settings: Record<string, unknown>;
}

/**
 * The lenient half - what the player's dialog opens with. See the module comment for why this
 * one never refuses.
 *
 * THE POLICY IS READ THROUGH `resolveChallengeStartPolicy`, the same function
 * `challengeRoundConfig` and the create-time resolver read it through. Two functions answering
 * that question differently is how a challenge gets created under one rule and played under
 * another.
 */
export function resolveChallengeDefaults(input: {
  fields: ConfigField[];
  stored?: ChallengeDefaults | null;
  bounds: ChallengeDurationBounds;
  /** What the dialog used before any of this existed. Used when the title says nothing. */
  fallbackMinutes: number;
}): ResolvedChallengeDefaults {
  const stored = input.stored ?? undefined;

  const rawMinutes = stored?.durationMinutes;
  const chosen =
    typeof rawMinutes === "number" && Number.isFinite(rawMinutes)
      ? rawMinutes
      : input.fallbackMinutes;
  const durationMinutes = Math.min(
    input.bounds.maxMinutes,
    Math.max(input.bounds.minMinutes, Math.round(chosen)),
  );

  const validated = validateConfigValues(input.fields, stored?.settings ?? {});

  return {
    durationMinutes,
    roundStartPolicy: resolveChallengeStartPolicy(stored),
    // Reason: the schema's own defaults UNDER the stored answers, so a stored value the schema
    // has since stopped accepting falls back to a usable one rather than leaving the field
    // empty. `validateConfigValues` skips what it cannot accept, so its result carries the
    // survivors and the merge fills the rest.
    settings: { ...defaultConfigValues(input.fields), ...validated.values },
  };
}
