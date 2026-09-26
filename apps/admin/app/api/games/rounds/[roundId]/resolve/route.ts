import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  isResolutionAction,
  MIN_REASON_LENGTH,
  resolutionActionNames,
  resolveRoundManually,
} from "@/lib/services/games/round-resolution.service";

/**
 * POST /api/games/rounds/[roundId]/resolve - end a stuck round by hand.
 *
 * THE ONLY WRITE IN THE ROUND INSPECTOR, and it deliberately cannot set a score. See
 * `round-resolution.service.ts` for why: scores enter through exactly one function and that
 * function lives in the main app, so a score box here would be the second door.
 *
 * The reason is mandatory and stored on an audit entry, following the manual-deposit and
 * emergency-cancel precedent. Reason it is not merely nice-to-have: voiding a round decides that
 * a player's attempt scores nothing, and six months later the only way to tell that from a
 * mistake is what the operator wrote down.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  // `guardSection`, never `requireAdminAuth` - the latter asks only whether the caller is an
  // admin at all, so an employee granted one unrelated section would pass it.
  const guard = await guardSection("round-inspector");
  if (!guard.ok) return guard.response;

  try {
    const { roundId } = await params;
    const body = (await request.json()) as {
      action?: unknown;
      reason?: string;
    };

    // `isResolutionAction`, which asks a Map. An object lookup here would reach the prototype
    // chain, so "toString" and "__proto__" would both have passed.
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

    const result = await resolveRoundManually({
      roundId,
      action,
      reason,
      adminEmail: guard.admin.email,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Written AFTER the change succeeded, so the log never claims something that did not happen.
    // `competition` rather than `settings` as the category: this is a decision about a contest's
    // outcome, and filing it under settings would hide it from anyone auditing a disputed result.
    await auditLogService.log({
      admin: guard.admin,
      action: "round_manually_resolved",
      category: "competition",
      description: `Round ${roundId} manually resolved to "${result.status}": ${reason}`,
      targetType: "other",
      targetId: roundId,
      newValue: result.status,
      metadata: { reason, action, unblockedSettlement: result.unblockedSettlement },
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
