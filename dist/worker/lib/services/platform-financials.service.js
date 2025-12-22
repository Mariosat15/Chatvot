"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformFinancialsService = void 0;
const mongoose_1 = require("@/database/mongoose");
const platform_financials_model_1 = require("@/database/models/platform-financials.model");
const credit_wallet_model_1 = __importDefault(require("@/database/models/trading/credit-wallet.model"));
const wallet_transaction_model_1 = __importDefault(require("@/database/models/trading/wallet-transaction.model"));
const credit_conversion_settings_model_1 = __importDefault(require("@/database/models/credit-conversion-settings.model"));
const vat_payment_model_1 = __importDefault(require("@/database/models/vat-payment.model"));
const user_purchase_model_1 = require("@/database/models/marketplace/user-purchase.model");
exports.PlatformFinancialsService = {
    /**
     * Record unclaimed pool funds when competition ends without winners
     */
    recordUnclaimedPool: async (params) => {
        await (0, mongoose_1.connectToDatabase)();
        const conversionSettings = await credit_conversion_settings_model_1.default.getSingleton();
        const eurAmount = params.poolAmount / conversionSettings.eurToCreditsRate;
        await platform_financials_model_1.PlatformTransaction.create({
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
    recordPlatformFee: async (params) => {
        await (0, mongoose_1.connectToDatabase)();
        const conversionSettings = await credit_conversion_settings_model_1.default.getSingleton();
        const eurAmount = params.amount / conversionSettings.eurToCreditsRate;
        const transactionType = params.sourceType === 'user_deposit' ? 'deposit_fee'
            : params.sourceType === 'user_withdrawal' ? 'withdrawal_fee'
                : 'platform_fee';
        await platform_financials_model_1.PlatformTransaction.create({
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
    recordDepositFee: async (params) => {
        console.log(`💵 [PLATFORM] Recording deposit fee...`, params);
        await (0, mongoose_1.connectToDatabase)();
        // Record platform deposit fee income
        const transaction = await platform_financials_model_1.PlatformTransaction.create({
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
    recordWithdrawalFee: async (params) => {
        await (0, mongoose_1.connectToDatabase)();
        // Record platform withdrawal fee income
        await platform_financials_model_1.PlatformTransaction.create({
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
    recordAdminWithdrawal: async (params) => {
        await (0, mongoose_1.connectToDatabase)();
        try {
            const transaction = await platform_financials_model_1.PlatformTransaction.create({
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
        }
        catch (error) {
            console.error('Error recording admin withdrawal:', error);
            return { success: false, error: 'Failed to record withdrawal' };
        }
    },
    /**
     * Get comprehensive platform financial stats
     */
    getFinancialStats: async () => {
        await (0, mongoose_1.connectToDatabase)();
        const conversionSettings = await credit_conversion_settings_model_1.default.getSingleton();
        const conversionRate = conversionSettings.eurToCreditsRate;
        // Get all user wallet balances (what we owe users)
        const walletAggregation = await credit_wallet_model_1.default.aggregate([
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
        const platformEarnings = await platform_financials_model_1.PlatformTransaction.aggregate([
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
        const marketplaceAggregation = await user_purchase_model_1.UserPurchase.aggregate([
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
        let totalPlatformFees = 0; // Competition fees
        let totalChallengeFees = 0; // Challenge fees
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
        const vatCollectedAggregation = await wallet_transaction_model_1.default.aggregate([
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
        const vatPaidAggregation = await vat_payment_model_1.default.aggregate([
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
    getTransactionHistory: async (params = {}) => {
        await (0, mongoose_1.connectToDatabase)();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = {};
        if (params.type && params.type !== 'all') {
            query.transactionType = params.type;
        }
        if (params.startDate || params.endDate) {
            query.createdAt = {};
            if (params.startDate)
                query.createdAt.$gte = params.startDate;
            if (params.endDate)
                query.createdAt.$lte = params.endDate;
        }
        const [transactions, total] = await Promise.all([
            platform_financials_model_1.PlatformTransaction.find(query)
                .sort({ createdAt: -1 })
                .skip(params.skip || 0)
                .limit(params.limit || 50)
                .lean(),
            platform_financials_model_1.PlatformTransaction.countDocuments(query),
        ]);
        return { transactions, total };
    },
    /**
     * Get unclaimed pools summary
     */
    getUnclaimedPoolsSummary: async () => {
        await (0, mongoose_1.connectToDatabase)();
        const conversionSettings = await credit_conversion_settings_model_1.default.getSingleton();
        const summary = await platform_financials_model_1.PlatformTransaction.aggregate([
            { $match: { transactionType: 'unclaimed_pool' } },
            {
                $group: {
                    _id: '$unclaimedReason',
                    count: { $sum: 1 },
                    amount: { $sum: '$amount' },
                },
            },
        ]);
        const recentPools = await platform_financials_model_1.PlatformTransaction.find({ transactionType: 'unclaimed_pool' })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        const byReason = {};
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
exports.default = exports.PlatformFinancialsService;
