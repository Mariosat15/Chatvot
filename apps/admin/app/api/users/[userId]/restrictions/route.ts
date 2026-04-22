import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import UserRestriction from "@/database/models/user-restriction.model";
import AuditLog from "@/database/models/audit-log.model";
import UserNote from "@/database/models/user-notes.model";
import { getAdminSession } from "@/lib/admin/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    await connectToDatabase();

    const restrictions = await UserRestriction.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ restrictions });
  } catch (error) {
    console.error("Error fetching user restrictions:", error);
    return NextResponse.json(
      { error: "Failed to fetch restrictions" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json();
    await connectToDatabase();

    // Check if user already has an active restriction
    const existingRestriction = await UserRestriction.findOne({
      userId,
      isActive: true,
    });

    if (existingRestriction) {
      return NextResponse.json(
        { error: "User already has an active restriction" },
        { status: 400 },
      );
    }

    // Determine blocked actions. If the caller supplied an explicit
    // `restrictions` object (new UI), honor it. Otherwise fall back to the
    // legacy preset (banned = block everything, suspended = allow deposits
    // only) so older callers keep working.
    // Reason: gives admins the same granular control we already expose in
    // the Fraud Monitoring dialog while preserving backward compatibility.
    const isBanned = body.restrictionType === "banned";
    const explicit = body.restrictions as
      | {
          canTrade?: boolean;
          canEnterCompetitions?: boolean;
          canDeposit?: boolean;
          canWithdraw?: boolean;
        }
      | undefined;
    const blockSettings = explicit
      ? {
          canTrade: !!explicit.canTrade,
          canEnterCompetitions: !!explicit.canEnterCompetitions,
          canDeposit: !!explicit.canDeposit,
          canWithdraw: !!explicit.canWithdraw,
        }
      : {
          canTrade: false,
          canEnterCompetitions: false,
          canDeposit: !isBanned, // Suspended users can still deposit
          canWithdraw: false,
        };

    // Normalize the optional review-packet inputs so malformed admin input
    // (string in a number field, blank textarea, etc.) never reaches the
    // database. These fields surface on the user-facing /account/review
    // page, so we clamp + trim defensively.
    const rawEta =
      typeof body.reviewEtaDays === "number"
        ? body.reviewEtaDays
        : typeof body.reviewEtaDays === "string" && body.reviewEtaDays.trim() !== ""
          ? Number(body.reviewEtaDays)
          : undefined;
    const reviewEtaDays =
      typeof rawEta === "number" && Number.isFinite(rawEta)
        ? Math.max(0, Math.min(90, Math.floor(rawEta)))
        : undefined;

    const documentsRequested = Array.isArray(body.documentsRequested)
      ? body.documentsRequested
          .map((d: unknown) => (typeof d === "string" ? d.trim() : ""))
          .filter((d: string) => d.length > 0)
          .slice(0, 20)
      : undefined;

    // Create restriction
    const restriction = await UserRestriction.create({
      userId,
      restrictionType: body.restrictionType,
      reason: body.reason,
      customReason: body.customReason,
      ...blockSettings,
      hideFromPublic: !!body.hideFromPublic,
      restrictedAt: new Date(),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      restrictedBy: session.id,
      isActive: true,
      reviewEtaDays,
      documentsRequested:
        documentsRequested && documentsRequested.length > 0
          ? documentsRequested
          : undefined,
    });

    // Auto-add a note about the restriction
    await UserNote.create({
      userId,
      adminId: session.id,
      adminName: session.name || session.email || "Admin",
      content: `User ${isBanned ? "banned" : "suspended"}. Reason: ${body.reason}${
        body.customReason ? `. Details: ${body.customReason}` : ""
      }`,
      category: "ban",
      priority: "high",
    });

    // Create audit log
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || "Admin",
      userEmail: session.email || "admin@system",
      userRole: "admin",
      action: isBanned ? "user_banned" : "user_suspended",
      actionCategory: "user_management",
      description: `${isBanned ? "Banned" : "Suspended"} user ${userId}. Reason: ${body.reason}`,
      targetType: "user",
      targetId: userId,
      metadata: {
        restrictionType: body.restrictionType,
        reason: body.reason,
        customReason: body.customReason,
        expiresAt: body.expiresAt,
      },
      status: "success",
    });

    // Invalidate leaderboard cache if user is hidden from public
    if (body.hideFromPublic) {
      try {
        const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        await fetch(`${mainAppUrl}/api/leaderboard/invalidate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: process.env.INTERNAL_API_SECRET || "simulator-cleanup" }),
        });
      } catch {
        // Cache will expire naturally in 5 min
      }
    }

    return NextResponse.json({ restriction });
  } catch (error) {
    console.error("Error creating user restriction:", error);
    return NextResponse.json(
      { error: "Failed to create restriction" },
      { status: 500 },
    );
  }
}
