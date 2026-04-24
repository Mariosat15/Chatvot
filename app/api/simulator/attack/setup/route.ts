/**
 * POST /api/simulator/attack/setup
 *
 * Gated by the 7-layer attack guard. Creates the test fixtures needed by the
 * attack scenarios without ever touching real users.
 *
 * Actions:
 *   - "create-user"         → creates a `sim-attack-user-<uuid>` user + wallet
 *   - "create-completed-tx" → creates a WalletTransaction pre-set to "completed"
 *                             so the replay-idempotency scenario can hit the
 *                             "already processed" branch.
 *
 * Every resource created here is tagged `metadata.simulatorAttack: true` so the
 * cleanup route can find and delete it.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectToDatabase } from "@/database/mongoose";
import {
  guardAttackRoute,
  isAttackTestUserId,
  ATTACK_USER_PREFIX,
} from "@/lib/services/simulator/attack-tests/guards";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = guardAttackRoute(req);
  if ("response" in guard) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const action = typeof body.action === "string" ? body.action : "";

  await connectToDatabase();

  if (action === "create-user") {
    const userId = `${ATTACK_USER_PREFIX}${crypto.randomUUID()}`;
    const email = `${userId}@test.simulator`;

    // Minimal better-auth user doc — the attack tests only need a stable userId
    // that survives queries; we skip the `account` entry since the defenses
    // under test don't call the full auth flow.
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database unavailable" },
        { status: 500 },
      );
    }

    try {
      await db.collection("user").insertOne({
        id: userId,
        email,
        name: "Attack Test User",
        emailVerified: true,
        role: "trader",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          simulatorMode: true,
          simulatorAttack: true,
        },
      });
    } catch (err) {
      console.error("setup create-user user insert failed:", err);
      return NextResponse.json(
        { success: false, error: "User create failed" },
        { status: 500 },
      );
    }

    try {
      await CreditWallet.create({
        userId,
        creditBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSpentOnCompetitions: 0,
        totalWonFromCompetitions: 0,
        totalSpentOnChallenges: 0,
        totalWonFromChallenges: 0,
        isActive: true,
        kycVerified: false,
        withdrawalEnabled: false,
      });
    } catch (err) {
      console.error("setup create-user wallet insert failed:", err);
      // Best effort; scenarios mostly don't need the wallet to exist.
    }

    return NextResponse.json({ success: true, userId, email });
  }

  if (action === "create-completed-tx") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    const amount = typeof body.amount === "number" ? body.amount : 25;

    if (!isAttackTestUserId(userId)) {
      return NextResponse.json(
        { success: false, error: "userId must be a sim-attack-* id" },
        { status: 400 },
      );
    }

    try {
      const ppp = `sim-ppp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const tx = await WalletTransaction.create({
        userId,
        transactionType: "deposit",
        amount,
        balanceBefore: 0,
        balanceAfter: 0,
        currency: "EUR",
        exchangeRate: 1,
        status: "completed", // pre-marked so replay hits the "already processed" branch
        provider: "nuvei",
        providerTransactionId: ppp,
        paymentId: ppp,
        description: "Attack-suite replay test transaction (pre-completed)",
        processedAt: new Date(),
        metadata: {
          simulatorMode: true,
          simulatorAttack: true,
          clientUniqueId: `txn_${ppp}`,
        },
      });

      return NextResponse.json({
        success: true,
        transactionId: tx._id.toString(),
        pppTransactionId: ppp,
        clientUniqueId: `txn_${tx._id.toString()}`,
      });
    } catch (err) {
      console.error("setup create-completed-tx failed:", err);
      return NextResponse.json(
        { success: false, error: "Transaction create failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { success: false, error: "Unknown action" },
    { status: 400 },
  );
}
