/**
 * POST /api/simulator/attack/cleanup
 *
 * Idempotent cleanup of everything the attack suite creates:
 *   - sim-attack-* user docs
 *   - their CreditWallets
 *   - their WalletTransactions (tagged metadata.simulatorAttack=true)
 *   - decline-velocity state in Redis (user + ip namespaces)
 *
 * Also accepts explicit `userIds`, `ips`, `transactionIds` for narrow cleanup
 * during an active run. Passing `{ all: true }` wipes every sim-attack-* doc
 * regardless — used by admins after crashed runs.
 *
 * Safe to call multiple times. Never touches anything outside the sim-attack-*
 * namespace.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  guardAttackRoute,
  isAttackTestUserId,
  ATTACK_USER_PREFIX,
} from "@/lib/services/simulator/attack-tests/guards";
import { connectToDatabase } from "@/database/mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { clearDeclines } from "@/lib/utils/rate-limiter";

export const dynamic = "force-dynamic";

interface CleanupBody {
  userIds?: string[];
  ips?: string[];
  transactionIds?: string[];
  all?: boolean;
}

export async function POST(req: NextRequest) {
  const guard = guardAttackRoute(req);
  if ("response" in guard) return guard.response;

  let body: CleanupBody = {};
  try {
    body = (await req.json()) as CleanupBody;
  } catch {
    // Empty body is fine — treat as targeted cleanup with empty lists
    body = {};
  }

  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    return NextResponse.json(
      { success: false, error: "Database unavailable" },
      { status: 500 },
    );
  }

  const explicitUserIds = (body.userIds ?? []).filter(isAttackTestUserId);
  const explicitIps = Array.isArray(body.ips) ? body.ips : [];
  const explicitTxIds = Array.isArray(body.transactionIds)
    ? body.transactionIds.filter((s): s is string => typeof s === "string")
    : [];

  // Build the user-id match set. If `all=true`, sweep every sim-attack-* id.
  let targetUserIds = explicitUserIds;
  if (body.all) {
    try {
      const users = await db
        .collection("user")
        .find({ id: { $regex: `^${ATTACK_USER_PREFIX}` } })
        .project({ id: 1 })
        .toArray();
      const sweep = users
        .map((u) => (u as { id?: unknown }).id)
        .filter((id): id is string => typeof id === "string")
        .filter(isAttackTestUserId);
      targetUserIds = Array.from(new Set([...targetUserIds, ...sweep]));
    } catch (err) {
      console.error("attack cleanup user sweep failed:", err);
    }
  }

  const summary = {
    usersDeleted: 0,
    walletsDeleted: 0,
    transactionsDeleted: 0,
    declineKeysCleared: 0,
  };

  // Clear decline state FIRST (user + ip namespaces) so even if DB deletes fail
  // Redis state is always wiped.
  for (const id of targetUserIds) {
    try {
      await clearDeclines(id);
      summary.declineKeysCleared++;
    } catch (err) {
      console.warn(`clearDeclines(${id}) failed:`, err);
    }
  }
  for (const ip of explicitIps) {
    try {
      await clearDeclines(`ip:${ip}`);
      summary.declineKeysCleared++;
    } catch (err) {
      console.warn(`clearDeclines(ip:${ip}) failed:`, err);
    }
  }

  // Explicit transaction deletes (including ones registered for this run)
  if (explicitTxIds.length > 0) {
    try {
      const mongooseModule = await import("mongoose");
      const objectIds = explicitTxIds
        .filter((id) => mongooseModule.Types.ObjectId.isValid(id))
        .map((id) => new mongooseModule.Types.ObjectId(id));
      if (objectIds.length > 0) {
        const res = await WalletTransaction.deleteMany({
          _id: { $in: objectIds },
        });
        summary.transactionsDeleted += res.deletedCount ?? 0;
      }
    } catch (err) {
      console.error("explicit tx cleanup failed:", err);
    }
  }

  // User-scoped cleanup
  if (targetUserIds.length > 0) {
    try {
      const txRes = await WalletTransaction.deleteMany({
        userId: { $in: targetUserIds },
      });
      summary.transactionsDeleted += txRes.deletedCount ?? 0;
    } catch (err) {
      console.error("per-user tx cleanup failed:", err);
    }

    try {
      const walletRes = await CreditWallet.deleteMany({
        userId: { $in: targetUserIds },
      });
      summary.walletsDeleted += walletRes.deletedCount ?? 0;
    } catch (err) {
      console.error("wallet cleanup failed:", err);
    }

    try {
      const userRes = await db
        .collection("user")
        .deleteMany({ id: { $in: targetUserIds } });
      summary.usersDeleted += userRes.deletedCount ?? 0;
    } catch (err) {
      console.error("user cleanup failed:", err);
    }
  }

  // Sweep any stray transactions tagged with simulatorAttack metadata regardless
  // of whether their user doc still exists (paranoia).
  if (body.all) {
    try {
      const res = await WalletTransaction.deleteMany({
        "metadata.simulatorAttack": true,
      });
      summary.transactionsDeleted += res.deletedCount ?? 0;
    } catch (err) {
      console.error("metadata-tag tx sweep failed:", err);
    }
  }

  return NextResponse.json({ success: true, summary });
}
