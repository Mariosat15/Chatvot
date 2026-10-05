import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  listContactUsPackagesForUser,
  setContactUsPackageUnlock,
} from "@/lib/services/gamemaster/package-unlocks.service";

/**
 * Per-Game-Master unlocks for "Contact us" GM packages.
 *
 * A package with `gameMasterConfig.contactUsOnly` cannot be bought; players are sent to support
 * chat. From Manage Game Masters an operator can enable such a package for ONE Game Master, after
 * which that player (and only that player) sees the normal buy button for it. The Users section
 * has a sibling route keyed on the player id for players who are not Game Masters yet.
 *
 * Reason: the unlock is keyed on the subscription's `userId` (the player id the purchase route
 * compares against), never on the subscription `_id` from the URL.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";

async function loadGameMasterUserId(
  id: string,
): Promise<{ ok: true; userId: string; name?: string } | { ok: false; response: NextResponse }> {
  if (!ObjectId.isValid(id)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Invalid Game Master id" }, { status: 400 }),
    };
  }
  const db = mongoose.connection.db;
  if (!db) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 }),
    };
  }
  const subscription = await db
    .collection("gamemastersubscriptions")
    .findOne({ _id: new ObjectId(id) }, { projection: { userId: 1, userName: 1 } });
  if (!subscription?.userId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Game master not found" }, { status: 404 }),
    };
  }
  return {
    ok: true,
    userId: String(subscription.userId),
    name: typeof subscription.userName === "string" ? subscription.userName : undefined,
  };
}

/** GET - every Contact-us GM package, with whether it is enabled for this Game Master. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("gamemaster-management");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
    const { id } = await params;
    const gm = await loadGameMasterUserId(id);
    if (!gm.ok) return gm.response;

    const packages = await listContactUsPackagesForUser(gm.userId);
    return NextResponse.json({ success: true, packages });
  } catch (error) {
    console.error("❌ Error loading GM package unlocks:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}

/** PUT { packageId, enabled } - enable or disable one Contact-us package for this Game Master. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("gamemaster-management");
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

    await connectToDatabase();
    const { id } = await params;
    const gm = await loadGameMasterUserId(id);
    if (!gm.ok) return gm.response;

    const result = await setContactUsPackageUnlock(gm.userId, packageId, enabled);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    await auditLogService.logSettingsUpdated(
      guard.admin,
      `GM package "${result.packageName}" purchase ${enabled ? "enabled" : "disabled"} for Game Master ${gm.name ?? gm.userId}`,
      { unlocked: !enabled },
      { unlocked: enabled, gameMasterUserId: gm.userId, packageId },
    );

    return NextResponse.json({ success: true, unlocked: enabled });
  } catch (error) {
    console.error("❌ Error updating GM package unlock:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
