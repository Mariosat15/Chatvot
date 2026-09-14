/**
 * Early End Check Job
 *
 * Checks for competitions/challenges that should end early because:
 * - All participants are eliminated (liquidated) or disqualified
 * - In challenges: one player is out while the other wins by default
 *
 * This runs every minute alongside other jobs.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "../config/database";

export interface EarlyEndCheckResult {
  competitionsEnded: number;
  challengesEnded: number;
  errors: string[];
}

/**
 * Hand an unclaimed pool to the one writer of an unclaimed-pool row.
 *
 * THIS FUNCTION DELIBERATELY COMPUTES NOTHING. It is not another copy of the rule; it is
 * the dynamic import, written once so that four call sites do not each carry it. The
 * arithmetic - the euro conversion at the platform's real rate, and the duplicate check -
 * lives in `PlatformFinancialsService.recordUnclaimedPool` and nowhere else.
 *
 * WHY THE IMPORT IS DYNAMIC: it is the convention every lib call in this worker follows
 * (see the `competition-end.actions` and `notification.service` imports below). The
 * service reaches Mongoose models through the `@/` alias, and keeping it out of the
 * top-level graph is what stops one job's dependencies loading for every other job.
 *
 * WHY IT SWALLOWS ITS OWN ERRORS: the four callers all follow this with a status update
 * that ends the contest. Before 9 September 2026 they used raw inserts that could not
 * fail in a way worth reporting; the service now does two extra reads, so a database
 * hiccup here must not leave a contest with every player eliminated stuck at `active`
 * for ever. The row is a bookkeeping record - nothing pays out of it - so an operator
 * reconciling a missing figure is a far better outcome than a contest that cannot end.
 */
async function recordUnclaimedPoolForWorker(params: {
  competitionId: string;
  competitionName: string;
  poolAmount: number;
  reason:
    | "no_participants"
    | "all_disqualified"
    | "no_qualified_winners"
    | "competition_cancelled";
  winnersCount: number;
  expectedWinnersCount: number;
  description?: string;
  sourceType?: "competition" | "challenge";
  testRunId?: string;
}): Promise<void> {
  try {
    const { PlatformFinancialsService } = await import(
      "../../lib/services/platform-financials.service"
    );
    await PlatformFinancialsService.recordUnclaimedPool(params);
  } catch (error) {
    console.error(
      `      ❌ [EARLY END] Could not record the unclaimed pool for ${params.sourceType ?? "competition"} ${params.competitionId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

export async function runEarlyEndCheck(): Promise<EarlyEndCheckResult> {
  const result: EarlyEndCheckResult = {
    competitionsEnded: 0,
    challengesEnded: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const competitionsCollection = db.collection("competitions");
    const participantsCollection = db.collection("competitionparticipants");
    const challengesCollection = db.collection("challenges");
    const challengeParticipantsCollection = db.collection(
      "challengeparticipants",
    );

    // Early exit: skip all work if no active competitions or challenges exist
    const [activeCompCount, activeChallengeCount] = await Promise.all([
      competitionsCollection.countDocuments({ status: "active" }),
      challengesCollection.countDocuments({ status: "active" }),
    ]);
    if (activeCompCount === 0 && activeChallengeCount === 0) {
      return result;
    }

    const now = new Date();

    // ============================================
    // 1. CHECK COMPETITIONS FOR EARLY END
    // ============================================
    const activeCompetitions = await competitionsCollection
      .find({
        status: "active",
        endTime: { $gt: now }, // Still has time remaining
        isTest: { $ne: true }, // Skip test data
        testRunId: { $exists: false }, // Skip test run data
      })
      .toArray();

    // BATCH: Load ALL participants for ALL active competitions in ONE query
    // NOTE: competitionId is stored as String in schema, so we must convert ObjectIds to strings
    const allCompIds = activeCompetitions.map((c) => c._id.toString());
    const allCompParticipants = allCompIds.length > 0
      ? await participantsCollection
          .find({ competitionId: { $in: allCompIds } })
          .project({ competitionId: 1, status: 1, pnl: 1, currentRank: 1, username: 1, userId: 1 })
          .toArray()
      : [];

    // Group by competition ID
    const compParticipantsMap = new Map<string, typeof allCompParticipants>();
    for (const p of allCompParticipants) {
      const key = p.competitionId.toString();
      if (!compParticipantsMap.has(key)) compParticipantsMap.set(key, []);
      compParticipantsMap.get(key)!.push(p);
    }

    for (const competition of activeCompetitions) {
      try {
        // Get all participants for this competition (from pre-loaded batch)
        const participants = compParticipantsMap.get(competition._id.toString()) || [];

        if (participants.length === 0) continue;

        // Check if disqualifyOnLiquidation is enabled for this competition
        const disqualifyOnLiquidation =
          competition.rules?.disqualifyOnLiquidation !== false; // Default true

        // Count by status
        const activeCount = participants.filter(
          (p) => p.status === "active",
        ).length;
        const liquidatedCount = participants.filter(
          (p) => p.status === "liquidated",
        ).length;
        const disqualifiedCount = participants.filter(
          (p) => p.status === "disqualified",
        ).length;

        // If disqualifyOnLiquidation is OFF, liquidated players can still win
        // Only end early if NO players can win (all explicitly disqualified)
        if (!disqualifyOnLiquidation) {
          // Liquidated players are still eligible - only end if all are disqualified
          if (activeCount > 0 || liquidatedCount > 0) continue;
          // All players are disqualified (not liquidated) - end early
        } else {
          // disqualifyOnLiquidation is ON - liquidated = out
          // If there are still active players, continue normally
          if (activeCount > 0) continue;
        }

        // All players are out - need to end early
        console.log(
          `\n   🏁 [EARLY END] Competition "${competition.name}" - All players eliminated!`,
        );
        console.log(
          `      Active: ${activeCount}, Liquidated: ${liquidatedCount}, Disqualified: ${disqualifiedCount}`,
        );
        console.log(
          `      disqualifyOnLiquidation: ${disqualifyOnLiquidation}`,
        );

        if (disqualifiedCount === participants.length) {
          // ALL players disqualified - prize pool goes to platform (unclaimed pools)
          console.log(
            `      ❌ All players disqualified - prize goes to unclaimed pools`,
          );

          // Record unclaimed pool for platform
          const prizePool = competition.prizePool || 0;
          if (prizePool > 0) {
            await recordUnclaimedPoolForWorker({
              competitionId: competition._id.toString(),
              competitionName: competition.name,
              poolAmount: prizePool,
              reason: "all_disqualified",
              winnersCount: 0,
              expectedWinnersCount: competition.prizeDistribution?.length || 3,
              description: `All participants disqualified in ${competition.name} - pool goes to platform`,
            });
            console.log(
              `      💰 Recorded ${prizePool} credits to unclaimed pools`,
            );
          }

          await competitionsCollection.updateOne(
            { _id: competition._id },
            {
              $set: {
                status: "completed",
                completedAt: now,
                earlyEndReason:
                  "All participants disqualified - prize to platform",
                noWinners: true,
              },
            },
          );
          result.competitionsEnded++;
        } else {
          // Some or all players liquidated - finalize normally to rank by equity
          console.log(
            `      🏆 Finalizing competition to rank liquidated players by equity`,
          );

          // Import and call finalize function
          const { finalizeCompetition } =
            await import("../../lib/actions/trading/competition-end.actions");
          const finalizeResult = await finalizeCompetition(
            competition._id.toString(),
          );

          if (finalizeResult?.success) {
            // Update with early end reason
            await competitionsCollection.updateOne(
              { _id: competition._id },
              {
                $set: {
                  earlyEndReason: "All participants eliminated before end time",
                },
              },
            );
            result.competitionsEnded++;
          } else {
            result.errors.push(
              // Reason: a failed finalization reports its reason on `error`; `message` is
              // only set on success. Reading `message` alone recorded every failure as the
              // bare string "Failed to finalize", losing the reason - and X5 adds a refusal
              // (a contest whose game has no settlement path) that this would have swallowed.
              `Competition ${competition._id}: ${finalizeResult?.error || finalizeResult?.message || "Failed to finalize"}`,
            );
          }
        }
      } catch (error) {
        result.errors.push(
          `Competition ${competition._id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    // ============================================
    // 2. CHECK CHALLENGES FOR EARLY END
    // ============================================
    const activeChallenges = await challengesCollection
      .find({
        status: "active",
        endTime: { $gt: now }, // Still has time remaining
        isTest: { $ne: true }, // Skip test data
        testRunId: { $exists: false }, // Skip test run data
      })
      .toArray();

    // BATCH: Load ALL participants for ALL active challenges in ONE query
    // NOTE: challengeId is stored as String in schema, so we must convert ObjectIds to strings
    const allChallengeIds = activeChallenges.map((c) => c._id.toString());
    const allChallengeParticipants = allChallengeIds.length > 0
      ? await challengeParticipantsCollection
          .find({ challengeId: { $in: allChallengeIds } })
          .project({ challengeId: 1, role: 1, status: 1, pnl: 1, username: 1, userId: 1, currentCapital: 1, unrealizedPnl: 1 })
          .toArray()
      : [];

    // Group by challenge ID
    const challengeParticipantsMap = new Map<string, typeof allChallengeParticipants>();
    for (const p of allChallengeParticipants) {
      const key = p.challengeId.toString();
      if (!challengeParticipantsMap.has(key)) challengeParticipantsMap.set(key, []);
      challengeParticipantsMap.get(key)!.push(p);
    }

    for (const challenge of activeChallenges) {
      try {
        // Get both participants (from pre-loaded batch)
        const participants = challengeParticipantsMap.get(challenge._id.toString()) || [];

        if (participants.length !== 2) continue;

        const challenger = participants.find((p) => p.role === "challenger");
        const opponent = participants.find((p) => p.role === "challenged");

        if (!challenger || !opponent) continue;

        // Check if disqualifyOnLiquidation is enabled for this challenge
        const disqualifyOnLiquidation =
          challenge.rules?.disqualifyOnLiquidation !== false; // Default true

        // Check statuses
        const challengerActive = challenger.status === "active";
        const opponentActive = opponent.status === "active";
        const challengerLiquidated = challenger.status === "liquidated";
        const opponentLiquidated = opponent.status === "liquidated";
        const challengerDisqualified = challenger.status === "disqualified";
        const opponentDisqualified = opponent.status === "disqualified";

        // If both still active, continue normally
        if (challengerActive && opponentActive) continue;

        // If disqualifyOnLiquidation is OFF, liquidated players are still "in the game"
        // Only trigger early end if a player is explicitly disqualified
        if (!disqualifyOnLiquidation) {
          // Treat liquidated as still eligible
          const challengerCanWin = challengerActive || challengerLiquidated;
          const opponentCanWin = opponentActive || opponentLiquidated;

          // If both can still win, let the challenge run until end time
          if (challengerCanWin && opponentCanWin) continue;

          // If neither is disqualified but both are out somehow, continue
          if (!challengerDisqualified && !opponentDisqualified) continue;
        }

        console.log(`\n   ⚔️ [EARLY END] Challenge ${challenge._id}`);
        console.log(
          `      Challenger: ${challenger.status}, Opponent: ${opponent.status}`,
        );
        console.log(
          `      disqualifyOnLiquidation: ${disqualifyOnLiquidation}`,
        );

        let winnerId: string | null = null;
        let winnerRole: "challenger" | "challenged" | null = null;
        let endReason = "";
        let noWinner = false;

        // Determine winner based on scenarios
        // Key: If disqualifyOnLiquidation is OFF, liquidated players DON'T auto-lose

        if (challengerDisqualified && opponentDisqualified) {
          // Both explicitly disqualified - prize pool goes to platform
          endReason = "Both players disqualified - prize to platform";
          noWinner = true;
          console.log(
            `      ❌ Both disqualified - prize goes to unclaimed pools`,
          );
        } else if (
          challengerDisqualified &&
          (opponentActive || (!disqualifyOnLiquidation && opponentLiquidated))
        ) {
          // Challenger disqualified, opponent wins (opponent is active OR liquidated when disqualifyOnLiquidation=false)
          winnerId = opponent.userId.toString();
          winnerRole = "challenged";
          endReason = "Challenger disqualified";
          console.log(`      🏆 Opponent wins (challenger disqualified)`);
        } else if (
          opponentDisqualified &&
          (challengerActive ||
            (!disqualifyOnLiquidation && challengerLiquidated))
        ) {
          // Opponent disqualified, challenger wins
          winnerId = challenger.userId.toString();
          winnerRole = "challenger";
          endReason = "Opponent disqualified";
          console.log(`      🏆 Challenger wins (opponent disqualified)`);
        } else if (
          disqualifyOnLiquidation &&
          challengerLiquidated &&
          opponentActive
        ) {
          // Only if disqualifyOnLiquidation is ON: Challenger liquidated = out, opponent wins
          winnerId = opponent.userId.toString();
          winnerRole = "challenged";
          endReason = "Challenger liquidated (disqualifyOnLiquidation enabled)";
          console.log(`      🏆 Opponent wins (challenger liquidated)`);
        } else if (
          disqualifyOnLiquidation &&
          opponentLiquidated &&
          challengerActive
        ) {
          // Only if disqualifyOnLiquidation is ON: Opponent liquidated = out, challenger wins
          winnerId = challenger.userId.toString();
          winnerRole = "challenger";
          endReason = "Opponent liquidated (disqualifyOnLiquidation enabled)";
          console.log(`      🏆 Challenger wins (opponent liquidated)`);
        } else if (
          disqualifyOnLiquidation &&
          challengerLiquidated &&
          opponentLiquidated
        ) {
          // Both liquidated with disqualifyOnLiquidation ON - compare final equity
          const challengerEquity =
            challenger.currentCapital + (challenger.unrealizedPnl || 0);
          const opponentEquity =
            opponent.currentCapital + (opponent.unrealizedPnl || 0);

          if (challengerEquity > opponentEquity) {
            winnerId = challenger.userId.toString();
            winnerRole = "challenger";
            endReason = `Both liquidated - challenger had higher equity ($${challengerEquity.toFixed(2)} vs $${opponentEquity.toFixed(2)})`;
          } else if (opponentEquity > challengerEquity) {
            winnerId = opponent.userId.toString();
            winnerRole = "challenged";
            endReason = `Both liquidated - opponent had higher equity ($${opponentEquity.toFixed(2)} vs $${challengerEquity.toFixed(2)})`;
          } else {
            // Tie - no winner (very rare)
            endReason = "Both liquidated with equal equity";
            noWinner = true;
          }
          console.log(
            `      ${noWinner ? "❌" : "🏆"} Both liquidated - ${endReason}`,
          );
        } else if (challengerLiquidated && opponentDisqualified) {
          // Challenger liquidated but played fair, opponent explicitly disqualified
          winnerId = challenger.userId.toString();
          winnerRole = "challenger";
          endReason =
            "Opponent disqualified (challenger liquidated but played fair)";
          console.log(`      🏆 Challenger wins (liquidated > disqualified)`);
        } else if (opponentLiquidated && challengerDisqualified) {
          // Opponent liquidated but played fair, challenger explicitly disqualified
          winnerId = opponent.userId.toString();
          winnerRole = "challenged";
          endReason =
            "Challenger disqualified (opponent liquidated but played fair)";
          console.log(`      🏆 Opponent wins (liquidated > disqualified)`);
        } else {
          // No early end condition met - let challenge continue
          // This happens when disqualifyOnLiquidation is OFF and both are liquidated (wait for end time)
          console.log(
            `      ⏳ No early end - challenge continues to end time`,
          );
          continue;
        }

        // End the challenge early.
        //
        // Reason: every credit that moves here - the winner's prize, its `WalletTransaction`
        // ledger row, their `totalWonFromChallenges` counter, the platform fee, the Game Master
        // referral commission and any unclaimed pool - is handled by the shared settlement
        // stages, exactly as the ordinary end-of-challenge path handles them. This job used to
        // pay the winner itself with the raw driver and got five separate things wrong; see
        // `payOutEarlyEndedChallenge` for the list. What stays here is the DECISION above, which
        // an early end makes under rules the ranking path does not express.
        const { payOutEarlyEndedChallenge } = await import(
          "./early-end-challenge-payout"
        );
        const payout = await payOutEarlyEndedChallenge({
          challengeId: challenge._id.toString(),
          winnerRole: noWinner ? null : winnerRole,
          earlyEndReason: endReason,
          challengerDisqualified,
          challengedDisqualified: opponentDisqualified,
          challengerReportedDisqualified:
            challengerDisqualified ||
            (disqualifyOnLiquidation && challengerLiquidated),
          challengedReportedDisqualified:
            opponentDisqualified ||
            (disqualifyOnLiquidation && opponentLiquidated),
        });

        if (noWinner) {
          console.log(
            `      💰 No winner - pool recorded to unclaimed funds (net of platform fee)`,
          );
        } else {
          console.log(
            `      💰 Awarded ${payout.prizePaid} credits to winner (${payout.winnerName})`,
          );

          // Send notifications
          try {
            const { sendNotification } =
              await import("../../lib/services/notification.service");
            await sendNotification({
              userId: winnerId!,
              type: "challenge_won",
              metadata: {
                challengeId: challenge._id.toString(),
                prize: payout.prizePaid,
              },
            });
            if (payout.loserId) {
              await sendNotification({
                userId: payout.loserId,
                type: "challenge_lost",
                metadata: {
                  challengeId: challenge._id.toString(),
                  opponentName: payout.winnerName,
                },
              });
            }
          } catch {
            // Notification failure is not critical
          }
        }

        result.challengesEnded++;
      } catch (error) {
        result.errors.push(
          `Challenge ${challenge._id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Critical error: ${error}`);
    return result;
  }
}

/**
 * Test-specific version that processes ONLY competitions/challenges
 * with the given testRunId. Used by the admin test panel.
 */
export async function runEarlyEndCheckForTest(
  testRunId: string,
): Promise<EarlyEndCheckResult> {
  const result: EarlyEndCheckResult = {
    competitionsEnded: 0,
    challengesEnded: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const competitionsCollection = db.collection("competitions");
    const participantsCollection = db.collection("competitionparticipants");
    const challengesCollection = db.collection("challenges");
    const challengeParticipantsCollection = db.collection(
      "challengeparticipants",
    );

    const now = new Date();

    // Process ONLY competitions with this testRunId
    const testCompetitions = await competitionsCollection
      .find({
        status: "active",
        testRunId,
      })
      .toArray();

    for (const competition of testCompetitions) {
      try {
        // Query using string ID to match schema (competitionId is stored as string)
        const participants = await participantsCollection
          .find({
            competitionId: competition._id.toString(),
          })
          .toArray();

        if (participants.length === 0) continue;

        const disqualifyOnLiquidation =
          competition.rules?.disqualifyOnLiquidation !== false;
        const activeCount = participants.filter(
          (p) => p.status === "active",
        ).length;
        const liquidatedCount = participants.filter(
          (p) => p.status === "liquidated",
        ).length;
        const disqualifiedCount = participants.filter(
          (p) => p.status === "disqualified",
        ).length;

        // Same logic as regular early end check
        if (!disqualifyOnLiquidation) {
          if (activeCount > 0 || liquidatedCount > 0) continue;
        } else {
          if (activeCount > 0) continue;
        }

        console.log(
          `\n   🧪 [TEST EARLY END] Competition "${competition.name}"`,
        );
        console.log(
          `      Active: ${activeCount}, Liquidated: ${liquidatedCount}, Disqualified: ${disqualifiedCount}`,
        );

        if (disqualifiedCount === participants.length) {
          const prizePool = competition.prizePool || 0;
          if (prizePool > 0) {
            await recordUnclaimedPoolForWorker({
              competitionId: competition._id.toString(),
              competitionName: competition.name,
              poolAmount: prizePool,
              reason: "all_disqualified",
              winnersCount: 0,
              expectedWinnersCount: competition.prizeDistribution?.length || 1,
              description: `All participants disqualified - pool goes to platform`,
              testRunId, // Mark for cleanup
            });
          }

          await competitionsCollection.updateOne(
            { _id: competition._id },
            {
              $set: {
                status: "completed",
                completedAt: now,
                earlyEndReason:
                  "All participants disqualified - prize to platform",
                noWinners: true,
              },
            },
          );
          result.competitionsEnded++;
        } else {
          // Finalize normally
          const { finalizeCompetition } =
            await import("../../lib/actions/trading/competition-end.actions");
          const finalizeResult = await finalizeCompetition(
            competition._id.toString(),
          );

          if (finalizeResult?.success) {
            await competitionsCollection.updateOne(
              { _id: competition._id },
              {
                $set: { earlyEndReason: "All participants eliminated (test)" },
              },
            );
            result.competitionsEnded++;
          } else {
            result.errors.push(
              // Reason: see the sibling site above - failures carry `error`, not `message`.
              `Competition ${competition._id}: ${finalizeResult?.error || finalizeResult?.message || "Failed"}`,
            );
          }
        }
      } catch (error) {
        result.errors.push(
          `Competition ${competition._id}: ${error instanceof Error ? error.message : "Error"}`,
        );
      }
    }

    // Process ONLY challenges with this testRunId
    const testChallenges = await challengesCollection
      .find({
        status: "active",
        testRunId,
      })
      .toArray();

    for (const challenge of testChallenges) {
      try {
        // Query using string ID to match schema (challengeId is stored as string)
        const participants = await challengeParticipantsCollection
          .find({
            challengeId: challenge._id.toString(),
          })
          .toArray();

        if (participants.length !== 2) continue;

        const challenger = participants.find((p) => p.role === "challenger");
        const opponent = participants.find((p) => p.role === "challenged");
        if (!challenger || !opponent) continue;

        const disqualifyOnLiquidation =
          challenge.rules?.disqualifyOnLiquidation !== false;

        const challengerActive = challenger.status === "active";
        const opponentActive = opponent.status === "active";
        const challengerLiquidated = challenger.status === "liquidated";
        const opponentLiquidated = opponent.status === "liquidated";
        const challengerDisqualified = challenger.status === "disqualified";
        const opponentDisqualified = opponent.status === "disqualified";

        if (challengerActive && opponentActive) continue;

        if (!disqualifyOnLiquidation) {
          const challengerCanWin = challengerActive || challengerLiquidated;
          const opponentCanWin = opponentActive || opponentLiquidated;
          if (challengerCanWin && opponentCanWin) continue;
          if (!challengerDisqualified && !opponentDisqualified) continue;
        }

        console.log(`\n   🧪 [TEST EARLY END] Challenge ${challenge._id}`);

        // Reason: only the ROLE is tracked here, where the production path above also keeps a
        // user id for its notifications. The harness sends none, and the payout helper takes the
        // role, so carrying an id as well would be a second answer to "who won" that nothing reads.
        let winnerRole: "challenger" | "challenged" | null = null;
        let noWinner = false;

        // Determine winner (same logic as main function)
        if (challengerDisqualified && opponentDisqualified) {
          noWinner = true;
        } else if (
          challengerDisqualified &&
          (opponentActive || (!disqualifyOnLiquidation && opponentLiquidated))
        ) {
          winnerRole = "challenged";
        } else if (
          opponentDisqualified &&
          (challengerActive ||
            (!disqualifyOnLiquidation && challengerLiquidated))
        ) {
          winnerRole = "challenger";
        } else if (
          disqualifyOnLiquidation &&
          challengerLiquidated &&
          opponentActive
        ) {
          winnerRole = "challenged";
        } else if (
          disqualifyOnLiquidation &&
          opponentLiquidated &&
          challengerActive
        ) {
          winnerRole = "challenger";
        } else if (
          disqualifyOnLiquidation &&
          challengerLiquidated &&
          opponentLiquidated
        ) {
          const challengerEquity = challenger.currentCapital;
          const opponentEquity = opponent.currentCapital;
          winnerRole =
            challengerEquity >= opponentEquity ? "challenger" : "challenged";
        } else if (challengerLiquidated && opponentDisqualified) {
          winnerRole = "challenger";
        } else if (opponentLiquidated && challengerDisqualified) {
          winnerRole = "challenged";
        } else {
          continue; // No early end condition
        }

        // Reason: the harness pays through exactly the code production pays through. It used
        // to have its own copy of the payout, which meant the end-logic tests exercised a path
        // adjacent to the real one and could never have caught the five defects that copy
        // carried. `testRunId` is not passed to the unclaimed-pool row because the shared stage
        // does not take one - cleanup finds those rows by `sourceId` against the test challenge
        // ids, not by tag, so nothing is left behind.
        const { payOutEarlyEndedChallenge } = await import(
          "./early-end-challenge-payout"
        );
        await payOutEarlyEndedChallenge({
          challengeId: challenge._id.toString(),
          winnerRole: noWinner ? null : winnerRole,
          challengerDisqualified,
          challengedDisqualified: opponentDisqualified,
          challengerReportedDisqualified:
            challengerDisqualified ||
            (disqualifyOnLiquidation && challengerLiquidated),
          challengedReportedDisqualified:
            opponentDisqualified ||
            (disqualifyOnLiquidation && opponentLiquidated),
        });

        result.challengesEnded++;
      } catch (error) {
        result.errors.push(
          `Challenge ${challenge._id}: ${error instanceof Error ? error.message : "Error"}`,
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Critical error: ${error}`);
    return result;
  }
}

export default runEarlyEndCheck;
