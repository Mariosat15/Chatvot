import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { getSkillEvidence } from "@/lib/services/games/skill-evidence.service";
import { MIN_PAIRS_FOR_EVIDENCE } from "@/lib/services/games/skill-evidence-stats";

/**
 * GET /api/games/skill-evidence - per-title skill evidence from settled contests.
 *
 * Read-only and derived on every request, like `/api/games/performance`. It sits under
 * its own section because the report is evidence prepared for counsel and regulators,
 * which is a different trust from running the catalogue. It carries no money and no
 * player identities, only aggregate figures.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardSection("skill-evidence");
  if (!guard.ok) return guard.response;

  try {
    const titles = await getSkillEvidence();
    return NextResponse.json({
      success: true,
      titles,
      minPairs: MIN_PAIRS_FOR_EVIDENCE,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to compute skill evidence:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
