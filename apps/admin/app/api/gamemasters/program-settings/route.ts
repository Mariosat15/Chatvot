import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { auditLogService } from "@/lib/services/audit-log.service";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * The Gamemaster Program v2 switches (`External game plans/24` s6.1):
 * - `gmJoinEnabled` opens the Game Master leaderboard and the Join GM button (step 4);
 * - `gmPrivateContestsEnabled` lets a permitted Game Master CREATE a private contest (step 5).
 *   The entry guard and the discovery filters run whatever it says.
 *
 * Reason: a named allow-list in a `Set`, never a spread of the body - a spread would let
 * this route write any WhiteLabel field, and `"constructor"` would pass an object lookup.
 */
const PROGRAM_SWITCHES: ReadonlySet<string> = new Set([
  "gmJoinEnabled",
  "gmPrivateContestsEnabled",
]);

interface ProgramSwitches {
  gmJoinEnabled: boolean;
  gmPrivateContestsEnabled: boolean;
}

async function readSwitches(): Promise<ProgramSwitches> {
  const doc = await WhiteLabel.findOne()
    .select({ gmJoinEnabled: 1, gmPrivateContestsEnabled: 1 })
    .lean<{ gmJoinEnabled?: unknown; gmPrivateContestsEnabled?: unknown }>();
  // Reason: only a stored `true` is on - absent, null or a legacy string all read as off,
  // matching the player app's `isGmJoinEnabled()` / `isGmPrivateContestsEnabled()`.
  return {
    gmJoinEnabled: doc?.gmJoinEnabled === true,
    gmPrivateContestsEnabled: doc?.gmPrivateContestsEnabled === true,
  };
}

export async function GET() {
  try {
    const guard = await guardSection("gamemaster-management");
    if (!guard.ok) return guard.response;
    await connectToDatabase();
    return NextResponse.json({ success: true, switches: await readSwitches() });
  } catch (error) {
    console.error("❌ Read Game Master program settings failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("gamemaster-management");
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const updates = new Map<string, boolean>();
    for (const [key, value] of Object.entries(body)) {
      // Reason: an unknown field is REFUSED with its name, never dropped - dropping makes a
      // typo look like a save that did nothing.
      if (!PROGRAM_SWITCHES.has(key)) {
        return NextResponse.json({ success: false, error: `Unknown setting: ${key}` }, { status: 400 });
      }
      if (typeof value !== "boolean") {
        return NextResponse.json({ success: false, error: `${key} must be true or false.` }, { status: 400 });
      }
      updates.set(key, value);
    }
    if (updates.size === 0) {
      return NextResponse.json({ success: false, error: "Nothing to update." }, { status: 400 });
    }

    await connectToDatabase();
    const previous = await readSwitches();
    // Reason: upsert, so the switch can be turned on for a deployment whose settings
    // document has never been saved - otherwise the first save 404s silently.
    await WhiteLabel.updateOne({}, { $set: Object.fromEntries(updates) }, { upsert: true });
    const next = await readSwitches();

    try {
      await auditLogService.logSettingsUpdated(
        {
          id: guard.admin.id,
          email: guard.admin.email,
          name: guard.admin.name ?? guard.admin.email.split("@")[0],
          role: guard.admin.role ?? "admin",
        },
        "Game Master Program",
        previous,
        next,
      );
    } catch (auditError) {
      console.error("❌ Failed to audit Game Master program settings:", auditError);
    }

    return NextResponse.json({ success: true, switches: next });
  } catch (error) {
    console.error("❌ Update Game Master program settings failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
