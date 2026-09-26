import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import {
  getJourneySettings,
  setJourneySettings,
} from "@/lib/services/games/journey-settings";

/**
 * GET /api/journey/settings — master journey switch for the editor toggle.
 */
export async function GET() {
  try {
    const guard = await guardSection("journey-map");
    if (!guard.ok) return guard.response;

    const settings = await getJourneySettings();
    return NextResponse.json({ success: true, ...settings });
  } catch (error) {
    console.error("[journey/settings] GET failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/journey/settings — enable or disable the player journey system.
 */
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("journey-map");
    if (!guard.ok) return guard.response;

    const body = await request.json();
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "enabled must be a boolean" },
        { status: 400 },
      );
    }

    const settings = await setJourneySettings({ enabled: body.enabled });
    return NextResponse.json({ success: true, ...settings });
  } catch (error) {
    console.error("[journey/settings] PUT failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
