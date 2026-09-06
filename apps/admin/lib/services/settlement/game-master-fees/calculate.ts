import { Types } from "mongoose";
import type {
  GameMasterFeeCalculation,
  GameMasterPayment,
  ReferredUser,
  RetainedGmFee,
  SettlementParticipantRef,
  SettlementDb,
} from "./types";

/**
 * Working out which Game Masters earned what from this contest's entry fees.
 *
 * Lifted verbatim out of `finalizeCompetition` step 4.6 by X5. It calculates and records
 * retained fees but pays nobody - paying is `distribute.ts`, and the split exists because
 * the platform-fee cap has to be applied between the two. Deciding an amount and then
 * capping it after it has been paid would be a refund, not a cap.
 */

const DEFAULT_REFERRAL_FEE_PERCENTAGE = 5;

interface CalculateInput {
  db: SettlementDb;
  participants: SettlementParticipantRef[];
  entryFee: number;
}

/**
 * Which Game Master referred each participant.
 *
 * TWO SOURCES, deliberately, and the precedence matters. `UserReferral` is the source of
 * truth; `user.referredByGameMasterId` is a fallback for older records that predate it.
 * The fallback is loaded FIRST so that a `UserReferral` row overwrites it - reverse the
 * order and a stale field on the user document silently wins over the current record.
 */
async function buildReferralMap(
  db: SettlementDb,
  participantUserIds: string[],
): Promise<Map<string, { gmId: string; userName: string; userEmail: string }>> {
  const userReferrals = await db
    .collection("userreferrals")
    .find({
      userId: { $in: participantUserIds },
      isActive: true,
      gameMasterId: { $exists: true, $ne: null },
    })
    .toArray();

  console.log(
    `   Found ${userReferrals.length} referred participants (via UserReferral collection)`,
  );

  const referredParticipantsFromUser = await db
    .collection("user")
    .find({
      id: { $in: participantUserIds },
      referredByGameMasterId: { $exists: true, $ne: null },
    })
    .toArray();

  console.log(
    `   Found ${referredParticipantsFromUser.length} referred participants (via user.referredByGameMasterId)`,
  );

  const referralMap = new Map<
    string,
    { gmId: string; userName: string; userEmail: string }
  >();

  for (const user of referredParticipantsFromUser) {
    referralMap.set(user.id, {
      gmId: user.referredByGameMasterId,
      userName: user.name || "Unknown",
      userEmail: user.email,
    });
  }

  for (const ref of userReferrals) {
    referralMap.set(ref.userId, {
      gmId: ref.gameMasterId,
      userName: ref.userName || "Unknown",
      userEmail: ref.userEmail,
    });
  }

  console.log(`   Total unique referred participants: ${referralMap.size}`);

  return referralMap;
}

/**
 * The referral percentage to use for a subscription.
 *
 * Reads the CURRENT package rather than the rate cached on the subscription, so that an
 * admin changing a package's terms takes effect for every Game Master on it. The cached
 * `limits.referralFeePercentage` is the fallback for when the package has been deleted.
 *
 * R31 IS FIXED HERE (5 September 2026), AND THE RISK AS WRITTEN OVERSTATED IT. The register
 * said a 0% package "is paid 5% instead". That was never true of the branch above: the
 * current-package check tests `!== undefined`, so a package that exists and says 0 correctly
 * yields 0. The defect was in the two FALLBACKS onto the cached `subscription.limits`, which
 * are reached when the package has been deleted or the subscription carries no `packageId` -
 * there, `||` read a stored 0 as absent and paid 5% commission nobody agreed to.
 *
 * Correcting a risk while fixing it is part of the fix: a fix aimed at the register's
 * sentence would have changed the one branch that was already right.
 *
 * It was a bug rather than a judgement call because the two money paths disagreed on one
 * stored value - `challenge-finalize.actions.ts` resolves the same fallback with `??`, so a
 * cached 0 paid 0% on a challenge and 5% on a competition. They now agree.
 *
 * WHY IT WAS LEFT IN PLACE DURING X5, since the comment that used to be here explained the
 * deferral: the extraction moved ~900 lines of money code, and the only evidence that no
 * payout moved was the payout tests producing identical figures. A behaviour change
 * smuggled in alongside would have destroyed that guarantee for the sake of one line.
 */
/**
 * The cached rate, or the default when the subscription genuinely stores none.
 *
 * One function for all three fallback sites rather than the same expression three times -
 * two of the three were identical and a fix applied to the one somebody happened to be
 * reading would have left the others paying 5%.
 *
 * `Number.isFinite` rather than a bare `??`: a stored `NaN` would otherwise propagate into
 * `entryFee * (feePercentage / 100)` and make every earning `NaN`, silently, because nothing
 * downstream checks. `??` alone fixes 0 and introduces that.
 */
function cachedRateOrDefault(
  gmSubscription: {
    limits?: { referralFeePercentage?: number };
  } | null,
): number {
  const cached = gmSubscription?.limits?.referralFeePercentage;
  return typeof cached === "number" && Number.isFinite(cached)
    ? cached
    : DEFAULT_REFERRAL_FEE_PERCENTAGE;
}

async function resolveFeePercentage(
  db: SettlementDb,
  gmSubscription: { packageId?: string; limits?: { referralFeePercentage?: number } } | null,
): Promise<number> {
  if (gmSubscription?.packageId) {
    try {
      const currentPackage = await db.collection("marketplaceitems").findOne({
        _id: new Types.ObjectId(gmSubscription.packageId),
      });

      if (
        currentPackage?.gameMasterConfig?.referralFeePercentage !== undefined
      ) {
        return currentPackage.gameMasterConfig.referralFeePercentage;
      }

      return cachedRateOrDefault(gmSubscription);
    } catch {
      return cachedRateOrDefault(gmSubscription);
    }
  }

  if (gmSubscription) {
    return cachedRateOrDefault(gmSubscription);
  }

  return DEFAULT_REFERRAL_FEE_PERCENTAGE;
}

export async function calculateGameMasterFees({
  db,
  participants,
  entryFee,
}: CalculateInput): Promise<GameMasterFeeCalculation> {
  const payments: GameMasterPayment[] = [];
  const retained: RetainedGmFee[] = [];
  let totalGmEarnings = 0;

  const participantUserIds = participants.map((p) => p.userId);
  const referralMap = await buildReferralMap(db, participantUserIds);

  // Group the referred participants by the Game Master who referred them.
  const gmEarningsMap = new Map<string, { gmId: string; users: ReferredUser[] }>();

  for (const [userId, refData] of referralMap) {
    const gmId = refData.gmId;
    const isParticipant = participantUserIds.includes(userId);

    if (!isParticipant || !gmId) continue;

    if (!gmEarningsMap.has(gmId)) {
      gmEarningsMap.set(gmId, { gmId, users: [] });
    }

    gmEarningsMap.get(gmId)!.users.push({
      userId,
      userName: refData.userName,
      userEmail: refData.userEmail,
    });
  }

  for (const [gmId, gmData] of gmEarningsMap) {
    const anySubscription = await db
      .collection("gamemastersubscriptions")
      .findOne({ userId: gmId });

    // Must be active AND not paused. Two separate conditions because a paused
    // subscription is a decision the operator can reverse, and it is reported differently.
    const gmSubscription = await db
      .collection("gamemastersubscriptions")
      .findOne({ userId: gmId, status: "active", isPaused: { $ne: true } });

    const feePercentage = await resolveFeePercentage(
      db,
      gmSubscription as {
        packageId?: string;
        limits?: { referralFeePercentage?: number };
      } | null,
    );

    if (!gmSubscription) {
      // Reason: an ineligible Game Master's share is RETAINED by the platform and recorded,
      // never silently absorbed. Without the record, the platform's books would show a
      // larger fee than the contest's terms explain, and nobody could reconstruct why.
      const wouldHaveEarned =
        gmData.users.length * entryFee * (feePercentage / 100);

      let subscriptionStatus = anySubscription?.status || "no_subscription";
      if (anySubscription?.status === "active" && anySubscription?.isPaused) {
        subscriptionStatus = "paused";
      }

      console.log(
        `   ⚠️ Game master ${gmId} has no earning-eligible subscription (status: ${subscriptionStatus}), retaining fee for platform`,
      );

      retained.push({
        gmId,
        gmEmail: anySubscription?.userEmail,
        users: gmData.users,
        wouldHaveEarned,
        feePercentage,
        subscriptionStatus,
      });
      continue;
    }

    const totalEarning = gmData.users.length * entryFee * (feePercentage / 100);
    totalGmEarnings += totalEarning;

    payments.push({
      gmId,
      gmSubscription,
      users: gmData.users,
      feePercentage,
      totalEarning,
    });

    console.log(
      `   📊 GM ${gmId}: ${gmData.users.length} referrals × €${entryFee} × ${feePercentage}% = €${totalEarning.toFixed(2)}`,
    );
  }

  return { payments, totalGmEarnings, retained };
}

/**
 * Cap the Game Masters' total share at the platform fee, scaling every payment down.
 *
 * Reason it exists at all: the referral percentage and the platform fee percentage are set
 * independently, so a generous referral rate on a low-fee contest can promise Game Masters
 * more than the platform collected - paying it in full would mean the platform funding
 * referral commission out of the prize pool.
 *
 * MUTATES the payments, and must run BEFORE distribution. Capping after payment is a
 * refund, and a refund from a Game Master's wallet may find it already spent.
 */
export function capGameMasterEarnings(
  payments: GameMasterPayment[],
  totalGmEarnings: number,
  grossPlatformFee: number,
): number {
  if (totalGmEarnings <= grossPlatformFee) return totalGmEarnings;

  console.warn(
    `   ⚠️ WARNING: Total GM earnings (${totalGmEarnings.toFixed(2)}) exceed platform fee (${grossPlatformFee.toFixed(2)})`,
  );
  console.warn(
    `   ⚠️ Capping GM earnings at platform fee to prevent platform loss`,
  );

  const scaleFactor = grossPlatformFee / totalGmEarnings;
  for (const payment of payments) {
    payment.totalEarning = payment.totalEarning * scaleFactor;
  }

  return grossPlatformFee;
}
