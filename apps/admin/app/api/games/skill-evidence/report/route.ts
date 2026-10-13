import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { describeEvidenceRange, parseEvidenceRange } from "@/lib/admin/skill-evidence-range";
import { getSkillEvidence } from "@/lib/services/games/skill-evidence.service";
import { MIN_PAIRS_FOR_EVIDENCE } from "@/lib/services/games/skill-evidence-stats";
import { draftNarrative } from "@/lib/services/games/skill-evidence-ai";
import { renderSkillEvidencePdf } from "@/lib/services/games/skill-evidence-pdf";

/**
 * POST /api/games/skill-evidence/report - the regulator PDF for a date range.
 *
 * Same section as the screen, because it is the same evidence in another format. It is a
 * POST rather than a GET because it calls a paid AI model: a GET is prefetched and retried
 * by browsers and proxies, and every one of those would be a billed call.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await guardSection("skill-evidence");
  if (!guard.ok) return guard.response;

  let body: { from?: unknown; to?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // An empty body means the whole history, the same as the screen with no dates set.
  }
  const parsed = parseEvidenceRange(
    typeof body.from === "string" ? body.from : null,
    typeof body.to === "string" ? body.to : null,
  );
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const titles = await getSkillEvidence(parsed.range);
    const period = describeEvidenceRange(parsed.from, parsed.to);
    const narrative = await draftNarrative(titles, MIN_PAIRS_FOR_EVIDENCE, period);
    const generatedAt = new Date();
    const pdf = await renderSkillEvidencePdf(titles, narrative, {
      period,
      generatedAt,
      preparedBy: guard.admin.name ? `${guard.admin.name} (${guard.admin.email})` : guard.admin.email,
      minPairs: MIN_PAIRS_FOR_EVIDENCE,
    });
    const name = `skill-evidence-${parsed.from ?? "start"}_to_${parsed.to ?? generatedAt.toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "X-Narrative-Source": narrative.source,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("❌ Failed to build skill evidence report:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
