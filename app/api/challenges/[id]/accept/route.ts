import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import mongoose from "mongoose";
import { canJoinChallenge } from "@/lib/services/market-hours.service";
import { checkAccountStanding } from "@/lib/services/contest-entry/guards";
import { gameNeedsMarketHours } from "@/lib/games";
import { buildChallengeParticipantSeat } from "@/lib/services/challenges/challenge-participant-seat";
import { isUnclaimedOpenChallenge } from "@/lib/utils/open-challenge";
import { randomBytes } from "crypto";

// POST - Accept a challenge
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Reason: Require verified email before accepting challenges.
    // Keeps unverified/spam accounts from engaging with real traders.
    if ((session.user as { emailVerified?: boolean }).emailVerified !== true) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        {
          error:
            "Please verify your email address before accepting challenges.",
        },
        { status: 403 },
      );
    }

    const { id } = await params;
    await connectToDatabase();

    // Reason: sub-defect 1b. Accepting a challenge debits a real entry fee from both
    // players, so it must refuse the accounts competition entry refuses - but it checked
    // neither the account restriction nor the fraud gate, so a suspended or
    // coordination-flagged account could enter a paid 1v1 and be charged. Proven by
    // `__tests__/services/challenge-accept-guards.test.ts` before being fixed here.
    //
    // Placed before every wallet read so a refusal cannot leave a partial debit, and
    // shares `checkAccountStanding` with the unified contest entry service so the two paths
    // cannot drift apart again. `enterChallenge`, not `enterCompetition`: the flags differ
    // deliberately, and the helper documents why.
    const standing = await checkAccountStanding(
      {
        userId: session.user.id,
        email: session.user.email || "",
        username: session.user.name || "",
        emailVerified: true,
        // Same header order as both competition entry paths, so one fraud gate does not
        // see a different address depending on which contest type it was asked about.
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          request.headers.get("cf-connecting-ip") ||
          undefined,
      },
      "enterChallenge",
      "You are not allowed to enter challenges",
    );
    if (standing) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: standing.error },
        { status: 403 },
      );
    }

    let challenge = await Challenge.findById(id).session(dbSession);

    if (!challenge) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 },
      );
    }

    const claimable = isUnclaimedOpenChallenge(challenge);

    if (claimable) {
      // Reason: the self-challenge rule that the create path could not apply, because an
      // open challenge names nobody at creation. The check did not disappear - it moved
      // to the only moment the second player is known.
      if (challenge.challengerId === session.user.id) {
        await dbSession.abortTransaction();
        return NextResponse.json(
          { error: "You cannot accept your own challenge" },
          { status: 400 },
        );
      }
    } else if (challenge.challengedId !== session.user.id) {
      // Only the challenged user can accept. Reason: this also refuses a DIRECTED
      // challenge whose `challengedId` somehow went missing - `undefined !== id` for
      // every caller - which is why openness is an explicit flag rather than inferred
      // from the absent field. The gate fails closed on a damaged document instead of
      // opening the seat to the whole platform.
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Only the challenged user can accept" },
        { status: 403 },
      );
    }

    // Check status
    if (challenge.status !== "pending") {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: `Cannot accept challenge with status: ${challenge.status}` },
        { status: 400 },
      );
    }

    // Check if expired
    if (new Date() > challenge.acceptDeadline) {
      challenge.status = "expired";
      await challenge.save({ session: dbSession });
      await dbSession.commitTransaction();
      return NextResponse.json(
        { error: "Challenge has expired" },
        { status: 400 },
      );
    }

    // ⏰ Market hours, but only for games that trade against a live market. A provider
    // challenge has no reason to be refused on a Saturday.
    //
    // Reason: this MOVED here from before the challenge lookup. It has to run after the
    // document is loaded, because the game type is on the document - there is no way to
    // scope the gate to a capability without first knowing which game it is. It still
    // runs before any wallet read, so a refusal cannot leave one of the two debits
    // applied - the same ordering rule as `checkAccountStanding` above.
    //
    // Side effect of the move, and an improvement: a request for a challenge that does
    // not exist now returns 404 rather than a market-closed 400.
    if (gameNeedsMarketHours(challenge.gameType)) {
      const marketCheck = await canJoinChallenge();
      if (!marketCheck.canJoin) {
        await dbSession.abortTransaction();
        return NextResponse.json(
          {
            error:
              marketCheck.reason ||
              "Cannot accept challenge: Market is currently closed.",
          },
          { status: 400 },
        );
      }
    }

    // Claim the empty seat on an open challenge.
    //
    // Reason: this is the lock, and it is the "setting the final status up front IS the
    // lock" pattern applied to the seat rather than the status. Two players pressing
    // Accept at the same moment both read `status: "pending"` and an empty seat, and
    // without an atomic claim both would be debited a real entry fee for a challenge only
    // one of them is in. The filter demands the seat still be empty, so the second
    // `findOneAndUpdate` matches nothing and that player is refused before any wallet is
    // touched.
    //
    // All three shapes of an empty seat are matched: absent, `null` and `""`. `$exists:
    // false` alone reads a stored empty string as taken, which would make the challenge
    // permanently unclaimable rather than double-claimable - quieter, but still wrong.
    //
    // Placed here, after every refusal that does not write and before every wallet read,
    // for the same reason as `checkAccountStanding` above: a later refusal aborts the
    // transaction and rolls the claim back, so a player who is turned away for an empty
    // wallet has not silently consumed somebody else's opportunity.
    if (claimable) {
      const claimed = await Challenge.findOneAndUpdate(
        {
          _id: challenge._id,
          status: "pending",
          openToAnyone: true,
          $or: [
            { challengedId: { $exists: false } },
            { challengedId: null },
            { challengedId: "" },
          ],
        },
        {
          $set: {
            challengedId: session.user.id,
            challengedName: session.user.name || "Unknown",
            challengedEmail: session.user.email || "",
          },
        },
        { session: dbSession, new: true },
      );

      if (!claimed) {
        await dbSession.abortTransaction();
        return NextResponse.json(
          { error: "Somebody else has already taken this challenge" },
          { status: 409 },
        );
      }

      // Reason: continue from the claimed document, not the one read before the claim -
      // everything below reads `challenge.challengedId` to debit a wallet, write a ledger
      // row and build a participant seat, and the stale copy still has no opponent on it.
      challenge = claimed;
    }

    // Reason: a tripwire, not a reachable refusal. Every path above either matched the
    // caller against a stored `challengedId` or has just written one, so this cannot
    // fire today - it exists because the three fields became optional on the model when
    // open challenges arrived, and without it the compiler would be satisfied by a
    // future branch that reaches the debit with an empty seat.
    const challengedId = challenge.challengedId;
    const challengedName = challenge.challengedName;
    const challengedEmail = challenge.challengedEmail;
    if (!challengedId || !challengedName) {
      await dbSession.abortTransaction();
      console.error(
        `❌ Challenge ${id} reached acceptance with no opponent on it`,
      );
      return NextResponse.json(
        { error: "Something went wrong. Please contact support." },
        { status: 500 },
      );
    }

    // Check challenged user's wallet balance
    const challengedWallet = await CreditWallet.findOne({
      userId: session.user.id,
    }).session(dbSession);

    if (
      !challengedWallet ||
      challengedWallet.creditBalance < challenge.entryFee
    ) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 400 },
      );
    }

    // Also check challenger still has balance
    const challengerWallet = await CreditWallet.findOne({
      userId: challenge.challengerId,
    }).session(dbSession);

    if (
      !challengerWallet ||
      challengerWallet.creditBalance < challenge.entryFee
    ) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Challenger no longer has sufficient credits" },
        { status: 400 },
      );
    }

    // Deduct credits from both users using atomic $inc
    // Reason: .save() does full document replacement which is less resilient to
    // concurrency issues. $inc is atomic at the MongoDB level and prevents
    // lost-update bugs where the transaction record is committed but the wallet
    // balance isn't properly decremented. This was the root cause of a 5-credit
    // reconciliation discrepancy discovered on 2026-03-13.

    // Challenger — atomic debit
    const challengerBalanceBefore = challengerWallet.creditBalance;
    const updatedChallengerWallet = await CreditWallet.findOneAndUpdate(
      { userId: challenge.challengerId },
      {
        $inc: {
          creditBalance: -challenge.entryFee,
          totalSpentOnChallenges: challenge.entryFee,
        },
      },
      { session: dbSession, new: true },
    );
    if (!updatedChallengerWallet) {
      throw new Error("Failed to update challenger wallet");
    }

    await WalletTransaction.create(
      [
        {
          userId: challenge.challengerId,
          transactionType: "challenge_entry",
          amount: -challenge.entryFee,
          balanceBefore: challengerBalanceBefore,
          balanceAfter: updatedChallengerWallet.creditBalance,
          currency: "EUR",
          exchangeRate: 1,
          status: "completed",
          challengeId: challenge._id.toString(),
          description: `Challenge entry vs ${challengedName}`,
          processedAt: new Date(),
        },
      ],
      { session: dbSession },
    );

    // Challenged — atomic debit
    const challengedBalanceBefore = challengedWallet.creditBalance;
    const updatedChallengedWallet = await CreditWallet.findOneAndUpdate(
      { userId: challengedId },
      {
        $inc: {
          creditBalance: -challenge.entryFee,
          totalSpentOnChallenges: challenge.entryFee,
        },
      },
      { session: dbSession, new: true },
    );
    if (!updatedChallengedWallet) {
      throw new Error("Failed to update challenged wallet");
    }

    await WalletTransaction.create(
      [
        {
          userId: challengedId,
          transactionType: "challenge_entry",
          amount: -challenge.entryFee,
          balanceBefore: challengedBalanceBefore,
          balanceAfter: updatedChallengedWallet.creditBalance,
          currency: "EUR",
          exchangeRate: 1,
          status: "completed",
          challengeId: challenge._id.toString(),
          description: `Challenge entry vs ${challenge.challengerName}`,
          processedAt: new Date(),
        },
      ],
      { session: dbSession },
    );

    // Set challenge times - starts NOW
    const now = new Date();
    const endTime = new Date(now.getTime() + challenge.duration * 60 * 1000);

    challenge.status = "active";
    challenge.acceptedAt = now;
    challenge.startTime = now;
    challenge.endTime = endTime;

    // Reason: a provider challenge's content seed is generated HERE, at acceptance, not at
    // creation - both the challenger and challenged ids are already known at creation, but
    // the model's own comment is explicit that it is "generated once at acceptance and
    // shared by both players, so they face the same content". Left unset, each side's round
    // would ask the provider for independent content, which defeats the reason a 1v1 needs
    // one seed at all: a puzzle-based challenge must not let one side draw an easier board
    // than the other. Trading has no `gameConfig`, so this is a no-op for it.
    if (challenge.gameConfig) {
      challenge.contentSeed = randomBytes(16).toString("hex");
    }

    await challenge.save({ session: dbSession });

    // Create participants (ordered: true required for session with multiple docs)
    // Reason: both seats come from one builder so a test can compare its keys against the
    // schema's declared paths. See buildChallengeParticipantSeat - it deliberately writes no
    // `score`, which is the challenge half of R50.
    await ChallengeParticipant.create(
      [
        buildChallengeParticipantSeat({
          challengeId: challenge._id.toString(),
          userId: challenge.challengerId,
          username: challenge.challengerName,
          email: challenge.challengerEmail,
          role: "challenger",
          gameKey: challenge.gameKey,
          startingCapital: challenge.startingCapital,
          joinedAt: now,
        }),
        buildChallengeParticipantSeat({
          challengeId: challenge._id.toString(),
          userId: challengedId,
          username: challengedName,
          email: challengedEmail ?? "",
          role: "challenged",
          gameKey: challenge.gameKey,
          startingCapital: challenge.startingCapital,
          joinedAt: now,
        }),
      ],
      { session: dbSession, ordered: true },
    );

    await dbSession.commitTransaction();

    // Reason: Leaderboard includes challengesEntered — invalidate after accept.
    try {
      const { clearLeaderboardCache } = await import(
        "@/lib/actions/leaderboard/global-leaderboard.actions"
      );
      await clearLeaderboardCache();
    } catch {
      // Best effort
    }

    // Send notifications
    try {
      const { notificationService } =
        await import("@/lib/services/notification.service");

      // Notify challenger that their challenge was accepted
      await notificationService.send({
        userId: challenge.challengerId,
        templateId: "challenge_accepted",
        variables: {
          // Changed from 'metadata' to 'variables'
          challengeId: challenge._id.toString(),
          challengeSlug: challenge.slug, // Added for actionUrl
          challengedName,
          opponentName: challengedName, // Alias for template compatibility
          entryFee: challenge.entryFee,
          duration: challenge.duration,
          winnerPrize: challenge.winnerPrize,
          endTime: endTime.toISOString(),
        },
      });

      // Notify challenged (confirmation) that the challenge started
      await notificationService.send({
        userId: challengedId,
        templateId: "challenge_started",
        variables: {
          // Changed from 'metadata' to 'variables'
          challengeId: challenge._id.toString(),
          challengeSlug: challenge.slug, // Added for actionUrl
          challengerName: challenge.challengerName,
          opponentName: challenge.challengerName, // Alias for template compatibility
          duration: challenge.duration,
          winnerPrize: challenge.winnerPrize,
          endTime: endTime.toISOString(),
        },
      });
    } catch (notifError) {
      console.error("Error sending challenge notifications:", notifError);
    }

    return NextResponse.json({
      success: true,
      message: "Challenge accepted! The battle begins now!",
      challenge: {
        _id: challenge._id,
        slug: challenge.slug,
        status: challenge.status,
        startTime: challenge.startTime,
        endTime: challenge.endTime,
        winnerPrize: challenge.winnerPrize,
      },
    });
  } catch (error) {
    await dbSession.abortTransaction();
    console.error("Error accepting challenge:", error);
    return NextResponse.json(
      { error: "Failed to accept challenge" },
      { status: 500 },
    );
  } finally {
    dbSession.endSession();
  }
}
