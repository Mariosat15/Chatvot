/**
 * Whether registration for a contest has closed.
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
 */
export function isRegistrationClosed(contest: {
  registrationDeadline?: Date | string | null;
  startTime?: Date | string | null;
}): boolean {
  if (!contest.registrationDeadline) return false;

  const deadline = new Date(contest.registrationDeadline);
  if (Number.isNaN(deadline.getTime())) return false;

  const start = contest.startTime ? new Date(contest.startTime) : null;
  const effectiveDeadline =
    start && !Number.isNaN(start.getTime()) && deadline < start
      ? start
      : deadline;

  return new Date() > effectiveDeadline;
}
