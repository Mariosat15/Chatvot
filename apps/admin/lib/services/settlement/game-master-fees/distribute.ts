import type { ClientSession, Types as MongooseTypes } from "mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import type { GameMasterPayment, SettlementDb } from "./types";

/**
 * Paying the Game Masters their referral share.
 *
 * Lifted verbatim out of `finalizeCompetition` step 4.7 by X5. Runs AFTER the cap in
 * `calculate.ts`, inside the settlement transaction, so a failure anywhere in settlement
 * rolls the commission back with everything else.
 */

interface CreditWalletDoc {
  userId: string;
  creditBalance: number;
}

export interface DistributeGmFeesInput {
  session: ClientSession;
  db: SettlementDb;
  payments: GameMasterPayment[];
  contest: {
    _id: MongooseTypes.ObjectId;
    name: string;
    entryFee: number;
    startTime?: Date;
    endTime?: Date;
  };
  participantCount: number;
  /**
   * Reused from the prize payout stage, as a QUERY CACHE only.
   *
   * This comment used to say it mattered for correctness - that a Game Master who also won a
   * prize needed it so their commission's `balanceBefore` was computed after the prize. The
   * ledger row is indeed correct, and `new: true` on the update below is what makes it so: the
   * map's value is read only by the `if (!gmWallet)` existence test, never for arithmetic.
   * See the fuller note on `PrizePayoutResult.walletMap`.
   */
  walletMap: Map<string, CreditWalletDoc>;
}

export async function distributeGameMasterFees({
  session,
  db,
  payments,
  contest,
  participantCount,
  walletMap,
}: DistributeGmFeesInput): Promise<void> {
  if (payments.length === 0) return;

  for (const payment of payments) {
    const { gmId, gmSubscription, users, feePercentage, totalEarning } = payment;

    // Divided from the possibly-capped total, so a scaled-down commission is shared
    // proportionally across the referred players rather than paid in full to the first.
    const perUserEarning = totalEarning / users.length;

    for (const user of users) {
      const entryFee = contest.entryFee;
      const grossEarning = perUserEarning;
      // The platform's cut was already taken before this stage; the Game Master's share is
      // carved out of that fee, so nothing further is deducted here.
      const platformFee = 0;
      const netEarning = grossEarning - platformFee;
      const effectivePercentage = (perUserEarning / entryFee) * 100;

      // IDEMPOTENCY. Read in the session so it is snapshot-consistent with the
      // transaction, which is what makes a retried finalization safe.
      const existingEarning = await db
        .collection("gamemasterearnings")
        .findOne(
          {
            sourceType: "competition",
            sourceId: contest._id.toString(),
            gameMasterId: gmId,
            referredUserId: user.userId,
          },
          { session },
        );

      if (existingEarning) {
        console.log(
          `   ⏩ GM earning already recorded for ${user.userName} in competition ${contest._id}, skipping duplicate`,
        );
        continue;
      }

      await db.collection("gamemasterearnings").insertOne(
        {
          gameMasterId: gmId,
          gameMasterEmail: gmSubscription.userEmail,
          sourceType: "competition",
          sourceId: contest._id.toString(),
          sourceName: contest.name,
          referredUserId: user.userId,
          referredUserEmail: user.userEmail,
          referredUserName: user.userName,
          entryFeeAmount: entryFee,
          earningPercentage: effectivePercentage,
          originalPercentage: feePercentage,
          grossEarning,
          platformFee,
          netEarning,
          status: "pending",
          eventStartTime: contest.startTime,
          eventEndTime: contest.endTime,
          participantCount,
          // Flagged so a support query about a smaller-than-expected commission has an
          // answer on the row itself rather than needing the finalization logs.
          wasCapped: effectivePercentage < feePercentage,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      );

      console.log(
        `   💰 GM ${gmId} earned ${netEarning.toFixed(2)} from ${user.userName}${effectivePercentage < feePercentage ? " (capped)" : ""}`,
      );
    }

    await db.collection("gamemastersubscriptions").updateOne(
      { _id: gmSubscription._id as MongooseTypes.ObjectId },
      {
        $inc: { totalEarnings: totalEarning, pendingEarnings: totalEarning },
        $set: { updatedAt: new Date() },
      },
      { session },
    );

    let gmWallet: CreditWalletDoc | undefined = walletMap.get(gmId.toString());
    if (!gmWallet) {
      gmWallet =
        ((await CreditWallet.findOne({ userId: gmId }).session(session)) as
          | CreditWalletDoc
          | null) ?? undefined;
    }
    if (!gmWallet) {
      const created = await CreditWallet.create(
        [
          {
            userId: gmId,
            creditBalance: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
            totalSpentOnCompetitions: 0,
            totalWonFromCompetitions: 0,
            isActive: true,
            kycVerified: false,
            withdrawalEnabled: false,
          },
        ],
        { session },
      );
      gmWallet = created[0] as CreditWalletDoc | undefined;
      if (!gmWallet) {
        throw new Error(`Failed to create wallet for GM ${gmId}`);
      }
      walletMap.set(gmId.toString(), gmWallet);
    }

    const updatedGmWallet = await CreditWallet.findOneAndUpdate(
      { userId: gmId },
      { $inc: { creditBalance: totalEarning } },
      { session, new: true },
    );
    const balanceAfter = updatedGmWallet?.creditBalance || totalEarning;
    const balanceBefore = balanceAfter - totalEarning;

    await WalletTransaction.create(
      [
        {
          userId: gmId,
          transactionType: "gamemaster_earning",
          amount: totalEarning,
          balanceBefore,
          balanceAfter,
          competitionId: contest._id,
          status: "completed",
          description: `🎮 Game Master referral earnings from ${contest.name} (${users.length} referred users)`,
          metadata: {
            competitionId: contest._id.toString(),
            competitionName: contest.name,
            referredUsersCount: users.length,
            feePercentage,
          },
        },
      ],
      { session },
    );

    await db.collection("gamemasterearnings").updateMany(
      {
        gameMasterId: gmId,
        sourceId: contest._id.toString(),
        sourceType: "competition",
      },
      { $set: { status: "paid", paidAt: new Date() } },
      { session },
    );

    await db.collection("gamemastersubscriptions").updateOne(
      { _id: gmSubscription._id as MongooseTypes.ObjectId },
      { $inc: { pendingEarnings: -totalEarning } },
      { session },
    );

    console.log(
      `   ✅ GM ${gmId}: Total earned ${totalEarning.toFixed(2)} from ${users.length} referrals`,
    );
  }
}
