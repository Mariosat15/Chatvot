import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { notificationService } from "@/lib/services/notification.service";

/**
 * POST /api/competitions/[id]/pause
 * Pause or resume an active competition
 *
 * Body: { action: 'pause' | 'resume', reason?: string }
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

    // Find the competition
    const competition = await Competition.findById(id);
    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    // Only active competitions can be paused/resumed
    if (competition.status !== "active") {
      return NextResponse.json(
        {
          error: `Cannot ${action} a competition with status: ${competition.status}. Only active competitions can be paused/resumed.`,
        },
        { status: 400 },
      );
    }

    const now = new Date();

    /*
      WHAT THE PLAYER IS TOLD, which must not say "trading" for a game with no market.
      X6.5 is the wording pass; this one cannot wait for it, because the notification is
      generated here and sent immediately, and a puzzle player told "trading is suspended" has
      been handed a sentence about a product they did not buy.

      Derived from the stored label via the same helper the list and edit paths use - never
      from caller input, for the same reason the market-hours capability gate is not allowed
      to take its deciding value from a request. An unlabelled contest resolves to trading,
      which is invariant 5 and is correct for every existing row.
    */
    const isProviderGame = hasProviderGameLabel(competition);
    const activityNoun = isProviderGame ? "Play" : "Trading";

    if (action === "pause") {
      // Check if already paused
      if (competition.isPaused) {
        return NextResponse.json(
          { error: "Competition is already paused" },
          { status: 400 },
        );
      }

      if (!reason) {
        return NextResponse.json(
          { error: "Pause reason is required" },
          { status: 400 },
        );
      }

      // Pause the competition
      competition.isPaused = true;
      competition.pausedAt = now;
      competition.pauseReason = reason;

      // Add to pause history
      if (!competition.pauseHistory) {
        competition.pauseHistory = [];
      }
      competition.pauseHistory.push({
        pausedAt: now,
        reason,
        pausedBy: admin.id,
      });

      await competition.save();

      // Notify all participants
      const participants = await CompetitionParticipant.find({
        competitionId: id,
        status: { $in: ["active", "joined"] },
      }).select("userId");

      for (const participant of participants) {
        await notificationService.createCustom({
          userId: participant.userId.toString(),
          type: "competition_paused",
          title: "⏸️ Competition Paused",
          message: `${competition.name} has been paused. ${activityNoun} is temporarily suspended. Reason: ${reason}`,
          icon: "pause-circle",
          category: "trading",
          priority: "urgent",
          color: "yellow",
        });
      }

      console.log(
        `⏸️ [Competition] Paused: ${competition.name} (${id}) - Reason: ${reason}`,
      );

      return NextResponse.json({
        success: true,
        message: "Competition paused successfully",
        competition: {
          id: competition._id,
          name: competition.name,
          isPaused: competition.isPaused,
          pausedAt: competition.pausedAt,
          pauseReason: competition.pauseReason,
        },
      });
    } else if (action === "resume") {
      // Check if actually paused
      if (!competition.isPaused) {
        return NextResponse.json(
          { error: "Competition is not paused" },
          { status: 400 },
        );
      }

      // Calculate pause duration
      const pausedAt = competition.pausedAt || now;
      const pauseDuration = now.getTime() - pausedAt.getTime();

      // Update the competition
      competition.isPaused = false;
      competition.pauseReason = undefined;

      // Add pause duration to total
      competition.totalPauseDuration =
        (competition.totalPauseDuration || 0) + pauseDuration;

      // Extend end time by pause duration to maintain fair competition time
      const currentEndTime = new Date(competition.endTime);
      competition.endTime = new Date(currentEndTime.getTime() + pauseDuration);

      /*
        AND THE PLAY WINDOW, because for a provider contest `endTime` is not what gates play.
        `createRound` enforces `playWindowEnd`; the launch service enforces `playWindowStart`.
        Extending only `endTime` gave the fairness compensation to trading and silently
        withheld it from every provider game - the contest ran longer while the window players
        actually play inside stayed exactly as short, so a two-hour pause simply consumed two
        hours of their playing time. No error, and it reads as correct because the field the
        code extends is the one called "end".

        `playWindowStart` moves only while it is still in the future. Shifting a window that
        has already opened would re-close it, refusing play that was legitimately available a
        moment earlier - which is worse than not compensating at all.
      */
      if (competition.playWindowEnd) {
        competition.playWindowEnd = new Date(
          new Date(competition.playWindowEnd).getTime() + pauseDuration,
        );
      }
      if (
        competition.playWindowStart &&
        new Date(competition.playWindowStart) > now
      ) {
        competition.playWindowStart = new Date(
          new Date(competition.playWindowStart).getTime() + pauseDuration,
        );
      }

      // Update pause history
      if (competition.pauseHistory && competition.pauseHistory.length > 0) {
        const lastPause =
          competition.pauseHistory[competition.pauseHistory.length - 1];
        if (!lastPause.resumedAt) {
          lastPause.resumedAt = now;
          lastPause.duration = pauseDuration;
          lastPause.resumedBy = admin.id;
        }
      }

      await competition.save();

      // Notify all participants
      const participants = await CompetitionParticipant.find({
        competitionId: id,
        status: { $in: ["active", "joined"] },
      }).select("userId");

      for (const participant of participants) {
        await notificationService.createCustom({
          userId: participant.userId.toString(),
          type: "competition_resumed",
          title: "▶️ Competition Resumed",
          message: `${competition.name} has been resumed. ${activityNoun} is now active again. End time extended by ${Math.round(pauseDuration / 60000)} minutes.`,
          icon: "play-circle",
          category: "trading",
          priority: "high",
          color: "green",
        });
      }

      console.log(
        `▶️ [Competition] Resumed: ${competition.name} (${id}) - Paused for ${Math.round(pauseDuration / 60000)} minutes`,
      );

      return NextResponse.json({
        success: true,
        message: "Competition resumed successfully",
        competition: {
          id: competition._id,
          name: competition.name,
          isPaused: competition.isPaused,
          totalPauseDuration: competition.totalPauseDuration,
          newEndTime: competition.endTime,
          pauseDuration,
        },
      });
    }
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
