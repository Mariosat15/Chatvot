import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { getUserById } from "@/lib/utils/user-lookup";
import {
  listContactUsPackagesForUser,
  setContactUsPackageUnlock,
} from "@/lib/services/gamemaster/package-unlocks.service";

/**
 * "Contact us" GM package unlocks from the Users section.
 *
 * Same behaviour as Manage Game Masters' route, keyed on the PLAYER id instead of a
 * subscription. Reason: a player who is not a Game Master yet has no subscription, so the
 * Game Masters screen cannot reach them - yet that is exactly who asks support to enable
 * their first package.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";

async function loadUser(userId: string) {
  if (!userId || userId.length > 64) return null;
  return getUserById(userId);
}

/** GET - every Contact-us GM package, with whether it is enabled for this player. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;

    const { userId } = await params;
    const user = await loadUser(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const packages = await listContactUsPackagesForUser(user.id);
    return NextResponse.json({ success: true, packages });
  } catch (error) {
    console.error("❌ Error loading user GM package unlocks:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}

/** PUT { packageId, enabled } - enable or disable one Contact-us package for this player. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;

    const body = (await request.json().catch(() => null)) as
      | { packageId?: unknown; enabled?: unknown }
      | null;
    const packageId = body?.packageId;
    const enabled = body?.enabled;
    if (typeof packageId !== "string" || !ObjectId.isValid(packageId)) {
      return NextResponse.json({ success: false, error: "A valid packageId is required" }, { status: 400 });
    }
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ success: false, error: "enabled must be true or false" }, { status: 400 });
    }

    const { userId } = await params;
    const user = await loadUser(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const result = await setContactUsPackageUnlock(user.id, packageId, enabled);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    await auditLogService.logSettingsUpdated(
      guard.admin,
      `GM package "${result.packageName}" purchase ${enabled ? "enabled" : "disabled"} for user ${user.username || user.name || user.id}`,
      { unlocked: !enabled },
      { unlocked: enabled, userId: user.id, packageId },
    );

    return NextResponse.json({ success: true, unlocked: enabled });
  } catch (error) {
    console.error("❌ Error updating user GM package unlock:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
