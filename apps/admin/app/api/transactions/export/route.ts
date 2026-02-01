import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";

/**
 * GET /api/transactions/export
 * Export transactions to CSV (Excel-compatible)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const status = searchParams.get("status") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search") || "";

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (type && type !== "all") {
      query.transactionType = type;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch all matching transactions (limit to 10000 to prevent memory issues)
    const transactions = await WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    // Get user info for all transactions
    const userIds = [
      ...new Set(
        transactions.map((t) => t.userId).filter((id) => id !== "platform"),
      ),
    ];
    const usersMap = await getUsersByIds(userIds);

    // Format date for Excel
    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toISOString().replace("T", " ").substring(0, 19);
    };

    // Transaction type labels
    const typeLabels: Record<string, string> = {
      deposit: "User Deposit",
      withdrawal: "User Withdrawal",
      competition_entry: "Competition Entry",
      competition_win: "Competition Win",
      competition_refund: "Competition Refund",
      platform_fee: "Platform Fee",
      admin_adjustment: "Admin Adjustment",
      admin_withdrawal: "Admin Withdrawal",
      vat_payment: "VAT Payment",
      vendor_payment: "🏢 Vendor Payment",
      unclaimed_pool: "Unclaimed Pool",
      deposit_fee: "Deposit Fee",
      withdrawal_fee: "Withdrawal Fee",
      challenge_entry: "Challenge Entry",
      challenge_win: "Challenge Win",
      challenge_loss: "Challenge Loss",
      challenge_refund: "Challenge Refund",
      gamemaster_earning: "GM Competition Earning",
      gamemaster_challenge_referral: "GM Challenge Earning",
      admin_balance_add: "Admin Balance Add",
      custom_expense: "Custom Expense",
    };

    // Build CSV content
    const headers = [
      "Transaction ID",
      "Date",
      "Type",
      "User ID",
      "User Name",
      "User Email",
      "Amount (Credits)",
      "Amount (EUR)",
      "Status",
      "Description",
      "Payment Method",
      "Competition ID",
    ];

    const rows = transactions.map((tx) => {
      const userInfo =
        tx.userId === "platform"
          ? { name: "Platform", email: "system" }
          : usersMap.get(tx.userId) || { name: "Unknown", email: "Unknown" };

      // Calculate EUR amount (if available in metadata)
      const amountEUR =
        tx.metadata?.amountEUR || tx.metadata?.amount_eur || tx.amount / 100;

      return [
        tx._id.toString(),
        formatDate(tx.createdAt),
        typeLabels[tx.transactionType] || tx.transactionType,
        tx.userId,
        userInfo.name || "Unknown",
        userInfo.email || "Unknown",
        tx.amount.toFixed(2),
        amountEUR.toFixed(2),
        tx.status,
        tx.description || "",
        tx.paymentMethod || "",
        tx.competitionId || "",
      ];
    });

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV string
    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) =>
        row.map((cell) => escapeCSV(String(cell))).join(","),
      ),
    ].join("\n");

    // Add BOM for Excel UTF-8 compatibility
    const bom = "\uFEFF";
    const csvWithBom = bom + csvContent;

    // Generate filename with date range
    const now = new Date();
    let filename = `transactions_${now.toISOString().split("T")[0]}`;
    if (startDate && endDate) {
      filename = `transactions_${startDate}_to_${endDate}`;
    } else if (type !== "all") {
      filename = `transactions_${type}_${now.toISOString().split("T")[0]}`;
    }

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export transactions" },
      { status: 500 },
    );
  }
}
