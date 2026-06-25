import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import { fetchMergedTransactions } from "@/lib/services/transaction-history.service";

/**
 * GET /api/transactions/export
 * Export transactions to CSV (Excel-compatible).
 *
 * Reason: Uses the SAME fetchMergedTransactions() as the list endpoint so the
 * downloaded report contains exactly the rows the admin sees (including
 * platform / VAT / vendor records) and honours every active filter.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const filters = {
      type,
      status: searchParams.get("status") || "all",
      userId: searchParams.get("userId"),
      competitionId: searchParams.get("competitionId"),
      search: searchParams.get("search") || "",
      startDate,
      endDate,
      minAmount: searchParams.get("minAmount"),
      maxAmount: searchParams.get("maxAmount"),
      sortBy: "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    // Reason: Up to 10k rows for an export (vs 1k for the on-screen list).
    const { transactions } = await fetchMergedTransactions(filters, {
      maxRecords: 10000,
    });

    // Reason: Convert credits → EUR using the real configured rate, not a
    // hardcoded /100, so the EUR column is accurate when a row lacks an
    // explicit EUR amount in its metadata.
    const conversionSettings = await CreditConversionSettings.getSingleton();
    const conversionRate = conversionSettings.eurToCreditsRate || 1;

    // Format date for Excel
    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toISOString().replace("T", " ").substring(0, 19);
    };

    // Transaction type labels
    const typeLabels: Record<string, string> = {
      deposit: "User Deposit",
      withdrawal: "User Withdrawal",
      withdrawal_fee: "Withdrawal Fee",
      withdrawal_refund: "Withdrawal Refund",
      manual_deposit_credit: "Manual Deposit Credit",
      competition_entry: "Competition Entry",
      competition_win: "Competition Win",
      competition_refund: "Competition Refund",
      platform_fee: "Platform Fee",
      admin_adjustment: "Admin Adjustment",
      admin_withdrawal: "Admin Withdrawal",
      vat_payment: "VAT Payment",
      vendor_payment: "Vendor Payment",
      unclaimed_pool: "Unclaimed Pool",
      deposit_fee: "Deposit Fee",
      challenge_entry: "Challenge Entry",
      challenge_win: "Challenge Win",
      challenge_loss: "Challenge Loss",
      challenge_refund: "Challenge Refund",
      challenge_declined: "Challenge Declined",
      challenge_expired: "Challenge Expired",
      gamemaster_earning: "GM Competition Earning",
      gamemaster_challenge_referral: "GM Challenge Earning",
      gamemaster_subscription: "GM Subscription",
      gamemaster_subscription_refund: "GM Subscription Refund",
      incident_compensation: "Incident Compensation",
      chargeback_clawback: "Chargeback Clawback",
      admin_balance_add: "Admin Balance Add",
      custom_expense: "Custom Expense",
    };

    // Build CSV content
    const headers = [
      "Transaction ID",
      "Date",
      "Type",
      "Source",
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
      const userInfo = tx.userInfo || { name: "Unknown", email: "Unknown" };

      // Reason: prefer an explicit EUR amount (set on platform/VAT/vendor rows
      // and on withdrawal metadata); otherwise derive from credits via the rate.
      const amountEUR =
        typeof tx.amountEUR === "number"
          ? tx.amountEUR
          : typeof tx.metadata?.amountEUR === "number"
            ? tx.metadata.amountEUR
            : (tx.amount || 0) / conversionRate;

      return [
        tx._id.toString(),
        formatDate(tx.createdAt),
        typeLabels[tx.transactionType] || tx.transactionType,
        tx.source || "wallet",
        tx.userId,
        userInfo.name || "Unknown",
        userInfo.email || "Unknown",
        (tx.amount || 0).toFixed(2),
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
