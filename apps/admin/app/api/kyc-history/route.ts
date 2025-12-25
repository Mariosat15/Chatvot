import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import KYCSession from '@/database/models/kyc-session.model';
import { getAdminSession } from '@/lib/admin/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const query: Record<string, any> = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    if (search) {
      query.$or = [
        { 'personData.firstName': { $regex: search, $options: 'i' } },
        { 'personData.lastName': { $regex: search, $options: 'i' } },
        { 'documentData.number': { $regex: search, $options: 'i' } },
        { userId: search },
        { veriffSessionId: search },
      ];
    }

    const [sessions, total] = await Promise.all([
      KYCSession.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      KYCSession.countDocuments(query),
    ]);

    // Get user details for each session
    const User = (await import('@/database/models/trading/credit-wallet.model')).default;
    const sessionsWithUsers = await Promise.all(
      sessions.map(async (session) => {
        // Try to get user info from Better Auth users collection
        const mongoose = (await import('mongoose')).default;
        const db = mongoose.connection.db;
        const user = await db?.collection('user').findOne({ id: session.userId });
        
        return {
          ...session,
          userEmail: user?.email || 'Unknown',
          userName: user?.name || 'Unknown',
        };
      })
    );

    // Get stats
    const stats = await KYCSession.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {
      total: 0,
      approved: 0,
      declined: 0,
      pending: 0,
      expired: 0,
    };

    stats.forEach((s) => {
      statusCounts.total += s.count;
      if (s._id === 'approved') statusCounts.approved = s.count;
      else if (s._id === 'declined') statusCounts.declined = s.count;
      else if (s._id === 'expired') statusCounts.expired = s.count;
      else if (['created', 'started', 'submitted'].includes(s._id)) statusCounts.pending += s.count;
    });

    return NextResponse.json({
      sessions: sessionsWithUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: statusCounts,
    });
  } catch (error) {
    console.error('Error fetching KYC history:', error);
    return NextResponse.json({ error: 'Failed to fetch KYC history' }, { status: 500 });
  }
}

