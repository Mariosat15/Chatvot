import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import {
  pauseContest,
  resumeContest,
} from "@/lib/services/games/contest-pause.service";

/**
 * POST /api/competitions/[id]/pause
 * Pause or resume an active competition
 *
 * Body: { action: 'pause' | 'resume', reason?: string }
 *
 * THE FIELD UPDATES AND EXTEND MATH live in `contest-pause.service.ts` (mirrored),
 * so the X9 outage worker and this route cannot drift. This file keeps auth,
 * request parsing, and the activity-noun derivation from the stored label.
 *
 * TWO THINGS WERE WRONG HERE UNTIL 7 SEPTEMBER 2026, and the second is the interesting one.
 *
 * 1. `verifyAdminAuth` is token validity, not section access, so an employee granted one
 *    unrelated section could freeze a live contest. Sixth instance of that class; see
 *    `finalize-old-competitions/route.ts` for the list.
 *
 * 2. **Pausing a provider contest did nothing.** `isPaused` is a trading-era field that
 *    `order.actions.ts` has honoured since long before this programme, and nothing in
 *    `round-launch.service.ts` read it. So this route returned success, the admin screen
 *    showed a paused badge, every participant was notified - and players carried on starting
 *    rounds, spending paid attempts and running up per-round provider charges. The control
 *    appeared to work and did nothing, which is the failure this codebase keeps producing.
 *    The gate now lives in the launch service, which is where the attempt is spent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;
    const admin = guard.admin;

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !["pause", "resume"].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pause" or "resume"' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const competition = await Competition.findById(id).select(
      "name gameType status",
    );
    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    /*
      WHAT THE PLAYER IS TOLD, which must not say "trading" for a game with no market.
      Derived from the stored label via the same helper the list and edit paths use - never
      from caller input.
    */
    const isProviderGame = hasProviderGameLabel(competition);
    const activityNoun = isProviderGame ? "Play" : "Trading";

    if (action === "pause") {
      const result = await pauseContest({
        competitionId: id,
        reason: reason ?? "",
        pausedBy: admin.id,
        activityNoun,
      });
      if (!result.success) {
        const status =
          result.code === "not_found"
            ? 404
            : result.code === "reason_required" ||
                result.code === "already_paused" ||
                result.code === "not_active"
              ? 400
              : 400;
        return NextResponse.json({ error: result.error }, { status });
      }

      console.log(
        `⏸️ [Competition] Paused: ${result.name} (${id}) - Reason: ${result.pauseReason}`,
      );

      return NextResponse.json({
        success: true,
        message: "Competition paused successfully",
        competition: {
          id: result.competitionId,
          name: result.name,
          isPaused: result.isPaused,
          pausedAt: result.pausedAt,
          pauseReason: result.pauseReason,
        },
      });
    }

    const result = await resumeContest({
      competitionId: id,
      resumedBy: admin.id,
      activityNoun,
    });
    if (!result.success) {
      const status = result.code === "not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    console.log(
      `▶️ [Competition] Resumed: ${result.name} (${id}) - Paused for ${Math.round(result.pauseDurationMs / 60000)} minutes`,
    );

    return NextResponse.json({
      success: true,
      message: "Competition resumed successfully",
      competition: {
        id: result.competitionId,
        name: result.name,
        isPaused: result.isPaused,
        totalPauseDuration: result.totalPauseDuration,
        newEndTime: result.endTime,
        pauseDuration: result.pauseDurationMs,
        // Reason: operator confirmation that the play-window compensation landed (R41).
        playWindowStart: result.playWindowStart,
        playWindowEnd: result.playWindowEnd,
      },
    });
  } catch (error) {
    console.error("Error in competition pause/resume:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/competitions/[id]/pause
 * Get pause status for a competition
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Guarded per-section like the POST beside it. A read of pause history is not sensitive,
    // but a file whose POST is guarded and whose GET is not is exactly the shape that passes
    // a review and a "does this file mention the guard" test while leaving a handler open -
    // which is why the test counts exported handlers against guards.
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    await connectToDatabase();

    const competition = await Competition.findById(id).select(
      "name isPaused pausedAt pauseReason totalPauseDuration pauseHistory status endTime playWindowStart playWindowEnd",
    );

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      pauseStatus: {
        isPaused: competition.isPaused || false,
        pausedAt: competition.pausedAt,
        pauseReason: competition.pauseReason,
        totalPauseDuration: competition.totalPauseDuration || 0,
        pauseHistory: competition.pauseHistory || [],
        status: competition.status,
        endTime: competition.endTime,
        // Returned because resume now extends these too, and an operator checking whether the
        // compensation landed needs to see the field that actually gates provider play.
        playWindowStart: competition.playWindowStart,
        playWindowEnd: competition.playWindowEnd,
      },
    });
  } catch (error) {
    console.error("Error getting pause status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
