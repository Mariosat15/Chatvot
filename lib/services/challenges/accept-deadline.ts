/**
 * How long a challenge waits before it lapses.
 *
 * Reason: `acceptDeadlineMinutes` was chosen with one question in mind - "if my
 * friend does not answer within X minutes, cancel it" - and 30 minutes is a
 * sensible answer to it. An open challenge asks a different question: how long
 * a public seat stays on the board waiting for any passer-by. Reusing one
 * number forces the two to be equal, and nobody chose it for the second case.
 *
 * One resolver rather than a branch at each writer, because there are two
 * creators today (the player route and the simulator batch) and whether a
 * challenge lapses in half an hour or a day would otherwise depend on which
 * one made it.
 *
 * Model-free and mirrored into `apps/admin` - `check:mirrors` compares models,
 * so a byte-for-byte test is the guarantee.
 */

/**
 * Used when the operator has never saved a value.
 *
 * Reason: a stored value and an absent one are different facts, and the
 * settings document predates this field, so `.lean()` reads return `undefined`
 * on every existing deployment. Falling back to `acceptDeadlineMinutes` would
 * reinstate the very equality this exists to break, silently.
 */
export const DEFAULT_OPEN_CHALLENGE_EXPIRY_MINUTES = 1440;

export interface AcceptDeadlineSettings {
  acceptDeadlineMinutes?: number | null;
  openChallengeExpiryMinutes?: number | null;
}

function positiveMinutes(value: unknown): number | null {
  // Reason: these arrive from `parseInt` on an admin form, so `NaN` is one
  // keystroke away and a non-finite deadline produces an Invalid Date that
  // every comparison below reads as "not yet expired" - the challenge would
  // then never lapse at all.
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function resolveAcceptDeadlineMinutes(
  settings: AcceptDeadlineSettings,
  openToAnyone: boolean,
): number {
  if (openToAnyone) {
    return (
      positiveMinutes(settings.openChallengeExpiryMinutes) ??
      DEFAULT_OPEN_CHALLENGE_EXPIRY_MINUTES
    );
  }
  return positiveMinutes(settings.acceptDeadlineMinutes) ?? 30;
}

export function resolveAcceptDeadline(
  settings: AcceptDeadlineSettings,
  openToAnyone: boolean,
  from: Date = new Date(),
): Date {
  return new Date(
    from.getTime() +
      resolveAcceptDeadlineMinutes(settings, openToAnyone) * 60 * 1000,
  );
}
