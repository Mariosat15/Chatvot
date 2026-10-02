import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import GameRound from "@/database/models/games/game-round.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  isResolutionAction,
  MIN_REASON_LENGTH,
  resolutionActionNames,
  resolveRoundManually,
} from "@/lib/services/games/round-resolution.service";

/**
 * POST /api/games/rounds/[roundId]/resolve - end a stuck PRACTICE round by hand.
 *
 * PRACTICE ONLY from this route. Paid competition and challenge rounds are ended from
 * Incident Management (`POST /api/incidents/[id]/act`), which records the reason on the
 * incident. The Round Inspector dialog withholds those and only offers a real ending for
 * practice - this route is the enforcement half of that, so a crafted request cannot skip
 * the hub for a money-bearing round.
 *
 * IT CANNOT ENTER A SCORE. See `round-resolution.service.ts`.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const guard = await guardSection("round-inspector");
  if (!guard.ok) return guard.response;

  try {
    const { roundId } = await params;
    const body = (await request.json()) as {
      action?: unknown;
      reason?: string;
    };

    const action = body.action;
    if (!isResolutionAction(action)) {
      return NextResponse.json(
        { error: `Choose one of: ${resolutionActionNames().join(", ")}.` },
        { status: 400 },
      );
    }

    const reason = (body.reason ?? "").trim();
    if (reason.length < MIN_REASON_LENGTH) {
      return NextResponse.json(
        {
          error: `A reason of at least ${MIN_REASON_LENGTH} characters is required.`,
        },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const round = await GameRound.findOne({ roundId })
      .select("contestType contestId")
      .lean<{ contestType?: string; contestId?: unknown } | null>();
    if (!round) {
      return NextResponse.json({ error: "No round with that id." }, { status: 404 });
    }
    // Reason: a practice round has no money and no incident to hang the reason on. Everything
    // else must go through the hub, which is why the dialog withholds it too.
    if (round.contestType !== "practice" || round.contestId) {
      return NextResponse.json(
        {
          error:
            "Paid rounds are ended from Incident Management, so the reason stays with the incident.",
        },
        { status: 403 },
      );
    }

    const result = await resolveRoundManually({
      roundId,
      action,
      reason,
      adminEmail: guard.admin.email,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "round_manually_resolved",
      category: "competition",
      description: `Practice round ${roundId} manually resolved to "${result.status}": ${reason}`,
      targetType: "other",
      targetId: roundId,
      newValue: result.status,
      metadata: { reason, action, practice: true },
    });

    return NextResponse.json({
      success: true,
      status: result.status,
      unblockedSettlement: result.unblockedSettlement,
    });
  } catch (error) {
    console.error("❌ Failed to resolve round:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
