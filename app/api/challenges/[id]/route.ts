import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import { isUnclaimedOpenChallenge } from "@/lib/utils/open-challenge";

// GET - Get specific challenge details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    let challenge = await Challenge.findById(id);

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 },
      );
    }

    // Only participants can view - plus anybody signed in, while the challenge is an
    // unclaimed open one.
    //
    // Reason: an open challenge has to be readable by the person deciding whether to take
    // it, or the only way to accept one is to press a button on a list without ever seeing
    // the entry fee, the game or the rules. The widening is bounded by
    // `isUnclaimedOpenChallenge`: the moment somebody claims the seat, the third clause
    // stops being true and the challenge is private to its two players again.
    if (
      challenge.challengerId !== session.user.id &&
      challenge.challengedId !== session.user.id &&
      !isUnclaimedOpenChallenge(challenge)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Auto-finalize if challenge is 'active' but has ended and not yet finalized
    if (
      challenge.status === "active" &&
      challenge.endTime &&
      new Date() >= new Date(challenge.endTime) &&
      !challenge.winnerId // Not yet finalized
    ) {
      console.log("🏁 Auto-finalizing challenge on access:", id);
      try {
        const { finalizeChallenge } =
          await import("@/lib/actions/trading/challenge-finalize.actions");
        await finalizeChallenge(id);
        // Refresh challenge data after finalization
        challenge = await Challenge.findById(id);
        console.log("✅ Challenge auto-finalized successfully:", id);
      } catch (error) {
        console.error("❌ Failed to auto-finalize challenge:", id, error);
      }
    }

    // Get participants if challenge is active or completed
    let participantDocs: any[] = [];
    if (["active", "completed"].includes(challenge.status)) {
      participantDocs = await ChallengeParticipant.find({
        challengeId: id,
      }).lean();
    }

    // Return raw participant documents with challenge data
    return NextResponse.json({
      success: true,
      challenge: challenge.toObject(),
      participants: participantDocs,
      challengerId: challenge.challengerId,
      challengedId: challenge.challengedId,
    });
  } catch (error) {
    console.error("Error fetching challenge:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenge" },
      { status: 500 },
    );
  }
}
