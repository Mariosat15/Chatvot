/**
 * The one rule both Game Master wizards use to refuse Next on the Access & Funding step.
 *
 * Model-free and client-reachable (R58). Returns the message to show, or null when the
 * step is complete. The create route re-checks every condition server-side.
 */
export function accessFundingStepError(input: {
  visibilityOptionCount: number;
  visibility: string | undefined;
  fundingOffered: boolean;
  fundingMode: string | undefined;
}): string | null {
  if (input.visibilityOptionCount === 0) {
    return "Your package does not allow creating a competition. Please contact support.";
  }
  if (!input.visibility) return "Choose who can join this competition.";
  if (input.fundingOffered && !input.fundingMode) {
    return "Choose who pays the entry fee: Normal or Funded by you.";
  }
  return null;
}

/** What the create request sends: player-paid whenever funding is not on offer. */
export function effectiveFundingMode<T extends string>(
  fundingOffered: boolean,
  fundingMode: T | undefined,
): T | "player_paid" {
  return fundingOffered && fundingMode ? fundingMode : "player_paid";
}
