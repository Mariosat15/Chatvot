/**
 * Validating an administrator's edit to a Game Master's limits, and to the per-Game-Master
 * competition-creation override.
 *
 * WHY AN ALLOW-LIST RATHER THAN A SPREAD
 * --------------------------------------
 * `PATCH /api/gamemasters/[id]` with `action: "update_limits"` used to write
 * `{ ...subscription.limits, ...body.limits }` - every key the browser sent, unvalidated,
 * onto the document that decides how many contests a Game Master may create, what share
 * they earn, and (since chapter 19 section 3.2) which games they may create at all. The same
 * shape as `PUT /api/competitions/[id]`'s blind `Object.assign`, one collection along.
 *
 * It matters more now than it did last week: `allowedGameTypes` is the gate holding back
 * provider-game creation until the Game Master share is computed on NET platform fee after
 * provider cost (section 5). A gate whose value can be set by an unvalidated spread is not
 * a gate - and this endpoint is where an operator legitimately edits it, so it cannot simply
 * be made read-only.
 *
 * AN UNKNOWN FIELD IS REFUSED WITH THE FIELD NAMED, NEVER DROPPED. Dropping is tidier and it
 * means the edit appears to save while doing nothing: the screen redraws the old value and
 * the operator concludes they misclicked. That is this codebase's recurring failure mode.
 *
 * Admin-only. `apps/admin/lib/admin/` is not mirrored, so `check:mirrors` says nothing about
 * this file.
 */

import { listGameModules } from "@/lib/games/registry";

/**
 * The limit fields an administrator may edit per Game Master.
 *
 * A `Set`, not an object or an array, and the reason is not style. `ALLOWED[key]` walks the
 * prototype chain, so `"constructor"` and `"toString"` are admitted - truthy, surviving a
 * `!allowed` test, and failing later somewhere unrelated. A `Set` has no prototype chain, so
 * the check is total. Third instance after the round-inspector action map and the competition
 * update allow-list.
 *
 * `canEarnFromChallenges` and `challengeReferralFeePercentage` are deliberately absent:
 * nothing in the admin UI edits them, and a field admitted here that no screen sets is a
 * widening nobody asked for.
 */
export const EDITABLE_LIMIT_FIELDS = new Set([
  "maxCompetitionsPerDay",
  "maxUsersPerCompetition",
  "referralFeePercentage",
  "canCreateCompetitions",
  "allowedGameTypes",
]);

/** Every game type the module registry knows about. */
export function registeredGameTypes(): Set<string> {
  return new Set(listGameModules().map((gameModule) => gameModule.type));
}

export type LimitsUpdateResult =
  | { ok: true; limits: Record<string, unknown> }
  | { ok: false; error: string };

interface Bounds {
  min: number;
  max: number;
}

// Mirrors the schema's own `min`/`max` on `gamemaster-subscription.model.ts`. Duplicated
// deliberately and knowingly: a raw-driver `updateOne` runs no Mongoose validation at all,
// so without these the schema's bounds are decoration on this path. A test pins the two
// together, because two copies of a bound that drift are worse than one.
const BOUNDS = new Map<string, Bounds>([
  ["maxCompetitionsPerDay", { min: 1, max: 100 }],
  ["maxUsersPerCompetition", { min: 2, max: 100000 }],
  ["referralFeePercentage", { min: 0, max: 50 }],
]);

/**
 * Merge a validated edit onto the stored limits.
 *
 * Returns the WHOLE limits object rather than a `$set` of the changed keys, because that is
 * what the caller writes and a partial merge is where a field gets silently dropped.
 */
export function validateLimitsUpdate(
  stored: Record<string, unknown> | null | undefined,
  requested: unknown,
): LimitsUpdateResult {
  if (requested === null || typeof requested !== "object" || Array.isArray(requested)) {
    return { ok: false, error: "Limits must be an object." };
  }

  const merged: Record<string, unknown> = { ...(stored ?? {}) };
  const validTypes = registeredGameTypes();

  for (const [key, value] of Object.entries(requested)) {
    if (!EDITABLE_LIMIT_FIELDS.has(key)) {
      return {
        ok: false,
        error: `"${key}" is not an editable Game Master limit.`,
      };
    }

    if (key === "canCreateCompetitions") {
      if (typeof value !== "boolean") {
        return { ok: false, error: `"${key}" must be true or false.` };
      }
      merged.canCreateCompetitions = value;
      continue;
    }

    if (key === "allowedGameTypes") {
      if (!Array.isArray(value) || value.length === 0) {
        // Reason an empty array is refused rather than stored: `resolveAllowedGameTypes`
        // reads `[]` as "nothing configured" and falls back to trading, so storing one would
        // silently produce a different answer from the one the operator selected. An
        // operator who wants trading only should be able to say so and see it.
        return {
          ok: false,
          error: `"allowedGameTypes" must list at least one game type.`,
        };
      }

      const cleaned: string[] = [];
      for (const entry of value) {
        if (typeof entry !== "string" || !validTypes.has(entry)) {
          return {
            ok: false,
            error: `"${String(entry)}" is not a known game type.`,
          };
        }
        if (!cleaned.includes(entry)) cleaned.push(entry);
      }

      merged.allowedGameTypes = cleaned;
      continue;
    }

    // The three numeric caps.
    const bounds = BOUNDS.get(key);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      // Reason `Number.isFinite` rather than a truthy check: these arrive from `parseFloat`
      // on an admin form, so `NaN` is one keystroke away, and a `NaN` stored on a required
      // Number path poisons every multiplication it reaches with nothing checking. Note 0 is
      // a legitimate `referralFeePercentage` (R31) and must survive this check.
      return { ok: false, error: `"${key}" must be a number.` };
    }
    if (bounds && (value < bounds.min || value > bounds.max)) {
      return {
        ok: false,
        error: `"${key}" must be between ${bounds.min} and ${bounds.max}.`,
      };
    }

    // Reason the three are assigned by name rather than with `merged[key] = value`: writing
    // to an object at a caller-supplied key is an object injection sink. The allow-list above
    // does make it safe here, but "safe because of a check earlier in the function" is the
    // reasoning that made `ACTIONS["__proto__"]` reachable on the round inspector, and three
    // named assignments cost nothing.
    if (key === "maxCompetitionsPerDay") merged.maxCompetitionsPerDay = value;
    else if (key === "maxUsersPerCompetition") merged.maxUsersPerCompetition = value;
    else if (key === "referralFeePercentage") merged.referralFeePercentage = value;
  }

  return { ok: true, limits: merged };
}

export type OverrideUpdateResult =
  | {
      ok: true;
      override: "enabled" | "disabled" | null;
      overrideLimits: { maxCompetitionsPerDay?: number; maxUsersPerCompetition?: number };
    }
  | { ok: false; error: string };

/**
 * Validate the per-Game-Master competition-creation override.
 *
 * WHY THIS ACTION EXISTS AT ALL, because the fields did and the control did not.
 * `competitionCreationOverride` and `overrideLimits` have been on the schema since long
 * before this project, with a Mongoose VIRTUAL that reads them correctly - and nothing has
 * ever written them, nothing has ever read them, and the virtual has never run, because both
 * creation routes read the collection with the raw driver. The admin UI carries two
 * vestigial guards special-casing an action string that no control sends and that this route
 * answered with "Invalid action".
 *
 * Chapter 19 section 4 describes this as "an admin clicks a button that does nothing"; the
 * button does not exist either. That is a different fault from the one recorded, and the
 * correction matters: implementing the handler alone would have left it unreachable.
 *
 * It is implemented rather than deleted - the `shouldBlockEntry` precedent cuts the other way
 * here - because it is the ONLY per-Game-Master control. Everything else is per-tier, so
 * without it the only ways to stop one Game Master creating competitions are to change the
 * package for everybody on that tier, or to suspend the subscription, which also stops the
 * earnings they are contractually owed.
 */
export function validateOverrideUpdate(body: {
  override?: unknown;
  overrideLimits?: unknown;
}): OverrideUpdateResult {
  const { override } = body;

  if (override !== null && override !== "enabled" && override !== "disabled") {
    return {
      ok: false,
      error: `"override" must be "enabled", "disabled", or null to follow the package.`,
    };
  }

  const overrideLimits: {
    maxCompetitionsPerDay?: number;
    maxUsersPerCompetition?: number;
  } = {};

  if (override === "enabled" && body.overrideLimits) {
    const raw = body.overrideLimits;
    if (typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: "Override limits must be an object." };
    }

    const source = raw as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      if (key !== "maxCompetitionsPerDay" && key !== "maxUsersPerCompetition") {
        return {
          ok: false,
          error: `"${key}" is not an override limit.`,
        };
      }
    }

    const perDay = source.maxCompetitionsPerDay;
    const perContest = source.maxUsersPerCompetition;

    if (perDay !== undefined) {
      if (typeof perDay !== "number" || !Number.isFinite(perDay) || perDay < 1) {
        return {
          ok: false,
          error: `"maxCompetitionsPerDay" must be a number of at least 1.`,
        };
      }
      overrideLimits.maxCompetitionsPerDay = perDay;
    }

    if (perContest !== undefined) {
      // Reason the floor is 2 and not 1: a contest whose participant cap is 1 is a paid
      // single-player format, which no paid format on this platform may be. It matches the
      // schema's own `min: 2` on this field.
      if (
        typeof perContest !== "number" ||
        !Number.isFinite(perContest) ||
        perContest < 2
      ) {
        return {
          ok: false,
          error: `"maxUsersPerCompetition" must be a number of at least 2.`,
        };
      }
      overrideLimits.maxUsersPerCompetition = perContest;
    }
  }

  return { ok: true, override, overrideLimits };
}
