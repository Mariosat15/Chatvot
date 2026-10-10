/**
 * What counts as a list of ids on a journey milestone.
 *
 * Four milestone paths are declared `[String]` — `requiredBadgeIds`,
 * `gameTypes`, `connectedTo` and `connectedFrom`. The milestone agent is handed
 * them comma-joined inside a pipe-separated table (`milestonesToCompact`), so a
 * model echoing `"trade_25,risk_survivor"` back is reading the format it was
 * given rather than malfunctioning. The reply is then cast `as MilestoneDraft[]`
 * with no shape check, and two things follow, neither of which raises anything:
 *
 * - Mongoose wraps a bare string into a ONE-ELEMENT array rather than
 *   rejecting it, and the document then validates. A gate stored as
 *   `["trade_25,risk_survivor"]` names a badge no badge carries, so
 *   `requiredBadgeIds.every(id => earned.has(id))` can never be true and the
 *   milestone is locked for ever. Proven by construction, not inferred.
 * - A string has `.length`, so `(m.requiredBadgeIds?.length ?? 0) > 0` admits
 *   it and the `.join(", ")` beneath dies, taking the whole review step down
 *   with it — the operator loses every proposal the agent made.
 *
 * Reason this module is model-free: the writer is an API route holding Mongoose
 * models and the reader is a `"use client"` component, so neither can import
 * the other (R58). One definition is what stops the display and the write
 * disagreeing about what a gate list is — a disagreement whose failure mode is
 * a gate shown on screen that was stored as something else.
 */

/** The milestone paths declared `[String]`, and therefore silently coercible. */
export const MILESTONE_ID_LIST_FIELDS = [
  "requiredBadgeIds",
  "gameTypes",
  "connectedTo",
  "connectedFrom",
] as const;

/**
 * Reads any value as the list of ids it was meant to be.
 *
 * Total by construction: a shape with no sensible reading yields an empty list
 * rather than throwing, because every caller is either rendering a review
 * screen or building a document, and neither can usefully handle an exception.
 *
 * Note the direction chosen for an unreadable value. Keeping it would preserve
 * a gate nobody can satisfy, which is the permanent lock this module exists to
 * prevent; dropping it leaves the milestone reachable and the missing gate
 * visible to an operator on the very screen that proposed it.
 */
export function toIdList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (id) seen.add(id);
  }
  return [...seen];
}

/**
 * Returns a copy of a milestone with its four id lists read as lists.
 *
 * Only fields that are PRESENT are touched. `gameTypes` carries no schema
 * default on purpose — an absent list means platform-wide, which is a different
 * fact from an empty one — so normalising an absent field into `[]` would
 * destroy that distinction on every milestone that passes through.
 */
export function normaliseMilestoneIdLists<T extends Record<string, unknown>>(milestone: T): T {
  let normalised: Record<string, unknown> | null = null;
  for (const field of MILESTONE_ID_LIST_FIELDS) {
    // Reason: the three object-injection warnings below are read and written
    // under `field`, which iterates the frozen literal tuple above and can
    // never be request-supplied, so the prototype-chain hazard the rule exists
    // for is not reachable here. Scoped to the rule rather than the file.
    /* eslint-disable security/detect-object-injection */
    if (!(field in milestone)) continue;
    const current = milestone[field];
    const list = toIdList(current);
    // Reason: an already-clean array is left as the same reference so an
    // untouched milestone is not rewritten, which keeps a write that changes
    // nothing out of the diff an operator reviews.
    if (Array.isArray(current) && current.length === list.length && current.every((v, i) => v === list[i])) {
      continue;
    }
    normalised ??= { ...milestone };
    normalised[field] = list;
    /* eslint-enable security/detect-object-injection */
  }
  return (normalised as T | null) ?? milestone;
}
