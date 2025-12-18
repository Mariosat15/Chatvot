import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';
import VATPayment from '@/database/models/vat-payment.model';
import { getUsersByIds } from '@/lib/utils/user-lookup';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type'); // transaction type filter
    const status = searchParams.get('status'); // status filter
    const userId = searchParams.get('userId'); // specific user filter
    const competitionId = searchParams.get('competitionId'); // competition filter
    const search = searchParams.get('search'); // search by ID, description
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    const query: any = {};
    
    if (type && type !== 'all') {
      query.transactionType = type;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (competitionId) {
      query.competitionId = competitionId;
    }
    
    if (search) {
      // Don't use regex on _id (ObjectId) - only search text fields
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
        { 'metadata.paymentIntentId': { $regex: search, $options: 'i' } },
        { 'userInfo.name': { $regex: search, $options: 'i' } },
        { 'userInfo.email': { $regex: search, $options: 'i' } },
      ];
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

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Check if we should include admin/platform transactions
    const includeAdminTx = type === 'all' || type === 'admin_withdrawal' || type === 'vat_payment' || 
                           type === 'platform_fee' || type === 'unclaimed_pool' || type === 'deposit_fee' || 
                           type === 'withdrawal_fee' || !type;

    // Execute query with pagination for wallet transactions
    const [walletTransactions, walletTotal] = await Promise.all([
      WalletTransaction.find(query)
        .sort(sort)
        .lean(),
      WalletTransaction.countDocuments(query),
    ]);

    // Also fetch platform transactions (admin withdrawals, fees, unclaimed pools)
    let platformTransactions: any[] = [];
    let vatPayments: any[] = [];
    
    if (includeAdminTx) {
      const platformQuery: any = {};
      if (type && type !== 'all') {
        if (['admin_withdrawal', 'platform_fee', 'unclaimed_pool', 'deposit_fee', 'withdrawal_fee'].includes(type)) {
          platformQuery.transactionType = type;
        }
      }
      if (startDate || endDate) {
        platformQuery.createdAt = {};
        if (startDate) platformQuery.createdAt.$gte = new Date(startDate);
        if (endDate) platformQuery.createdAt.$lte = new Date(endDate);
      }
      
      platformTransactions = await PlatformTransaction.find(platformQuery).sort(sort).lean();
      
      // Fetch VAT payments if type is 'all' or 'vat_payment'
      if (type === 'all' || type === 'vat_payment' || !type) {
        const vatQuery: any = { status: 'paid' };
        if (startDate || endDate) {
          vatQuery.paidAt = {};
          if (startDate) vatQuery.paidAt.$gte = new Date(startDate);
          if (endDate) vatQuery.paidAt.$lte = new Date(endDate);
        }
        vatPayments = await VATPayment.find(vatQuery).sort({ paidAt: -1 }).lean();
      }
    }

    // Get unique user IDs to fetch user info
    const userIds = [...new Set(walletTransactions.map(t => t.userId).filter(id => id !== 'platform'))];
    const usersMap = await getUsersByIds(userIds);

    // Enrich wallet transactions with user info
    const enrichedWalletTransactions = walletTransactions.map(t => ({
      ...t,
      source: 'wallet' as const,
      userInfo: t.userId === 'platform' 
        ? { id: 'platform', name: 'Platform', email: 'system' }
        : usersMap.get(t.userId) || { id: t.userId, name: 'Unknown', email: 'Unknown' },
    }));

    // Format platform transactions
    const enrichedPlatformTransactions = platformTransactions.map(t => ({
      _id: t._id,
      userId: 'admin',
      transactionType: t.transactionType,
      amount: t.amount,
      amountEUR: t.amountEUR,
      status: 'completed',
      description: t.description,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      source: 'platform' as const,
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
        id: 'admin', 
        name: t.processedByEmail || 'Admin', 
        email: t.processedByEmail || 'admin@system' 
      },
    }));

    // Format VAT payments
    const enrichedVatPayments = vatPayments.map(v => ({
      _id: v._id,
      userId: 'admin',
      transactionType: 'vat_payment',
      amount: -v.vatAmountEUR, // Negative because it's money going out
      amountEUR: v.vatAmountEUR,
      status: 'completed',
      description: `VAT Payment for ${new Date(v.periodStart).toLocaleDateString()} - ${new Date(v.periodEnd).toLocaleDateString()}`,
      createdAt: v.paidAt || v.createdAt,
      updatedAt: v.updatedAt,
      source: 'vat' as const,
      metadata: {
        periodStart: v.periodStart,
        periodEnd: v.periodEnd,
        transactionCount: v.transactionCount,
        reference: v.reference,
        paidByEmail: v.paidByEmail,
      },
      userInfo: { 
        id: 'admin', 
        name: v.paidByEmail || 'Admin', 
        email: v.paidByEmail || 'admin@system' 
      },
    }));

    // Combine all transactions and sort by date
    const allTransactions = [
      ...enrichedWalletTransactions,
      ...enrichedPlatformTransactions,
      ...enrichedVatPayments,
    ].sort((a, b) => {
      const dateA = new Date((a as any).createdAt).getTime();
      const dateB = new Date((b as any).createdAt).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
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
          _id: '$transactionType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          positiveAmount: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
          negativeAmount: { $sum: { $cond: [{ $lt: ['$amount', 0] }, '$amount', 0] } },
        },
      },
    ]);

    // Get status breakdown
    const statusBreakdown = await WalletTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
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
          byType: stats.reduce((acc, s) => {
            acc[s._id] = {
              count: s.count,
              totalAmount: s.totalAmount,
              positiveAmount: s.positiveAmount,
              negativeAmount: s.negativeAmount,
            };
            return acc;
          }, {} as Record<string, any>),
          byStatus: statusBreakdown.reduce((acc, s) => {
            acc[s._id] = s.count;
            return acc;
          }, {} as Record<string, number>),
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
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
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const transaction = await WalletTransaction.findById(transactionId).lean();
    
    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Get user info
    const txUserId = (transaction as any).userId;
    let userInfo = { id: txUserId, name: 'Unknown', email: 'Unknown' };
    if (txUserId !== 'platform') {
      const usersMap = await getUsersByIds([txUserId]);
      userInfo = usersMap.get(txUserId) || userInfo;
    } else {
      userInfo = { id: 'platform', name: 'Platform', email: 'system' };
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}

