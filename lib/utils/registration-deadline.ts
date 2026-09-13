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

/**
 * WHY entry closes when it does, which is a different question from when.
 *
 * The entry panel used to answer it with one unconditional sentence - "after that no new
 * entries are accepted, whether or not the competition is still running" - and that sentence
 * is wrong in both directions on a game contest. Under `until_window_closes` the deadline IS
 * the moment play stops, so the clause describes a gap that does not exist and invites a
 * player to think they are being shut out early. Under `reserve_full_round` there genuinely is
 * a gap, and the sentence never says the one thing that makes it fair rather than arbitrary:
 * the door shuts early so that whoever walks through it last still gets a whole round.
 *
 * IT LIVES BESIDE THE DEADLINE ON PURPOSE. The span it reports is measured from the very
 * instant `resolveRegistrationDeadline` returns, so the countdown a player watches and the
 * explanation underneath it cannot disagree - including about the legacy clamp against
 * `startTime`, which makes the reserved span wider than one round on a short contest. A second
 * module recomputing the deadline to describe it is the "one rule, two copies" shape this file
 * was extracted to prevent.
 */
export type EntryCloseKind =
  /** Shuts early, holding back enough time for one whole round. */
  | "reserves_round"
  /** Shuts when play stops; a late joiner gets a shortened round. */
  | "runs_to_the_end"
  /** A deadline the operator chose, unrelated to how long a round takes. */
  | "operator_chosen";

export interface EntryCloseExplanation {
  kind: EntryCloseKind;
  /** How long before play stops the door shuts. Zero unless `reserves_round`. */
  reservedMs: number;
}

interface EntryCloseInput extends RegistrationWindow {
  /** Absent on a trading contest, which has no rounds to reserve time for. */
  roundStartPolicy?: string | null;
  /** `12` s2.3 derives this from the contest clock; `endTime` is the fallback. */
  playWindowEnd?: Date | string | null;
  endTime?: Date | string | null;
}

/**
 * Reads the stored policy rather than inferring one from the arithmetic.
 *
 * Inferring is tempting, because a reserving contest is exactly the one whose deadline sits
 * before its window end - but the two coincide whenever nothing declares a round length, and a
 * contest that reserves nothing because it cannot compute a reservation behaves permissively.
 * Describing that as "we held time back for you" would be a promise no gate keeps.
 */
export function describeEntryClose(
  contest: EntryCloseInput,
): EntryCloseExplanation {
  const none: EntryCloseExplanation = { kind: "operator_chosen", reservedMs: 0 };

  const policy = contest.roundStartPolicy;
  if (!policy) return none;
  if (policy === "until_window_closes") {
    return { kind: "runs_to_the_end", reservedMs: 0 };
  }

  const deadline = resolveRegistrationDeadline(contest);
  const endSource = contest.playWindowEnd ?? contest.endTime;
  if (!deadline || !endSource) return none;

  const end = new Date(endSource);
  if (Number.isNaN(end.getTime())) return none;

  const reservedMs = end.getTime() - deadline.getTime();

  // Reason: a reserving contest with nothing to reserve is the third case in
  // `resolveContestEntryDeadline` - no declared attempt length, so the round-start gate applies
  // no reservation either and entry really does run to the end. `resolveExpiry` still clamps a
  // late round to the window, so the permissive sentence is the accurate one.
  return reservedMs > 0
    ? { kind: "reserves_round", reservedMs }
    : { kind: "runs_to_the_end", reservedMs: 0 };
}
