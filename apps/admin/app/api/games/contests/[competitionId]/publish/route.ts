import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { publishProviderContest } from "@/lib/services/game-providers/provider-contest-publish.service";

/**
 * POST /api/games/contests/[competitionId]/publish - make a draft provider contest visible.
 *
 * Guarded on `competitions` for the same reason the create route is: publishing is contest
 * administration, and it must not require the grant that reaches provider API credentials.
 *
 * There is deliberately no unpublish. Once a contest is visible a player can pay to enter
 * it, and hiding it again would leave paid entrants holding a seat in something they can no
 * longer see. Cancelling is the reversible operation, and it refunds - the same reasoning
 * that gives providers a disable switch and no delete.
 */

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  try {
    const { competitionId } = await params;
    const result = await publishProviderContest(competitionId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, errors: result.errors },
        { status: 400 },
      );
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "competition_updated",
      category: "competition",
      description: `Provider contest published - it is now visible to players and can be entered`,
      targetType: "competition",
      targetId: competitionId,
      previousValue: { status: "draft" },
      newValue: { status: "upcoming" },
    });

    return NextResponse.json({ success: true, warnings: result.warnings });
  } catch (error) {
    console.error("❌ Failed to publish provider contest:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
