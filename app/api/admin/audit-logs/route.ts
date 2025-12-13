import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';
import AuditLog from '@/database/models/audit-log.model';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const action = searchParams.get('action');
    const category = searchParams.get('category');
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    const query: any = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (userEmail) {
      query.userEmail = { $regex: userEmail, $options: 'i' };
    }
    
    if (action && action !== 'all') {
      query.action = action;
    }
    
    if (category && category !== 'all') {
      query.actionCategory = category;
    }
    
    if (targetType && targetType !== 'all') {
      query.targetType = targetType;
    }
    
    if (targetId) {
      query.targetId = targetId;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { targetName: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    // Get unique actions for filter dropdown
    const uniqueActions = await AuditLog.distinct('action');
    
    // Get statistics
    const stats = await AuditLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$actionCategory',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get unique users for filter
    const uniqueUsers = await AuditLog.aggregate([
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          userEmail: { $first: '$userEmail' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
        filters: {
          uniqueActions,
          uniqueUsers,
        },
        stats: stats.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/audit-logs
 * Clear audit logs (with optional date filter)
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const beforeDate = searchParams.get('beforeDate');

    let query: any = {};
    let description = 'Cleared all audit logs';
    
    if (beforeDate) {
      query.createdAt = { $lt: new Date(beforeDate) };
      description = `Cleared audit logs before ${beforeDate}`;
    }

    const result = await AuditLog.deleteMany(query);

    // Log this action (meta!)
    await auditLogService.log({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.email.split('@')[0],
        role: 'admin',
      },
      action: 'audit_logs_cleared',
      category: 'system',
      description,
      metadata: { deletedCount: result.deletedCount, beforeDate },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error clearing audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear audit logs' },
      { status: 500 }
    );
  }
}

