import type { ClientSession } from "mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import {
  getGameModuleOrTrading,
  type RankableParticipant,
} from "@/lib/games";
import type { SettlementContest } from "./types";

/**
 * Returning entry fees when a contest finished and NOBODY recorded a score.
 *
 * THE OWNER'S DECISION, 7 September 2026, answering open question 17. A contest that
 * completes with no result from anybody is not the same event as a contest whose players all
 * broke a rule, and it should not be settled the same way. The likeliest cause is a provider
 * outage, not ten people declining to play - so the operator now chooses per contest, and the
 * choice is a field on the contest rather than a platform-wide setting, because the right
 * answer differs between a free practice-adjacent contest and a high-fee one.
 *
 * WHAT SEPARATES THIS FROM A DISQUALIFICATION, and it is the whole reason this file can
 * exist. R45 made an unscored player *unqualified*, with the human reason "No score recorded"
 * sitting beside "Liquidated" and "Insufficient trades" in the same free-text field. Deciding
 * a refund by matching on that prose would be a defect waiting to happen: the string is
 * presentation, and the first person to reword it silently changes who gets paid back.
 *
 * So the question is asked of the GAME MODULE instead, and asked of the whole set at once:
 * **did anybody produce a result?** That is `hasResult`, which R45 already added for exactly
 * this kind of question, and it gives three properties for free.
 *
 *  - **A rule-based disqualification is untouched.** A liquidated trader HAS a result; they
 *    broke a rule. `hasResult` is true for them, so this never fires and their fee stays with
 *    the contest and goes to the unclaimed pool, which is what the owner asked for.
 *  - **Trading can never reach it**, because `tradingGameModule.hasResult` returns `true`
 *    unconditionally - a flat account is a real result. So the behaviour is provider-only
 *    **by construction rather than by a game-type branch**, which is the trap every
 *    trading-shaped service in this codebase fell into.
 *  - **A future game gets it automatically** if it can express "no result", with no change
 *    here.
 *
 * WHY THE REFUND IS NET OF THE PLATFORM FEE, unlike a cancellation. A cancelled contest never
 * ran, so the platform did nothing and returns everything. This contest *ran* - it was
 * scheduled, hosted, and the rounds were launched - so the operator's choice is between
 * keeping the whole pot and keeping only the fee. The owner chose the latter as the option
 * worth offering. **Do not "simplify" this to a full refund**: it would silently reverse a
 * fee the platform has already booked and recorded as income.
 */

/**
 * The machine-readable reason stamped on every refund this file writes, and the key the
 * player's results screen looks for.
 *
 * A CONSTANT RATHER THAN THE LITERAL IT WAS, because it is now read as well as written. The
 * two spellings would be the "one rule, two copies" shape behind `referenceId`,
 * `failedReason`, `challengeId` and the Game Master `||` - and here the drift would be
 * silent in the worst direction: the writer would keep refunding correctly while the screen
 * stopped finding the row, so a player who HAD been refunded would be told nothing.
 *
 * It also has to stay distinct from `unresolved_round_excluded`, which `exclusion-refund.ts`
 * writes for a different cause with a different explanation.
 */
export const UNSCORED_REFUND_REASON = "no_score_recorded";

interface RefundWalletDoc {
  _id: unknown;
  userId: string;
  creditBalance: number;
}

/**
 * A participant as the ranking engine sees one.
 *
 * `RankableParticipant` rather than a two-field shape of our own, and the difference matters.
 * `hasResult` is declared against the engine's participant type, so narrowing the input here
 * would need a cast at the call site - and a cast is precisely how a caller ends up handing
 * this function an object missing the field the game module actually reads, with the compiler
 * satisfied. The real caller already builds this shape for `calculateRankings`, so asking for
 * it costs nothing and keeps one definition of what a participant is.
 */
export type ScoreBearingParticipant = RankableParticipant;

export interface UnscoredRefundResult {
  refundedUserIds: string[];
  /** What actually left the pool. The fee stage needs this to keep the books exact. */
  totalRefunded: number;
  alreadyRefundedUserIds: string[];
}

/**
 * Did this contest finish with no result from anybody?
 *
 * **An empty contest is deliberately NOT unscored.** With no participants there is no fee to
 * return and nobody to return it to, and `fees.service.ts` already has a distinct
 * `no_participants` reason for that case. Folding the two together would make the log say a
 * refund policy was applied to a contest that never had a player.
 */
export function isUnscoredContest(
  participants: ScoreBearingParticipant[],
  /**
   * The contest's `gameType`, NOT its `gameKey`.
   *
   * The distinction cost a defect during implementation and is worth the parameter name:
   * `getGameModuleOrTrading` resolves a module by game *type* ("trading", "provider"), so
   * handing it a key like `provider:mock:circuit-sprint` returns `undefined` and the refund
   * silently never fires. One module serves every provider title, which is exactly why the
   * key is the wrong granularity here.
   */
  gameType: string | undefined,
): boolean {
  if (participants.length === 0) return false;

  const gameModule = getGameModuleOrTrading(gameType);

  // FAILS CLOSED on an unknown game type, and the two mistakes are not symmetric. Declining
  // to refund leaves the money in the unclaimed pool, where an operator can see it and move
  // it by hand. Refunding a contest we could not evaluate pays credits out of a pot that may
  // have had a legitimate winner, and there is no undo for that.
  if (!gameModule) {
    console.error(
      `❌ [UNSCORED] No game module for type "${gameType}"; not refunding. The pot stays with the contest.`,
    );
    return false;
  }

  // `every`, not `some`: a single real score means there was a winner to pay, the pot was
  // distributed among whoever placed, and no refund is owed to anybody. This fires only for
  // the all-or-nothing case the owner described.
  return participants.every((p) => !gameModule.hasResult(p));
}

/**
 * Returns each player their entry fee less the platform's share.
 *
 * Runs inside the settlement transaction, and **after** ranking rather than before it. That
 * is the opposite of `refundExcludedParticipants`, and the difference is not arbitrary:
 * exclusion REMOVES a player, so it has to happen before the pool is split or the winners are
 * paid from a pot counting somebody who left. Here nobody is removed and nothing is split -
 * the refund is what happens *because* the split produced no winner, so it cannot be known
 * until the split has been attempted.
 */
export async function refundUnscoredContest({
  session,
  contest,
  participants,
  platformFeeFraction,
}: {
  session: ClientSession;
  contest: SettlementContest;
  participants: ScoreBearingParticipant[];
  /** A FRACTION (0-0.5), never a percentage. */
  platformFeeFraction: number;
}): Promise<UnscoredRefundResult> {
  const result: UnscoredRefundResult = {
    refundedUserIds: [],
    totalRefunded: 0,
    alreadyRefundedUserIds: [],
  };

  const competitionId = contest._id.toString();
  const entryFee = contest.entryFee || 0;

  // A free contest has nothing to return. Not an error, and not worth a log line.
  if (entryFee <= 0) return result;

  // Reason for flooring: credits are carried to two decimal places everywhere else, and
  // rounding UP would return more than was taken. The fractions of a credit this leaves
  // behind are handed to the fee stage as a residue rather than absorbed, so the pool still
  // adds up - see `refundedToPlayers` in `fees.service.ts`.
  const refundPerPlayer =
    Math.floor(entryFee * (1 - platformFeeFraction) * 100) / 100;

  if (refundPerPlayer <= 0) return result;

  const userIds = participants.map((p) => p.userId);

  // IDEMPOTENCY on the ledger row, never on the contest status. R43 is the reason: a lock
  // keyed on a field any caller can write is only as good as every caller's restraint, and
  // a contest reset from `finalizing` to `active` after a stall (R4) is settled again by the
  // next sweep. A player who has been paid back has a row; one who has not does not.
  const priorRefunds = await WalletTransaction.find({
    competitionId,
    userId: { $in: userIds },
    transactionType: "competition_refund",
  })
    .select("userId")
    .session(session)
    .lean<{ userId: string }[]>();

  const alreadyRefunded = new Set(priorRefunds.map((t) => String(t.userId)));

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

    // Logged, never thrown. Aborting the transaction over one missing wallet would roll back
    // every other player's refund too - a worse outcome than one row an operator can see.
    if (!wallet) {
      console.error(
        `❌ [UNSCORED] No wallet for user ${userId} in contest ${competitionId}; entry fee not returned.`,
      );
      continue;
    }

    const balanceBefore = wallet.creditBalance;
    const balanceAfter = balanceBefore + refundPerPlayer;

    // A refund REVERSES a spend and is not a win. Inflating `totalWonFromCompetitions` would
    // credit the player with winnings on every stats screen for a contest nobody won.
    await CreditWallet.findByIdAndUpdate(
      wallet._id,
      {
        $inc: {
          creditBalance: refundPerPlayer,
          totalSpentOnCompetitions: -refundPerPlayer,
          totalRefunded: refundPerPlayer,
        },
      },
      { session },
    );

    await WalletTransaction.create(
      [
        {
          userId,
          transactionType: "competition_refund",
          amount: refundPerPlayer,
          balanceBefore,
          balanceAfter,
          competitionId,
          status: "completed",
          // The player-facing explanation the owner asked for. It has to say why they are
          // getting back less than they paid, or a partial refund reads as an error.
          description: `No player recorded a score in "${contest.name}" - entry fee returned less the platform fee`,
          metadata: {
            competitionName: contest.name,
            refundReason: UNSCORED_REFUND_REASON,
            originalEntryFee: entryFee,
            platformFeeRetained:
              Math.round((entryFee - refundPerPlayer) * 100) / 100,
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
    result.totalRefunded += refundPerPlayer;
  }

  // Rounded because repeated floating-point addition of two-decimal credits drifts, and this
  // number is subtracted from the pool remainder in the fee stage.
  result.totalRefunded = Math.round(result.totalRefunded * 100) / 100;

  return result;
}

/**
 * What this player was actually returned, for the explanation on their results screen.
 *
 * IT LIVES BESIDE THE WRITER FOR TWO REASONS, and the second one is a hard constraint rather
 * than a preference.
 *
 * The reason string is the join key, so a reader in another file would be a second copy of it.
 * That is the drift this module's constant exists to prevent, and keeping the query here means
 * there is exactly one place that knows how an unscored refund is identified.
 *
 * And the read cannot live in `lib/services/games/`, where the results service does the rest of
 * its work: chapter 11 seam 4 bans every money import from that folder, blocked-by-default, and
 * `__tests__/services/round-lifecycle.test.ts` invariant 6 enforces it by scanning the import
 * strings. That guard caught this on the first run. **The right response was to move the read,
 * not to carve a read-shaped hole in the guard** - an import grants writes as readily as reads,
 * so "reads are fine" is not a property a rule about imports can express.
 *
 * A READ, NOT A DERIVATION. It reports the row the settlement transaction wrote; it does not
 * infer a refund from the contest's configured policy. The policy says what was chosen, the row
 * says what happened, and a contest configured to refund whose players were paid a prize has no
 * row at all - telling those players they were refunded would simply be false.
 */
export async function findUnscoredRefund(
  competitionId: string,
  userId: string,
): Promise<number | undefined> {
  const row = await WalletTransaction.findOne({
    competitionId,
    userId,
    transactionType: "competition_refund",
    // Filtered on the reason so a refund from a DIFFERENT cause - the `exclude` unresolved-round
    // policy, or a cancellation - does not borrow an explanation specific to nobody scoring.
    "metadata.refundReason": UNSCORED_REFUND_REASON,
  })
    .select("amount")
    .lean<{ amount?: number }>();

  return row?.amount;
}
