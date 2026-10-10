import UserReferral from "@/database/models/user-referral.model";
import { verifyGmTermsAcceptance } from "./gm-terms.service";

/**
 * Record Game Master terms consent on an affiliation that already exists (s5.5).
 *
 * Reason this is a second writer of `userreferrals` beside `affiliate()`: an own referral who
 * joined before terms existed is already affiliated, and `affiliate()` returns
 * `alreadyAffiliated` for the same Game Master and writes nothing. So it stays narrow: it
 * never creates a row, never ends one, never changes the Game Master, and only fills the
 * three terms fields on a row that has none. Listed with that reason in the single-writer
 * test in `__tests__/services/gm-affiliation-service.test.ts`.
 */

export type RecordConsentResult =
  | { success: true; recorded: boolean }
  | { success: false; code: string; error: string };

export async function recordAffiliationConsent(input: {
  userId: string;
  gameMasterId: string;
  referralId: string;
  termsAcceptanceId: string | undefined;
}): Promise<RecordConsentResult> {
  // Reason: the id must prove THIS player accepted THIS Game Master's CURRENT terms - the
  // same check `affiliate()` runs, so a borrowed or stale acceptance is refused here too.
  const verified = await verifyGmTermsAcceptance({
    acceptanceId: input.termsAcceptanceId,
    userId: input.userId,
    gameMasterId: input.gameMasterId,
  });
  if (!verified.ok) return { success: false, code: verified.code, error: verified.message };

  const result = await UserReferral.updateOne(
    {
      _id: input.referralId,
      userId: input.userId,
      gameMasterId: input.gameMasterId,
      isActive: true,
      // Reason: "missing" has three shapes; a row that already carries consent is left alone,
      // so an older acceptance is never overwritten by a newer one.
      $or: [
        { termsAcceptanceId: { $exists: false } },
        { termsAcceptanceId: null },
        { termsAcceptanceId: "" },
      ],
    },
    {
      $set: {
        termsAcceptanceId: verified.termsAcceptanceId,
        termsSlug: verified.termsSlug,
        termsVersion: verified.termsVersion,
      },
    },
  );
  return { success: true, recorded: result.modifiedCount === 1 };
}
