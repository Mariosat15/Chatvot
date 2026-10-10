import type { ClientSession, HydratedDocument } from "mongoose";
import type { IChallenge } from "@/database/models/trading/challenge.model";
import type { IChallengeParticipant } from "@/database/models/trading/challenge-participant.model";
import { payContestPrizes } from "./prize-payout.service";
import { settleFeesAndGameMasters } from "./fees.service";
import type {
  SettlementContest,
  SettlementLeaderboardEntry,
  SettlementPrizeDistribution,
} from "./types";

/**
 * A decided challenge outcome: who won, who lost, and which side was disqualified.
 *
 * The first eight fields are exactly `SettleChallengeResult`. They are spelled out here
 * rather than extending it so that this module does not import from
 * `challenge-settlement.service.ts`, which imports this one - a type-only cycle would work,
 * but the dependency genuinely runs one way and keeping it that way is what lets the
 * early-end worker pull in the payout without pulling in the ranking rules it deliberately
 * does not use.
 *
 * The two disqualification flags are NOT on the result type because no caller returns them:
 * they decide whether a participant row stays `disqualified` and how many qualified winners
 * the fee stage is told about.
 */
export interface ChallengeOutcome {
  winnerId: string | null;
  winnerName: string | null;
  winnerPnL: number;
  loserId: string | null;
  loserName: string | null;
  loserPnL: number;
  isTie: boolean;
  noWinner: boolean;
  challengerDisqualified: boolean;
  challengedDisqualified: boolean;
}

export interface ApplyChallengeOutcomeInput {
  session: ClientSession;
  challenge: HydratedDocument<IChallenge>;
  challenger: HydratedDocument<IChallengeParticipant>;
  challenged: HydratedDocument<IChallengeParticipant>;
  outcome: ChallengeOutcome;
  tiePrizeDistribution?: "split_equally" | "challenger_wins" | "both_lose";
  /** Stored on the challenge when it ended before its `endTime`. */
  earlyEndReason?: string;
  /**
   * What the stored `challengerFinalStats.isDisqualified` / `challengedFinalStats.isDisqualified`
   * should report, when that differs from the outcome's disqualification flags. Defaults to them.
   *
   * WHY THE TWO CAN DIFFER: the outcome flags decide whether a participant ROW stays
   * `disqualified` and how many qualified winners the fee stage is told about, while these two
   * decide what an operator READS - `apps/admin/app/challenges/view/[id]/page.tsx` renders them
   * as a badge and strikes the score through. For `settleChallenge` the two questions have one
   * answer, so it passes nothing. For an early end they come apart: with
   * `disqualifyOnLiquidation` on, a liquidated player must be reported as disqualified, and yet
   * a liquidated-but-fair player can still WIN on final equity - so folding liquidation into the
   * outcome flags would leave that winner's row unmarked and their `prizeReceived` unrecorded.
   */
  reportedDisqualified?: { challenger: boolean; challenged: boolean };
}

/**
 * Write a decided outcome to the challenge and pay it out.
 *
 * WHY THIS IS SEPARATE FROM `settleChallenge`: there are TWO deciders and only one correct
 * payout. `settleChallenge` decides a winner from the ranking rules at the challenge's end
 * time. `worker/jobs/early-end-check.job.ts` decides one *before* that, when every remaining
 * player is liquidated or disqualified - and it does so under materially different rules,
 * because an early end has cases the ordinary path does not: a liquidated-but-fair player
 * beats an explicitly disqualified one, and two liquidated players are separated on final
 * equity. Handing that decision to `settleChallenge` would silently pay a different person
 * in three of its branches, so the decision stays with each caller and only the money is
 * shared.
 *
 * WHAT THIS FIXES: until 14 September 2026 the early-end worker had its own payout, and it
 * was wrong in four ways at once - it credited the winner `entryFee * 2`, the GROSS pool,
 * where `winnerPrize` is net of `platformFeePercentage`; it wrote no `WalletTransaction`, so
 * the credit was invisible to reconciliation and to the `challenge_win` idempotency check in
 * `challenge-finalize.job.ts`; it never incremented `totalWonFromChallenges`; and it booked
 * neither the platform fee nor the Game Master referral share. Every one of those is
 * something the two shared stages below already do correctly.
 */
export async function applyChallengeOutcome({
  session,
  challenge,
  challenger,
  challenged,
  outcome,
  tiePrizeDistribution = "split_equally",
  earlyEndReason,
  reportedDisqualified,
}: ApplyChallengeOutcomeInput): Promise<void> {
  const {
    winnerId,
    winnerName,
    winnerPnL,
    loserId,
    loserName,
    loserPnL,
    isTie,
    noWinner,
    challengerDisqualified,
    challengedDisqualified,
  } = outcome;

  const bothDisqualified = challengerDisqualified && challengedDisqualified;

  // ---------- Persist the challenge's own record of the outcome ----------
  challenge.winnerId = winnerId || undefined;
  challenge.winnerName = winnerName || undefined;
  challenge.winnerPnL = winnerPnL;
  challenge.loserId = loserId || undefined;
  challenge.loserName = loserName || undefined;
  challenge.loserPnL = loserPnL;
  challenge.isTie = isTie;
  challenge.noWinner = noWinner ? true : undefined;

  // Reason `score` is here at all, and why it is passed through rather than defaulted: R92.
  // The five trading metrics above are all `undefined` on a provider challenge, so before
  // this line the stored snapshot carried nothing but `isDisqualified` - and both admin
  // challenge screens, reading `pnl` and `totalTrades` off it, reported `+0.00` over
  // `0 trades` for a contest that had ranked correctly on a score they never showed. The
  // leaderboard built forty lines below has passed `p.score` to the payout stage since the
  // provider challenge shipped, so the number was in this function the whole time with
  // nowhere to be stored. `?? 0` here would be the same defect as R50's participant default:
  // it makes "scored nothing" and "this game has no score" one stored fact, and on a
  // lower-is-better title that zero sorts first.
  challenge.challengerFinalStats = {
    finalCapital: challenger.currentCapital,
    pnl: challenger.pnl,
    pnlPercentage: challenger.pnlPercentage,
    totalTrades: challenger.totalTrades,
    winRate: challenger.winRate,
    score: challenger.score,
    isDisqualified: reportedDisqualified?.challenger ?? challengerDisqualified,
    disqualificationReason: challenger.disqualificationReason,
  };
  challenge.challengedFinalStats = {
    finalCapital: challenged.currentCapital,
    pnl: challenged.pnl,
    pnlPercentage: challenged.pnlPercentage,
    totalTrades: challenged.totalTrades,
    winRate: challenged.winRate,
    score: challenged.score,
    isDisqualified: reportedDisqualified?.challenged ?? challengedDisqualified,
    disqualificationReason: challenged.disqualificationReason,
  };
  challenge.status = "completed";
  if (earlyEndReason) {
    challenge.earlyEndReason = earlyEndReason;
  }
  await challenge.save({ session });

  // ---------- Build what the shared stages need ----------
  const winnerPrize = challenge.winnerPrize;
  let distributions: SettlementPrizeDistribution[] = [];

  if (winnerId && !isTie) {
    distributions = [{ rank: 1, userId: winnerId, prizeAmount: winnerPrize, isTied: false }];
  } else if (isTie && tiePrizeDistribution === "split_equally") {
    // First participant gets ceiling, second gets floor - no credits lost to rounding.
    const halfPrize = winnerPrize / 2;
    distributions = [
      { rank: 1, userId: challenger.userId, prizeAmount: Math.ceil(halfPrize), isTied: true },
      { rank: 1, userId: challenged.userId, prizeAmount: Math.floor(halfPrize), isTied: true },
    ];
  }
  // Both disqualified, or a true tie under "both_lose": no distributions. The unclaimed
  // pool this leaves is recorded by `settleFeesAndGameMasters` itself, below.

  const leaderboard: SettlementLeaderboardEntry[] = [challenger, challenged].map((p) => ({
    rank: isTie || !winnerId ? 1 : p.userId === winnerId ? 1 : 2,
    userId: p.userId,
    username: p.username,
    prizeAmount: 0, // filled in by payContestPrizes
    pnl: p.pnl,
    finalCapital: p.currentCapital,
    // Reason: matches `provider-settlement.service.ts`'s leaderboard exactly. Without this,
    // `buildWinMetadata` (whose own comment says a provider row carries `finalScore`
    // instead of `finalPnl`/`finalCapital`) had nothing to read, so a provider challenge
    // winner's wallet transaction recorded no score at all - a number-shaped hole in the
    // audit trail for the one game family where `pnl`/`finalCapital` are never set.
    score: p.score,
    qualificationStatus: p.status === "disqualified" ? "disqualified" : "qualified",
    disqualificationReason: p.disqualificationReason,
  }));

  const contest: SettlementContest = {
    _id: challenge._id,
    name: `${challenge.challengerName} vs ${challenge.challengedName}`,
    entryFee: challenge.entryFee,
    startTime: challenge.startTime,
    endTime: challenge.endTime,
    // Reason: a challenge is never "created by" a Game Master the way a competition can be -
    // there is no such field on the model - so this is always absent and `isGmCreated`
    // naturally evaluates false in the fee stage below.
    gameMasterId: null,
    platformFeePercentage: challenge.platformFeePercentage,
    // Reason (X7 step 5): challenges carry gameKey; stamp it onto GM earnings so
    // a provider 1v1 is not filed under trading by the distribute fallback.
    gameKey: challenge.gameKey,
    contestKind: "challenge",
  };

  const totalDistributed = distributions.reduce((sum, d) => sum + d.prizeAmount, 0);

  const { walletMap } =
    distributions.length > 0
      ? await payContestPrizes({ session, contest, distributions, leaderboard })
      : { walletMap: new Map() };

  await settleFeesAndGameMasters({
    session,
    contest,
    prizePool: challenge.prizePool,
    totalDistributed,
    prizeWinnerCount: distributions.length,
    expectedWinners: 1,
    qualifiedWinnersCount: [challengerDisqualified, challengedDisqualified].filter(
      (d) => !d,
    ).length,
    participants: [{ userId: challenger.userId }, { userId: challenged.userId }],
    walletMap,
    platformFeeFraction: challenge.platformFeePercentage / 100,
  });

  // ---------- Mark participants by what was actually paid ----------
  // Reason: the both-disqualified case leaves both rows at "disqualified" (already saved
  // above) rather than overwriting that with "completed" - every other outcome (a winner,
  // any resolved tie, or a genuine "both_lose" tie) moves both participants to "completed".
  if (!bothDisqualified) {
    for (const participant of [challenger, challenged]) {
      const dist = distributions.find((d) => d.userId === participant.userId);
      if (dist) {
        participant.isWinner = true;
        participant.prizeReceived = dist.prizeAmount;
      }
      participant.status = "completed";
      await participant.save({ session });
    }
  }
}
