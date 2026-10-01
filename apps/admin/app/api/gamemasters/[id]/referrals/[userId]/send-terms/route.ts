import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";
import { GENERIC_ERROR, sendAdminTermsReminder } from "@/lib/services/gamemaster/admin-terms-reminder.service";

/**
 * POST /api/gamemasters/[id]/referrals/[userId]/send-terms - an admin reminds a referred player
 * to answer the Game Master terms (`External game plans/24` s5.6). `[id]` is the Game Master's
 * subscription id, as on every route under `/api/gamemasters/[id]`.
 *
 * Reason: guarded by `gamemaster-management`, the section that renders the Referrals tab. The
 * admin is taken from the guard, never from the body, so the audit row names who really sent it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const guard = await guardSection("gamemaster-management");
  if (!guard.ok) return guard.response;

  try {
    const { id, userId } = await params;
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });

    const forwarded = request.headers.get("x-forwarded-for");
    const result = await sendAdminTermsReminder(db, {
      gameMasterSubscriptionId: id,
      playerUserId: userId,
      admin: guard.admin,
      meta: {
        ipAddress: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });
    if (result.success) return NextResponse.json(result);
    const status = result.code === "error" ? 500 : result.code === "not_found" || result.code === "not_game_master" ? 404 : 409;
    return NextResponse.json({ success: false, code: result.code, error: result.error }, { status });
  } catch (error) {
    console.error("❌ Admin send-terms failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
