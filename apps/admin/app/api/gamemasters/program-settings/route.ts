import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  resolveFreePrivateEntryRule,
  type FreePrivateEntryRule,
} from "@/lib/utils/free-private-entry-rule";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * The Gamemaster Program v2 switches (`External game plans/24` s6.1):
 * - `gmJoinEnabled` opens the Game Master leaderboard and the Join GM button (step 4);
 * - `gmPrivateContestsEnabled` lets a permitted Game Master CREATE a private contest (step 5).
 *   The entry guard and the discovery filters run whatever it says.
 * - `gmFreePrivateContestsEnabled` lets a permitted Game Master CREATE a GM-funded private
 *   contest. Entry, settlement and refunds of one already created never read it.
 *
 * Reason: a named allow-list in a `Set`, never a spread of the body - a spread would let
 * this route write any WhiteLabel field, and `"constructor"` would pass an object lookup.
 */
const PROGRAM_SWITCHES: ReadonlySet<string> = new Set([
  "gmJoinEnabled",
  "gmPrivateContestsEnabled",
  "gmFreePrivateContestsEnabled",
]);

/** Who may take a funded seat - validated by `validateEntryRuleField`, not as booleans. */
const ENTRY_RULE_FIELDS: ReadonlySet<string> = new Set([
  "freePrivateEntryPolicy",
  "freePrivateMinEntryBalance",
]);

interface ProgramSwitches {
  gmJoinEnabled: boolean;
  gmPrivateContestsEnabled: boolean;
  gmFreePrivateContestsEnabled: boolean;
}

interface ProgramSettings {
  switches: ProgramSwitches;
  freePrivateEntry: FreePrivateEntryRule;
}

async function readSettings(): Promise<ProgramSettings> {
  const doc = await WhiteLabel.findOne()
    .select({
      gmJoinEnabled: 1,
      gmPrivateContestsEnabled: 1,
      gmFreePrivateContestsEnabled: 1,
      freePrivateEntryPolicy: 1,
      freePrivateMinEntryBalance: 1,
    })
    .lean<{
      gmJoinEnabled?: unknown;
      gmPrivateContestsEnabled?: unknown;
      gmFreePrivateContestsEnabled?: unknown;
      freePrivateEntryPolicy?: unknown;
      freePrivateMinEntryBalance?: unknown;
    }>();
  // Reason: only a stored `true` is on - absent, null or a legacy string all read as off,
  // matching the player app's `isGmJoinEnabled()` / `isGmPrivateContestsEnabled()`.
  return {
    switches: {
      gmJoinEnabled: doc?.gmJoinEnabled === true,
      gmPrivateContestsEnabled: doc?.gmPrivateContestsEnabled === true,
      gmFreePrivateContestsEnabled: doc?.gmFreePrivateContestsEnabled === true,
    },
    // Reason: the same resolver the entry guard runs, so the screen shows the rule players
    // actually meet, not the raw stored fields.
    freePrivateEntry: resolveFreePrivateEntryRule(doc),
  };
}

/** Validate the two entry-rule fields. Returns an error message, or null when valid. */
function validateEntryRuleField(key: string, value: unknown): string | null {
  if (key === "freePrivateEntryPolicy") {
    return value === "open" || value === "min_balance"
      ? null
      : "freePrivateEntryPolicy must be open or min_balance.";
  }
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000
    ? null
    : "freePrivateMinEntryBalance must be a number from 0 to 1,000,000.";
}

export async function GET() {
  try {
    const guard = await guardSection("gamemaster-management");
    if (!guard.ok) return guard.response;
    await connectToDatabase();
    const settings = await readSettings();
    return NextResponse.json({ success: true, ...settings });
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

    const updates = new Map<string, boolean | string | number>();
    for (const [key, value] of Object.entries(body)) {
      if (ENTRY_RULE_FIELDS.has(key)) {
        const invalid = validateEntryRuleField(key, value);
        if (invalid) {
          return NextResponse.json({ success: false, error: invalid }, { status: 400 });
        }
        updates.set(key, value as string | number);
        continue;
      }
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
    const previous = await readSettings();
    // Reason: upsert, so the switch can be turned on for a deployment whose settings
    // document has never been saved - otherwise the first save 404s silently.
    await WhiteLabel.updateOne({}, { $set: Object.fromEntries(updates) }, { upsert: true });
    const next = await readSettings();

    try {
      await auditLogService.logSettingsUpdated(
        {
          id: guard.admin.id,
          email: guard.admin.email,
          name: guard.admin.name ?? guard.admin.email.split("@")[0],
          role: guard.admin.role ?? "admin",
        },
        "Game Master Program",
        { ...previous.switches, ...previous.freePrivateEntry },
        { ...next.switches, ...next.freePrivateEntry },
      );
    } catch (auditError) {
      console.error("❌ Failed to audit Game Master program settings:", auditError);
    }

    return NextResponse.json({ success: true, ...next });
  } catch (error) {
    console.error("❌ Update Game Master program settings failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
