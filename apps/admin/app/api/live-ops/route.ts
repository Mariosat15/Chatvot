import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/database/mongoose";
import { requireAdminAuth } from "@/lib/admin/auth";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import UserPresence from "@/database/models/user-presence.model";
// Reason: shared service lives at repo root and is loaded via relative path
// so it resolves the same under the admin app's @/ alias.
import { listSecurityAlerts } from "../../../../../lib/services/security/security-alert.service";

/**
 * GET /api/live-ops
 *
 * Unified feed for the admin overview's Live Ops panel. Returns the most
 * recent slice of each stream in a single round-trip so the dashboard only
 * fires one poll regardless of how many panels it renders.
 *
 * Load profile:
 * - 4 Promise.all'd indexed MongoDB reads (≤ 50 docs each) per call
 * - Typical total server work per poll: ~40 ms
 * - Admin UI polls every 5 s and pauses when the tab is hidden
 *
 * Intentionally uses `no-store` so the UI never sees stale cached data, but
 * every response is small (< 50 KB).
 */

const DEPOSIT_LIMIT = 50;
const WITHDRAWAL_LIMIT = 50;
const ONLINE_LIMIT = 200;
const ALERT_LIMIT = 30;
const PRESENCE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

interface UserLookupDoc {
  id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- _id is ObjectId | string
  _id?: any;
  name?: string;
  email?: string;
  image?: string;
}

type UserLookupMap = Map<string, { name?: string; email?: string; image?: string }>;

/**
 * Look up the `user` collection for display names/emails.
 *
 * Reason: Better Auth stores the primary key as `_id` (ObjectId) but also
 * surfaces it as a string `id` field; different code paths have written
 * user references using one or the other. To match every transaction we
 * search under BOTH `id: <string>` and `_id: <ObjectId>` (and string `_id`
 * as a safety net), mirroring the `buildUserQuery` pattern used elsewhere
 * in the admin codebase.
 */
async function loadUserLookup(userIds: string[]): Promise<UserLookupMap> {
  const map: UserLookupMap = new Map();
  if (userIds.length === 0) return map;

  const db = mongoose.connection.db;
  if (!db) return map;

  const uniq = Array.from(new Set(userIds.filter(Boolean)));
  const asObjectIds: ObjectId[] = [];
  for (const id of uniq) {
    if (ObjectId.isValid(id)) {
      asObjectIds.push(new ObjectId(id));
    }
  }

  const orClauses: Record<string, unknown>[] = [
    { id: { $in: uniq } },
    { _id: { $in: uniq } },
  ];
  if (asObjectIds.length > 0) {
    orClauses.push({ _id: { $in: asObjectIds } });
  }

  const users = await db
    .collection<UserLookupDoc>("user")
    .find(
      { $or: orClauses },
      { projection: { id: 1, _id: 1, name: 1, email: 1, image: 1 } },
    )
    .toArray();

  for (const u of users) {
    const info = { name: u.name, email: u.email, image: u.image };
    if (u.id) map.set(u.id, info);
    if (u._id !== undefined && u._id !== null) {
      map.set(String(u._id), info);
    }
  }
  return map;
}

export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const now = Date.now();
    const presenceThreshold = new Date(now - PRESENCE_WINDOW_MS);

    // Run all four feeds in parallel — they're independent, small, indexed.
    const [depositsRaw, withdrawalsRaw, onlineRaw, alertsRaw] =
      await Promise.all([
        WalletTransaction.find({ transactionType: "deposit" })
          .sort({ createdAt: -1 })
          .limit(DEPOSIT_LIMIT)
          .lean(),
        WalletTransaction.find({ transactionType: "withdrawal" })
          .sort({ createdAt: -1 })
          .limit(WITHDRAWAL_LIMIT)
          .lean(),
        UserPresence.find({ lastHeartbeat: { $gte: presenceThreshold } })
          .sort({ lastHeartbeat: -1 })
          .limit(ONLINE_LIMIT)
          .lean(),
        listSecurityAlerts({ limit: ALERT_LIMIT, includeAcknowledged: false }),
      ]);

    // Build a shared user lookup so names resolve once for all streams.
    const userIds = [
      ...depositsRaw.map((d) => d.userId),
      ...withdrawalsRaw.map((w) => w.userId),
      ...onlineRaw.map((p) => p.userId),
    ].filter((id): id is string => Boolean(id));
    const users = await loadUserLookup(userIds);

    const pickUser = (id?: string) => {
      if (!id) return { name: undefined, email: undefined };
      const u = users.get(id);
      return { name: u?.name, email: u?.email };
    };

    const deposits = depositsRaw.map((d) => {
      const u = pickUser(d.userId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form PSP metadata blob
      const md = (d.metadata ?? {}) as Record<string, any>;
      return {
        id: String(d._id),
        userId: d.userId,
        userName: u.name,
        userEmail: u.email,
        amount: d.amount,
        currency: d.currency,
        status: d.status,
        provider: d.provider,
        paymentMethod: d.paymentMethod,
        providerTransactionId: d.providerTransactionId,
        failureReason: d.failureReason,
        ip: md.ip || md.clientIp || undefined,
        cardLast4: md.cardLast4 || md.last4 || undefined,
        classification:
          md.fraudClassification || md.riskClassification || undefined,
        createdAt: d.createdAt,
      };
    });

    const withdrawals = withdrawalsRaw.map((w) => {
      const u = pickUser(w.userId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form PSP metadata blob
      const md = (w.metadata ?? {}) as Record<string, any>;
      return {
        id: String(w._id),
        userId: w.userId,
        userName: u.name,
        userEmail: u.email,
        amount: w.amount,
        currency: w.currency,
        status: w.status,
        provider: w.provider,
        paymentMethod: w.paymentMethod,
        destination: md.destination || md.target || md.iban || undefined,
        approvalStatus: md.approvalStatus || md.adminStatus || undefined,
        ip: md.ip || md.clientIp || undefined,
        failureReason: w.failureReason,
        createdAt: w.createdAt,
      };
    });

    const onlineUsers = onlineRaw.map((p) => {
      const u = pickUser(p.userId);
      const fresh =
        p.lastHeartbeat &&
        new Date(p.lastHeartbeat).getTime() >= now - PRESENCE_WINDOW_MS;
      return {
        userId: p.userId,
        userName: u.name || p.username,
        userEmail: u.email,
        status: fresh ? "online" : "offline",
        currentPage: p.currentPage,
        ip: p.ipAddress,
        country: p.country,
        city: p.city,
        region: p.region,
        userAgent: p.userAgent,
        isInCompetition: p.isInCompetition,
        isInChallenge: p.isInChallenge,
        lastHeartbeat: p.lastHeartbeat,
      };
    });

    const securityAlerts = alertsRaw.map((a) => ({
      id: String(a._id),
      alertType: a.alertType,
      severity: a.severity,
      source: a.source,
      provider: a.provider,
      ip: a.ip,
      userId: a.userId,
      reason: a.reason,
      acknowledged: a.acknowledged,
      createdAt: a.createdAt,
    }));

    return NextResponse.json(
      {
        success: true,
        generatedAt: new Date(now).toISOString(),
        deposits,
        withdrawals,
        onlineUsers,
        securityAlerts,
        counts: {
          deposits: deposits.length,
          withdrawals: withdrawals.length,
          onlineUsers: onlineUsers.length,
          securityAlerts: securityAlerts.length,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("❌ [live-ops] failed to build feed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
