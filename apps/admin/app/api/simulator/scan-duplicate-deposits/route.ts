import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";

/**
 * GET /api/simulator/scan-duplicate-deposits
 *
 * Read-only integrity scan: are there any DUPLICATE completed deposit credits?
 *
 * A duplicate group = the same provider payment id appears on more than one
 * COMPLETED deposit, which would mean a user was credited twice for a single
 * payment. The deposit flow now guards against this with an atomic status claim
 * in completeDeposit(), so a clean result also confirms it is safe to add the
 * optional defense-in-depth unique index.
 *
 * Mirrors scan-duplicate-deposits.mjs, but reuses the pooled Mongoose
 * connection and is admin-authenticated.
 */

// Provider transaction-id fields a completed deposit may be keyed by. Different
// PSPs populate different fields, so we check each independently.
const KEY_FIELDS = ["paymentId", "providerTransactionId", "paymentIntentId"] as const;

interface DuplicateGroup {
  key: string;
  count: number;
  userIds: string[];
  totalCredits: number;
  txIds: string[];
}

interface FieldResult {
  field: string;
  duplicateGroups: DuplicateGroup[];
}

export async function GET() {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database not connected" },
        { status: 500 },
      );
    }

    // Resolve the wallet-transactions collection name defensively.
    const collectionNames = (await db.listCollections().toArray()).map(
      (c) => c.name,
    );
    const txCollectionName = ["wallettransactions", "wallet_transactions"].find(
      (c) => collectionNames.includes(c),
    );
    if (!txCollectionName) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet transactions collection not found",
        },
        { status: 404 },
      );
    }

    const coll = db.collection(txCollectionName);
    const fields: FieldResult[] = [];
    let totalDuplicateGroups = 0;

    for (const field of KEY_FIELDS) {
      // Group completed deposits by the key field; report any key used more than
      // once (that would be a double-credit for the same provider payment).
      const dupes = (await coll
        .aggregate([
          {
            $match: {
              transactionType: { $in: ["deposit", "manual_deposit_credit"] },
              status: "completed",
              [field]: { $exists: true, $ne: null, $type: "string" },
            },
          },
          {
            $group: {
              _id: `$${field}`,
              count: { $sum: 1 },
              ids: { $push: "$_id" },
              userIds: { $addToSet: "$userId" },
              totalCredits: { $sum: "$amount" },
            },
          },
          { $match: { count: { $gt: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray()) as Array<{
        _id: unknown;
        count: number;
        ids: unknown[];
        userIds: unknown[];
        totalCredits: number;
      }>;

      const duplicateGroups: DuplicateGroup[] = dupes.map((d) => ({
        key: String(d._id),
        count: d.count,
        userIds: (d.userIds || []).map((x) => String(x)),
        totalCredits: Math.round((d.totalCredits || 0) * 100) / 100,
        txIds: (d.ids || []).map((x) => String(x)),
      }));

      totalDuplicateGroups += duplicateGroups.length;
      fields.push({ field, duplicateGroups });
    }

    return NextResponse.json({
      success: true,
      collection: txCollectionName,
      clean: totalDuplicateGroups === 0,
      totalDuplicateGroups,
      fields,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ scan-duplicate-deposits error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to scan for duplicate deposits" },
      { status: 500 },
    );
  }
}
