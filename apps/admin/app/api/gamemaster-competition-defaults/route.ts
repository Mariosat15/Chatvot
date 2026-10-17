import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import {
  loadGameMasterCompetitionDefaults,
  saveGameMasterCompetitionDefaults,
} from "@/lib/services/gamemaster/competition-defaults.service";
import { validateCompetitionDefaultsInput } from "@/lib/services/gamemaster/competition-defaults-apply";

const FALLBACK_ERROR = "Something went wrong. Please contact support.";

// GET - every competition option with the admin's default and its "Game Master can change" switch
export async function GET(_request: NextRequest) {
  const guard = await guardSection("gm-competition-defaults");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
    const options = await loadGameMasterCompetitionDefaults();
    return NextResponse.json({ success: true, options });
  } catch (error) {
    console.error("❌ [GM competition defaults] GET failed:", error);
    return NextResponse.json({ success: false, error: FALLBACK_ERROR }, { status: 500 });
  }
}

// PUT - save the list. Every entry is validated against the option's own bounds, and a bad
// entry refuses the whole save with each problem named, so nothing is half-written.
export async function PUT(request: NextRequest) {
  const guard = await guardSection("gm-competition-defaults");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const checked = validateCompetitionDefaultsInput(
    body && typeof body === "object" ? (body as { options?: unknown }).options : undefined,
  );
  if (!checked.ok) {
    return NextResponse.json(
      { success: false, error: checked.errors.join(" "), errors: checked.errors },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const options = await saveGameMasterCompetitionDefaults(checked.entries, guard.admin.email);
    return NextResponse.json({ success: true, options });
  } catch (error) {
    console.error("❌ [GM competition defaults] PUT failed:", error);
    return NextResponse.json({ success: false, error: FALLBACK_ERROR }, { status: 500 });
  }
}
