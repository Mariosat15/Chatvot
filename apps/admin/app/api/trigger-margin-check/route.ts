/**
 * Admin API to manually trigger margin checks and liquidate positions
 * below the configured stopout level
 *
 * GET /api/trigger-margin-check
 */

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { checkMarginCalls } from "@/lib/actions/trading/position.actions";
import Competition from "@/database/models/trading/competition.model";
import { guardSection } from "@/lib/admin/section-route-guard";

export async function GET() {
  try {
    // Reason: no UI caller; margin liquidation belongs with TradingRiskSection's grant.
    const guard = await guardSection("trading-risk");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const activeCompetitions = await Competition.find({
      status: "active",
    })
      .select("_id slug name")
      .lean();

    if (!activeCompetitions || activeCompetitions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active competitions to check",
        competitions: 0,
      });
    }

    const results = [];

    for (const competition of activeCompetitions) {
      const competitionId = String((competition as { _id: unknown })._id);
      const competitionName = (competition as { name?: string }).name;

      try {
        await checkMarginCalls(competitionId);
        results.push({
          id: competitionId,
          name: competitionName,
          status: "checked",
        });
      } catch (error) {
        console.error(`Error checking ${competitionName}:`, error);
        results.push({
          id: competitionId,
          name: competitionName,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${activeCompetitions.length} active competition(s)`,
      competitions: results,
    });
  } catch (error) {
    console.error("❌ Error triggering margin check:", error);
    return NextResponse.json(
      {
        message: "Failed to trigger margin check",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
