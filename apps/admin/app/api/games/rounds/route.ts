import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { listRoundsNeedingAttention } from "@/lib/services/games/round-resolution.service";

/**
 * GET /api/games/rounds - the rounds an operator needs to make a decision about.
 *
 * Read-only. The one write in this area is the resolution route beside it, which is separately
 * guarded - so a reviewer can see at a glance that listing and acting are different handlers.
 */

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  // `guardSection`, never `requireAdminAuth`. The latter asks only whether the caller is an
  // admin at all, so an employee granted one unrelated section would pass it - the fourth
  // instance of that mistake in this codebase, which is why it is worth naming here.
  const guard = await guardSection("round-inspector");
  if (!guard.ok) return guard.response;

  try {
    const rounds = await listRoundsNeedingAttention();
    return NextResponse.json({ success: true, rounds });
  } catch (error) {
    console.error("❌ Failed to list rounds needing attention:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
