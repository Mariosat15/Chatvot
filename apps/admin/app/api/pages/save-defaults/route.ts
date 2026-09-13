import { NextResponse } from "next/server";
import { savePageDefaults } from "@/lib/services/whitelabel-defaults.service";

/**
 * POST /api/pages/save-defaults — Save current pages as defaults.
 * These persist in data/defaults/pages.json and survive DB resets.
 */
export async function POST() {
  try {
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
