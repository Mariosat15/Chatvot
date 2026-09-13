import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import mongoose from "mongoose";
import { auditLogService } from "@/lib/services/audit-log.service";
import { guardSection } from "@/lib/admin/section-route-guard";
import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";
import { filterTradingCompetitionUpdate } from "@/lib/admin/competition-update-fields";

/**
 * Read, edit and delete one competition.
 *
 * GUARDED ON `competitions`, NOT MERELY ON "IS AN ADMIN". This file used to carry its own
 * `verifyAdminToken`, which verified the JWT signature and nothing else. Every employee is
 * issued an `admin_token`, so a support employee granted only `messaging` could delete any
 * contest and rewrite any field on it. That hand-rolled check also skipped the four
 * revocations `verifyAdminAuth` performs - deleted admin, disabled admin, locked-out admin
 * and force-logout - so a sacked employee's cookie kept working until it expired.
 *
 * `guardSection` is the same helper the provider and round-inspector routes use, and it maps
 * the two refusals to different statuses: 401 not signed in, 403 signed in without the
 * grant.
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;
    const admin = guard.admin;

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid competition ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Check if competition exists
    const competition = await Competition.findById(id);
    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    // Check if competition is active with participants
    if (
      competition.status === "active" &&
      competition.currentParticipants > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot delete active competition with participants. Cancel it first.",
        },
        { status: 400 },
      );
    }

    // Delete all participants
    await CompetitionParticipant.deleteMany({ competitionId: id });

    // Delete the competition
    await Competition.findByIdAndDelete(id);

    console.log(`✅ Competition deleted: ${competition.name} (ID: ${id})`);

    // Log audit action
    try {
      await auditLogService.logCompetitionDeleted(
        {
          id: admin.id,
          email: admin.email,
          name: admin.name ?? admin.email.split("@")[0],
          role: admin.role ?? "admin",
        },
        id,
        competition.name,
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Competition deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting competition:", error);
    return NextResponse.json(
      { error: "Failed to delete competition" },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid competition ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const competition = await Competition.findById(id).lean();

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      competition: JSON.parse(JSON.stringify(competition)),
    });
  } catch (error) {
    console.error("Error fetching competition:", error);
    return NextResponse.json(
      { error: "Failed to fetch competition" },
      { status: 500 },
    );
  }
}

/**
 * Edit a TRADING competition.
 *
 * A provider contest is refused here and edited through `PATCH /api/games/contests/[id]`
 * instead. The refusal is the server-side half of the withheld Edit button on the
 * competitions list: this route's body shape is the trading editor's, so applying it to a
 * provider contest would write `startingCapital` and `leverageAllowed` onto a puzzle and
 * leave the provider settings unreviewed.
 *
 * The check is `hasProviderGameLabel` - the label alone - deliberately, and NOT the stricter
 * `isProviderContest`. A provider contest whose keys are missing cannot launch a round, but
 * it is still not a trading contest, and it is precisely the row an operator would try to
 * "fix" by saving it through this form.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;
    const admin = guard.admin;

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid competition ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const competition = await Competition.findById(id);
    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    if (hasProviderGameLabel(competition)) {
      return NextResponse.json(
        {
          error:
            "This is a provider-game contest. Edit it from the game contest editor, not the trading form.",
        },
        { status: 400 },
      );
    }

    // Don't allow editing if competition has started and has participants
    if (
      competition.status === "active" &&
      competition.currentParticipants > 0
    ) {
      return NextResponse.json(
        { error: "Cannot edit active competition with participants" },
        { status: 400 },
      );
    }

    const body = await request.json();

    // Named allow-list, never a blind assign. See `competition-update-fields.ts` for why
    // unknown keys are refused rather than dropped.
    const filtered = filterTradingCompetitionUpdate(body);
    if (!filtered.ok) {
      return NextResponse.json({ error: filtered.error }, { status: 400 });
    }

    Object.assign(competition, filtered.update);
    await competition.save();

    console.log(`✅ Competition updated: ${competition.name} (ID: ${id})`);

    // Log audit action
    try {
      await auditLogService.logCompetitionUpdated(
        {
          id: admin.id,
          email: admin.email,
          name: admin.name ?? admin.email.split("@")[0],
          role: admin.role ?? "admin",
        },
        id,
        competition.name,
        filtered.update,
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Competition updated successfully",
      competition: JSON.parse(JSON.stringify(competition)),
    });
  } catch (error) {
    console.error("Error updating competition:", error);
    return NextResponse.json(
      { error: "Failed to update competition" },
      { status: 500 },
    );
  }
}
