import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";
import { parseReferredPlayersQuery } from "@/lib/services/gamemaster/referral-report-filter";
import { readReferredPlayers } from "@/lib/services/gamemaster/referral-read-model";

/**
 * GET /api/gamemasters/referred-players
 *
 * Every referred player across Game Masters, labelled own referral / external, with join
 * date, join surface, activity and earnings (`External game plans/24` s7.1). Filters arrive in
 * the query string and are allow-listed by `parseReferredPlayersQuery`.
 *
 * Reason: granted by `gamemaster-management`, the section owning the screen that reads it.
 * It returns personal data one page at a time; BULK export is a separate grant (`24` s7.5).
 */
export async function GET(request: NextRequest) {
  const guard = await guardSection("gamemaster-management");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection unavailable");

    const { filter, paging } = parseReferredPlayersQuery(new URL(request.url).searchParams);
    const report = await readReferredPlayers(db, filter, paging);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("❌ Referred-players report failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
