import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/payment-history
 * Get all payment (deposit) transactions with filtering, pagination, and user details
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    
    // Filters
    const status = searchParams.get('status') || 'all';
    const paymentMethod = searchParams.get('paymentMethod') || 'all';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const search = searchParams.get('search');
    const provider = searchParams.get('provider') || 'all';

    // Build query
    const query: any = {
      transactionType: 'deposit',
    };

    // Status filter
    if (status !== 'all') {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }

    // Payment method filter
    if (paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    // Provider filter (from metadata)
    if (provider !== 'all') {
      query['metadata.paymentProvider'] = provider;
    }

    // Date filters
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Amount filters
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) {
        query.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        query.amount.$lte = parseFloat(maxAmount);
      }
    }

    // Get database connection for Better Auth users
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database connection not found');
    }

    // If searching, first find matching users
    let userIds: string[] | null = null;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingUsers = await db.collection('user').find({
        $or: [
          { email: searchRegex },
          { name: searchRegex },
        ],
      }).toArray();
      
      userIds = matchingUsers.map((u: any) => u.id || u._id?.toString());
      
      // Also search by payment intent ID
      query.$or = [
        { userId: { $in: userIds } },
        { paymentIntentId: searchRegex },
        { paymentId: searchRegex },
      ];
    }

    // Get total count
    const total = await WalletTransaction.countDocuments(query);

    // Fetch payments with pagination
    const payments = await WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get stats for all deposits
    const statsAggregation = await WalletTransaction.aggregate([
      { $match: { transactionType: 'deposit' } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalEUR: { 
            $sum: { 
              $cond: [
                { $ne: ['$metadata.totalCharged', null] },
                '$metadata.totalCharged',
                { $cond: [
                  { $ne: ['$metadata.eurAmount', null] },
                  '$metadata.eurAmount',
                  '$amount'
                ]}
              ]
            }
          },
        },
      },
    ]);

    const stats: Record<string, { count: number; totalAmount: number; totalEUR: number }> = {
      pending: { count: 0, totalAmount: 0, totalEUR: 0 },
      completed: { count: 0, totalAmount: 0, totalEUR: 0 },
      failed: { count: 0, totalAmount: 0, totalEUR: 0 },
      cancelled: { count: 0, totalAmount: 0, totalEUR: 0 },
    };

    for (const stat of statsAggregation) {
      if (stats[stat._id]) {
        stats[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
          totalEUR: stat.totalEUR,
        };
      }
    }

    // Fetch user details for each payment
    const paymentsWithUserDetails = await Promise.all(
      payments.map(async (payment: any) => {
        try {
          let user = await db.collection('user').findOne({ id: payment.userId });
          
          if (!user) {
            try {
              const { ObjectId } = await import('mongodb');
              user = await db.collection('user').findOne({ _id: new ObjectId(payment.userId) });
            } catch {
              // Not a valid ObjectId, skip
            }
          }
          
          if (!user) {
            user = await db.collection('user').findOne({ _id: payment.userId });
          }
          
          return {
            ...payment,
            user: user ? {
              id: user.id || user._id?.toString(),
              name: user.name || 'User',
              email: user.email || 'No email',
              image: user.image || null,
            } : {
              id: payment.userId,
              name: 'Unknown User',
              email: 'No email available',
              image: null,
            },
          };
        } catch {
          return {
            ...payment,
            user: {
              id: payment.userId,
              name: 'Unknown User',
              email: 'Error loading',
              image: null,
            },
          };
        }
      })
    );

    // Get unique payment providers for filter dropdown
    const providers = await WalletTransaction.distinct('metadata.paymentProvider', {
      transactionType: 'deposit',
      'metadata.paymentProvider': { $exists: true, $ne: null },
    });

    // Get unique payment methods for filter dropdown
    const paymentMethods = await WalletTransaction.distinct('paymentMethod', {
      transactionType: 'deposit',
      paymentMethod: { $exists: true, $ne: null },
    });

    return NextResponse.json({
      success: true,
      payments: paymentsWithUserDetails,
      stats,
      providers: providers.filter(Boolean),
      paymentMethods: paymentMethods.filter(Boolean),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('❌ Error fetching payment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}

