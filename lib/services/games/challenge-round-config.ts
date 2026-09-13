import type { RoundContestConfig } from "./round-types";
import { deriveChallengeWindow, type ChallengeWindowFields } from "./challenge-window";

/**
 * Reads a stored challenge's round settings, the challenge-side sibling of
 * `contest-config.ts`.
 *
 * A SEPARATE FILE RATHER THAN A GENERALISATION OF `contestRoundConfig`, on the precedent
 * `challenge-settlement.service.ts` already set: the two documents share almost every field
 * NAME (`gameConfig`, `contentSeed`, `attemptsPolicy`, `roundStartPolicy`) but not the same
 * shape for the window, and forcing one function to branch on which model it was handed is
 * how a competition-only assumption ends up inside challenge code, or vice versa, reading as
 * correct in review. Every low-level piece this calls - `RoundContestConfig`,
 * `deriveChallengeWindow` - is already the ONE definition; only the orchestration differs.
 */

export interface ChallengeContestFields extends ChallengeWindowFields {
  gameType?: string;
  gameConfig?: {
    providerKey: string;
    gameCode: string;
    settings?: Record<string, unknown>;
  };
  contentSeed?: string;
  attemptsPolicy?: string;
  attemptsAllowed?: number;
  roundStartPolicy?: string;
}

/**
 * True when this challenge is played through an external provider.
 *
 * Reason it tests `gameConfig` and not `gameType === "provider"`: a challenge labelled
 * provider but carrying no provider key and game code cannot launch a round, so treating it
 * as one would only move the failure later. Both must hold - the exact reasoning
 * `isProviderContest` already carries for `Competition`.
 */
export function isProviderChallenge(
  challenge: ChallengeContestFields | null | undefined,
): boolean {
  return Boolean(
    challenge?.gameType === "provider" &&
      challenge.gameConfig?.providerKey &&
      challenge.gameConfig?.gameCode,
  );
}

/**
 * True when this challenge is LABELLED as a provider challenge, whatever else it is missing.
 *
 * See `hasProviderGameLabel` in `contest-config.ts` for the full reasoning - it is the same
 * deliberately weaker question, kept under its own name for the same reason: a screen
 * deciding which lobby or badge to render must not reach for the strict helper and render a
 * keyless provider challenge as a trading one.
 */
export function hasProviderChallengeGameLabel(
  challenge: Pick<ChallengeContestFields, "gameType"> | null | undefined,
): boolean {
  return challenge?.gameType === "provider";
}

export type ChallengeRoundConfigResult =
  | { ok: true; providerKey: string; gameCode: string; config: RoundContestConfig }
  | { ok: false; error: string };

/**
 * A CHALLENGE MISSING THESE IS A HARD REFUSAL, NOT A DEFAULTED ONE - the same rule
 * `contestRoundConfig` states for competitions, for the same reason. Falling back to
 * single-attempt with a grace period would let the challenge run under settings neither
 * player chose.
 */
export function challengeRoundConfig(
  challenge: ChallengeContestFields,
): ChallengeRoundConfigResult {
  const providerKey = challenge.gameConfig?.providerKey;
  const gameCode = challenge.gameConfig?.gameCode;

  if (!providerKey || !gameCode) {
    return {
      ok: false,
      error: "This challenge has no provider game recorded, so a round cannot be created.",
    };
  }

  const window = deriveChallengeWindow(challenge);
  if (!window) {
    return {
      ok: false,
      error: "This challenge has no play window yet.",
    };
  }

  if (!challenge.attemptsPolicy) {
    return { ok: false, error: "This challenge has no attempts policy." };
  }

  const attemptsPolicy = challenge.attemptsPolicy;
  if (
    attemptsPolicy !== "single" &&
    attemptsPolicy !== "best_of_n" &&
    attemptsPolicy !== "sum_of_n"
  ) {
    return {
      ok: false,
      error: `This challenge has an unrecognised attempts policy "${attemptsPolicy}".`,
    };
  }

  return {
    ok: true,
    providerKey,
    gameCode,
    config: {
      attemptsPolicy,
      // `single` ignores the allowance; passing it through anyway would let a stale value
      // read as a granted allowance in a debug dump. Same reasoning as `contestRoundConfig`.
      attemptsAllowed:
        attemptsPolicy === "single" ? undefined : challenge.attemptsAllowed,
      playWindowEnd: window.playWindowEnd,
      contentSeed: challenge.contentSeed,
      roundStartPolicy:
        challenge.roundStartPolicy === "until_window_closes"
          ? "until_window_closes"
          : "reserve_full_round",
      settings: challenge.gameConfig?.settings,
    },
  };
}
