import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import Incident from "@/database/models/incident.model";
import { isCompetitionIdShaped } from "@/lib/utils/competition-id";
import { resettleProviderCompetition } from "@/lib/services/settlement/provider-resettle.service";

/**
 * POST /api/competitions/[id]/re-settle
 *
 * Void disputed provider rounds on a completed contest, re-rank from remaining
 * scores, claw back old prizes and pay the corrected board (`06` s7.2 / X9).
 *
 * Requires `competitions` section access and an incident id for the audit trail.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;

    const { id: competitionId } = await params;
    if (!isCompetitionIdShaped(competitionId)) {
      return NextResponse.json(
        { error: "Invalid competition id." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { incidentId, roundIds, reason } = body ?? {};

    if (!incidentId || typeof incidentId !== "string") {
      return NextResponse.json(
        { error: "incidentId is required for the audit trail." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return NextResponse.json(
        { error: "Incident not found." },
        { status: 404 },
      );
    }

    const result = await resettleProviderCompetition({
      competitionId,
      roundIds: Array.isArray(roundIds) ? roundIds.map(String) : [],
      incidentId,
      reason: typeof reason === "string" ? reason : "",
      adminId: guard.admin.id,
      adminEmail: guard.admin.email,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Re-settle refused." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Re-settle route failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
