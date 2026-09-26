import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  parseScoringRulesInput,
  setGameScoringRules,
} from "@/lib/services/game-providers/game-scoring-rules.service";

/**
 * PATCH /api/games/providers/[providerKey]/games/scoring - which scores win a prize
 *
 * A FOURTH route beside `games` (the Live on ChartVolt switch), `games/content` (copy and
 * artwork) and `games/play-style` (whether everybody plays at once), for the reason the
 * content route already records: one route taking any of the four shapes would have to work
 * out which edit it was being asked for from the fields present, and getting that wrong here
 * changes who is paid out of a pot people have bought into.
 *
 * `scoring` is a literal segment and cannot collide with a provider key, because the segment
 * that varies is `[providerKey]` above it - the same reasoning as `content` and `play-style`,
 * and the reason provider health had to move out from under `providers/`.
 */

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  // `guardSection`, never `verifyAdminAuth` or `verifyAdminToken`: those ask whether the
  // caller is an admin at all, so an employee granted one unrelated section passes them.
  // Nine instances of that confusion are now on record in `17`, the most recent being the
  // Image Optimizer's two unguarded handlers (R57). This is the grant that reveals the screen.
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      gameCode?: string;
      rules?: unknown;
    };

    if (!body.gameCode || typeof body.gameCode !== "string") {
      return NextResponse.json({ error: "A game code is required." }, { status: 400 });
    }

    const parsed = parseScoringRulesInput(body.rules);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await setGameScoringRules(providerKey, body.gameCode, parsed.input);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Reason the description spells the rule out in words rather than logging the field
    // names: this is the line somebody reads after a contest paid a player they did not
    // expect, and "zeroIsValidResult: true" requires them to already know what that means.
    // The two halves are named separately because they are independent decisions.
    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Prize eligibility for "${providerKey}/${body.gameCode}": a score of zero ${
        result.zeroIsValidResult ? "COUNTS as a result" : "wins nothing"
      }; ${
        result.minimumEligibleScore === undefined
          ? "no minimum score"
          : `a score must reach ${result.minimumEligibleScore}`
      }`,
      targetType: "settings",
      targetId: `${providerKey}/${body.gameCode}`,
      newValue: {
        zeroIsValidResult: result.zeroIsValidResult,
        minimumEligibleScore: result.minimumEligibleScore ?? null,
        scoreUnit: result.scoreUnit ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      zeroIsValidResult: result.zeroIsValidResult,
      minimumEligibleScore: result.minimumEligibleScore ?? null,
      scoreUnit: result.scoreUnit ?? null,
    });
  } catch (error) {
    console.error("❌ Failed to update game scoring rules:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
