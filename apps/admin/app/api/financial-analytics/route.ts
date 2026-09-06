import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import VATPayment from "@/database/models/vat-payment.model";
import VendorPayment from "@/database/models/vendor-payment.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";

/**
 * GET /api/financial-analytics
 * Get time-series financial data for charts
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30"; // days or 'all', 'custom'
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Calculate date range
    let startDate: Date;
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (period === "all") {
      startDate = new Date("2020-01-01"); // Far back enough
    } else if (period === "custom" && startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const days = parseInt(period) || 30;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    const conversionSettings = await CreditConversionSettings.getSingleton();
    const conversionRate = conversionSettings.eurToCreditsRate;

    // Aggregate daily data for wallet transactions
    const walletDailyAggregation = await WalletTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "completed",
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$transactionType",
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Aggregate daily data for platform transactions
    const platformDailyAggregation = await PlatformTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$transactionType",
          },
          totalAmountEUR: { $sum: "$amountEUR" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Aggregate VAT payments
    const vatAggregation = await VATPayment.aggregate([
      {
        $match: {
          paidAt: { $gte: startDate, $lte: endDate },
          status: "paid",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          totalVAT: { $sum: "$vatAmountEUR" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Aggregate vendor payments
    const vendorAggregation = await VendorPayment.aggregate([
      {
        $match: {
          paidAt: { $gte: startDate, $lte: endDate },
          status: "paid",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          totalVendor: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get revenue breakdown totals for pie chart
    const revenueBreakdown = await WalletTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "completed",
          transactionType: {
            $in: ["deposit", "competition_entry", "challenge_entry"],
          },
        },
      },
      {
        $group: {
          _id: "$transactionType",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get platform fee breakdown
    const platformFeeBreakdown = await PlatformTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          transactionType: {
            $in: [
              "platform_fee",
              "challenge_platform_fee",
              "deposit_fee",
              "withdrawal_fee",
              "unclaimed_pool",
            ],
          },
        },
      },
      {
        $group: {
          _id: "$transactionType",
          total: { $sum: "$amountEUR" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get expense breakdown
    const expenseBreakdown = await PlatformTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          transactionType: {
            $in: [
              "admin_withdrawal",
              "custom_expense",
              "incident_compensation",
            ],
          },
        },
      },
      {
        $group: {
          _id: "$transactionType",
          total: { $sum: { $abs: "$amountEUR" } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Add vendor payments to expense breakdown
    const vendorTotal = await VendorPayment.aggregate([
      {
        $match: {
          paidAt: { $gte: startDate, $lte: endDate },
          status: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Add VAT payments to expense breakdown
    const vatTotal = await VATPayment.aggregate([
      {
        $match: {
          paidAt: { $gte: startDate, $lte: endDate },
          status: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$vatAmountEUR" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build daily time series data
    const dateMap = new Map<
      string,
      {
        date: string;
        deposits: number;
        withdrawals: number;
        competitionFees: number;
        challengeFees: number;
        depositFees: number;
        withdrawalFees: number;
        unclaimedPools: number;
        adminWithdrawals: number;
        vendorPayments: number;
        vatPayments: number;
        customExpenses: number;
        adminBalanceAdded: number;
        totalIncome: number;
        totalExpenses: number;
        netProfit: number;
      }
    >();

    // Initialize all dates in range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      dateMap.set(dateStr, {
        date: dateStr,
        deposits: 0,
        withdrawals: 0,
        competitionFees: 0,
        challengeFees: 0,
        depositFees: 0,
        withdrawalFees: 0,
        unclaimedPools: 0,
        adminWithdrawals: 0,
        vendorPayments: 0,
        vatPayments: 0,
        customExpenses: 0,
        adminBalanceAdded: 0,
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Populate wallet transaction data
    for (const item of walletDailyAggregation) {
      const dateStr = item._id.date;
      const entry = dateMap.get(dateStr);
      if (entry) {
        const amountEUR = Math.abs(item.totalAmount) / conversionRate;
        switch (item._id.type) {
          case "deposit":
            entry.deposits = amountEUR;
            break;
          case "withdrawal":
            entry.withdrawals = amountEUR;
            break;
        }
      }
    }

    // Populate platform transaction data
    for (const item of platformDailyAggregation) {
      const dateStr = item._id.date;
      const entry = dateMap.get(dateStr);
      if (entry) {
        const amountEUR = Math.abs(item.totalAmountEUR);
        switch (item._id.type) {
          case "platform_fee":
            entry.competitionFees = amountEUR;
            break;
          case "challenge_platform_fee":
            entry.challengeFees = amountEUR;
            break;
          case "deposit_fee":
            entry.depositFees = amountEUR;
            break;
          case "withdrawal_fee":
            entry.withdrawalFees = amountEUR;
            break;
          case "unclaimed_pool":
            entry.unclaimedPools = amountEUR;
            break;
          case "admin_withdrawal":
            entry.adminWithdrawals = amountEUR;
            break;
          case "custom_expense":
            entry.customExpenses = amountEUR;
            break;
          case "admin_balance_add":
            entry.adminBalanceAdded = amountEUR;
            break;
        }
      }
    }

    // Populate VAT data
    for (const item of vatAggregation) {
      const entry = dateMap.get(item._id);
      if (entry) {
        entry.vatPayments = item.totalVAT;
      }
    }

    // Populate vendor data
    for (const item of vendorAggregation) {
      const entry = dateMap.get(item._id);
      if (entry) {
        entry.vendorPayments = item.totalVendor;
      }
    }

    // Calculate totals for each day
    for (const entry of dateMap.values()) {
      entry.totalIncome =
        entry.competitionFees +
        entry.challengeFees +
        entry.depositFees +
        entry.withdrawalFees +
        entry.unclaimedPools +
        entry.adminBalanceAdded;
      entry.totalExpenses =
        entry.adminWithdrawals +
        entry.vendorPayments +
        entry.vatPayments +
        entry.customExpenses;
      entry.netProfit = entry.totalIncome - entry.totalExpenses;
    }

    // Convert to array and sort by date
    const timeSeries = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Calculate cumulative totals
    let cumulativeIncome = 0;
    let cumulativeExpenses = 0;
    const cumulativeData = timeSeries.map((day) => {
      cumulativeIncome += day.totalIncome;
      cumulativeExpenses += day.totalExpenses;
      return {
        ...day,
        cumulativeIncome,
        cumulativeExpenses,
        cumulativeProfit: cumulativeIncome - cumulativeExpenses,
      };
    });

    // Calculate summary totals
    const totalIncome = timeSeries.reduce((sum, d) => sum + d.totalIncome, 0);
    const totalExpenses = timeSeries.reduce(
      (sum, d) => sum + d.totalExpenses,
      0,
    );
    const totalDeposits = timeSeries.reduce((sum, d) => sum + d.deposits, 0);
    const totalWithdrawals = timeSeries.reduce(
      (sum, d) => sum + d.withdrawals,
      0,
    );

    // Format revenue pie chart data
    const revenuePieData = [
      {
        name: "Competition Fees",
        value:
          platformFeeBreakdown.find((x) => x._id === "platform_fee")?.total ||
          0,
        color: "#10b981",
      },
      {
        name: "Challenge Fees",
        value:
          platformFeeBreakdown.find((x) => x._id === "challenge_platform_fee")
            ?.total || 0,
        color: "#f97316",
      },
      {
        name: "Deposit Fees",
        value:
          platformFeeBreakdown.find((x) => x._id === "deposit_fee")?.total || 0,
        color: "#22c55e",
      },
      {
        name: "Withdrawal Fees",
        value:
          platformFeeBreakdown.find((x) => x._id === "withdrawal_fee")?.total ||
          0,
        color: "#3b82f6",
      },
      {
        name: "Unclaimed Pools",
        value:
          platformFeeBreakdown.find((x) => x._id === "unclaimed_pool")?.total ||
          0,
        color: "#f59e0b",
      },
    ].filter((x) => x.value > 0);

    // Format expense pie chart data
    const expensePieData = [
      {
        name: "Admin Withdrawals",
        value:
          expenseBreakdown.find((x) => x._id === "admin_withdrawal")?.total ||
          0,
        color: "#ef4444",
      },
      {
        name: "Vendor Payments",
        value: vendorTotal[0]?.total || 0,
        color: "#a855f7",
      },
      {
        name: "VAT Payments",
        value: vatTotal[0]?.total || 0,
        color: "#6366f1",
      },
      {
        name: "Custom Expenses",
        value:
          expenseBreakdown.find((x) => x._id === "custom_expense")?.total || 0,
        color: "#f43f5e",
      },
      {
        name: "Incident Compensations",
        value:
          expenseBreakdown.find((x) => x._id === "incident_compensation")
            ?.total || 0,
        color: "#dc2626",
      },
    ].filter((x) => x.value > 0);

    // Calculate month-over-month comparison
    const midPoint = Math.floor(cumulativeData.length / 2);
    const firstHalf = cumulativeData.slice(0, midPoint);
    const secondHalf = cumulativeData.slice(midPoint);

    const firstHalfIncome = firstHalf.reduce(
      (sum, d) => sum + d.totalIncome,
      0,
    );
    const secondHalfIncome = secondHalf.reduce(
      (sum, d) => sum + d.totalIncome,
      0,
    );
    const incomeGrowth =
      firstHalfIncome > 0
        ? ((secondHalfIncome - firstHalfIncome) / firstHalfIncome) * 100
        : 0;

    const firstHalfExpenses = firstHalf.reduce(
      (sum, d) => sum + d.totalExpenses,
      0,
    );
    const secondHalfExpenses = secondHalf.reduce(
      (sum, d) => sum + d.totalExpenses,
      0,
    );
    const expenseGrowth =
      firstHalfExpenses > 0
        ? ((secondHalfExpenses - firstHalfExpenses) / firstHalfExpenses) * 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days: Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
          ),
        },
        summary: {
          totalIncome,
          totalExpenses,
          netProfit: totalIncome - totalExpenses,
          totalDeposits,
          totalWithdrawals,
          profitMargin:
            totalIncome > 0
              ? ((totalIncome - totalExpenses) / totalIncome) * 100
              : 0,
          incomeGrowth,
          expenseGrowth,
        },
        timeSeries: cumulativeData,
        revenuePieData,
        expensePieData,
      },
    });
  } catch (error) {
    console.error("Error fetching financial analytics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch financial analytics" },
      { status: 500 },
    );
  }
}
