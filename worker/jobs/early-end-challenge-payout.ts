import mongoose from "mongoose";
import Challenge from "../../database/models/trading/challenge.model";
import ChallengeParticipant from "../../database/models/trading/challenge-participant.model";
import { applyChallengeOutcome } from "../../lib/services/settlement/challenge-outcome";

/**
 * Pay out a challenge that ended before its `endTime`.
 *
 * WHY THIS EXISTS: until 14 September 2026 `early-end-check.job.ts` paid the winner itself,
 * with the raw MongoDB driver, and it was wrong in five ways at once:
 *
 *   1. It credited `entryFee * 2` - the GROSS pool. The winner is owed `challenge.winnerPrize`,
 *      which the create route stores as `prizePool - platformFeeAmount`. Every early-ended
 *      challenge overpaid its winner by exactly the platform fee (10% by default).
 *   2. It wrote no `WalletTransaction`. The credit was therefore invisible to financial
 *      reconciliation, which compares the wallet balance against the sum of its ledger rows -
 *      so every early-ended challenge left a permanent `balance_mismatch` on the winner.
 *   3. It never incremented `totalWonFromChallenges`, so the player's lifetime winnings under-
 *      reported by the prize.
 *   4. It booked no platform fee and no Game Master referral commission. The platform's own
 *      books simply had no record of the contest.
 *   5. In the no-winner case it recorded the GROSS pool as unclaimed, where the shared stage
 *      records it net of the fee - overstating unclaimed funds and understating revenue.
 *
 * Every one of those is something `payContestPrizes` and `settleFeesAndGameMasters` already do
 * correctly for the ordinary end-of-challenge path, so this routes the money through them.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not decide the winner. `settleChallenge` ranks
 * players at the challenge's end time under rules that do not fit an early end - an early end
 * separates a liquidated-but-fair player from an explicitly disqualified one, and two liquidated
 * players on final equity, neither of which the ranking path expresses. The caller decides; only
 * the money is shared. See `applyChallengeOutcome`'s own note on the two deciders.
 */
export interface EarlyEndPayoutInput {
  challengeId: string;
  /**
   * Which side won, `null` when nobody did.
   *
   * Reason: the role is taken rather than the user id because the role is what the caller
   * actually decided - every branch of its scenario table sets one - and because deriving it
   * back from an id means a second comparison that can disagree with the caller's.
   */
  winnerRole: "challenger" | "challenged" | null;
  /** Stored on the challenge. The test-harness path deliberately stores none. */
  earlyEndReason?: string;
  /**
   * EXPLICIT disqualification only (`status === "disqualified"`), never liquidation - even when
   * `disqualifyOnLiquidation` is on.
   *
   * Reason: these two flags decide whether a participant row stays `disqualified` instead of
   * moving to `completed`, and how many qualified winners the fee stage is told about. A player
   * who was liquidated but played fair can still WIN an early end on final equity, and folding
   * liquidation in here would leave that winner's row unmarked while their prize was paid.
   */
  challengerDisqualified: boolean;
  challengedDisqualified: boolean;
  /**
   * Liquidation-INCLUSIVE disqualification, i.e. explicitly disqualified OR (liquidated while
   * `disqualifyOnLiquidation` is on). This is what gets stored in the final-stats blob and read
   * back by the admin challenge view, and it is deliberately a different question from the two
   * flags above - see `reportedDisqualified` on `ApplyChallengeOutcomeInput`.
   */
  challengerReportedDisqualified: boolean;
  challengedReportedDisqualified: boolean;
}

export interface EarlyEndPayoutResult {
  winnerName: string | null;
  loserId: string | null;
  /** What the winner was actually credited - net of the platform fee. */
  prizePaid: number;
}

export async function payOutEarlyEndedChallenge({
  challengeId,
  winnerRole,
  earlyEndReason,
  challengerDisqualified,
  challengedDisqualified,
  challengerReportedDisqualified,
  challengedReportedDisqualified,
}: EarlyEndPayoutInput): Promise<EarlyEndPayoutResult> {
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new Error(`Challenge ${challengeId} not found`);
  }

  const challenger = await ChallengeParticipant.findOne({
    challengeId,
    role: "challenger",
  });
  const challenged = await ChallengeParticipant.findOne({
    challengeId,
    role: "challenged",
  });
  if (!challenger || !challenged) {
    throw new Error(`Challenge ${challengeId} is missing a participant row`);
  }

  const winner =
    winnerRole === null
      ? null
      : winnerRole === "challenger"
        ? challenger
        : challenged;
  const loser =
    winner === null ? null : winner === challenger ? challenged : challenger;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await applyChallengeOutcome({
        session,
        challenge,
        challenger,
        challenged,
        earlyEndReason,
        reportedDisqualified: {
          challenger: challengerReportedDisqualified,
          challenged: challengedReportedDisqualified,
        },
        outcome: {
          winnerId: winner?.userId.toString() ?? null,
          winnerName: winner?.username ?? null,
          winnerPnL: winner?.pnl ?? 0,
          loserId: loser?.userId.toString() ?? null,
          loserName: loser?.username ?? null,
          loserPnL: loser?.pnl ?? 0,
          // Reason: an early end never splits a prize. Its one drawn case - two liquidated
          // players on equal final equity - pays nobody, so it travels as `noWinner` rather
          // than as a tie. Sending it as `isTie` would split the pool between two players the
          // caller decided had both lost.
          isTie: false,
          noWinner: winner === null,
          challengerDisqualified,
          challengedDisqualified,
        },
      });
    });
  } finally {
    await session.endSession();
  }

  // Reason: `winnerRole` and `completedAt` are NOT declared on the challenge schema. The old
  // code only managed to store them because the raw driver bypasses Mongoose strict mode, which
  // would silently discard both. They are written here with the raw driver for the same reason,
  // preserving exactly what this path has always stored: `winnerRole` is read back by the admin
  // end-logic test harness (also with the raw driver), and dropping it would make that harness
  // read `undefined` for every early-end scenario. Declaring them instead is a mirrored model
  // change for two fields the ordinary finalize path has never written, so it is deliberately
  // not done as part of a money fix.
  const db = mongoose.connection.db;
  if (db) {
    await db.collection("challenges").updateOne(
      { _id: challenge._id },
      {
        $set: {
          completedAt: new Date(),
          winnerRole,
        },
      },
    );
  }

  return {
    winnerName: winner?.username ?? null,
    loserId: loser?.userId.toString() ?? null,
    prizePaid: winner === null ? 0 : challenge.winnerPrize,
  };
}
