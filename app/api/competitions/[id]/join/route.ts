import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { canJoinCompetition } from "@/lib/services/market-hours.service";
import {
  isSimulatorRequest,
  getSimulatorUserId,
} from "@/lib/services/simulator/simulator-mode";

/**
 * POST /api/competitions/[id]/join
 * Join a competition
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: competitionId } = await context.params;

    // Check for simulator mode first.
    // Reason: this branch skips authentication and acts as whichever user id the
    // caller names, debiting that user's wallet. It previously accepted the
    // X-Simulator-User-Id header on its own, so an unauthenticated caller could
    // join a competition as any user. It now requires the internal secret.
    const allowSimulatorMode = isSimulatorRequest(request);
    const simulatorUserId = allowSimulatorMode
      ? getSimulatorUserId(request)
      : null;

    let userId: string;
    let userEmail: string;
    let userName: string;

    if (allowSimulatorMode) {
      // In simulator mode, accept userId from header or body
      let bodyUserId: string | undefined;
      try {
        const body = await request.json();
        bodyUserId = body.userId;
      } catch {
        // No body or invalid JSON
      }

      const simUserId = simulatorUserId || bodyUserId;
      if (!simUserId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "userId required in simulator mode (X-Simulator-User-Id header or body.userId)",
          },
          { status: 400 },
        );
      }
      userId = simUserId;
      userEmail = `simuser_${userId.slice(-6)}@test.simulator`;
      userName = `SimUser_${userId.slice(-6)}`;
    } else {
      // Normal mode - require authentication
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
      userId = session.user.id;
      userEmail = session.user.email || "";
      userName = session.user.name || "Unknown";
    }

    await connectToDatabase();

    // Check if market is open (skip for simulator mode)
    if (!allowSimulatorMode) {
      const marketCheck = await canJoinCompetition();
      if (!marketCheck.canJoin) {
        return NextResponse.json(
          {
            success: false,
            error:
              marketCheck.reason ||
              "Market is closed. Cannot join competitions at this time.",
          },
          { status: 400 },
        );
      }
    }

    // Reason: Concurrent joins on the same competition cause MongoDB WriteConflict
    // (code 112, TransientTransactionError) because multiple transactions try to
    // $inc currentParticipants on the same document simultaneously.
    // MongoDB recommends retrying the entire transaction on TransientTransactionError.
    // 5 retries with exponential backoff handles bursts of 50+ concurrent joins.
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const mongoSession = await mongoose.startSession();
      mongoSession.startTransaction();

      try {
        const competition =
          await Competition.findById(competitionId).session(mongoSession);
        if (!competition) {
          await mongoSession.abortTransaction();
          mongoSession.endSession();
          return NextResponse.json(
            { success: false, error: "Competition not found" },
            { status: 404 },
          );
        }

        if (
          competition.status !== "upcoming" &&
          competition.status !== "active"
        ) {
          await mongoSession.abortTransaction();
          mongoSession.endSession();
          return NextResponse.json(
            {
              success: false,
              error: "Competition is not accepting participants",
            },
            { status: 400 },
          );
        }

        const now = new Date();
        if (competition.registrationDeadline) {
          const deadline = new Date(competition.registrationDeadline);
          const start = new Date(competition.startTime);
          const effectiveDeadline = deadline < start ? start : deadline;
          if (now > effectiveDeadline) {
            await mongoSession.abortTransaction();
            mongoSession.endSession();
            return NextResponse.json(
              {
                success: false,
                error: "Registration for this competition has closed. No new entries are accepted.",
              },
              { status: 400 },
            );
          }
        }

        if (competition.currentParticipants >= competition.maxParticipants) {
          await mongoSession.abortTransaction();
          mongoSession.endSession();
          return NextResponse.json(
            { success: false, error: "Competition is full" },
            { status: 400 },
          );
        }

        const existingParticipant = await CompetitionParticipant.findOne({
          competitionId,
          userId,
        }).session(mongoSession);

        if (existingParticipant) {
          await mongoSession.abortTransaction();
          mongoSession.endSession();
          return NextResponse.json({
            success: true,
            message: "Already joined",
            participantId: existingParticipant._id.toString(),
          });
        }

        if (competition.entryFee > 0) {
          const wallet = await CreditWallet.findOne({ userId }).session(
            mongoSession,
          );
          if (!wallet || wallet.creditBalance < competition.entryFee) {
            await mongoSession.abortTransaction();
            mongoSession.endSession();
            return NextResponse.json(
              { success: false, error: "Insufficient balance" },
              { status: 400 },
            );
          }

          const balanceBefore = wallet.creditBalance;
          const updatedWallet = await CreditWallet.findOneAndUpdate(
            { userId },
            {
              $inc: {
                creditBalance: -competition.entryFee,
                totalSpentOnCompetitions: competition.entryFee,
              },
            },
            { session: mongoSession, new: true },
          );
          if (!updatedWallet) {
            throw new Error("Failed to update wallet for competition entry");
          }

          await WalletTransaction.create(
            [
              {
                userId,
                transactionType: "competition_entry",
                amount: -competition.entryFee,
                balanceBefore,
                balanceAfter: updatedWallet.creditBalance,
                currency: "EUR",
                exchangeRate: 1,
                status: "completed",
                competitionId,
                description: `Entry fee for ${competition.name}`,
                processedAt: new Date(),
              },
            ],
            { session: mongoSession },
          );
        }

        const [participant] = await CompetitionParticipant.create(
          [
            {
              competitionId,
              userId,
              username: userName,
              email: userEmail,
              startingCapital: competition.startingCapital,
              currentCapital: competition.startingCapital,
              availableCapital: competition.startingCapital,
              usedMargin: 0,
              pnl: 0,
              pnlPercentage: 0,
              realizedPnl: 0,
              unrealizedPnl: 0,
              totalTrades: 0,
              winningTrades: 0,
              losingTrades: 0,
              winRate: 0,
              averageWin: 0,
              averageLoss: 0,
              largestWin: 0,
              largestLoss: 0,
              currentOpenPositions: 0,
              maxDrawdown: 0,
              maxDrawdownPercentage: 0,
              currentRank: 0,
              highestRank: 0,
              status: "active",
              marginCallWarnings: 0,
              enteredAt: new Date(),
            },
          ],
          { session: mongoSession },
        );

        await Competition.findByIdAndUpdate(
          competitionId,
          { $inc: { currentParticipants: 1 } },
          { session: mongoSession },
        );

        await mongoSession.commitTransaction();
        mongoSession.endSession();

        try {
          const { clearLeaderboardCache } = await import(
            "@/lib/actions/leaderboard/global-leaderboard.actions"
          );
          await clearLeaderboardCache();
        } catch {
          // Best effort
        }

        return NextResponse.json({
          success: true,
          participantId: participant._id.toString(),
          competition: {
            name: competition.name,
            startingCapital: competition.startingCapital,
          },
        });
      } catch (txError: unknown) {
        try { await mongoSession.abortTransaction(); } catch { /* already aborted */ }
        mongoSession.endSession();

        // Reason: MongoDB marks WriteConflict (code 112) with TransientTransactionError
        // label. Check both the error code and the label for robustness.
        const mongoErr = txError as { code?: number; hasErrorLabel?: (l: string) => boolean; errorLabels?: string[] };
        const isTransient =
          mongoErr.code === 112 ||
          mongoErr.hasErrorLabel?.("TransientTransactionError") ||
          mongoErr.errorLabels?.includes("TransientTransactionError");

        if (isTransient && attempt < MAX_RETRIES) {
          // Exponential backoff with wide jitter to spread out concurrent retries
          const baseDelay = 100 * Math.pow(2, attempt); // 100, 200, 400, 800, 1600
          const jitter = Math.floor(Math.random() * baseDelay);
          const delay = baseDelay + jitter;
          console.warn(`⚠️ Competition join WriteConflict for ${competitionId}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (isTransient) {
          // Reason: a lost race is not a server fault, and it used to be reported as one.
          // Re-throwing landed in the outer catch, which returned 500 with `error.message`
          // verbatim - so the caller received "Write conflict during plan execution and
          // yielding is disabled".
          //
          // Two things were wrong with that. A 500 tells a browser not to retry and can make
          // a load balancer pull the instance out of rotation, so a busy competition looked
          // like an outage. And the driver's own text names the storage engine and its
          // configuration to an unauthenticated caller.
          //
          // 409 is the accurate answer: the request conflicted with a concurrent one and is
          // worth repeating. The detail stays in the server log.
          console.error(
            `❌ Competition join exhausted ${MAX_RETRIES} retries for ${competitionId}:`,
            txError,
          );
          return NextResponse.json(
            {
              success: false,
              error:
                "This competition is receiving a lot of entries right now. Please try again.",
            },
            { status: 409 },
          );
        }

        throw txError;
      }
    }

    // Reason: unreachable - every iteration returns, continues or throws - but the compiler
    // cannot see that, and without it the function has a path that returns undefined. Next
    // would turn that into an opaque 500, so answer the same way the exhausted-retry branch
    // does rather than leaving the behaviour to chance.
    return NextResponse.json(
      {
        success: false,
        error:
          "This competition is receiving a lot of entries right now. Please try again.",
      },
      { status: 409 },
    );
  } catch (error) {
    console.error("Competition join error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
