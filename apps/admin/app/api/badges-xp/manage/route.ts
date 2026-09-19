import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import XPConfig from "@/database/models/xp-config.model";
import { getXPConfigFromDB } from "@/lib/services/badge-config-seed.service";
import { guardSection } from "@/lib/admin/section-route-guard";
import { getLeaderboardWeights } from "@/lib/services/leaderboard/leaderboard-weights.service";
import {
  GLOBAL_SCORE_COMPONENTS,
  normaliseGlobalWeights,
  weightsForDisplay,
} from "@/lib/services/leaderboard/global-score";

/*
  R89 - both handlers had no authorization of any kind.

  Granted by `badges`, the section owning the calling screen (BadgeXPManagementSection),
  never by a general grant: the POST rewrites the level ladder and every badge's XP value,
  which decides the level gate on paid contest entry.
*/

/**
 * GET /api/admin/badges-xp/manage
 * Get badge XP values and level progression configuration from database
 */
export async function GET() {
  const guard = await guardSection("badges");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
    const config = await getXPConfigFromDB();
    const weights = await getLeaderboardWeights();

    return NextResponse.json({
      success: true,
      badgeXP: config.badgeXP,
      levels: config.levels,
      // The seven global-rank shares, sent as whole percentages adding to 100,
      // alongside the component list so the screen never holds its own copy of
      // the labels or the default split.
      leaderboardWeights: weightsForDisplay(weights),
      leaderboardComponents: GLOBAL_SCORE_COMPONENTS,
    });
  } catch (error) {
    console.error("Error fetching XP configuration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch XP configuration" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/badges-xp/manage
 * Update badge XP values and/or level progression in database
 */
export async function POST(request: NextRequest) {
  const guard = await guardSection("badges");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
    const { badgeXP, levels, leaderboardWeights } = await request.json();

    // Update badge XP values if provided
    if (badgeXP) {
      await XPConfig.findOneAndUpdate(
        { configType: "badge_xp" },
        { data: badgeXP },
        { upsert: true, new: true },
      );
    }

    // Update level progression if provided
    if (levels) {
      await XPConfig.findOneAndUpdate(
        { configType: "level_progression" },
        { data: { levels } },
        { upsert: true, new: true },
      );
    }

    // Reason: normalise before storing so the stored document always adds to 100
    // and the reader never has to guess what a set summing to 93 meant. A
    // non-finite or negative share is dropped to zero by the normaliser rather
    // than refused, because these arrive from `parseFloat` on a form field.
    let storedWeights: Record<string, number> | undefined;
    if (leaderboardWeights && typeof leaderboardWeights === "object") {
      const normalised = normaliseGlobalWeights(
        leaderboardWeights as Record<string, unknown>,
      );
      await XPConfig.findOneAndUpdate(
        { configType: "leaderboard_weights" },
        { data: { weights: normalised }, isActive: true },
        { upsert: true, new: true },
      );
      storedWeights = Object.fromEntries(
        weightsForDisplay(normalised).map((w) => [w.id, w.percent]),
      );
    }

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully!",
      badgeXP,
      levels,
      leaderboardWeights: storedWeights,
    });
  } catch (error) {
    console.error("Error updating XP configuration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update XP configuration" },
      { status: 500 },
    );
  }
}
