/**
 * Contest entry - the single path into a paid competition.
 *
 * Stage 0, Defect 1. Four independent implementations of "join a competition" existed as of
 * 1 September 2026, and they disagreed about which guards applied and what money moved:
 *
 *   Gate A  `enterCompetition`                  lib/actions/trading/competition.actions.ts
 *   Gate B  POST /api/competitions/[id]/join    app/api/competitions/[id]/join/route.ts
 *   Batch   POST /api/simulator/.../join-batch  fixed in place; seeds many users at once
 *   Admin   apps/admin/.../competition.actions  deleted; it was dead code with weaker guards
 *
 * This module is the union of Gate A's and Gate B's behaviour, so that neither's guards can
 * be bypassed by using the other entrance. Every difference was measured by a test before
 * being resolved here - see `__tests__/services/competition-join-gate-parity.test.ts`.
 *
 * What each gate contributed, and what was decided where they disagreed:
 *
 *   From Gate A   ObjectId validation, email verification, the restriction check, the fraud
 *                 gate, the level requirement, the prizePool increment, badge evaluation,
 *                 and the specific status messages ("cancelled" / "already ended").
 *   From Gate B   The write-conflict retry loop, the full participant field set, the
 *                 leaderboard cache clear, and the correct ledger attribution.
 *
 *   Prize pool    ALWAYS incremented by the fee taken. Gate B took the fee and left the pool
 *                 at zero, so a competition entered through it under-paid its winners. This
 *                 is the money defect at the centre of Defect 1.
 *   Ledger        Uses `competitionId`, which the schema declares. Gate A wrote `referenceId`,
 *                 which it does not, so strict mode dropped it and every entry fee taken
 *                 through Gate A is unattributable to its competition.
 *   Duplicate     Idempotent success (owner decision, 1 Sep 2026). Gate A threw "You are
 *                 already in this competition"; Gate B returned success. Success is safer for
 *                 retries and double-clicks, and it is what the retry loop above needs to be
 *                 correct - a retry that succeeded but lost its response must not be charged
 *                 a second fee.
 *   Market hours  NOT checked (owner decision, 1 Sep 2026). Gate B blocked joining while the
 *                 market was shut, which stopped weekend sign-ups for Monday contests. Only
 *                 trading is gated; see `order.actions.ts`.
 *   Currency      "EUR" with exchangeRate 1, matching the schema default, the other three
 *                 writers, and the € the entry fee is quoted in. Gate A wrote "CREDITS",
 *                 which nothing reads.
 *
 * This is a service, not a server action: it takes an already-authenticated actor and never
 * touches request state, so a route, an action and a test can all call it the same way.
 *
 * The guards, the result shapes and the post-commit work live in `./contest-entry/`; this
 * file is the transaction.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { checkActor, checkLevelRequirement } from "./contest-entry/guards";
import { buildParticipantSeat } from "./contest-entry/participant-seat";
import { runPostEntrySideEffects } from "./contest-entry/side-effects";
import { fail } from "./contest-entry/types";

export type {
  ContestEntryActor,
  ContestEntryFailure,
  ContestEntryFailureCode,
  ContestEntryResult,
  ContestEntrySuccess,
} from "./contest-entry/types";

import type { ContestEntryActor, ContestEntryResult } from "./contest-entry/types";

const MAX_RETRIES = 5;
const DUPLICATE_KEY = 11000;

/** MongoDB flags a lost race as code 112 and/or a TransientTransactionError label. */
function isTransientConflict(error: unknown): boolean {
  const e = error as {
    code?: number;
    hasErrorLabel?: (label: string) => boolean;
    errorLabels?: string[];
  };
  return (
    e?.code === 112 ||
    e?.hasErrorLabel?.("TransientTransactionError") === true ||
    e?.errorLabels?.includes("TransientTransactionError") === true
  );
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number })?.code === DUPLICATE_KEY;
}

/**
 * Enter a competition: take the fee, fund the prize pool, seat the player. Atomic.
 *
 * Never throws. Returns a discriminated result so that callers with different error
 * conventions - a server action returning `{ success: false }` and a route returning an HTTP
 * status - can both use it without one of them having to catch.
 */
export async function enterContest(
  competitionId: string,
  actor: ContestEntryActor,
): Promise<ContestEntryResult> {
  if (!mongoose.Types.ObjectId.isValid(competitionId)) {
    return fail("invalid_id", "Invalid competition ID format");
  }

  await connectToDatabase();

  const actorFailure = await checkActor(actor);
  if (actorFailure) return actorFailure;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const competition =
        await Competition.findById(competitionId).session(session);

      if (!competition) {
        await session.abortTransaction();
        return fail("not_found", "Competition not found");
      }

      if (competition.status !== "upcoming" && competition.status !== "active") {
        await session.abortTransaction();
        return fail(
          "not_open",
          competition.status === "cancelled"
            ? "This competition has been cancelled"
            : competition.status === "completed"
              ? "This competition has already ended"
              : "Competition is not open for entries",
        );
      }

      // Reason: a legacy bug set registrationDeadline an hour BEFORE startTime, which would
      // close entries before the contest existed. Treat startTime as the floor.
      if (competition.registrationDeadline) {
        const deadline = new Date(competition.registrationDeadline);
        const start = new Date(competition.startTime);
        const effective = deadline < start ? start : deadline;
        if (new Date() > effective) {
          await session.abortTransaction();
          return fail(
            "registration_closed",
            "Registration for this competition has closed. No new entries are accepted.",
          );
        }
      }

      // The seat check comes before the "full" check so that a player who is already in a
      // full competition still gets their idempotent success rather than "Competition is
      // full" - they are not asking for a new seat.
      const existing = await CompetitionParticipant.findOne({
        competitionId,
        userId: actor.userId,
      }).session(session);

      if (existing) {
        await session.abortTransaction();
        return {
          success: true,
          alreadyEntered: true,
          participantId: existing._id.toString(),
          feeCharged: 0,
          competition: {
            name: competition.name,
            startingCapital: competition.startingCapital,
          },
        };
      }

      if (competition.currentParticipants >= competition.maxParticipants) {
        await session.abortTransaction();
        return fail("full", "Competition is full");
      }

      const levelFailure = await checkLevelRequirement(
        actor.userId,
        competition.levelRequirement ?? {},
      );
      if (levelFailure) {
        await session.abortTransaction();
        return levelFailure;
      }

      const entryFee = competition.entryFee || 0;

      if (entryFee > 0) {
        const wallet = await CreditWallet.findOne({
          userId: actor.userId,
        }).session(session);

        if (!wallet) {
          await session.abortTransaction();
          return fail("no_wallet", "Wallet not found");
        }

        if (wallet.creditBalance < entryFee) {
          await session.abortTransaction();
          return fail(
            "insufficient_balance",
            `Insufficient balance. Need €${entryFee}, have €${wallet.creditBalance}`,
          );
        }

        const balanceBefore = wallet.creditBalance;
        const debited = await CreditWallet.findOneAndUpdate(
          { userId: actor.userId },
          {
            $inc: {
              creditBalance: -entryFee,
              totalSpentOnCompetitions: entryFee,
            },
          },
          { session, new: true },
        );

        if (!debited) {
          throw new Error("Failed to debit wallet for competition entry");
        }

        await WalletTransaction.create(
          [
            {
              userId: actor.userId,
              transactionType: "competition_entry",
              amount: -entryFee,
              balanceBefore,
              balanceAfter: debited.creditBalance,
              currency: "EUR",
              exchangeRate: 1,
              status: "completed",
              // Reason: `competitionId` is the declared field. Gate A wrote `referenceId`,
              // which the schema lacks, so strict mode silently discarded it and left the
              // row unattributable. Getting this name wrong breaks the audit trail without
              // breaking any balance, which is why it went unnoticed.
              competitionId,
              description: `Entry fee for ${competition.name}`,
              processedAt: new Date(),
            },
          ],
          { session },
        );
      }

      const [participant] = await CompetitionParticipant.create(
        [
          buildParticipantSeat({
            competitionId,
            userId: actor.userId,
            username: actor.username || actor.email,
            email: actor.email,
            gameKey: competition.gameKey,
            gameType: competition.gameType,
            startingCapital: competition.startingCapital,
            enteredAt: new Date(),
          }),
        ],
        { session },
      );

      // Reason: the prize pool must grow by every fee taken, in the same transaction that
      // takes it. Gate B incremented only the participant count, so the fee reached platform
      // revenue while the pool stayed at zero and the winners were paid from nothing. There
      // is a finalize-time safeguard, but it only fires when the pool is too HIGH - an
      // under-funded pool is under-distributed in silence.
      await Competition.findByIdAndUpdate(
        competitionId,
        { $inc: { currentParticipants: 1, prizePool: entryFee } },
        { session },
      );

      await session.commitTransaction();

      console.log(
        `✅ User ${actor.userId} entered "${competition.name}" (fee €${entryFee})`,
      );

      runPostEntrySideEffects(competitionId, competition.name, actor);

      return {
        success: true,
        alreadyEntered: false,
        participantId: participant._id.toString(),
        feeCharged: entryFee,
        competition: {
          name: competition.name,
          startingCapital: competition.startingCapital,
        },
      };
    } catch (error: unknown) {
      try {
        await session.abortTransaction();
      } catch {
        // Already aborted by the failing operation.
      }

      // Reason: the read-then-insert above is not atomic against another request for the
      // same player, so two concurrent joins can both pass the seat check. The unique index
      // on (competitionId, userId) is what actually prevents the double seat, and it
      // surfaces as a duplicate-key error rather than a write conflict. Neither original
      // gate handled this: whichever request lost got an opaque 500 and, worse, the caller
      // could not tell whether a fee had been taken. It is the same answer as the seat
      // check - the player is in, nothing was charged.
      if (isDuplicateKey(error)) {
        const existing = await CompetitionParticipant.findOne({
          competitionId,
          userId: actor.userId,
        });
        const competition = await Competition.findById(competitionId);
        if (existing && competition) {
          return {
            success: true,
            alreadyEntered: true,
            participantId: existing._id.toString(),
            feeCharged: 0,
            competition: {
              name: competition.name,
              startingCapital: competition.startingCapital,
            },
          };
        }
        return fail("failed", "Something went wrong. Please contact support.");
      }

      if (isTransientConflict(error) && attempt < MAX_RETRIES) {
        // Exponential backoff with wide jitter, so a burst of concurrent joins spreads out
        // instead of colliding again on the same schedule.
        const base = 100 * Math.pow(2, attempt);
        const delay = base + Math.floor(Math.random() * base);
        console.warn(
          `⚠️ Competition entry write conflict for ${competitionId}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (isTransientConflict(error)) {
        // Reason: a lost race is not a server fault. Reporting it as one told browsers not
        // to retry and leaked the storage engine's own wording ("Write conflict during plan
        // execution and yielding is disabled") to an unauthenticated caller.
        console.error(
          `❌ Competition entry exhausted ${MAX_RETRIES} retries for ${competitionId}:`,
          error,
        );
        return fail(
          "contended",
          "This competition is receiving a lot of entries right now. Please try again.",
        );
      }

      console.error(
        `❌ Competition entry failed for user ${actor.userId} on ${competitionId}:`,
        error,
      );
      return fail("failed", "Something went wrong. Please contact support.");
    } finally {
      await session.endSession();
    }
  }

  // Unreachable: every iteration returns, continues or throws. Present because the compiler
  // cannot see that, and an implicit undefined return would become an opaque failure.
  return fail(
    "contended",
    "This competition is receiving a lot of entries right now. Please try again.",
  );
}
