/**
 * Which fields of a provider contest survive somebody entering it.
 *
 * MODEL-FREE ON PURPOSE, so both sides of the boundary can import it. The edit service
 * imports Mongoose models and therefore cannot be pulled into a client component; the editor
 * form needs the same list to decide which inputs to disable. Writing the list twice is the
 * "one rule, two copies" shape that has already produced four defects here - `referenceId`,
 * `failedReason`, `challengeId` and the Game Master `||` - none of which `check:mirrors` can
 * see, because it compares models. The drift it prevents is not cosmetic either: a form that
 * submits a field the server has since frozen fails with a 400 that reads to the operator
 * like a permissions problem.
 *
 * Not mirrored. `apps/admin/lib/admin/` is admin-only.
 */

/**
 * Editable at any point in a contest's life, including after players have paid to enter.
 *
 * Each earns its place for a different reason:
 *   - `name` and `description` are presentational. Fixing a typo must not require cancelling
 *     a contest and refunding everyone.
 *   - `maxParticipants` only ever goes UP - the service enforces the direction. Raising a cap
 *     adds seats and harms nobody; lowering it below the number already seated would make
 *     `currentParticipants > maxParticipants`, which every "is registration open" check
 *     reads, so the contest would silently look full.
 *   - `perRoundCostAcknowledged` is not a stored field at all, just an acknowledgement the
 *     pre-flight checklist reads, so it is harmless whenever it arrives.
 */
export const EDITABLE_ONCE_ENTERED = [
  "name",
  "description",
  "maxParticipants",
  "perRoundCostAcknowledged",
] as const;

/**
 * Statuses at which a contest is finished with and must not be edited at all.
 *
 * `finalizing` is in the list for the same reason it is treated as closed by result
 * ingestion: ranking is being computed from participant scores right then, so a change
 * landing during it may or may not be counted depending purely on timing.
 */
export const CLOSED_TO_EDITS = [
  "finalizing",
  "completed",
  "cancelled",
  "emergency_ended",
] as const;

export function isEditableOnceEntered(field: string): boolean {
  return (EDITABLE_ONCE_ENTERED as readonly string[]).includes(field);
}

export function isClosedToEdits(status: string): boolean {
  return (CLOSED_TO_EDITS as readonly string[]).includes(status);
}
