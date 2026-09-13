import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";
import { fetchMergedTransactions } from "@/lib/services/transaction-history.service";

/**
 * GET /api/admin/transactions
 * Get comprehensive transaction history with filters.
 *
 * Reason: All filtering + source-merging logic lives in
 * fetchMergedTransactions() so this list and the CSV export
 * (/api/transactions/export) always apply identical filters.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);

    // Parse filters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const filters = {
      type: searchParams.get("type"),
      status: searchParams.get("status"),
      userId: searchParams.get("userId"),
      competitionId: searchParams.get("competitionId"),
      search: searchParams.get("search"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      minAmount: searchParams.get("minAmount"),
      maxAmount: searchParams.get("maxAmount"),
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    // OPTIMIZATION: cap fetched records per source to bound memory.
    const { transactions: allTransactions, walletQuery: query } =
      await fetchMergedTransactions(filters, { maxRecords: 1000 });

    // Apply pagination to combined results
    const skip = (page - 1) * limit;
    const total = allTransactions.length;
    const enrichedTransactions = allTransactions.slice(skip, skip + limit);

    // Get aggregated statistics
    const stats = await WalletTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$transactionType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          positiveAmount: {
            $sum: { $cond: [{ $gt: ["$amount", 0] }, "$amount", 0] },
          },
          negativeAmount: {
            $sum: { $cond: [{ $lt: ["$amount", 0] }, "$amount", 0] },
          },
        },
      },
    ]);

    // Status breakdown.
    // Reason: a withdrawal's DISPLAYED status is RE-DERIVED from its
    // WithdrawalRequest after the DB query (and the status filter is applied
    // post-enrichment). A raw `$status` aggregation over the wallet query would
    // therefore disagree with the rows actually shown — e.g. filtering by
    // "completed" could still tally withdrawals by their stale raw status.
    // Computing the breakdown from the enriched, already-status-filtered merged
    // set makes the summary 100% consistent with the rows, totals, and exports.
    const byStatus = allTransactions.reduce(
      (acc, t) => {
        const s = String(t.status || "unknown");
        // eslint-disable-next-line security/detect-object-injection
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return NextResponse.json({
      success: true,
      data: {
        transactions: enrichedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
        stats: {
          byType: stats.reduce(
            (acc, s) => {
              acc[s._id] = {
                count: s.count,
                totalAmount: s.totalAmount,
                positiveAmount: s.positiveAmount,
                negativeAmount: s.negativeAmount,
              };
              return acc;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {} as Record<string, any>,
          ),
          byStatus,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

/**
 * GET single transaction by ID
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 },
      );
    }

    const transaction = await WalletTransaction.findById(transactionId).lean();

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // Get user info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txUserId = (transaction as any).userId;
    let userInfo = { id: txUserId, name: "Unknown", email: "Unknown" };
    if (txUserId !== "platform") {
      const usersMap = await getUsersByIds([txUserId]);
      userInfo = usersMap.get(txUserId) || userInfo;
    } else {
      userInfo = { id: "platform", name: "Platform", email: "system" };
    }

    return NextResponse.json({
      success: true,
      data: {
        transaction: {
          ...transaction,
          userInfo,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 },
    );
  }
}
