/**
 * GET /api/simulator/attack/check-user-restriction?userId=sim-attack-...
 *
 * Gated by the 7-layer attack guard. Returns whether the user has an active
 * UserRestriction — used by the chargeback scenario to verify that the Nuvei
 * webhook created the expected restriction after a chargeback DMN.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  guardAttackRoute,
  isAttackTestUserId,
} from "@/lib/services/simulator/attack-tests/guards";
import { connectToDatabase } from "@/database/mongoose";
import UserRestriction from "@/database/models/user-restriction.model";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await guardAttackRoute(req);
  if ("response" in guard) return guard.response;

  const userId = new URL(req.url).searchParams.get("userId") ?? "";
  if (!isAttackTestUserId(userId)) {
    return NextResponse.json(
      { success: false, error: "userId must be a sim-attack-* id" },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const restriction = await UserRestriction.findOne({
    userId,
    isActive: true,
  }).lean<{
    _id: unknown;
    restrictionType?: string;
    reason?: string;
    canTrade?: boolean;
    canDeposit?: boolean;
    canWithdraw?: boolean;
    canEnterCompetitions?: boolean;
    customReason?: string;
  } | null>();

  if (!restriction) {
    return NextResponse.json({
      success: true,
      restricted: false,
    });
  }

  return NextResponse.json({
    success: true,
    restricted: true,
    restrictionId: String(restriction._id),
    restrictionType: restriction.restrictionType,
    reason: restriction.reason,
    canTrade: restriction.canTrade,
    canDeposit: restriction.canDeposit,
    canWithdraw: restriction.canWithdraw,
    canEnterCompetitions: restriction.canEnterCompetitions,
    customReason: restriction.customReason,
  });
}
