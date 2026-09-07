import type { ClientSession } from "mongoose";
import Competition from "@/database/models/trading/competition.model";
import {
  calculateGameMasterFees,
  capGameMasterEarnings,
  distributeGameMasterFees,
} from "./game-master-fees";
import type { SettlementContest } from "./types";

/**
 * The platform's cut, the unclaimed pool and the Game Masters' share.
 *
 * Lifted out of `finalizeCompetition` steps 4 through 4.7 by X5. These four stages are ONE
 * function rather than four because they are genuinely interdependent and the order is
 * load-bearing: the Game Masters' commission is carved OUT of the platform fee, so it has
 * to be calculated before the fee is recorded, capped before it is paid, and subtracted
 * before the platform books what it kept. Split them apart and the platform's ledger shows
 * a fee it did not keep.
 */

interface CreditWalletDoc {
  userId: string;
  creditBalance: number;
}

export interface SettleFeesInput {
  session: ClientSession;
  contest: SettlementContest;
  /** Gross pool, after any integrity cap the caller applied. */
  prizePool: number;
  totalDistributed: number;
  /**
   * How many prize distributions were PRODUCED, not how many were paid.
   *
   * The distinction is preserved from the original deliberately. They are equal whenever
   * every distribution matches a leaderboard entry, which is always true today - but the
   * fee arithmetic and the unclaimed-pool decision were written against the distribution
   * count, and quietly swapping in the paid count would change what the platform books on
   * the day those two ever diverge. That is not a change to make inside an extraction.
   */
  prizeWinnerCount: number;
  expectedWinners: number;
  qualifiedWinnersCount: number;
  participants: { userId: string }[];
  walletMap: Map<string, CreditWalletDoc>;
  /** A FRACTION (0-0.5), never a percentage. See the name. */
  platformFeeFraction: number;
  /**
   * Credits already returned to players from this pool before this stage ran.
   *
   * Non-zero only when the `refund_entry_fees` policy fired on a contest nobody scored in -
   * see `unscored-refund.ts`. It is subtracted from the unclaimed pool so the same credit is
   * never booked in two places.
   *
   * WHY A NUMBER AND NOT A FLAG. A boolean would say "somebody was refunded" and leave this
   * stage to recompute how much, which is the arithmetic the refund already did and would be
   * a second place to get it wrong. A number also keeps the residue honest: flooring each
   * player's refund to two decimals leaves fractions of a credit behind, and the difference
   * lands in the unclaimed pool where it belongs instead of vanishing.
   *
   * Defaulting to 0 makes this stage byte-for-byte what it was for every existing caller,
   * which is the only reason the trading payout tests are still evidence of anything.
   */
  refundedToPlayers?: number;
}

export interface SettleFeesResult {
  grossPlatformFee: number;
  gmEarnings: number;
  netPlatformFee: number;
}

export async function settleFeesAndGameMasters({
  session,
  contest,
  prizePool,
  totalDistributed,
  prizeWinnerCount,
  expectedWinners,
  qualifiedWinnersCount,
  participants,
  walletMap,
  platformFeeFraction,
  refundedToPlayers = 0,
}: SettleFeesInput): Promise<SettleFeesResult> {
  // The fee is ONLY the percentage, never the whole pool. With winners it is whatever was
  // not distributed; with none it is still just the percentage, and the remainder becomes
  // an unclaimed pool rather than platform income.
  const grossPlatformFee =
    prizeWinnerCount > 0
      ? prizePool - totalDistributed
      : prizePool * platformFeeFraction;

  console.log(
    `💼 Platform fee calculated: ${grossPlatformFee.toFixed(2)} credits (${contest.platformFeePercentage}% of pool)`,
  );

  const { PlatformFinancialsService } = await import(
    "@/lib/services/platform-financials.service"
  );

  // Only a contest where NOBODY was paid has an unclaimed pool. When some winners were
  // paid, the undistributed prize ranks were redistributed among them, so nothing is left.
  if (prizeWinnerCount === 0 && prizePool > 0) {
    // Whatever the platform did not keep and the players were not given back. With no refund
    // this is the whole net pool, exactly as before the `refundedToPlayers` parameter
    // existed; with a full refund it is only the sub-credit residue that flooring left.
    const unclaimedNet =
      Math.round((prizePool * (1 - platformFeeFraction) - refundedToPlayers) *
        100) / 100;

    let unclaimedReason:
      | "no_participants"
      | "all_disqualified"
      | "no_qualified_winners";
    if (participants.length === 0) {
      unclaimedReason = "no_participants";
    } else if (qualifiedWinnersCount === 0) {
      unclaimedReason = "all_disqualified";
    } else {
      unclaimedReason = "no_qualified_winners";
    }

    // Reason for the threshold rather than `> 0`: a refunded contest leaves nothing, or a few
    // hundredths of a credit that flooring could not divide. Recording a pool of 0.00 would
    // put a row on the platform's books claiming it holds money it does not, and an operator
    // reconciling unclaimed funds would chase it. Below one hundredth of a credit there is
    // nothing to hold.
    if (unclaimedNet >= 0.01) {
      console.log(
        `💰 Recording unclaimed pool: ${unclaimedNet.toFixed(2)} credits (${unclaimedReason})`,
      );

      await PlatformFinancialsService.recordUnclaimedPool({
        competitionId: contest._id.toString(),
        competitionName: contest.name,
        poolAmount: unclaimedNet,
        reason: unclaimedReason,
        winnersCount: 0,
        expectedWinnersCount: expectedWinners,
        description: `Unclaimed pool from ${contest.name}: ${unclaimedReason.replace(/_/g, " ")} - No prizes awarded`,
      });
    } else {
      console.log(
        `💰 No unclaimed pool: ${refundedToPlayers.toFixed(2)} credits returned to players (${unclaimedReason})`,
      );
    }
  } else if (prizeWinnerCount > 0 && prizeWinnerCount < expectedWinners) {
    console.log(
      `📊 Prize redistribution: ${prizeWinnerCount} winners received ${expectedWinners} prize positions worth of prizes`,
    );
  }

  console.log(`🎮 Calculating Game Master referral fees...`);

  let payments: Awaited<
    ReturnType<typeof calculateGameMasterFees>
  >["payments"] = [];
  let totalGmEarnings = 0;

  try {
    const db = Competition.db.db;
    if (db) {
      const calculation = await calculateGameMasterFees({
        db,
        participants,
        entryFee: contest.entryFee,
      });

      payments = calculation.payments;
      totalGmEarnings = calculation.totalGmEarnings;

      for (const inactiveGm of calculation.retained) {
        try {
          await PlatformFinancialsService.recordRetainedGmFee({
            sourceType: "competition",
            sourceId: contest._id.toString(),
            sourceName: contest.name,
            gameMasterId: inactiveGm.gmId,
            gameMasterEmail: inactiveGm.gmEmail,
            referredUsersCount: inactiveGm.users.length,
            amount: inactiveGm.wouldHaveEarned,
            originalFeePercentage: inactiveGm.feePercentage,
            subscriptionStatus: inactiveGm.subscriptionStatus,
            referredUserIds: inactiveGm.users.map((u) => u.userId),
          });
        } catch (recordError) {
          console.error(
            `   ⚠️ Failed to record retained GM fee for ${inactiveGm.gmId}:`,
            recordError,
          );
        }
      }
    }
  } catch (gmCalcError) {
    // Reason: a contest must still settle if the referral calculation fails. Preserved
    // from the original - the players' prizes do not depend on commission arithmetic.
    console.error("   ⚠️ Error calculating Game Master fees:", gmCalcError);
  }

  const gmEarnings = capGameMasterEarnings(
    payments,
    totalGmEarnings,
    grossPlatformFee,
  );

  const netPlatformFee = Math.max(0, grossPlatformFee - gmEarnings);

  console.log(`💼 Platform fee breakdown:`);
  console.log(
    `   Gross platform fee: €${grossPlatformFee.toFixed(2)} (${contest.platformFeePercentage}%)`,
  );
  console.log(`   GM referral fees:   €${gmEarnings.toFixed(2)}`);
  console.log(`   NET platform fee:   €${netPlatformFee.toFixed(2)}`);

  if (netPlatformFee > 0) {
    await PlatformFinancialsService.recordPlatformFee({
      amount: netPlatformFee,
      sourceType: "competition",
      sourceId: contest._id.toString(),
      sourceName: contest.name,
      description: `Platform fee (${contest.platformFeePercentage}% - ${totalGmEarnings.toFixed(2)} GM fees) from ${contest.name}`,
      // Stored now so the financial dashboard can split admin from Game Master contests
      // without joining at read time.
      isGmCreated: !!contest.gameMasterId,
    });
  }

  console.log(`🎮 Distributing Game Master referral fees...`);
  try {
    const db = Competition.db.db;
    if (db) {
      await distributeGameMasterFees({
        session,
        db,
        payments,
        contest,
        participantCount: participants.length,
        walletMap,
      });
    }
  } catch (gmError) {
    // Also preserved: commission failures do not fail the contest. Note this is inside the
    // settlement transaction, so a throw here would otherwise roll back every prize.
    console.error(
      "   ⚠️ Error processing Game Master fees (non-blocking):",
      gmError,
    );
  }

  return { grossPlatformFee, gmEarnings, netPlatformFee };
}
