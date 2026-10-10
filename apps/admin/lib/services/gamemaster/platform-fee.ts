/**
 * Platform fee for contests a Game Master creates.
 *
 * Reason: GMs must never choose the platform fee — that is an admin commercial
 * decision. Admins already set the prize-pool platform fee under Challenge
 * Settings (`ChallengeSettings.platformFeePercentage`); that is the one
 * operator-controlled percentage we reuse here so trading and game GM contests
 * stamp the same admin figure. Client-supplied values are ignored at write time.
 */
import ChallengeSettings from "@/database/models/trading/challenge-settings.model";

export const FALLBACK_GM_PLATFORM_FEE_PERCENTAGE = 10;

/**
 * Resolve the fee the platform takes from a GM-created contest's prize pool.
 * Never accept a caller-supplied number — pass this into create instead.
 */
export async function resolveGameMasterPlatformFeePercentage(): Promise<number> {
  try {
    const settings = await ChallengeSettings.getSingleton();
    const fee = settings?.platformFeePercentage;
    if (typeof fee === "number" && Number.isFinite(fee) && fee >= 0 && fee <= 50) {
      return fee;
    }
  } catch (error) {
    console.warn(
      "⚠️ [GM platform fee] Could not read ChallengeSettings; using fallback:",
      error,
    );
  }
  return FALLBACK_GM_PLATFORM_FEE_PERCENTAGE;
}
