import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import { auditLogService } from "@/lib/services/audit-log.service";

// Expense categories
export const EXPENSE_CATEGORIES = [
  "marketing",
  "software",
  "hosting",
  "legal",
  "accounting",
  "office",
  "equipment",
  "travel",
  "salary",
  "consulting",
  "advertising",
  "insurance",
  "utilities",
  "maintenance",
  "subscriptions",
  "other",
] as const;

/**
 * GET /api/admin-funds
 * Get admin funds summary (balance adds and custom expenses)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build date filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      transactionType: { $in: ["admin_balance_add", "custom_expense"] },
    };
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }

    // Get recent transactions
    const transactions = await PlatformTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Get totals for balance additions
    const balanceAddTotal = await PlatformTransaction.aggregate([
      { $match: { transactionType: "admin_balance_add" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amountEUR" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get totals for custom expenses
    const expenseTotal = await PlatformTransaction.aggregate([
      { $match: { transactionType: "custom_expense" } },
      {
        $group: {
          _id: null,
          total: { $sum: { $abs: "$amountEUR" } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get expenses by category
    const expensesByCategory = await PlatformTransaction.aggregate([
      { $match: { transactionType: "custom_expense" } },
      {
        $group: {
          _id: "$expenseDetails.category",
          total: { $sum: { $abs: "$amountEUR" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Monthly breakdown for current year
    const currentYear = new Date().getFullYear();
    const monthlyBreakdown = await PlatformTransaction.aggregate([
      {
        $match: {
          transactionType: { $in: ["admin_balance_add", "custom_expense"] },
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lte: new Date(currentYear, 11, 31),
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            type: "$transactionType",
          },
          total: { $sum: "$amountEUR" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    // Calculate net operating balance (balance adds - expenses)
    const totalBalanceAdded = balanceAddTotal[0]?.total || 0;
    const totalExpenses = expenseTotal[0]?.total || 0;
    const netOperatingBalance = totalBalanceAdded - totalExpenses;

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        summary: {
          totalBalanceAdded,
          balanceAddCount: balanceAddTotal[0]?.count || 0,
          totalExpenses,
          expenseCount: expenseTotal[0]?.count || 0,
          netOperatingBalance,
          expensesByCategory,
          monthlyBreakdown,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching admin funds:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch admin funds" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin-funds/add-balance
 * Add balance to operating funds
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const {
      action,
      amount,
      source,
      reference,
      notes,
      category,
      vendor,
      invoiceNumber,
      paymentMethod,
      description,
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    // Get conversion rate for credits
    const conversionSettings = await CreditConversionSettings.getSingleton();
    const conversionRate = conversionSettings.eurToCreditsRate;
    const amountCredits = amount * conversionRate;

    if (action === "add_balance") {
      // Admin adding funds to operating balance
      if (!source) {
        return NextResponse.json(
          { success: false, error: "Source is required for balance addition" },
          { status: 400 },
        );
      }

      const transaction = await PlatformTransaction.create({
        transactionType: "admin_balance_add",
        amount: amountCredits,
        amountEUR: amount,
        sourceType: "manual",
        description: description || `Admin balance addition from ${source}`,
        notes,
        balanceAddDetails: {
          source,
          reference,
        },
        processedBy: admin.adminId || "admin",
        processedByEmail: admin.email,
      });

      console.log(
        `💰 Admin Balance Added: €${amount} from ${source} by ${admin.email}`,
      );

      // Log audit
      try {
        await auditLogService.logAdminBalanceAdd(
          {
            id: admin.adminId || "admin",
            email: admin.email || "admin",
            name: (admin.email || "admin").split("@")[0],
            role: "admin",
          },
          amount,
          source,
          reference || `BAL-${transaction._id}`,
        );
      } catch (auditError) {
        console.error("Failed to log audit action:", auditError);
      }

      return NextResponse.json({
        success: true,
        transaction,
        message: `€${amount.toFixed(2)} added to operating funds from ${source}`,
      });
    } else if (action === "add_expense") {
      // Admin recording a custom expense
      if (!category) {
        return NextResponse.json(
          { success: false, error: "Category is required for expense" },
          { status: 400 },
        );
      }

      const transaction = await PlatformTransaction.create({
        transactionType: "custom_expense",
        amount: -amountCredits, // Negative for expense
        amountEUR: -amount, // Negative for expense
        sourceType: "manual",
        description:
          description ||
          `Custom expense: ${category}${vendor ? ` - ${vendor}` : ""}`,
        notes,
        expenseDetails: {
          category,
          vendor,
          invoiceNumber,
          paymentMethod,
        },
        processedBy: admin.adminId || "admin",
        processedByEmail: admin.email,
      });

      console.log(
        `💸 Custom Expense Recorded: €${amount} for ${category} by ${admin.email}`,
      );

      // Log audit
      try {
        await auditLogService.logCustomExpense(
          {
            id: admin.adminId || "admin",
            email: admin.email || "admin",
            name: (admin.email || "admin").split("@")[0],
            role: "admin",
          },
          amount,
          category,
          vendor || "N/A",
          invoiceNumber || `EXP-${transaction._id}`,
        );
      } catch (auditError) {
        console.error("Failed to log audit action:", auditError);
      }

      return NextResponse.json({
        success: true,
        transaction,
        message: `€${amount.toFixed(2)} expense recorded for ${category}`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Use "add_balance" or "add_expense"',
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error processing admin funds:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 },
    );
  }
}
