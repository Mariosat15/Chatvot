import type { ClientSession, Types as MongooseTypes } from "mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import type { GameMasterPayment, SettlementDb } from "./types";
import { resolveContestVocabulary, type ContestKind } from "../types";

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
    contestKind?: ContestKind;
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

  const vocabulary = resolveContestVocabulary(contest.contestKind);

  for (const payment of payments) {
    const { gmId, gmSubscription, users, feePercentage, totalEarning } = payment;

    // IDEMPOTENCY, and it must cover the WHOLE per-GM block rather than the earning rows
    // alone. Read in the session so it is snapshot-consistent with the transaction.
    //
    // Reason: R85. This check used to sit inside the per-user loop below and `continue`d
    // only the row insert, so a second run skipped the rows and then fell through to the
    // subscription increment, the wallet credit and the ledger row — paying the Game Master
    // a second time while leaving `gamemasterearnings` with exactly one row per referral.
    // A guard that is only ever reached in order to make a double payment silent is worse
    // than no guard, because it reads as idempotency.
    //
    // The rows and the payment commit together, so a single surviving row for this Game
    // Master on this contest is proof the whole block already ran.
    const alreadyPaid = await db.collection("gamemasterearnings").findOne(
      {
        sourceType: vocabulary.gmSourceType,
        sourceId: contest._id.toString(),
        gameMasterId: gmId,
      },
      { session },
    );

    if (alreadyPaid) {
      console.log(
        `   ⏩ GM ${gmId} already paid for ${vocabulary.kind} ${contest._id}, skipping duplicate payment`,
      );
      continue;
    }

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

      await db.collection("gamemasterearnings").insertOne(
        {
          gameMasterId: gmId,
          gameMasterEmail: gmSubscription.userEmail,
          sourceType: vocabulary.gmSourceType,
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
      // Reason: R82. `totalGmEarnings` was declared on CreditWallet, rendered on
      // the reconciliation screen and incremented by NOTHING — this is the one
      // site that pays a Game Master, so it is the one site that can maintain it.
      // It must move in the same $inc as the balance, or the two can diverge.
      { $inc: { creditBalance: totalEarning, totalGmEarnings: totalEarning } },
      { session, new: true },
    );
    const balanceAfter = updatedGmWallet?.creditBalance || totalEarning;
    const balanceBefore = balanceAfter - totalEarning;

    await WalletTransaction.create(
      [
        {
          userId: gmId,
          transactionType: vocabulary.gmWalletTransactionType,
          amount: totalEarning,
          balanceBefore,
          balanceAfter,
          [vocabulary.idField]: contest._id,
          status: "completed",
          description: `🎮 Game Master referral earnings from ${contest.name} (${users.length} referred users)`,
          metadata: {
            [vocabulary.idField]: contest._id.toString(),
            [vocabulary.nameField]: contest.name,
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
        sourceType: vocabulary.gmSourceType,
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
