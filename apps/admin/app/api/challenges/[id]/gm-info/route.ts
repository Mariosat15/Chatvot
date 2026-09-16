import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";

/**
 * GET - Fetch Game Master info for a challenge
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Reason: ChallengesAdminSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("challenges");
    if (!guard.ok) return guard.response;

    const { id: challengeId } = await params;
    const { searchParams } = new URL(request.url);
    const challengerId = searchParams.get("challengerId");
    const challengedId = searchParams.get("challengedId");

    if (!challengerId || !challengedId) {
      return NextResponse.json(
        { error: "Missing challengerId or challengedId" },
        { status: 400 },
      );
    }

    const { connection } = await connectToDatabase();
    const db = connection.db;

    // Get GM earnings for this challenge
    const gmEarnings = await db
      .collection("gamemasterearnings")
      .find({
        sourceId: challengeId,
        sourceType: "challenge",
      })
      .toArray();

    const result: {
      challenger?: {
        gameMasterId: string;
        gameMasterEmail: string;
        netEarning: number;
      };
      challenged?: {
        gameMasterId: string;
        gameMasterEmail: string;
        netEarning: number;
      };
    } = {};

    // Map earnings to challenger/challenged
    for (const earning of gmEarnings) {
      const gmInfo = {
        gameMasterId: earning.gameMasterId,
        gameMasterEmail: earning.gameMasterEmail,
        netEarning: earning.netEarning || earning.grossEarning || 0,
      };

      if (earning.referredUserId === challengerId) {
        result.challenger = gmInfo;
      } else if (earning.referredUserId === challengedId) {
        result.challenged = gmInfo;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching challenge GM info:", error);
    return NextResponse.json(
      { error: "Failed to fetch GM info" },
      { status: 500 },
    );
  }
}
