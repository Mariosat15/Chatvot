import { connectToDatabase } from '@/database/mongoose';
import { PlatformTransaction, PlatformBalanceSnapshot } from '@/database/models/platform-financials.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import VATPayment from '@/database/models/vat-payment.model';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';

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
  reason: 'no_participants' | 'all_disqualified' | 'no_qualified_winners' | 'competition_cancelled';
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
      transactionType: 'unclaimed_pool',
      amount: params.poolAmount,
      amountEUR: eurAmount,
      sourceType: 'competition',
      sourceId: params.competitionId,
      sourceName: params.competitionName,
      unclaimedReason: params.reason,
      originalPoolAmount: params.poolAmount,
      winnersCount: params.winnersCount,
      expectedWinnersCount: params.expectedWinnersCount,
      description: params.description || `Unclaimed pool from ${params.competitionName}: ${params.reason.replace('_', ' ')}`,
    });
    
    console.log(`💰 [PLATFORM] Recorded unclaimed pool: ${params.poolAmount} credits (€${eurAmount.toFixed(2)}) from ${params.competitionName}`);
    console.log(`   Reason: ${params.reason}, Winners: ${params.winnersCount}/${params.expectedWinnersCount}`);
  },
  
  /**
   * Record platform fee earnings
   */
  recordPlatformFee: async (params: {
    amount: number;
    sourceType: 'competition' | 'user_deposit' | 'user_withdrawal';
    sourceId?: string;
    sourceName?: string;
    description: string;
  }): Promise<void> => {
    await connectToDatabase();
    
    const conversionSettings = await CreditConversionSettings.getSingleton();
    const eurAmount = params.amount / conversionSettings.eurToCreditsRate;
    
    const transactionType = params.sourceType === 'user_deposit' ? 'deposit_fee' 
      : params.sourceType === 'user_withdrawal' ? 'withdrawal_fee' 
      : 'platform_fee';
    
    await PlatformTransaction.create({
      transactionType,
      amount: params.amount,
      amountEUR: eurAmount,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceName: params.sourceName,
      description: params.description,
    });
    
    console.log(`💵 [PLATFORM] Recorded fee: ${params.amount} credits (€${eurAmount.toFixed(2)}) - ${params.description}`);
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
      transactionType: 'deposit_fee',
      amount: params.platformFeeAmount,
      amountEUR: params.platformFeeAmount,
      sourceType: 'user_deposit',
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
      transactionType: 'withdrawal_fee',
      amount: params.platformFeeAmount,
      amountEUR: params.platformFeeAmount,
      sourceType: 'user_withdrawal',
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
    
    console.log(`💵 [PLATFORM] Withdrawal fee: €${params.platformFeeAmount.toFixed(2)} - Bank: €${params.bankFeeAmount.toFixed(2)} = Net: €${params.netEarning.toFixed(2)}`);
  },
  
  /**
   * Record admin withdrawal (converting platform credits to real money)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recordAdminWithdrawal: async (params: AdminWithdrawalParams): Promise<{ success: boolean; transaction?: any; error?: string }> => {
    await connectToDatabase();
    
    try {
      const transaction = await PlatformTransaction.create({
        transactionType: 'admin_withdrawal',
        amount: -params.amount, // Negative because platform is losing credits
        amountEUR: -params.amountEUR,
        sourceType: 'manual',
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
      
      console.log(`🏦 [PLATFORM] Admin withdrawal recorded: €${params.amountEUR.toFixed(2)} by ${params.adminEmail}`);
      
      return { success: true, transaction };
    } catch (error) {
      console.error('Error recording admin withdrawal:', error);
      return { success: false, error: 'Failed to record withdrawal' };
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
    totalPlatformFees: number;           // Competition platform fees
    totalChallengeFees: number;          // Challenge platform fees
    totalMarketplaceSales: number;       // Marketplace item purchases
    marketplacePurchases: number;        // Number of marketplace purchases
    totalDepositFeesGross: number;       // Platform deposit fees charged to users
    totalWithdrawalFeesGross: number;    // Platform withdrawal fees charged to users
    
    // Bank Fees (what payment providers charge platform)
    totalBankDepositFees: number;       // Stripe/bank fees on deposits
    totalBankWithdrawalFees: number;    // Bank fees on payouts
    totalBankFees: number;              // Total bank fees
    
    // Net Earnings (what platform actually keeps)
    netDepositEarnings: number;         // Deposit fees - bank deposit fees
    netWithdrawalEarnings: number;      // Withdrawal fees - bank withdrawal fees
    totalGrossEarnings: number;         // All platform fees charged
    totalNetEarnings: number;           // Gross - bank fees
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
          totalCredits: { $sum: '$creditBalance' },
          totalDeposited: { $sum: '$totalDeposited' },
          totalWithdrawn: { $sum: '$totalWithdrawn' },
          count: { $sum: { $cond: [{ $gt: ['$creditBalance', 0] }, 1, 0] } },
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
          _id: '$transactionType',
          total: { $sum: '$amount' },
          totalEUR: { $sum: '$amountEUR' },
          count: { $sum: 1 },
          totalPlatformFees: { $sum: '$feeDetails.platformFee' },
          totalBankFees: { $sum: '$feeDetails.bankFee' },
          totalNetEarnings: { $sum: '$feeDetails.netEarning' },
        },
      },
    ]);
    
    // Get marketplace sales
    const marketplaceAggregation = await UserPurchase.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$pricePaid' },
          purchaseCount: { $sum: 1 },
        },
      },
    ]);
    const marketplaceSales = marketplaceAggregation[0] || { totalSales: 0, purchaseCount: 0 };
    
    // Process earnings
    let totalUnclaimedPools = 0;
    let totalPlatformFees = 0;       // Competition fees
    let totalChallengeFees = 0;      // Challenge fees
    const totalMarketplaceSales = marketplaceSales.totalSales;
    const marketplacePurchases = marketplaceSales.purchaseCount;
    let totalDepositFeesGross = 0;
    let totalWithdrawalFeesGross = 0;
    let totalBankDepositFees = 0;
    let totalBankWithdrawalFees = 0;
    let netDepositEarnings = 0;
    let netWithdrawalEarnings = 0;
    let totalAdminWithdrawals = 0;
    let totalAdminWithdrawalsEUR = 0;
    
    for (const earning of platformEarnings) {
      switch (earning._id) {
        case 'unclaimed_pool':
          totalUnclaimedPools = earning.total;
          break;
        case 'platform_fee':
          totalPlatformFees = earning.total;
          break;
        case 'challenge_platform_fee':
          totalChallengeFees = earning.total;
          break;
        case 'deposit_fee':
          totalDepositFeesGross = earning.totalPlatformFees || earning.total;
          totalBankDepositFees = earning.totalBankFees || 0;
          netDepositEarnings = earning.totalNetEarnings || (totalDepositFeesGross - totalBankDepositFees);
          break;
        case 'withdrawal_fee':
          totalWithdrawalFeesGross = earning.totalPlatformFees || earning.total;
          totalBankWithdrawalFees = earning.totalBankFees || 0;
          netWithdrawalEarnings = earning.totalNetEarnings || (totalWithdrawalFeesGross - totalBankWithdrawalFees);
          break;
        case 'admin_withdrawal':
          totalAdminWithdrawals = Math.abs(earning.total);
          totalAdminWithdrawalsEUR = Math.abs(earning.totalEUR);
          break;
      }
    }
    
    // Calculate totals (including challenge fees and marketplace sales)
    const totalBankFees = totalBankDepositFees + totalBankWithdrawalFees;
    const totalGrossEarnings = totalUnclaimedPools + totalPlatformFees + totalChallengeFees + totalMarketplaceSales + totalDepositFeesGross + totalWithdrawalFeesGross;
    const totalNetEarnings = totalUnclaimedPools + totalPlatformFees + totalChallengeFees + totalMarketplaceSales + netDepositEarnings + netWithdrawalEarnings;
    const totalNetEarningsEUR = totalNetEarnings;
    
    const platformNetCredits = totalNetEarnings - totalAdminWithdrawals;
    const platformNetEUR = platformNetCredits;
    
    // Get VAT data
    // Total VAT collected from all deposits
    const vatCollectedAggregation = await WalletTransaction.aggregate([
      {
        $match: {
          transactionType: 'deposit',
          status: 'completed',
          'metadata.vatAmount': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalVAT: { $sum: '$metadata.vatAmount' },
        },
      },
    ]);
    const totalVATCollected = vatCollectedAggregation[0]?.totalVAT || 0;
    
    // Total VAT paid to government
    const vatPaidAggregation = await VATPayment.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$vatAmountEUR' },
        },
      },
    ]);
    const totalVATPaid = vatPaidAggregation[0]?.totalPaid || 0;
    const outstandingVAT = totalVATCollected - totalVATPaid;
    
    // Bank reconciliation: 
    // What we HAVE = Money received from users - Bank fees taken - Money paid out + Platform fees (from contests)
    // IMPORTANT: Bank fees (Stripe, etc.) are DEDUCTED from what we receive, so subtract them!
    // Competition/Challenge fees are earned from prize pools, which come from entry fees (already in deposits)
    const totalMoneyReceivedGross = walletStats.totalDeposited + totalDepositFeesGross + totalVATCollected;
    const totalMoneyPaidOut = walletStats.totalWithdrawn + totalAdminWithdrawalsEUR + totalVATPaid;
    // FIXED: Subtract bank fees because they reduce what we actually have in bank
    // Add competition/challenge fees as they represent earnings from the platform (not deducted from user wallets directly)
    const theoreticalBankBalance = totalMoneyReceivedGross - totalBankFees - totalMoneyPaidOut;
    
    // Coverage ratio: How much of total liabilities can be covered
    // Liabilities = User credit balances + Outstanding VAT
    const totalUserCreditsEUR = walletStats.totalCredits / conversionRate;
    const totalLiabilities = totalUserCreditsEUR + outstandingVAT;
    const coverageRatio = totalLiabilities > 0 
      ? theoreticalBankBalance / totalLiabilities 
      : 1;
    
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
      
      totalUserDeposits: walletStats.totalDeposited,
      totalUserWithdrawals: walletStats.totalWithdrawn,
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
  getTransactionHistory: async (params: {
    type?: string;
    limit?: number;
    skip?: number;
    startDate?: Date;
    endDate?: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = {}): Promise<{ transactions: any[]; total: number }> => {
    await connectToDatabase();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};
    
    if (params.type && params.type !== 'all') {
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
      { $match: { transactionType: 'unclaimed_pool' } },
      {
        $group: {
          _id: '$unclaimedReason',
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]);
    
    const recentPools = await PlatformTransaction.find({ transactionType: 'unclaimed_pool' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    const byReason: Record<string, { count: number; amount: number }> = {};
    let totalAmount = 0;
    
    for (const item of summary) {
      byReason[item._id || 'unknown'] = { count: item.count, amount: item.amount };
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

