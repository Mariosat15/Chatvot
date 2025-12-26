import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { FraudHistory, FraudActionType, ActionSeverity } from '@/database/models/fraud/fraud-history.model';
import { requireAdminAuth } from '@/lib/admin/auth';

// GET - Fetch fraud history with filters
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const userId = searchParams.get('userId');
    const actionType = searchParams.get('actionType') as FraudActionType | null;
    const severity = searchParams.get('severity') as ActionSeverity | null;
    const performedByType = searchParams.get('performedByType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');

    // Build query
    const query: Record<string, unknown> = {};

    if (userId) {
      query.userId = userId;
    }

    if (actionType) {
      query.actionType = actionType;
    }

    if (severity) {
      query.actionSeverity = severity;
    }

    if (performedByType) {
      query['performedBy.type'] = performedByType;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        (query.createdAt as Record<string, Date>).$gte = new Date(startDate);
      }
      if (endDate) {
        (query.createdAt as Record<string, Date>).$lte = new Date(endDate);
      }
    }

    if (search) {
      query.$or = [
        { userEmail: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [history, total] = await Promise.all([
      FraudHistory.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('relatedAlertId', 'title status')
        .populate('relatedCompetitionId', 'name')
        .lean(),
      FraudHistory.countDocuments(query),
    ]);

    // Get statistics
    const stats = await FraudHistory.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalActions: { $sum: 1 },
          warnings: {
            $sum: { $cond: [{ $eq: ['$actionType', 'warning_issued'] }, 1, 0] },
          },
          suspensions: {
            $sum: { $cond: [{ $eq: ['$actionType', 'suspended'] }, 1, 0] },
          },
          bans: {
            $sum: { $cond: [{ $eq: ['$actionType', 'banned'] }, 1, 0] },
          },
          lifts: {
            $sum: {
              $cond: [
                { $in: ['$actionType', ['suspension_lifted', 'ban_lifted']] },
                1,
                0,
              ],
            },
          },
          criticalActions: {
            $sum: { $cond: [{ $eq: ['$actionSeverity', 'critical'] }, 1, 0] },
          },
          autoActions: {
            $sum: {
              $cond: [{ $eq: ['$performedBy.type', 'automated'] }, 1, 0],
            },
          },
          adminActions: {
            $sum: { $cond: [{ $eq: ['$performedBy.type', 'admin'] }, 1, 0] },
          },
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: stats[0] || {
          totalActions: 0,
          warnings: 0,
          suspensions: 0,
          bans: 0,
          lifts: 0,
          criticalActions: 0,
          autoActions: 0,
          adminActions: 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching fraud history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fraud history' },
      { status: 500 }
    );
  }
}

// POST - Add manual entry to fraud history
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const {
      userId,
      userEmail,
      userName,
      actionType,
      actionSeverity,
      reason,
      details,
      relatedAlertId,
      relatedCompetitionId,
      adminNotes,
      duration,
    } = body;

    // Validate required fields
    if (!userId || !userEmail || !userName || !actionType || !reason || !details) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const historyEntry = await FraudHistory.logAction({
      userId,
      userEmail,
      userName,
      actionType,
      actionSeverity: actionSeverity || 'medium',
      performedBy: {
        type: 'admin',
        adminId: auth.adminId,
        adminEmail: auth.email,
        adminName: auth.email?.split('@')[0] || 'Admin',
      },
      reason,
      details,
      relatedAlertId,
      relatedCompetitionId,
      adminNotes,
      duration,
    });

    return NextResponse.json({
      success: true,
      data: historyEntry,
    });
  } catch (error) {
    console.error('Error adding fraud history entry:', error);
    return NextResponse.json(
      { error: 'Failed to add history entry' },
      { status: 500 }
    );
  }
}

