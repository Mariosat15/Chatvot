/**
 * Fields a Game Master-funded contest may not change once it exists.
 *
 * The reserve taken from the Game Master's wallet is `entryFee x maxParticipants`, computed
 * once at creation. Changing either afterwards leaves the escrow sized for a different
 * contest: raise the fee and sponsored seats start failing for lack of reserve; lower it and
 * the surplus sits locked until settlement. A different price or size is a new contest.
 *
 * Not mirrored - both edit paths are admin-only.
 */
export const FUNDED_RESERVE_FIELDS = new Set<string>([
  "entryFee",
  "entryFeeCredits",
  "maxParticipants",
]);

export function refuseFundedReserveEdit(
  fundingMode: unknown,
  submittedKeys: readonly string[],
): string | null {
  if (fundingMode !== "gm_funded") return null;
  const touched = submittedKeys.filter((key) => FUNDED_RESERVE_FIELDS.has(key));
  if (touched.length === 0) return null;
  return `This contest is funded by its Game Master, so ${touched
    .map((f) => `"${f}"`)
    .join(", ")} cannot be changed - the reserve was sized from them. Cancel it and create a new one instead.`;
}
