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

// Precomputed cleanup regexes. ATTACK_USER_PREFIX is a compile-time constant
// exported from the guards module (`"sim-attack-"`), so the resulting
// RegExp is static — not user-controlled — and not a ReDoS surface.
// eslint-disable-next-line security/detect-non-literal-regexp -- fixed compile-time prefix
const ATTACK_PREFIX_RE = new RegExp(`^${ATTACK_USER_PREFIX}`);
const ATO_EMAIL_SUFFIX_RE = /@test\.simulator$/;

interface CleanupBody {
  userIds?: string[];
  ips?: string[];
  transactionIds?: string[];
  all?: boolean;
}

export async function POST(req: NextRequest) {
  const guard = await guardAttackRoute(req);
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
    restrictionsDeleted: 0,
    securityAlertsDeleted: 0,
    lockoutsDeleted: 0,
    fraudAlertsDeleted: 0,
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

    // UserRestrictions created by the chargeback scenario
    try {
      const restrRes = await db
        .collection("userrestrictions")
        .deleteMany({ userId: { $in: targetUserIds } });
      summary.restrictionsDeleted += restrRes.deletedCount ?? 0;
    } catch (err) {
      console.error("restriction cleanup failed:", err);
    }

    // SecurityAlerts: broaden so we also catch alerts that don't carry a
    // user-scoped `userId` field (they're stored only in metadata). The three
    // current simulator-originated alert types are:
    //   - chargeback_received      (top-level userId → caught by $in)
    //   - webhook_signature_failure (no userId; sim-attack userid in metadata.userid)
    //   - nosql_injection_attempt  (no userId; tagged by probe-nosql with metadata.simulator=true)
    // Reason: matching on these explicit markers avoids accidentally deleting
    // real production alerts that happen to be contemporaneous.
    try {
      const alertRes = await db.collection("securityalerts").deleteMany({
        $or: [
          { userId: { $in: targetUserIds } },
          { "metadata.userId": { $in: targetUserIds } },
          { "metadata.userid": { $regex: ATTACK_PREFIX_RE } },
          { "metadata.simulator": true },
        ],
      });
      summary.securityAlertsDeleted += alertRes.deletedCount ?? 0;
    } catch (err) {
      console.error("security-alert cleanup failed:", err);
    }

    // AccountLockouts created by the ATO scenario. Use the Mongoose model so
    // the collection name resolution is guaranteed to match production, and
    // widen the regex to also catch the fixed @test.simulator suffix the
    // scenario uses.
    try {
      const AccountLockout = (
        await import("@/database/models/account-lockout.model")
      ).default;
      const lockoutRes = await AccountLockout.deleteMany({
        $or: [
          { userId: { $in: targetUserIds } },
          { email: ATTACK_PREFIX_RE },
          { email: ATO_EMAIL_SUFFIX_RE },
        ],
      });
      summary.lockoutsDeleted += lockoutRes.deletedCount ?? 0;
    } catch (err) {
      console.error("lockout cleanup failed:", err);
    }

    // FraudAlerts created by recordFailedLogin
    try {
      const fraudRes = await db.collection("fraudalerts").deleteMany({
        $or: [
          { primaryUserId: { $in: targetUserIds } },
          { suspiciousUserIds: { $in: targetUserIds } },
          { primaryUserId: { $regex: ATTACK_PREFIX_RE } },
          // ATO scenario records primary identifier as email when userId is unknown.
          { primaryUserId: ATO_EMAIL_SUFFIX_RE },
          { primaryUserId: ATTACK_PREFIX_RE },
        ],
      });
      summary.fraudAlertsDeleted += fraudRes.deletedCount ?? 0;
    } catch (err) {
      console.error("fraud-alert cleanup failed:", err);
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

    // Same safety net for SecurityAlerts: anything explicitly flagged as
    // simulator-originated (by probe-nosql or future probes) gets wiped,
    // even from dead/broken runs whose targetUserIds we can no longer derive.
    try {
      const alertSweep = await db
        .collection("securityalerts")
        .deleteMany({ "metadata.simulator": true });
      summary.securityAlertsDeleted += alertSweep.deletedCount ?? 0;
    } catch (err) {
      console.error("metadata-tag alert sweep failed:", err);
    }

    // And stray AccountLockouts with sim-attack-* emails (survivors from
    // earlier runs before the email regex was broadened).
    try {
      const AccountLockout = (
        await import("@/database/models/account-lockout.model")
      ).default;
      const lockoutSweep = await AccountLockout.deleteMany({
        $or: [
          { email: ATTACK_PREFIX_RE },
          { email: ATO_EMAIL_SUFFIX_RE },
        ],
      });
      summary.lockoutsDeleted += lockoutSweep.deletedCount ?? 0;
    } catch (err) {
      console.error("metadata-tag lockout sweep failed:", err);
    }
  }

  return NextResponse.json({ success: true, summary });
}
