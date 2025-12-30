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
    
    // Convert to ObjectIds for _id lookup (Better Auth may use _id as ObjectId)
    const objectIds = userIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));
    
    // Get users from Better Auth user collection (singular) - try both id field and _id
    const usersCollection = mongoose.connection.collection('user');
    const users = await usersCollection.find(
      { 
        $or: [
          { id: { $in: userIds } },
          { _id: { $in: objectIds } }
        ]
      },
      { projection: { _id: 1, id: 1, name: 1, email: 1 } }
    ).toArray();
    
    // Also get from credit wallets which store user email
    const walletsCollection = mongoose.connection.collection('creditwallets');
    const wallets = await walletsCollection.find(
      { userId: { $in: userIds } },
      { projection: { userId: 1, userEmail: 1 } }
    ).toArray();
    
    // Build user map from both sources
    const userMap = new Map<string, { name?: string; email?: string }>();
    
    // First add from users collection - map by both id and _id.toString()
    for (const u of users) {
      const idStr = u.id || u._id?.toString();
      if (idStr) {
        userMap.set(idStr, { name: u.name, email: u.email });
      }
      // Also set by _id string if different from id
      if (u._id && u._id.toString() !== u.id) {
        userMap.set(u._id.toString(), { name: u.name, email: u.email });
      }
    }
    
    // Then supplement from wallets if user not found
    for (const w of wallets) {
      if (!userMap.has(w.userId) && w.userEmail) {
        userMap.set(w.userId, { name: w.userEmail.split('@')[0], email: w.userEmail });
      } else if (userMap.has(w.userId) && !userMap.get(w.userId)?.email && w.userEmail) {
        const existing = userMap.get(w.userId)!;
        userMap.set(w.userId, { ...existing, email: w.userEmail });
      }
    }

    // Enrich transactions with user info
    const enrichedTransactions = transactions.map(t => ({
      ...t,
      user: userMap.get(t.userId) || { name: 'Unknown', email: t.userId },
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

