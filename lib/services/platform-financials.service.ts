import { connectToDatabase } from "@/database/mongoose";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import VATPayment from "@/database/models/vat-payment.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";

/**
 * Platform Financials Service
 * Tracks all platform earnings, unclaimed pools, and provides real-time financial metrics
 */

export interface UnclaimedPoolParams {
  competitionId: string;
  competitionName: string;
  poolAmount: number;
  // Note: 'partial_unclaimed' was removed - when there are fewer winners than prizes,
  // the extra % is REDISTRIBUTED to existing winners as bonus, not kept by platform
  reason:
    | "no_participants"
    | "all_disqualified"
    | "no_qualified_winners"
    | "competition_cancelled";
  winnersCount: number;
  expectedWinnersCount: number;
  description?: string;
}

export interface AdminWithdrawalParams {
  amount: number;
  amountEUR: number;
  bankName?: string;
  accountLastFour?: string;
  reference?: string;
  adminId: string;
  adminEmail: string;
  notes?: string;
}

export const PlatformFinancialsService = {
  /**
   * Record unclaimed pool funds when competition ends without winners
   */
  recordUnclaimedPool: async (params: UnclaimedPoolParams): Promise<void> => {
    await connectToDatabase();

    const conversionSettings = await CreditConversionSettings.getSingleton();
    const eurAmount = params.poolAmount / conversionSettings.eurToCreditsRate;

    await PlatformTransaction.create({
      transactionType: "unclaimed_pool",
      amount: params.poolAmount,
      amountEUR: eurAmount,
      sourceType: "competition",
      sourceId: params.competitionId,
      sourceName: params.competitionName,
      unclaimedReason: params.reason,
      originalPoolAmount: params.poolAmount,
      winnersCount: params.winnersCount,
      expectedWinnersCount: params.expectedWinnersCount,
      description:
        params.description ||
        `Unclaimed pool from ${params.competitionName}: ${params.reason.replace("_", " ")}`,
    });

    console.log(
      `💰 [PLATFORM] Recorded unclaimed pool: ${params.poolAmount} credits (€${eurAmount.toFixed(2)}) from ${params.competitionName}`,
    );
    console.log(
      `   Reason: ${params.reason}, Winners: ${params.winnersCount}/${params.expectedWinnersCount}`,
    );
  },

  /**
   * Record retained GM fee (when GM subscription is inactive)
   * These fees would have gone to the GM but are kept by platform
   */
  recordRetainedGmFee: async (params: {
    sourceType: "competition" | "challenge";
    sourceId: string;
    sourceName: string;
    gameMasterId: string;
    gameMasterEmail?: string;
    referredUsersCount: number;
    amount: number; // Amount that would have been paid to GM
    originalFeePercentage: number;
    subscriptionStatus: string;
    referredUserIds?: string[];
  }): Promise<void> => {
    await connectToDatabase();

    const conversionSettings = await CreditConversionSettings.getSingleton();
    const eurAmount = params.amount / conversionSettings.eurToCreditsRate;

    await PlatformTransaction.create({
      transactionType: "retained_gm_fee",
      amount: params.amount,
      amountEUR: eurAmount,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceName: params.sourceName,
      retainedGmFeeDetails: {
        gameMasterId: params.gameMasterId,
        gameMasterEmail: params.gameMasterEmail,
        referredUsersCount: params.referredUsersCount,
        originalFeePercentage: params.originalFeePercentage,
        subscriptionStatus: params.subscriptionStatus,
        referredUserIds: params.referredUserIds,
      },
      description: `Retained GM fee: ${params.referredUsersCount} referral(s) from inactive GM (${params.subscriptionStatus}) - ${params.sourceName}`,
    });

    console.log(
      `💰 [PLATFORM] Retained GM fee: ${params.amount} credits (€${eurAmount.toFixed(2)}) from inactive GM ${params.gameMasterId}`,
    );
    console.log(
      `   ${params.sourceType.charAt(0).toUpperCase() + params.sourceType.slice(1)}: ${params.sourceName}, Referrals: ${params.referredUsersCount}, Status: ${params.subscriptionStatus}`,
    );
  },

  /**
   * Record platform fee earnings
   */
  recordPlatformFee: async (params: {
    amount: number;
    sourceType:
      | "competition"
      | "challenge"
      | "user_deposit"
      | "user_withdrawal";
    sourceId?: string;
    sourceName?: string;
    description: string;
    // Reason: Flag set at recording time so the financial dashboard can
    // distinguish admin-created vs GM-created competition fees without joins.
    isGmCreated?: boolean;
  }): Promise<void> => {
    await connectToDatabase();

    const conversionSettings = await CreditConversionSettings.getSingleton();
    const eurAmount = params.amount / conversionSettings.eurToCreditsRate;

    const transactionType =
      params.sourceType === "user_deposit"
        ? "deposit_fee"
        : params.sourceType === "user_withdrawal"
          ? "withdrawal_fee"
          : params.sourceType === "challenge"
            ? "challenge_platform_fee"
            : "platform_fee";

    await PlatformTransaction.create({
      transactionType,
      amount: params.amount,
      amountEUR: eurAmount,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceName: params.sourceName,
      description: params.description,
      ...(params.isGmCreated !== undefined && { isGmCreated: params.isGmCreated }),
    });

    console.log(
      `💵 [PLATFORM] Recorded fee: ${params.amount} credits (€${eurAmount.toFixed(2)}) - ${params.description}`,
    );
  },

  /**
   * Record deposit fee (platform and bank fees)
   */
  recordDepositFee: async (params: {
    userId: string;
    depositAmount: number; // EUR amount deposited
    platformFeeAmount: number; // EUR platform fee charged to user
    bankFeeAmount: number; // EUR bank fee (what Stripe charges us)
    netEarning: number; // EUR net = platform fee - bank fee
    transactionId: string;
  }): Promise<void> => {
    console.log(`💵 [PLATFORM] Recording deposit fee...`, params);

    await connectToDatabase();

    // Record platform deposit fee income
    const transaction = await PlatformTransaction.create({
      transactionType: "deposit_fee",
      amount: params.platformFeeAmount,
      amountEUR: params.platformFeeAmount,
      sourceType: "user_deposit",
      sourceId: params.transactionId,
      userId: params.userId,
      feeDetails: {
        depositAmount: params.depositAmount,
        platformFee: params.platformFeeAmount,
        bankFee: params.bankFeeAmount,
        netEarning: params.netEarning,
      },
      description: `Deposit fee: €${params.platformFeeAmount.toFixed(2)} (Bank: €${params.bankFeeAmount.toFixed(2)}, Net: €${params.netEarning.toFixed(2)})`,
    });

    console.log(`✅ [PLATFORM] Deposit fee recorded: ID=${transaction._id}`);
    console.log(`   Platform Fee: €${params.platformFeeAmount.toFixed(2)}`);
    console.log(`   Bank Fee: €${params.bankFeeAmount.toFixed(2)}`);
    console.log(`   Net Earning: €${params.netEarning.toFixed(2)}`);
  },

  /**
   * Record withdrawal fee (platform and bank fees)
   */
  recordWithdrawalFee: async (params: {
    userId: string;
    withdrawalAmount: number; // EUR amount withdrawn
    platformFeeAmount: number; // EUR platform fee charged to user
    bankFeeAmount: number; // EUR bank fee (payout costs)
    netEarning: number; // EUR net = platform fee - bank fee
    transactionId: string;
  }): Promise<void> => {
    await connectToDatabase();

    // Record platform withdrawal fee income
    await PlatformTransaction.create({
      transactionType: "withdrawal_fee",
      amount: params.platformFeeAmount,
      amountEUR: params.platformFeeAmount,
      sourceType: "user_withdrawal",
      sourceId: params.transactionId,
      userId: params.userId,
      feeDetails: {
        withdrawalAmount: params.withdrawalAmount,
        platformFee: params.platformFeeAmount,
        bankFee: params.bankFeeAmount,
        netEarning: params.netEarning,
      },
      description: `Withdrawal fee: €${params.platformFeeAmount.toFixed(2)} (Bank: €${params.bankFeeAmount.toFixed(2)}, Net: €${params.netEarning.toFixed(2)})`,
    });

    console.log(
      `💵 [PLATFORM] Withdrawal fee: €${params.platformFeeAmount.toFixed(2)} - Bank: €${params.bankFeeAmount.toFixed(2)} = Net: €${params.netEarning.toFixed(2)}`,
    );
  },

  /**
   * Record admin withdrawal (converting platform credits to real money)
   */
  recordAdminWithdrawal: async (
    params: AdminWithdrawalParams,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ success: boolean; transaction?: any; error?: string }> => {
    await connectToDatabase();

    try {
      const transaction = await PlatformTransaction.create({
        transactionType: "admin_withdrawal",
        amount: -params.amount, // Negative because platform is losing credits
        amountEUR: -params.amountEUR,
        sourceType: "manual",
        bankDetails: {
          accountNumber: params.accountLastFour,
          bankName: params.bankName,
          reference: params.reference,
          withdrawnBy: params.adminEmail,
        },
        description: `Admin withdrawal: €${params.amountEUR.toFixed(2)} (${params.amount} credits)`,
        notes: params.notes,
        processedBy: params.adminId,
        processedByEmail: params.adminEmail,
      });

      console.log(
        `🏦 [PLATFORM] Admin withdrawal recorded: €${params.amountEUR.toFixed(2)} by ${params.adminEmail}`,
      );

      return { success: true, transaction };
    } catch (error) {
      console.error("Error recording admin withdrawal:", error);
      return { success: false, error: "Failed to record withdrawal" };
    }
  },

  /**
   * Get comprehensive platform financial stats
   */
  getFinancialStats: async (): Promise<{
    // User Liabilities
    totalUserCredits: number;
    totalUserCreditsEUR: number;
    activeWalletsCount: number;

    // Platform Earnings by Category (Gross - what platform charged users)
    totalUnclaimedPools: number;
    totalPlatformFees: number; // Competition platform fees
    totalChallengeFees: number; // Challenge platform fees
    totalMarketplaceSales: number; // Marketplace item purchases
    marketplacePurchases: number; // Number of marketplace purchases
    totalDepositFeesGross: number; // Platform deposit fees charged to users
    totalWithdrawalFeesGross: number; // Platform withdrawal fees charged to users
    totalRetainedGmFees: number; // GM fees retained due to inactive subscriptions
    retainedGmFeesCount: number; // Number of inactive GM fee instances

    // Bank Fees (what payment providers charge platform)
    totalBankDepositFees: number; // Stripe/bank fees on deposits
    totalBankWithdrawalFees: number; // Bank fees on payouts
    totalBankFees: number; // Total bank fees

    // Net Earnings (what platform actually keeps)
    netDepositEarnings: number; // Deposit fees - bank deposit fees
    netWithdrawalEarnings: number; // Withdrawal fees - bank withdrawal fees
    totalGrossEarnings: number; // All platform fees charged
    totalNetEarnings: number; // Gross - bank fees
    totalNetEarningsEUR: number;

    // Admin Withdrawals
    totalAdminWithdrawals: number;
    totalAdminWithdrawalsEUR: number;

    // Net Platform Position
    platformNetCredits: number;
    platformNetEUR: number;

    // Bank Reconciliation
    totalUserDeposits: number;
    totalUserWithdrawals: number;
    theoreticalBankBalance: number; // What should be in bank

    // Risk Metrics
    coverageRatio: number;
    maxWithdrawalLiability: number;

    // VAT Tracking
    totalVATCollected: number;
    totalVATPaid: number;
    outstandingVAT: number;

    // Conversion Rate
    conversionRate: number;
  }> => {
    await connectToDatabase();

    const conversionSettings = await CreditConversionSettings.getSingleton();
    const conversionRate = conversionSettings.eurToCreditsRate;

    // Get all user wallet balances (what we owe users)
    const walletAggregation = await CreditWallet.aggregate([
      {
        $group: {
          _id: null,
          totalCredits: { $sum: "$creditBalance" },
          totalDeposited: { $sum: "$totalDeposited" },
          totalWithdrawn: { $sum: "$totalWithdrawn" },
          count: { $sum: { $cond: [{ $gt: ["$creditBalance", 0] }, 1, 0] } },
        },
      },
    ]);

    const walletStats = walletAggregation[0] || {
      totalCredits: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      count: 0,
    };

    // Get platform earnings by type with fee breakdown
    const platformEarnings = await PlatformTransaction.aggregate([
      {
        $group: {
          _id: "$transactionType",
          total: { $sum: "$amount" },
          totalEUR: { $sum: "$amountEUR" },
          count: { $sum: 1 },
          totalPlatformFees: { $sum: "$feeDetails.platformFee" },
          totalBankFees: { $sum: "$feeDetails.bankFee" },
          totalNetEarnings: { $sum: "$feeDetails.netEarning" },
        },
      },
    ]);

    // Get marketplace sales
    const marketplaceAggregation = await UserPurchase.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$pricePaid" },
          purchaseCount: { $sum: 1 },
        },
      },
    ]);
    const marketplaceSales = marketplaceAggregation[0] || {
      totalSales: 0,
      purchaseCount: 0,
    };

    // Process earnings
    // Reason: ALL summary totals below are in EUR for consistent financial reporting.
    // PlatformTransaction stores `amount` (credits for comp/challenge/unclaimed/GM fees,
    // EUR for deposit/withdrawal fees) and `amountEUR` (always EUR).
    // We use `earning.totalEUR` for credit-based types to get proper EUR values.
    let totalUnclaimedPools = 0; // EUR
    let totalPlatformFees = 0; // EUR — Competition platform fees
    let totalChallengeFees = 0; // EUR — Challenge platform fees
    const totalMarketplaceSales = marketplaceSales.totalSales / conversionRate; // EUR
    const marketplacePurchases = marketplaceSales.purchaseCount;
    let totalDepositFeesGross = 0; // EUR — already stored in EUR
    let totalWithdrawalFeesGross = 0; // EUR — already stored in EUR
    let totalBankDepositFees = 0; // EUR
    let totalBankWithdrawalFees = 0; // EUR
    let netDepositEarnings = 0; // EUR
    let netWithdrawalEarnings = 0; // EUR
    let totalAdminWithdrawals = 0; // Credits (for credit display)
    let totalAdminWithdrawalsEUR = 0; // EUR
    let totalRetainedGmFees = 0; // EUR
    let retainedGmFeesCount = 0;

    for (const earning of platformEarnings) {
      switch (earning._id) {
        case "unclaimed_pool":
          // Reason: Use totalEUR because `amount` is in credits for unclaimed pools
          totalUnclaimedPools = earning.totalEUR;
          break;
        case "platform_fee":
          // Reason: Use totalEUR because `amount` is in credits for competition fees
          totalPlatformFees = earning.totalEUR;
          break;
        case "challenge_platform_fee":
          // Reason: Use totalEUR because `amount` is in credits for challenge fees
          totalChallengeFees = earning.totalEUR;
          break;
        case "deposit_fee":
          // Reason: For deposit fees, amount and amountEUR are both EUR
          totalDepositFeesGross = earning.totalPlatformFees || earning.totalEUR;
          totalBankDepositFees = earning.totalBankFees || 0;
          netDepositEarnings =
            earning.totalNetEarnings ||
            totalDepositFeesGross - totalBankDepositFees;
          break;
        case "withdrawal_fee":
          // Reason: For withdrawal fees, amount and amountEUR are both EUR
          totalWithdrawalFeesGross = earning.totalPlatformFees || earning.totalEUR;
          totalBankWithdrawalFees = earning.totalBankFees || 0;
          netWithdrawalEarnings =
            earning.totalNetEarnings ||
            totalWithdrawalFeesGross - totalBankWithdrawalFees;
          break;
        case "admin_withdrawal":
          totalAdminWithdrawals = Math.abs(earning.total);
          totalAdminWithdrawalsEUR = Math.abs(earning.totalEUR);
          break;
        case "retained_gm_fee":
          // Reason: Use totalEUR because `amount` is in credits for retained GM fees
          totalRetainedGmFees = earning.totalEUR;
          retainedGmFeesCount = earning.count;
          break;
      }
    }

    // Reason: All values below are now consistently in EUR
    const totalBankFees = totalBankDepositFees + totalBankWithdrawalFees;
    const totalGrossEarnings =
      totalUnclaimedPools +
      totalPlatformFees +
      totalChallengeFees +
      totalMarketplaceSales +
      totalDepositFeesGross +
      totalWithdrawalFeesGross +
      totalRetainedGmFees;
    const totalNetEarnings =
      totalUnclaimedPools +
      totalPlatformFees +
      totalChallengeFees +
      totalMarketplaceSales +
      netDepositEarnings +
      netWithdrawalEarnings +
      totalRetainedGmFees;
    const totalNetEarningsEUR = totalNetEarnings;

    const platformNetCredits = totalNetEarnings - totalAdminWithdrawalsEUR;
    const platformNetEUR = platformNetCredits;

    // Get VAT data
    // Total VAT collected from all deposits
    const vatCollectedAggregation = await WalletTransaction.aggregate([
      {
        $match: {
          transactionType: "deposit",
          status: "completed",
          "metadata.vatAmount": { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalVAT: { $sum: "$metadata.vatAmount" },
        },
      },
    ]);
    const totalVATCollected = vatCollectedAggregation[0]?.totalVAT || 0;

    // Total VAT paid to government
    const vatPaidAggregation = await VATPayment.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$vatAmountEUR" },
        },
      },
    ]);
    const totalVATPaid = vatPaidAggregation[0]?.totalPaid || 0;
    const outstandingVAT = totalVATCollected - totalVATPaid;

    // Bank reconciliation (ALL values in EUR):
    // What we HAVE = Money received from users - Bank fees taken - Money paid out
    // IMPORTANT: Bank fees (Stripe, etc.) are DEDUCTED from what we receive, so subtract them!
    // Reason: walletStats.totalDeposited is already in EUR (tracked as eurAmount on deposit).
    // walletStats.totalWithdrawn is in CREDITS (tracked as amountCredits), so we convert to EUR.
    const totalUserWithdrawalsEUR = walletStats.totalWithdrawn / conversionRate;
    const totalMoneyReceivedGross =
      walletStats.totalDeposited + totalDepositFeesGross + totalVATCollected;
    const totalMoneyPaidOut =
      totalUserWithdrawalsEUR + totalAdminWithdrawalsEUR + totalVATPaid;
    const theoreticalBankBalance =
      totalMoneyReceivedGross - totalBankFees - totalMoneyPaidOut;

    // Coverage ratio: How much of total liabilities can be covered
    // Liabilities = User credit balances + Outstanding VAT
    const totalUserCreditsEUR = walletStats.totalCredits / conversionRate;
    const totalLiabilities = totalUserCreditsEUR + outstandingVAT;
    const coverageRatio =
      totalLiabilities > 0 ? theoreticalBankBalance / totalLiabilities : 1;

    return {
      totalUserCredits: walletStats.totalCredits,
      totalUserCreditsEUR,
      activeWalletsCount: walletStats.count,

      // Gross earnings (what platform charged users)
      totalUnclaimedPools,
      totalPlatformFees,
      totalChallengeFees,
      totalMarketplaceSales,
      marketplacePurchases,
      totalDepositFeesGross,
      totalWithdrawalFeesGross,
      totalRetainedGmFees,
      retainedGmFeesCount,

      // Bank fees (what providers charge platform)
      totalBankDepositFees,
      totalBankWithdrawalFees,
      totalBankFees,

      // Net earnings (what platform actually keeps)
      netDepositEarnings,
      netWithdrawalEarnings,
      totalGrossEarnings,
      totalNetEarnings,
      totalNetEarningsEUR,

      totalAdminWithdrawals,
      totalAdminWithdrawalsEUR,

      platformNetCredits,
      platformNetEUR,

      totalUserDeposits: walletStats.totalDeposited, // EUR
      totalUserWithdrawals: totalUserWithdrawalsEUR, // EUR (converted from credits)
      theoreticalBankBalance,

      coverageRatio,
      maxWithdrawalLiability: totalUserCreditsEUR,

      // VAT Tracking
      totalVATCollected,
      totalVATPaid,
      outstandingVAT,

      conversionRate,
    };
  },

  /**
   * Get platform transaction history with filters
   */
  getTransactionHistory: async (
    params: {
      type?: string;
      limit?: number;
      skip?: number;
      startDate?: Date;
      endDate?: Date;
    } = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ transactions: any[]; total: number }> => {
    await connectToDatabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (params.type && params.type !== "all") {
      query.transactionType = params.type;
    }

    if (params.startDate || params.endDate) {
      query.createdAt = {};
      if (params.startDate) query.createdAt.$gte = params.startDate;
      if (params.endDate) query.createdAt.$lte = params.endDate;
    }

    const [transactions, total] = await Promise.all([
      PlatformTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(params.skip || 0)
        .limit(params.limit || 50)
        .lean(),
      PlatformTransaction.countDocuments(query),
    ]);

    return { transactions, total };
  },

  /**
   * Get unclaimed pools summary
   */
  getUnclaimedPoolsSummary: async (): Promise<{
    totalAmount: number;
    totalAmountEUR: number;
    byReason: Record<string, { count: number; amount: number }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentPools: any[];
  }> => {
    await connectToDatabase();

    const conversionSettings = await CreditConversionSettings.getSingleton();

    const summary = await PlatformTransaction.aggregate([
      { $match: { transactionType: "unclaimed_pool" } },
      {
        $group: {
          _id: "$unclaimedReason",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]);

    const recentPools = await PlatformTransaction.find({
      transactionType: "unclaimed_pool",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const byReason: Record<string, { count: number; amount: number }> = {};
    let totalAmount = 0;

    for (const item of summary) {
      byReason[item._id || "unknown"] = {
        count: item.count,
        amount: item.amount,
      };
      totalAmount += item.amount;
    }

    return {
      totalAmount,
      totalAmountEUR: totalAmount / conversionSettings.eurToCreditsRate,
      byReason,
      recentPools,
    };
  },
};

export default PlatformFinancialsService;
