/**
 * How long a challenge waits before it lapses.
 *
 * Two questions, one resolver. A directed challenge asks "if my friend does not
 * answer within X minutes, cancel it". An open challenge asks how long a public
 * seat stays on the board waiting for any passer-by. They are different
 * questions, so `openChallengeExpiryMinutes` exists and an operator can answer
 * them separately - but unless they do, both get the Accept Deadline.
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
 * Used when the operator has never saved an Accept Deadline.
 *
 * Reason: a stored value and an absent one are different facts, so this is a
 * named constant rather than a literal at the point of use - the admin form's
 * placeholder and this must agree, and two literals drift.
 */
export const DEFAULT_ACCEPT_DEADLINE_MINUTES = 30;

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
  const directed =
    positiveMinutes(settings.acceptDeadlineMinutes) ??
    DEFAULT_ACCEPT_DEADLINE_MINUTES;

  if (!openToAnyone) return directed;

  /*
    AN UNSET OPEN EXPIRY FALLS BACK TO THE DIRECTED DEADLINE, NOT TO A CONSTANT.

    Reason: owner decision, 14 Sep 2026, and it REVERSES the rule this file
    shipped with earlier the same day. That rule was a fixed 24 hours, on the
    grounds that falling back to `acceptDeadlineMinutes` would make the whole
    feature invisible - the branch present and merely answering the same thing.

    That argument was about VISIBILITY and it stopped holding the moment the
    control existed: the operator can now see both numbers on Settings -> 1v1
    Challenges and set them apart whenever they want to. With the control there,
    a separate hidden constant is the worse option - it is a third number nobody
    configured, sitting between two they did, and an operator who lowers the
    Accept Deadline to five minutes reasonably expects an open seat not to
    outlive it by a day.

    The distinction the earlier rule protected still stands and is what keeps
    this a fallback rather than a merge: a SAVED open expiry always wins, so the
    two are free to differ. What changed is only what happens when nobody has
    chosen.
  */
  return positiveMinutes(settings.openChallengeExpiryMinutes) ?? directed;
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
