/**
 * What an update to a competition is allowed to change.
 *
 * WHY THIS EXISTS: `PUT /api/competitions/[id]` did `Object.assign(competition, await
 * request.json())`. Every field on the document was therefore writable by any caller with an
 * admin cookie, including `gameKey` - which is the immutable join key for every historical
 * stat - and `status`, which could walk a contest backwards out of `completed`.
 *
 * UNKNOWN KEYS ARE REFUSED, NOT DROPPED, and that is the load-bearing choice. Dropping is
 * the tidy-looking option and it is the failure mode that has already bitten this codebase
 * twice: the simulator batch route silently discarded six participant fields whose names the
 * schema did not declare, and Mongoose strict mode discarded `suspensionEndsAt` while the
 * caller reported success. If somebody adds a field to the editor form and forgets this
 * list, a refusal breaks the save loudly in an admin screen; a drop loses the operator's
 * work with a success toast on top of it.
 *
 * Not mirrored. `apps/admin/lib/admin/` is admin-only, like `contest-game-label.ts` and
 * `game-sections.ts`, so `check:mirrors` says nothing about this file.
 */

/**
 * Exactly the keys `CompetitionEditorForm.tsx` submits.
 *
 * Verified against that form's `updatePayload` rather than assembled from the model, and the
 * distinction matters: the model has ~60 fields and the form writes 14. A list derived from
 * the model would re-open most of the hole this closes.
 *
 * `PUT /api/competitions/[id]` has exactly ONE writer - that form - which is what makes an
 * allow-list safe here. Counted with `rg`, because "one caller" is an assumption until it
 * is not.
 */
export const TRADING_EDITABLE_FIELDS = [
  "name",
  "description",
  "entryFee",
  "entryFeeCredits",
  "startingCapital",
  "startingTradingPoints",
  "maxParticipants",
  "startTime",
  "endTime",
  "leverageAllowed",
  "platformFeePercentage",
  "assetClasses",
  "prizeDistribution",
  "levelRequirement",
] as const;

/**
 * Fields no update may touch, whatever the game and whatever the contest's state.
 *
 * These are refused with the field named rather than quietly ignored. An operator who
 * believes they have converted a trading contest into a provider one, or re-seeded a
 * contest, must be told they have not.
 *
 * `gameKey` is the hard case and the reason the list exists: it is the join key for all
 * historical stats and is immutable by platform-wide constraint, so a route that can rewrite
 * it can orphan a player's whole history with no error anywhere.
 *
 * `contentSeed` is the fairness one. Every round in a contest derives its content from it,
 * so changing it mid-contest means two players ranked against each other played different
 * games - and the leaderboard still renders, perfectly, side by side.
 *
 * `playMode` is listed even though it is absent from the allow-list and would therefore be
 * refused anyway (task document 11). Belt and braces is not the reason: the two refusals say
 * different things, and the day somebody adds `playMode` to an editor form and to the
 * allow-list, this entry is what keeps it immutable. It decides when entry closes and how
 * many attempts a paying entrant gets, so it is frozen for the same reason `contentSeed` is.
 */
export const NEVER_EDITABLE_FIELDS = [
  "_id",
  "gameType",
  "gameKey",
  "gameConfig",
  "contentSeed",
  "playMode",
  "slug",
  "status",
  "createdBy",
  "currentParticipants",
  "prizePool",
] as const;

export interface UpdateFilterResult {
  ok: boolean;
  /** Operator-facing refusal. Present only when `ok` is false. */
  error?: string;
  /** The fields that may be applied, in the caller's own values. */
  update: Record<string, unknown>;
}

/**
 * Narrows an arbitrary request body to the fields the trading editor may write.
 *
 * Refuses rather than filters, for the reason in the file header. Both refusal messages name
 * the offending key, because "invalid request" in an admin screen sends the operator to a
 * developer.
 */
export function filterTradingCompetitionUpdate(
  body: unknown,
): UpdateFilterResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "The update must be an object.", update: {} };
  }

  const allowed = new Set<string>(TRADING_EDITABLE_FIELDS);
  const forbidden = new Set<string>(NEVER_EDITABLE_FIELDS);
  const update: Record<string, unknown> = {};

  // `Object.hasOwn` over `in`, and own-keys over a prototype walk: `{"__proto__": ...}` from
  // a JSON body lands as an own property, but `"toString" in obj` is true for every object
  // ever, so an `in`-based allow-list check would admit inherited names.
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (forbidden.has(key)) {
      return {
        ok: false,
        error: `"${key}" cannot be changed after a contest is created.`,
        update: {},
      };
    }
    if (!allowed.has(key)) {
      return {
        ok: false,
        error: `"${key}" is not an editable field on a trading contest.`,
        update: {},
      };
    }
    // Reason: `key` is request-derived, so the rule is right to flag the shape - but it has
    // already been proved a member of `allowed`, a `Set`, which has no prototype chain to
    // walk. That check is what makes the access total, and it is why the allow-list is a Set
    // rather than an object: `ALLOWED[key]` would admit "constructor" as truthy.
    // eslint-disable-next-line security/detect-object-injection
    update[key] = (body as Record<string, unknown>)[key];
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "The update contained no fields.", update: {} };
  }

  return { ok: true, update };
}
