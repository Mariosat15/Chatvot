import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SiteVisit from "@/database/models/site-visit.model";
import BlockedVisitor from "@/database/models/blocked-visitor.model";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * DELETE /api/visitors/clear — Clear all site visit data and optionally block rules
 * Query params:
 *   ?includeBlocks=true — Also clear all block rules
 */
export async function DELETE(req: Request) {
  try {
    // Reason: VisitorAnalyticsSection owns this destructive clear; section grant is the auth answer.
    const guard = await guardSection("visitors");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const includeBlocks = searchParams.get("includeBlocks") === "true";

    const results: Record<string, number> = {};

    // Clear all site visits
    const visitResult = await SiteVisit.deleteMany({});
    results.visitsDeleted = visitResult.deletedCount;

    // Optionally clear block rules
    if (includeBlocks) {
      const blockResult = await BlockedVisitor.deleteMany({});
      results.blocksDeleted = blockResult.deletedCount;
    }

    console.log("🗑️ [Visitors] Cleared data:", results);
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("❌ Error clearing visitor data:", error);
    return NextResponse.json(
      { error: "Failed to clear data" },
      { status: 500 },
    );
  }
}
