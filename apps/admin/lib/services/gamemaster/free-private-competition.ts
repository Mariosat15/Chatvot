/**
 * Free Private (GM-funded) competitions - the one set of rules every writer reads.
 *
 * A Game Master funds the entry fees of a private contest from their own Volts. The player
 * joins free and never receives spendable or withdrawable Volts: the sponsored fee goes
 * straight into the prize pool. The reserve is `entryFee x maxParticipants`, taken from the
 * Game Master's wallet when the contest is created; the platform fee is still carved at
 * settlement exactly as for a player-paid contest.
 *
 * Model-free and MIRRORED into `apps/admin/lib/services/gamemaster/`. `check:mirrors`
 * compares models, so a test pins the two copies byte-identical.
 */

export const FUNDING_MODES = ["player_paid", "gm_funded"] as const;
export type FundingMode = (typeof FUNDING_MODES)[number];
export const DEFAULT_FUNDING_MODE: FundingMode = "player_paid";

/**
 * Is this STORED contest GM-funded? Only an exact `"gm_funded"` counts.
 *
 * Reason it fails towards player-paid: every money path branches on this, and a contest
 * created before the field existed has no value at all - it must keep settling exactly as
 * it always has.
 */
export function isGmFundedContest(
  contest: { fundingMode?: unknown } | null | undefined,
): boolean {
  return contest?.fundingMode === "gm_funded";
}

/** Round to the cent, so a reserve and the seats debited from it can sum exactly. */
export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The reserve a funded contest must hold: every seat it could ever sponsor.
 * Returns null when the inputs cannot describe a funded contest.
 */
export function computeFreePrivateReserve(entryFee: unknown, maxParticipants: unknown): number | null {
  if (typeof entryFee !== "number" || !Number.isFinite(entryFee) || entryFee <= 0) return null;
  if (
    typeof maxParticipants !== "number" ||
    !Number.isInteger(maxParticipants) ||
    maxParticipants < 2
  ) {
    return null;
  }
  return roundCredits(entryFee * maxParticipants);
}

/**
 * Whether the Game Master's package allows funded contests.
 *
 * Same precedence as every other limit: the CURRENT package decides while it exists, so an
 * admin unticking the box takes effect immediately; the cached subscription copy is only
 * the fallback for a deleted package. Only an explicit `true` grants it.
 */
export function resolveCanCreateFreePrivate(input: {
  hasPackage: boolean;
  packageConfig?: { canCreateFreePrivateCompetitions?: unknown } | null;
  cachedLimits?: { canCreateFreePrivateCompetitions?: unknown } | null;
}): boolean {
  if (input.hasPackage && input.packageConfig) {
    return input.packageConfig.canCreateFreePrivateCompetitions === true;
  }
  return input.cachedLimits?.canCreateFreePrivateCompetitions === true;
}

export type FundingRefusalReason =
  | "funding_unknown"
  | "funding_requires_private"
  | "free_private_disabled"
  | "free_private_not_permitted"
  | "free_private_invalid_fee";

export interface FundingVerdict {
  ok: boolean;
  fundingMode: FundingMode;
  /** The reserve to take, when `fundingMode` is `gm_funded`. */
  reserve?: number;
  reason?: FundingRefusalReason;
  message?: string;
}

export interface CheckFundingInput {
  /** What the caller asked for. Absent, `null` or `""` means player-paid. */
  requested: unknown;
  /** The visibility ALREADY resolved by `checkVisibilityAllowed`. */
  visibility: string;
  /** `WhiteLabel.gmFreePrivateContestsEnabled`. */
  platformEnabled: boolean;
  /** `resolveCanCreateFreePrivate(...)`. */
  packageAllows: boolean;
  /** Whether the package allows private visibility at all - a funded contest is private. */
  privateAllowed: boolean;
  entryFee: unknown;
  maxParticipants: unknown;
}

/**
 * May this contest be created with this funding mode?
 *
 * Reason funding is refused on a PUBLIC contest rather than silently downgraded: a Game
 * Master who meant to fund their community would otherwise publish a contest strangers pay
 * into, and nothing would tell them. Reason an unknown value is refused: guessing either
 * way spends (or fails to spend) somebody's Volts on a choice nobody made.
 */
export function checkFundingAllowed(input: CheckFundingInput): FundingVerdict {
  const raw = input.requested;
  const blank = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
  if (blank || raw === "player_paid") return { ok: true, fundingMode: "player_paid" };
  if (raw !== "gm_funded") {
    return {
      ok: false,
      fundingMode: DEFAULT_FUNDING_MODE,
      reason: "funding_unknown",
      message: "Unknown funding mode. Choose Normal or Funded.",
    };
  }
  const fundingMode: FundingMode = "gm_funded";
  if (input.visibility !== "gm_private") {
    return {
      ok: false,
      fundingMode,
      reason: "funding_requires_private",
      message: "Only a private competition can be funded by the Game Master.",
    };
  }
  if (!input.platformEnabled) {
    return {
      ok: false,
      fundingMode,
      reason: "free_private_disabled",
      message: "Free Private competitions are not available on the platform yet.",
    };
  }
  if (!input.packageAllows || !input.privateAllowed) {
    return {
      ok: false,
      fundingMode,
      reason: "free_private_not_permitted",
      message: "Your Game Master package does not allow Free Private competitions.",
    };
  }
  const reserve = computeFreePrivateReserve(input.entryFee, input.maxParticipants);
  if (reserve === null) {
    return {
      ok: false,
      fundingMode,
      reason: "free_private_invalid_fee",
      message:
        "A Free Private competition needs an entry fee above zero and at least two places.",
    };
  }
  return { ok: true, fundingMode, reserve };
}
