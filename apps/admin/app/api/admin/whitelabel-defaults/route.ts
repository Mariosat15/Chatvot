import { NextRequest, NextResponse } from "next/server";
import {
  saveBadgeDefaults,
  saveXPDefaults,
  saveMilestoneDefaults,
  seedBadgesFromDefaults,
  seedXPFromDefaults,
  seedMilestonesFromDefaults,
  getDefaultsSummary,
} from "@/lib/services/whitelabel-defaults.service";

/**
 * GET /api/admin/whitelabel-defaults
 * Returns summary of which defaults have been saved and when
 */
export async function GET() {
  try {
    const summary = getDefaultsSummary();
    return NextResponse.json({ success: true, defaults: summary });
  } catch (error) {
    console.error("[Defaults API] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/whitelabel-defaults
 *
 * Actions:
 *   save    - Snapshot current DB state to JSON files
 *   restore - Restore from saved JSON files into DB
 *
 * Types: badges, xp_config, milestones, all
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type } = body;

    if (!action || !type) {
      return NextResponse.json(
        { success: false, error: "Missing action or type" },
        { status: 400 },
      );
    }

    const validTypes = ["badges", "xp_config", "milestones", "all"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // ─── SAVE ─────────────────────────────────────────────────────────
    if (action === "save") {
      const results: Record<string, any> = {};

      if (type === "badges" || type === "all") {
        results.badges = await saveBadgeDefaults();
      }
      if (type === "xp_config" || type === "all") {
        results.xp_config = await saveXPDefaults();
      }
      if (type === "milestones" || type === "all") {
        results.milestones = await saveMilestoneDefaults();
      }

      return NextResponse.json({
        success: true,
        message: `Saved ${type} defaults successfully`,
        results,
        summary: getDefaultsSummary(),
      });
    }

    // ─── RESTORE ──────────────────────────────────────────────────────
    if (action === "restore") {
      const results: Record<string, boolean> = {};

      if (type === "badges" || type === "all") {
        results.badges = await seedBadgesFromDefaults();
      }
      if (type === "xp_config" || type === "all") {
        results.xp_config = await seedXPFromDefaults();
      }
      if (type === "milestones" || type === "all") {
        results.milestones = await seedMilestonesFromDefaults();
      }

      const restoredTypes = Object.entries(results)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const skippedTypes = Object.entries(results)
        .filter(([, v]) => !v)
        .map(([k]) => k);

      return NextResponse.json({
        success: true,
        message: restoredTypes.length > 0
          ? `Restored: ${restoredTypes.join(", ")}${skippedTypes.length > 0 ? `. No saved defaults for: ${skippedTypes.join(", ")}` : ""}`
          : "No saved defaults found. Use hardcoded constants as fallback.",
        results,
        summary: getDefaultsSummary(),
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Must be 'save' or 'restore'" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[Defaults API] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
