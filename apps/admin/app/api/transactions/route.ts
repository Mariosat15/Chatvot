import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import VATPayment from "@/database/models/vat-payment.model";
import VendorPayment from "@/database/models/vendor-payment.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";

// Reason: MongoDB $regex treats the search string as a regular expression.
// Characters like +, ., *, ?, (, ), [, ], {, }, ^, $, |, \ are regex metacharacters.
// Unescaped, they cause MongoServerError or unintended wildcard matches.
// Example: "user+tag@example.com" → + means "one or more" → parse error → 500 crash.
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/admin/transactions
 * Get comprehensive transaction history with filters
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);

    // Parse filters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const type = searchParams.get("type"); // transaction type filter
    const status = searchParams.get("status"); // status filter
    const userId = searchParams.get("userId"); // specific user filter
    const competitionId = searchParams.get("competitionId"); // competition filter
    const search = searchParams.get("search"); // search by ID, description
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const minAmount = searchParams.get("minAmount");
    const maxAmount = searchParams.get("maxAmount");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (type && type !== "all") {
      query.transactionType = type;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (userId) {
      query.userId = userId;
    }

    if (competitionId) {
      query.competitionId = competitionId;
    }

    if (search && search.trim()) {
      // Reason: userInfo.email/name are NOT stored in WalletTransaction – they're enriched after fetch.
      // Pre-resolve matching userIds from the user collection first, then query by userId.
      // Reason: Escape the raw search string before using in $regex to prevent MongoServerError
      // from special regex characters (e.g. + in "user+tag@example.com").
      const safeSearch = escapeRegex(search.trim());
      const db = mongoose.connection.db;
      const resolvedUserIds: string[] = [];

      if (db) {
        try {
          const matchingUsers = await db
            .collection("user")
            .find(
              {
                $or: [
                  { email: { $regex: safeSearch, $options: "i" } },
                  { name: { $regex: safeSearch, $options: "i" } },
                  // Exact match on id field (better-auth string ID)
                  { id: search.trim() },
                ],
              },
              // Reason: Fetch both id (better-auth string) and _id (ObjectId) so we can
              // match against WalletTransaction.userId regardless of which format was stored.
              { projection: { id: 1, _id: 1 } },
            )
            .limit(500)
            .toArray();

          matchingUsers.forEach((u) => {
            // Collect better-auth string id
            if (u.id) resolvedUserIds.push(String(u.id));
            // Also collect ObjectId string in case transactions stored it that way
            if (u._id) resolvedUserIds.push(u._id.toString());
          });
        } catch (userLookupError) {
          // Reason: Don't fail the whole request if user lookup has an error.
          // Fall back to text-only search below.
          console.warn("⚠️ Transaction search: user lookup error:", userLookupError);
        }
      }

      // Build $or: text fields + pre-resolved userIds
      const searchConditions: Record<string, unknown>[] = [
        { description: { $regex: safeSearch, $options: "i" } },
        { "metadata.paymentIntentId": { $regex: safeSearch, $options: "i" } },
      ];

      if (resolvedUserIds.length > 0) {
        // Deduplicate IDs before querying
        const uniqueIds = [...new Set(resolvedUserIds)];
        searchConditions.push({ userId: { $in: uniqueIds } });
      } else {
        // Reason: No users found by name/email/id — try a direct regex on userId
        // as a last resort (handles partial ID searches).
        searchConditions.push({ userId: { $regex: safeSearch, $options: "i" } });
      }

      query.$or = searchConditions;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Reason: Mongoose sort requires a dynamic key — use allowlist to prevent injection
    const allowedSortFields = new Set(["createdAt", "amount", "transactionType", "status", "userId"]);
    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";
    const sort: Record<string, 1 | -1> = { [safeSortBy]: sortOrder === "asc" ? 1 : -1 };

    // Check if we should include admin/platform transactions
    const includeAdminTx =
      type === "all" ||
      type === "admin_withdrawal" ||
      type === "vat_payment" ||
      type === "platform_fee" ||
      type === "unclaimed_pool" ||
      type === "deposit_fee" ||
      type === "withdrawal_fee" ||
      type === "admin_balance_add" ||
      type === "custom_expense" ||
      type === "vendor_payment" ||
      !type;

    // OPTIMIZATION: Limit max records to prevent memory issues
    // For very large result sets, use date filters to narrow down
    const maxRecords = 1000; // Safety limit

    const [walletTransactions, _walletTransactionTotal] = await Promise.all([
      WalletTransaction.find(query).sort(sort).limit(maxRecords).lean(),
      WalletTransaction.countDocuments(query),
    ]);

    // Also fetch platform transactions (admin withdrawals, fees, unclaimed pools)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let platformTransactions: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vatPayments: any[] = [];

    if (includeAdminTx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const platformQuery: any = {};
      if (type && type !== "all") {
        if (
          [
            "admin_withdrawal",
            "platform_fee",
            "unclaimed_pool",
            "deposit_fee",
            "withdrawal_fee",
            "admin_balance_add",
            "custom_expense",
          ].includes(type)
        ) {
          platformQuery.transactionType = type;
        }
      }
      if (startDate || endDate) {
        platformQuery.createdAt = {};
        if (startDate) platformQuery.createdAt.$gte = new Date(startDate);
        if (endDate) platformQuery.createdAt.$lte = new Date(endDate);
      }

      platformTransactions = await PlatformTransaction.find(platformQuery)
        .sort(sort)
        .limit(maxRecords)
        .lean();

      // Fetch VAT payments if type is 'all' or 'vat_payment'
      if (type === "all" || type === "vat_payment" || !type) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vatQuery: any = { status: "paid" };
        if (startDate || endDate) {
          vatQuery.paidAt = {};
          if (startDate) vatQuery.paidAt.$gte = new Date(startDate);
          if (endDate) vatQuery.paidAt.$lte = new Date(endDate);
        }
        vatPayments = await VATPayment.find(vatQuery)
          .sort({ paidAt: -1 })
          .limit(maxRecords)
          .lean();
      }
    }

    // Fetch vendor payments if type is 'all' or 'vendor_payment'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vendorPayments: any[] = [];
    if (type === "all" || type === "vendor_payment" || !type) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vendorQuery: any = { status: "paid" };
      if (startDate || endDate) {
        vendorQuery.paidAt = {};
        if (startDate) vendorQuery.paidAt.$gte = new Date(startDate);
        if (endDate) vendorQuery.paidAt.$lte = new Date(endDate);
      }
      vendorPayments = await VendorPayment.find(vendorQuery)
        .sort({ paidAt: -1 })
        .limit(maxRecords)
        .lean();
    }

    // Get unique user IDs to fetch user info
    const userIds = [
      ...new Set(
        walletTransactions
          .map((t) => t.userId)
          .filter((id) => id !== "platform"),
      ),
    ];
    const usersMap = await getUsersByIds(userIds);

    // Get withdrawal request IDs for enriching withdrawal transactions
    const withdrawalTxs = walletTransactions.filter(
      (t) =>
        t.transactionType === "withdrawal" && t.metadata?.withdrawalRequestId,
    );
    const withdrawalRequestIds = withdrawalTxs
      .map((t) => t.metadata?.withdrawalRequestId)
      .filter(Boolean);

    // Fetch withdrawal requests to get fee details
    const withdrawalRequests =
      withdrawalRequestIds.length > 0
        ? await WithdrawalRequest.find({
            _id: { $in: withdrawalRequestIds },
          }).lean()
        : [];
    const withdrawalRequestMap = new Map(
      withdrawalRequests.map((w) => [w._id.toString(), w]),
    );

    // Enrich wallet transactions with user info and withdrawal details
    const enrichedWalletTransactions = walletTransactions.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enriched: any = {
        ...t,
        source: "wallet" as const,
        userInfo:
          t.userId === "platform"
            ? { id: "platform", name: "Platform", email: "system" }
            : usersMap.get(t.userId) || {
                id: t.userId,
                name: "Unknown",
                email: "Unknown",
              },
      };

      // Enrich withdrawal transactions with fee details from WithdrawalRequest
      if (
        t.transactionType === "withdrawal" &&
        t.metadata?.withdrawalRequestId
      ) {
        const withdrawalReq = withdrawalRequestMap.get(
          t.metadata.withdrawalRequestId.toString(),
        );
        if (withdrawalReq) {
          // Update status from withdrawal request (source of truth)
          if (withdrawalReq.status === "completed")
            enriched.status = "completed";
          else if (
            withdrawalReq.status === "rejected" ||
            withdrawalReq.status === "failed"
          )
            enriched.status = "failed";
          else if (withdrawalReq.status === "cancelled")
            enriched.status = "cancelled";
          else enriched.status = "pending";

          // Add fee details to metadata
          enriched.metadata = {
            ...enriched.metadata,
            amountEUR: withdrawalReq.amountEUR,
            platformFee: withdrawalReq.platformFee,
            bankFee: withdrawalReq.bankFee,
            netAmountEUR: withdrawalReq.netAmountEUR,
            withdrawalStatus: withdrawalReq.status,
          };
        }
      }

      return enriched;
    });

    // Format platform transactions
    const enrichedPlatformTransactions = platformTransactions.map((t) => ({
      _id: t._id,
      userId: "admin",
      transactionType: t.transactionType,
      amount: t.amount,
      amountEUR: t.amountEUR,
      status: "completed",
      description: t.description,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      source: "platform" as const,
      metadata: {
        bankDetails: t.bankDetails,
        feeDetails: t.feeDetails,
        sourceType: t.sourceType,
        sourceId: t.sourceId,
        sourceName: t.sourceName,
        unclaimedReason: t.unclaimedReason,
        processedBy: t.processedBy,
        processedByEmail: t.processedByEmail,
      },
      userInfo: {
        id: "admin",
        name: t.processedByEmail || "Admin",
        email: t.processedByEmail || "admin@system",
      },
    }));

    // Format VAT payments
    const enrichedVatPayments = vatPayments.map((v) => ({
      _id: v._id,
      userId: "admin",
      transactionType: "vat_payment",
      amount: -v.vatAmountEUR, // Negative because it's money going out
      amountEUR: v.vatAmountEUR,
      status: "completed",
      description: `VAT Payment for ${new Date(v.periodStart).toLocaleDateString()} - ${new Date(v.periodEnd).toLocaleDateString()}`,
      createdAt: v.paidAt || v.createdAt,
      updatedAt: v.updatedAt,
      source: "vat" as const,
      metadata: {
        periodStart: v.periodStart,
        periodEnd: v.periodEnd,
        transactionCount: v.transactionCount,
        reference: v.reference,
        paidByEmail: v.paidByEmail,
      },
      userInfo: {
        id: "admin",
        name: v.paidByEmail || "Admin",
        email: v.paidByEmail || "admin@system",
      },
    }));

    // Format Vendor payments
    const enrichedVendorPayments = vendorPayments.map((v) => ({
      _id: v._id,
      userId: "admin",
      transactionType: "vendor_payment",
      amount: -v.amount, // Negative because it's money going out
      amountEUR: v.amount,
      status: "completed",
      description: `Vendor Payment to ${v.vendorName} (${v.serviceType})`,
      createdAt: v.paidAt || v.createdAt,
      updatedAt: v.updatedAt,
      source: "vendor" as const,
      metadata: {
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        serviceType: v.serviceType,
        reference: v.reference,
        invoiceNumber: v.invoiceNumber,
        paidByEmail: v.paidByEmail,
        billingCycle: v.billingCycle,
      },
      userInfo: {
        id: "admin",
        name: v.paidByEmail || "Admin",
        email: v.paidByEmail || "admin@system",
      },
    }));

    // Combine all transactions and sort by date
    const allTransactions = [
      ...enrichedWalletTransactions,
      ...enrichedPlatformTransactions,
      ...enrichedVatPayments,
      ...enrichedVendorPayments,
    ].sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dateA = new Date((a as any).createdAt).getTime();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dateB = new Date((b as any).createdAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    // Apply pagination to combined results
    const total = allTransactions.length;
    const transactions = allTransactions.slice(skip, skip + limit);
    const enrichedTransactions = transactions;

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

    // Get status breakdown
    const statusBreakdown = await WalletTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

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
          byStatus: statusBreakdown.reduce(
            (acc, s) => {
              acc[s._id] = s.count;
              return acc;
            },
            {} as Record<string, number>,
          ),
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
