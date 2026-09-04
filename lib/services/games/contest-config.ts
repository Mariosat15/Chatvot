import type { RoundContestConfig } from "./round-types";

/**
 * Reads a stored contest's round settings, closing the deferral X3 recorded.
 *
 * X3's `RoundContestConfig` was passed in by the caller because no contest carried these
 * fields yet. They now live on the contest (`04` section 2.1), so this is the one place
 * that turns a contest document into the config the round service wants - and having ONE
 * such place is the point. If each caller assembled its own, the defaults would drift and
 * two contests created the same day would behave differently for no visible reason.
 *
 * A CONTEST MISSING THESE IS A HARD REFUSAL, NOT A DEFAULTED ONE. It would be easy to fall
 * back to single-attempt with a grace period, and that is exactly the wrong instinct: the
 * contest would run, players would play, and the settings governing their money would be
 * ones no operator ever chose. Refusing surfaces a real gap while nothing is at stake.
 */

export interface ProviderContestFields {
  gameType?: string;
  gameConfig?: {
    providerKey: string;
    gameCode: string;
    settings?: Record<string, unknown>;
  };
  contentSeed?: string;
  playWindowStart?: Date;
  playWindowEnd?: Date;
  resultGracePeriodSeconds?: number;
  attemptsPolicy?: string;
  attemptsAllowed?: number;
  unresolvedRoundPolicy?: string;
}

/**
 * True when this contest is played through an external provider.
 *
 * Reason it tests `gameConfig` and not `gameType === "provider"`: a contest labelled
 * provider but carrying no provider key and game code cannot launch a round, so treating it
 * as a provider contest would only move the failure later. Both must hold.
 */
export function isProviderContest(
  contest: ProviderContestFields | null | undefined,
): boolean {
  return Boolean(
    contest?.gameType === "provider" &&
      contest.gameConfig?.providerKey &&
      contest.gameConfig?.gameCode,
  );
}

export type ContestRoundConfigResult =
  | { ok: true; providerKey: string; gameCode: string; config: RoundContestConfig }
  | { ok: false; error: string };

export function contestRoundConfig(
  contest: ProviderContestFields,
): ContestRoundConfigResult {
  const providerKey = contest.gameConfig?.providerKey;
  const gameCode = contest.gameConfig?.gameCode;

  if (!providerKey || !gameCode) {
    return {
      ok: false,
      error: "This contest has no provider game recorded, so a round cannot be created.",
    };
  }
  if (!contest.playWindowEnd) {
    return { ok: false, error: "This contest has no play window end." };
  }
  if (!contest.attemptsPolicy) {
    return { ok: false, error: "This contest has no attempts policy." };
  }

  const attemptsPolicy = contest.attemptsPolicy;
  if (
    attemptsPolicy !== "single" &&
    attemptsPolicy !== "best_of_n" &&
    attemptsPolicy !== "sum_of_n"
  ) {
    return {
      ok: false,
      error: `This contest has an unrecognised attempts policy "${attemptsPolicy}".`,
    };
  }

  return {
    ok: true,
    providerKey,
    gameCode,
    config: {
      attemptsPolicy,
      // `single` ignores the allowance; passing it through anyway would let a stale value
      // read as a granted allowance in a debug dump.
      attemptsAllowed:
        attemptsPolicy === "single" ? undefined : contest.attemptsAllowed,
      playWindowEnd: contest.playWindowEnd,
      contentSeed: contest.contentSeed,
      settings: contest.gameConfig?.settings,
    },
  };
}
