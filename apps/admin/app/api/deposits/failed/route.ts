/**
 * Failed Deposits API
 * 
 * Returns failed deposit transactions that may need manual review
 * Admin can investigate and manually credit users if payment was actually received
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'failed'; // failed, pending, all
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    const onlyUnresolved = searchParams.get('unresolved') !== 'false';

    // Build query
    const query: Record<string, unknown> = {
      transactionType: 'deposit',
    };

    if (status === 'failed') {
      query.status = 'failed';
    } else if (status === 'pending') {
      query.status = 'pending';
    } else if (status === 'needs_review') {
      // Failed deposits that haven't been manually resolved
      query.status = 'failed';
      if (onlyUnresolved) {
        query['metadata.manuallyResolved'] = { $ne: true };
      }
    }

    // Fetch transactions
    const [transactions, totalCount] = await Promise.all([
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments(query),
    ]);

    // Get user details for all transactions
    const userIds = [...new Set(transactions.map(t => t.userId))];
    const usersCollection = mongoose.connection.collection('users');
    const users = await usersCollection.find(
      { id: { $in: userIds } },
      { projection: { id: 1, name: 1, email: 1 } }
    ).toArray();
    
    const userMap = new Map(users.map(u => [u.id, u]));

    // Enrich transactions with user info
    const enrichedTransactions = transactions.map(t => ({
      ...t,
      user: userMap.get(t.userId) || { name: 'Unknown', email: 'Unknown' },
    }));

    // Get summary stats
    const [failedCount, pendingCount, unresolvedCount] = await Promise.all([
      WalletTransaction.countDocuments({ transactionType: 'deposit', status: 'failed' }),
      WalletTransaction.countDocuments({ transactionType: 'deposit', status: 'pending' }),
      WalletTransaction.countDocuments({
        transactionType: 'deposit',
        status: 'failed',
        'metadata.manuallyResolved': { $ne: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      transactions: enrichedTransactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        failed: failedCount,
        pending: pendingCount,
        unresolvedFailed: unresolvedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching failed deposits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deposits' },
      { status: 500 }
    );
  }
}

