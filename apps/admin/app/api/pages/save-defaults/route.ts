import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { savePageDefaults } from "@/lib/services/whitelabel-defaults.service";

/**
 * POST /api/pages/save-defaults — Save current pages as defaults.
 * These persist in data/defaults/pages.json and survive DB resets.
 */
export async function POST() {
  try {
    // Reason: SitePagesSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("site-pages");
    if (!guard.ok) return guard.response;

    const result = await savePageDefaults();
    return NextResponse.json({
      success: true,
      message: `Saved ${result.count} pages as defaults`,
      path: result.path,
    });
  } catch (error) {
    console.error("❌ Error saving page defaults:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save page defaults" },
      { status: 500 },
    );
  }
}
