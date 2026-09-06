import type { ClientSession } from "mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import type { SettlementContest } from "./types";

/**
 * Refunding the players the `exclude` policy removes, inside the settlement transaction.
 *
 * WHY IT LIVES HERE AND NOT IN THE RECONCILIATION NET
 * ---------------------------------------------------
 * `reconciliation.service.ts` names this obligation and deliberately does not pay it. Two
 * reasons, both recorded there: paying from the net would put a second money writer beside
 * settlement, and it cannot be done correctly in isolation anyway - removing a player
 * changes the prize pool, so the refund and the re-split have to be one transaction.
 *
 * This is that transaction. The refund happens BEFORE ranking, so the pool the winners are
 * paid from is already the reduced one. Doing it after would pay prizes out of a pot that
 * still counted a player who is no longer in the contest.
 */

interface RefundWalletDoc {
  _id: unknown;
  userId: string;
  creditBalance: number;
}

export interface ExclusionRefundResult {
  /** Players actually refunded on this run. Excludes anyone already refunded. */
  refundedUserIds: string[];
  /** Sum of entry fees returned. This is exactly what leaves the prize pool. */
  totalRefunded: number;
  /**
   * Players who were already refunded by an earlier run and were skipped.
   *
   * Reported rather than swallowed: it is the normal case on a retried settlement, and a
   * silent skip would make a double-refund bug and a correct retry look identical in the
   * logs.
   */
  alreadyRefundedUserIds: string[];
}

export async function refundExcludedParticipants({
  session,
  contest,
  userIds,
}: {
  session: ClientSession;
  contest: SettlementContest;
  userIds: string[];
}): Promise<ExclusionRefundResult> {
  const result: ExclusionRefundResult = {
    refundedUserIds: [],
    totalRefunded: 0,
    alreadyRefundedUserIds: [],
  };

  if (userIds.length === 0) return result;

  const competitionId = contest._id.toString();
  const entryFee = contest.entryFee || 0;

  // Reason: a zero-fee contest has nothing to refund, but the players must still be
  // EXCLUDED from ranking. Returning early here is safe only because exclusion is driven
  // by the assessment in the caller, never by this result.
  if (entryFee <= 0) return result;

  // IDEMPOTENCY, and it is not the transaction that provides it. The settlement transaction
  // is atomic, so a failed run rolls the refund back - but a contest can be settled twice
  // for a different reason: a run that stalls in `finalizing` is reset to `active` after
  // five minutes (risk R4), and the next sweep then settles it for real. Without this check
  // the second run refunds the same players again and reduces the pool twice.
  const priorRefunds = await WalletTransaction.find({
    competitionId,
    userId: { $in: userIds },
    transactionType: "competition_refund",
  })
    .select("userId")
    .session(session)
    .lean<{ userId: string }[]>();

  const alreadyRefunded = new Set(priorRefunds.map((t) => t.userId));

  const pending = userIds.filter((id) => !alreadyRefunded.has(id));
  result.alreadyRefundedUserIds = userIds.filter((id) =>
    alreadyRefunded.has(id),
  );

  if (pending.length === 0) return result;

  const wallets = await CreditWallet.find({ userId: { $in: pending } })
    .session(session)
    .lean<RefundWalletDoc[]>();

  const walletMap = new Map(wallets.map((w) => [w.userId, w]));

  for (const userId of pending) {
    const wallet = walletMap.get(userId);

    // Reason: no wallet means nothing was ever debited from one, so there is nothing to
    // return. Logged rather than thrown - aborting the whole settlement, and with it every
    // other player's prize, over one missing wallet is a worse outcome than one unrefunded
    // player an operator can see in the log and fix by hand.
    if (!wallet) {
      console.error(
        `❌ [EXCLUDE] No wallet for user ${userId} in contest ${competitionId}; entry fee not returned.`,
      );
      continue;
    }

    const balanceBefore = wallet.creditBalance;
    const balanceAfter = balanceBefore + entryFee;

    // Reason for the tracking fields: a refund REVERSES a spend, it is not a win. Inflating
    // `totalWonFromCompetitions` would credit the player with winnings they never earned on
    // every stats screen. These are the same three fields cancel-and-refund moves.
    await CreditWallet.findByIdAndUpdate(
      wallet._id,
      {
        $inc: {
          creditBalance: entryFee,
          totalSpentOnCompetitions: -entryFee,
          totalRefunded: entryFee,
        },
      },
      { session },
    );

    // `competitionId` is set because an unattributable money row is the defect Stage 0
    // found twice - entry fees written with an undeclared `referenceId`, and the whole
    // challenge trail written with an undeclared `challengeId`. Neither was a wrong
    // balance and both were a broken audit trail, which is the harm here too.
    await WalletTransaction.create(
      [
        {
          userId,
          transactionType: "competition_refund",
          amount: entryFee,
          balanceBefore,
          balanceAfter,
          competitionId,
          status: "completed",
          description: `Entry fee returned - no game result was received for "${contest.name}"`,
          metadata: {
            competitionName: contest.name,
            refundReason: "unresolved_round_excluded",
            originalEntryFee: entryFee,
          },
        },
      ],
      { session },
    );

    await CompetitionParticipant.updateOne(
      { competitionId, userId },
      { $set: { status: "refunded" } },
      { session },
    );

    result.refundedUserIds.push(userId);
    result.totalRefunded += entryFee;
  }

  return result;
}
