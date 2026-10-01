/**
 * Own referral or external? The ONE answer to how a referred player came to a Game Master
 * (`External game plans/24` s7.1, task 3 of the v2 programme).
 *
 * Model-free on purpose: the model is imported for TYPES only (erased at build), so a client
 * badge can import this file without pulling the database driver into the browser (R58).
 * Mirrored into `apps/admin`; a test pins the copies byte-identical, because `check:mirrors`
 * compares models and cannot see this file.
 *
 * Both the JavaScript resolver and the MongoDB expressions below are generated from the same
 * two tables, and a behavioural test runs the expressions against a real database and asserts
 * they agree with the resolver row by row - two spellings of one rule is how a report filter
 * and a row badge come to disagree about the same player.
 */

import type {
  AffiliationSource,
  AffiliationSurface,
} from "../../../database/models/user-referral.model";

export type ReferralKind = "own" | "external" | "unclassified";

/**
 * Before Gamemaster Program v2 the ONLY writer was the signup referral link, so a row with no
 * `source` is a referral-link row. `affiliation-migration.ts` re-exports this - one definition.
 */
export const LEGACY_AFFILIATION_SOURCE: AffiliationSource = "gm_referral_link";

// Reason: `satisfies Record<AffiliationSource, ...>` makes adding an enum value to the model a
// compile error here, so a new channel cannot silently fall into "unclassified".
const KIND_BY_SOURCE = {
  gm_referral_link: "own",
  chartvolt_join_gm: "external",
  // Reason: an admin move is not the Game Master's own recruiting, so it never counts as own.
  admin_assigned: "external",
} as const satisfies Record<AffiliationSource, Exclude<ReferralKind, "unclassified">>;

/** Mirrors the writer: `affiliate()` stamps exactly this when no surface was supplied. */
const DEFAULT_SURFACE_BY_SOURCE = {
  gm_referral_link: "signup",
  chartvolt_join_gm: "leaderboard",
  admin_assigned: "admin",
} as const satisfies Record<AffiliationSource, AffiliationSurface>;

export const REFERRAL_SURFACE_LABELS = {
  signup: "Referral link",
  leaderboard: "GM leaderboard",
  private_contest: "Private competition",
  gm_profile: "GM profile",
  admin: "Admin move",
} as const satisfies Record<AffiliationSurface, string>;

export const REFERRAL_KIND_LABELS: Readonly<Record<ReferralKind, string>> = {
  own: "Own referral",
  external: "External",
  unclassified: "Unclassified",
};

export const REFERRAL_SOURCES = Object.keys(KIND_BY_SOURCE) as AffiliationSource[];
export const REFERRAL_SURFACES = Object.keys(REFERRAL_SURFACE_LABELS) as AffiliationSurface[];
export const REFERRAL_KINDS: readonly ReferralKind[] = ["own", "external", "unclassified"];

// Reason: Sets, never object lookups - a stored value reaching `KIND_BY_SOURCE[x]` walks the
// prototype chain, and "__proto__" returns something truthy.
const SOURCE_SET: ReadonlySet<string> = new Set(REFERRAL_SOURCES);
const SURFACE_SET: ReadonlySet<string> = new Set(REFERRAL_SURFACES);

export function isAffiliationSurface(value: unknown): value is AffiliationSurface {
  return typeof value === "string" && SURFACE_SET.has(value);
}

/** Absent, null and "" are the three shapes of "nobody recorded it" - all legacy. */
export function resolveEffectiveSource(source: unknown): AffiliationSource | null {
  if (source === undefined || source === null || source === "") return LEGACY_AFFILIATION_SOURCE;
  return typeof source === "string" && SOURCE_SET.has(source) ? (source as AffiliationSource) : null;
}

export function defaultSurfaceForSource(source: AffiliationSource): AffiliationSurface {
  // Reason: `source` is typed AffiliationSource, so the key is one of the table's own literals.
  // eslint-disable-next-line security/detect-object-injection
  return DEFAULT_SURFACE_BY_SOURCE[source];
}

export interface ReferralClassification {
  kind: ReferralKind;
  source: AffiliationSource | null;
  surface: AffiliationSurface | null;
}

/** Classify one stored referral row. Never throws; bad data reads as "unclassified". */
export function classifyReferral(row: {
  source?: unknown;
  affiliatedVia?: { surface?: unknown } | null;
}): ReferralClassification {
  const source = resolveEffectiveSource(row.source);
  if (!source) return { kind: "unclassified", source: null, surface: null };
  const stored = row.affiliatedVia?.surface;
  return {
    // Reason: `source` passed the SOURCE_SET check in resolveEffectiveSource.
    // eslint-disable-next-line security/detect-object-injection
    kind: KIND_BY_SOURCE[source],
    source,
    surface: isAffiliationSurface(stored) ? stored : defaultSurfaceForSource(source),
  };
}

// ---------------------------------------------------------------------------------------
// The same rule as MongoDB aggregation expressions, built from the tables above.
// ---------------------------------------------------------------------------------------

/** `$source` with absent / null / "" resolved to the legacy source; unknown stays as-is. */
export function effectiveSourceExpression(): Record<string, unknown> {
  return {
    $cond: [{ $eq: [{ $ifNull: ["$source", ""] }, ""] }, LEGACY_AFFILIATION_SOURCE, "$source"],
  };
}

/** Expects the effective source at `sourceField` (e.g. "$_effSource"). */
export function referralKindExpression(sourceField: string): Record<string, unknown> {
  return {
    $switch: {
      branches: REFERRAL_SOURCES.map((s) => ({
        case: { $eq: [sourceField, s] },
        // eslint-disable-next-line security/detect-object-injection -- s is the table's own key
        then: KIND_BY_SOURCE[s],
      })),
      default: "unclassified",
    },
  };
}

/**
 * Stored surface if recognised, else the writer's default for the source. An unrecognised
 * SOURCE yields null whatever surface is stored, exactly as `classifyReferral` does.
 */
export function referralSurfaceExpression(sourceField: string): Record<string, unknown> {
  return {
    $cond: [
      { $in: [sourceField, REFERRAL_SOURCES] },
      {
        $cond: [
          { $in: [{ $ifNull: ["$affiliatedVia.surface", ""] }, REFERRAL_SURFACES] },
          "$affiliatedVia.surface",
          {
            $switch: {
              branches: REFERRAL_SOURCES.map((s) => ({
                case: { $eq: [sourceField, s] },
                // eslint-disable-next-line security/detect-object-injection -- s is the table's own key
                then: DEFAULT_SURFACE_BY_SOURCE[s],
              })),
              default: null,
            },
          },
        ],
      },
      null,
    ],
  };
}
