/**
 * When registration for a contest closes, and whether it already has.
 *
 * EXTRACTED RATHER THAN COPIED, and the legacy guard is the reason. An older bug set
 * `registrationDeadline` to one hour *before* `startTime`, so those documents are still in the
 * database with a deadline that had already passed when the contest opened. Clamping the
 * deadline to no earlier than the start is what keeps those contests joinable - and a second
 * copy of this rule that forgot the clamp would refuse entry to them silently, with the contest
 * visibly upcoming and the button simply saying registration had closed.
 *
 * That is the "one rule, two copies" shape behind five defects in this codebase already
 * (`referenceId`, `failedReason`, `challengeId`, the Game Master `||`, and the score direction
 * that R37 closed), none of which `check:mirrors` can see, because it compares models.
 *
 * `resolveRegistrationDeadline` was split out of `isRegistrationClosed` on 7 September 2026 for
 * exactly that reason. The entry panel now counts down to the moment the door shuts, and the
 * only safe way to do that is to read the same instant the gate compares against. Computing it
 * again in the component - even correctly - would mean a player watching a countdown reach zero
 * while the button stayed open, or the reverse, the first time this clamp changed.
 */

interface RegistrationWindow {
  registrationDeadline?: Date | string | null;
  startTime?: Date | string | null;
}

/**
 * The instant after which no new entry is accepted, or `null` when the contest names none.
 *
 * `null` means entry is limited only by the contest's status, which is a real configuration
 * rather than a missing value - so a caller must say so rather than substituting `startTime`.
 * A trading contest with no deadline accepts entries for as long as it is running.
 */
export function resolveRegistrationDeadline(
  contest: RegistrationWindow,
): Date | null {
  if (!contest.registrationDeadline) return null;

  const deadline = new Date(contest.registrationDeadline);
  if (Number.isNaN(deadline.getTime())) return null;

  const start = contest.startTime ? new Date(contest.startTime) : null;
  return start && !Number.isNaN(start.getTime()) && deadline < start
    ? start
    : deadline;
}

/** Whether registration for a contest has closed. */
export function isRegistrationClosed(contest: RegistrationWindow): boolean {
  const deadline = resolveRegistrationDeadline(contest);
  if (!deadline) return false;

  return new Date() > deadline;
}
