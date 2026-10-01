import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { readReferredPlayers } from "@/lib/services/gamemaster/referral-read-model";
import {
  parseReferredPlayersQuery,
  type ReferredPlayersFilter,
} from "@/lib/services/gamemaster/referral-report-filter";
import { toGameMasterReferralView } from "@/lib/services/gamemaster/gm-referral-view";

/**
 * GET /api/gamemaster/referrals - the signed-in Game Master's own referred players
 * (`External game plans/24` s6, task 5 of the v2 programme).
 *
 * Read through the shared read model, so this list, the admin report and the financial
 * breakdown agree about every player, and mapped through `toGameMasterReferralView`, so an
 * email is shown only for a player who accepted the affiliation terms (D6).
 */

// Reason: the screen predates the read model and sent `status=active|inactive` meaning "is the
// affiliation live". Mapped rather than dropped so an old bookmark still filters.
const LEGACY_STATUS = new Map<string, ReferredPlayersFilter["status"]>([
  ["active", "current"],
  ["inactive", "ended"],
]);

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const subscription = await GameMasterSubscription.exists({ userId });
    if (!subscription) {
      return NextResponse.json({ success: false, error: "Not a Game Master" }, { status: 403 });
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error("database connection unavailable");

    const params = new URL(request.url).searchParams;
    const { filter, paging } = parseReferredPlayersQuery(params);
    const legacy = LEGACY_STATUS.get(params.get("status") ?? "");
    if (legacy) filter.status = legacy;

    // Reason: the Game Master is ALWAYS the session user. A `gameMasterId` in the query string
    // would otherwise let one Game Master read another's players.
    const scope: ReferredPlayersFilter = { gameMasterIds: [userId], contactRequiresConsent: true };
    const filtered = Object.keys(filter).some((k) => k !== "gameMasterIds");
    const report = await readReferredPlayers(db, { ...filter, ...scope }, paging);
    // The headline figures describe every player, not just the filtered page.
    const overall = filtered
      ? await readReferredPlayers(db, scope, { page: 1, limit: 1 })
      : report;
    const all = overall.summary.all;

    return NextResponse.json({
      success: true,
      data: {
        referrals: report.rows.map(toGameMasterReferralView),
        stats: {
          totalReferred: all.players,
          currentReferred: all.current,
          activeUsers: all.active,
          ownReferrals: overall.summary.byKind.own.players,
          externalReferrals: overall.summary.byKind.external.players,
          totalEntryFees: all.entryFees,
          totalEarningsGenerated: all.earned,
          avgEarningsPerUser: all.players > 0 ? all.earned / all.players : 0,
        },
        pagination: {
          page: report.page,
          limit: report.limit,
          total: report.total,
          totalPages: Math.max(1, Math.ceil(report.total / report.limit)),
        },
        asOf: report.asOf,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching GM referrals:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
