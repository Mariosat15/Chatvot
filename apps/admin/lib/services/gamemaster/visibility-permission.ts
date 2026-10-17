/**
 * May this Game Master create a contest with this visibility? (Gamemaster Program v2 step 5,
 * `External game plans/24-gamemaster-program-v2.md` s10.)
 *
 * One rule for both creation routes - `app/api/gamemaster/competitions` and the admin-hosted
 * copy - for the same reason `game-permissions.ts` exists: two routes answering one question
 * separately is the "one rule, two copies" shape, and a Game Master can reach both.
 *
 * Model-free and MIRRORED into `apps/admin/lib/services/gamemaster/`. `check:mirrors` compares
 * models, so a test pins the two copies byte-identical.
 */

import {
  COMPETITION_VISIBILITIES,
  DEFAULT_COMPETITION_VISIBILITY,
  type CompetitionVisibility,
} from "./competition-visibility";
import { resolveAllowedVisibility } from "./subscription-limits";

export type VisibilityRefusalReason =
  | "visibility_unknown"
  | "visibility_not_permitted"
  | "private_contests_disabled";

/** Which source decided the allow-list - reported so the refusal names who refused. */
export type VisibilityDecidedBy = "current_package" | "cached_limits" | "default";

export interface VisibilityVerdict {
  ok: boolean;
  /** The visibility to STAMP on the insert, resolved once so gate and label agree. */
  visibility: CompetitionVisibility;
  allowedVisibility: readonly CompetitionVisibility[];
  decidedBy: VisibilityDecidedBy;
  reason?: VisibilityRefusalReason;
  message?: string;
}

export interface CheckVisibilityInput {
  /** What the caller asked for. Absent, `null` or `""` means public. */
  requested: unknown;
  /** The CURRENT package's `gameMasterConfig.allowedVisibility`, or undefined when gone. */
  packageAllowed?: unknown;
  /** Whether a current package was found at all (a deleted package falls back to the cache). */
  hasPackage: boolean;
  /** `subscription.limits.allowedVisibility`, the value cached at purchase. */
  cachedAllowed?: unknown;
  /** `WhiteLabel.gmPrivateContestsEnabled`. Absent means off. */
  privateContestsEnabled: boolean;
}

const KNOWN = new Set<string>(COMPETITION_VISIBILITIES);

/**
 * Refusals, in the order an operator would want to hear them: an unknown value, then the
 * platform switch, then the package.
 *
 * Reason an admin creation override does NOT widen this: the override decides whether a Game
 * Master may create at all, exactly as it never widens `allowedGameTypes`. A private contest
 * is a commercial tier; carrying it through a switch labelled "creation" hides that grant.
 *
 * Reason an unknown value is REFUSED here while `resolveCompetitionVisibility` reads one as
 * private: that function reads a STORED value, where failing closed hides a contest; this reads
 * CALLER input, where guessing either way stores a visibility nobody chose.
 */
export function checkVisibilityAllowed(input: CheckVisibilityInput): VisibilityVerdict {
  const decidedBy: VisibilityDecidedBy = input.hasPackage && Array.isArray(input.packageAllowed)
    ? "current_package"
    : Array.isArray(input.cachedAllowed)
      ? "cached_limits"
      : "default";
  const allowedVisibility = resolveAllowedVisibility(
    decidedBy === "current_package"
      ? input.packageAllowed
      : decidedBy === "cached_limits"
        ? input.cachedAllowed
        : undefined,
  );

  const raw = input.requested;
  const requestedBlank =
    raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
  if (!requestedBlank && (typeof raw !== "string" || !KNOWN.has(raw))) {
    return {
      ok: false,
      visibility: DEFAULT_COMPETITION_VISIBILITY,
      allowedVisibility,
      decidedBy,
      reason: "visibility_unknown",
      message: "Unknown competition visibility. Choose Public or Private.",
    };
  }
  const visibility: CompetitionVisibility = requestedBlank
    ? DEFAULT_COMPETITION_VISIBILITY
    : (raw as CompetitionVisibility);

  if (visibility === "gm_private" && !input.privateContestsEnabled) {
    return {
      ok: false,
      visibility,
      allowedVisibility,
      decidedBy,
      reason: "private_contests_disabled",
      message: "Private competitions are not available on the platform yet.",
    };
  }

  if (!allowedVisibility.includes(visibility)) {
    return {
      ok: false,
      visibility,
      allowedVisibility,
      decidedBy,
      reason: "visibility_not_permitted",
      message:
        visibility === "gm_private"
          ? "Your Game Master package does not allow private competitions."
          : "Your Game Master package does not allow public competitions.",
    };
  }

  return { ok: true, visibility, allowedVisibility, decidedBy };
}

export type AllowedVisibilityInputResult =
  | { ok: true; value: CompetitionVisibility[] }
  | { ok: false; error: string };

/**
 * Validate what the admin package editor sends as `gameMasterConfig.allowedVisibility`.
 *
 * Reason it exists at all: the marketplace PUT writes with `findByIdAndUpdate` and no
 * `runValidators`, so the schema's enum never runs on that path, and the value is then copied
 * onto every subscription with the raw driver. An empty list is refused rather than stored,
 * because `resolveAllowedVisibility` reads `[]` as public-only - storing one would make the
 * editor and the creation routes disagree. Order is normalised so a re-save is not a change.
 */
export function parseAllowedVisibilityInput(value: unknown): AllowedVisibilityInputResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Choose at least one competition visibility." };
  }
  if (!value.every((v) => typeof v === "string" && KNOWN.has(v))) {
    return { ok: false, error: "Unknown competition visibility. Choose Public or Private." };
  }
  return { ok: true, value: COMPETITION_VISIBILITIES.filter((v) => value.includes(v)) };
}
