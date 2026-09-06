import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import LandingPageVisit from "@/database/models/landing-page-visit.model";
import LandingPage from "@/database/models/landing-page.model";

/**
 * DELETE /api/landing-pages/analytics/clear — Clear all LP visit analytics
 * Resets visit counters on landing pages and deletes all visit records.
 */
export async function DELETE() {
  try {
    await connectToDatabase();

    // Reset counters on all landing pages
    await LandingPage.updateMany(
      {},
      { $set: { totalVisits: 0, uniqueVisitors: 0, totalSignups: 0 } },
    );

    // Delete all visit records
    const result = await LandingPageVisit.deleteMany({});

    console.log(
      `🗑️ [LP Analytics] Cleared ${result.deletedCount} visit records`,
    );

    return NextResponse.json({
      success: true,
      deletedVisits: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ Error clearing LP analytics:", error);
    return NextResponse.json(
      { error: "Failed to clear analytics" },
      { status: 500 },
    );
  }
}
