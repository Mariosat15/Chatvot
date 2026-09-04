import type { ClientSession } from "mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import type {
  SettlementContest,
  SettlementLeaderboardEntry,
  SettlementPrizeDistribution,
} from "./types";

/**
 * Paying the winners of a contest - the one place credits are awarded for a win.
 *
 * Lifted verbatim out of `finalizeCompetition` step 3 by X5 so a provider contest pays
 * through the same code rather than a second copy of it. The behaviour is deliberately
 * unchanged: every quirk below was in the trading path already, and the five end-to-end
 * payout tests pin it.
 *
 * NOTHING HERE IS GAME-SPECIFIC, and that is what made the extraction possible. Prizes are
 * a function of rank and pool, and rank is what the game module computed. A game that
 * reports a score and a game that reports a profit reach this function identically.
 */

interface CreditWalletDoc {
  userId: string;
  creditBalance: number;
}

export interface PrizePayoutInput {
  session: ClientSession;
  contest: SettlementContest;
  distributions: SettlementPrizeDistribution[];
  /**
   * Mutated in place: each winner's `prizeAmount` is filled in.
   *
   * Reason it mutates rather than returning a copy: the caller stores this same array on
   * the contest as `finalLeaderboard`, and a copy would mean the stored leaderboard and
   * the paid amounts could diverge. One array, one truth.
   */
  leaderboard: SettlementLeaderboardEntry[];
}

export interface PrizePayoutResult {
  totalDistributed: number;
  winnersPaid: number;
  /**
   * Handed back so the Game Master stage can reuse it.
   *
   * It matters for correctness, not just for saving a query: a Game Master who is ALSO a
   * prize winner must have their referral credit computed from the balance after the prize,
   * and a stale wallet read would report the wrong `balanceBefore` on the ledger row.
   */
  walletMap: Map<string, CreditWalletDoc>;
}

export async function payContestPrizes({
  session,
  contest,
  distributions,
  leaderboard,
}: PrizePayoutInput): Promise<PrizePayoutResult> {
  let totalDistributed = 0;
  let winnersPaid = 0;

  // One query for every winner's wallet instead of one per winner.
  const allWinnerUserIds = distributions
    .map((d) => leaderboard.find((l) => l.userId === d.userId)?.userId)
    .filter(Boolean) as string[];

  const existingWallets = await CreditWallet.find({
    userId: { $in: allWinnerUserIds },
  }).session(session);

  const walletMap = new Map<string, CreditWalletDoc>(
    existingWallets.map((w) => [w.userId.toString(), w as CreditWalletDoc]),
  );

  for (const dist of distributions) {
    const winner = leaderboard.find((l) => l.userId === dist.userId);
    if (!winner) continue;

    const prizeAmount = dist.prizeAmount;
    winner.prizeAmount = prizeAmount;
    totalDistributed += prizeAmount;

    console.log(
      `  🏆 Rank ${dist.rank}${dist.isTied ? " (TIED)" : ""}: ${winner.username} wins ${prizeAmount} credits`,
    );

    let winnerWallet: CreditWalletDoc | undefined = walletMap.get(
      winner.userId.toString(),
    );
    if (!winnerWallet) {
      const created = await CreditWallet.create(
        [
          {
            userId: winner.userId,
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
      winnerWallet = created[0] as CreditWalletDoc | undefined;
      if (!winnerWallet) {
        throw new Error(`Failed to create wallet for winner ${winner.userId}`);
      }
      walletMap.set(winner.userId.toString(), winnerWallet);
    }

    // `new: true` so `balanceAfter` is the real post-credit balance rather than one
    // derived from a read that another writer may already have overtaken.
    const updatedWinnerWallet = await CreditWallet.findOneAndUpdate(
      { userId: winner.userId },
      {
        $inc: {
          creditBalance: prizeAmount,
          totalWonFromCompetitions: prizeAmount,
        },
      },
      { session, new: true },
    );
    const balanceAfter = updatedWinnerWallet?.creditBalance || prizeAmount;
    const balanceBefore = balanceAfter - prizeAmount;

    if (updatedWinnerWallet) {
      walletMap.set(
        winner.userId.toString(),
        updatedWinnerWallet as CreditWalletDoc,
      );
    }

    await WalletTransaction.create(
      [
        {
          userId: winner.userId,
          transactionType: "competition_win",
          amount: prizeAmount,
          balanceBefore,
          balanceAfter,
          // Reason: `competitionId` is the declared field and `referenceId` is not. Stage 0
          // found every entry fee unattributable to its competition because a writer chose
          // the undeclared name and strict mode discarded it while reporting success.
          competitionId: contest._id,
          status: "completed",
          description: dist.isTied
            ? `🏆 Prize for Rank ${winner.rank} (Tied) in ${contest.name}`
            : `🏆 Prize for Rank ${winner.rank} in ${contest.name}`,
          metadata: buildWinMetadata(winner, dist),
        },
      ],
      { session },
    );

    winnersPaid += 1;
  }

  return { totalDistributed, winnersPaid, walletMap };
}

/**
 * The ledger row's metadata, with absent facts left out rather than written as undefined.
 *
 * Reason: `finalPnl` and `finalCapital` are trading facts. A provider contest has neither,
 * and writing them as `null` would put a number-shaped hole in the audit trail that reads
 * as "we measured zero" rather than "this game has no such measure". A provider row
 * carries `finalScore` instead, so the row says what was actually true.
 */
function buildWinMetadata(
  winner: SettlementLeaderboardEntry,
  dist: SettlementPrizeDistribution,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    rank: winner.rank,
    isTied: dist.isTied,
    qualificationStatus: winner.qualificationStatus,
    disqualificationReason: winner.disqualificationReason,
  };

  if (winner.pnl !== undefined) metadata.finalPnl = winner.pnl;
  if (winner.finalCapital !== undefined)
    metadata.finalCapital = winner.finalCapital;
  if (winner.score !== undefined) metadata.finalScore = winner.score;

  return metadata;
}
