/**
 * The route-side funding gate (Free Private Competitions, 2 Oct 2026). Mirrored into
 * apps/admin, byte-identical (pinned by a test), so both POST /api/gamemaster/competitions
 * copies ask the same question with the same inputs.
 */
import { isGmFreePrivateContestsEnabled } from "./gm-program-flags";
import {
  checkFundingAllowed,
  resolveCanCreateFreePrivate,
  type FundingVerdict,
} from "./free-private-competition";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

export async function checkRouteFunding(input: {
  requested: unknown;
  /** Already resolved by `checkVisibilityAllowed`. */
  visibility: "public" | "gm_private";
  packageConfig: { canCreateFreePrivateCompetitions?: unknown } | null;
  cachedLimits?: { canCreateFreePrivateCompetitions?: unknown } | null;
  entryFee: unknown;
  maxParticipants: unknown;
  maxUsersPerCompetition: number;
}): Promise<FundingVerdict> {
  // Reason the cap is applied here: both create paths clamp the place count to the
  // package limit, and the reserve must match the contest that is actually stored.
  const requestedMax = Math.floor(toNumber(input.maxParticipants));
  const maxParticipants = Number.isFinite(requestedMax)
    ? Math.min(requestedMax, input.maxUsersPerCompetition)
    : Number.NaN;

  const wantsFunding = input.requested === "gm_funded";
  return checkFundingAllowed({
    requested: input.requested,
    visibility: input.visibility,
    // Reason: only read the switch when funding is asked for - a player-paid create must
    // not depend on a settings read it does not need.
    platformEnabled: wantsFunding ? await isGmFreePrivateContestsEnabled() : false,
    packageAllows: resolveCanCreateFreePrivate({
      hasPackage: input.packageConfig !== null,
      packageConfig: input.packageConfig,
      cachedLimits: input.cachedLimits,
    }),
    // A resolved `gm_private` already proves the package allows private visibility.
    privateAllowed: input.visibility === "gm_private",
    entryFee: toNumber(input.entryFee),
    maxParticipants,
  });
}

/** HTTP status for a refusal: a malformed request is 400, a permission refusal 403. */
export function fundingRefusalStatus(reason: FundingVerdict["reason"]): number {
  return reason === "funding_unknown" || reason === "free_private_invalid_fee" ? 400 : 403;
}
