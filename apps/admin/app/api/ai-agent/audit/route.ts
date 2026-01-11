/**
 * AI Agent Audit Logs API
 * 
 * Provides access to AI agent usage logs for compliance and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import AIAgentAudit from '@/database/models/ai-agent-audit.model';
import { verifyAdminAuth } from '@/lib/admin/auth';

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const adminEmail = searchParams.get('adminEmail');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    const query: any = {};
    
    if (adminEmail) {
      query.adminEmail = adminEmail;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Fetch logs
    const [logs, total] = await Promise.all([
      AIAgentAudit.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AIAgentAudit.countDocuments(query)
    ]);

    // Calculate summary statistics
    const stats = await AIAgentAudit.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          totalCost: { $sum: '$estimatedCost' },
          totalTokens: { $sum: '$totalTokens' },
          avgCost: { $avg: '$estimatedCost' },
          avgTokens: { $avg: '$totalTokens' },
          avgDuration: { $avg: '$totalDurationMs' },
        }
      }
    ]);

    // Get tool usage breakdown
    const toolUsage = await AIAgentAudit.aggregate([
      { $match: query },
      { $unwind: '$toolsCalled' },
      {
        $group: {
          _id: '$toolsCalled.name',
          count: { $sum: 1 },
          avgExecutionTime: { $avg: '$toolsCalled.executionTimeMs' },
          successRate: {
            $avg: { $cond: ['$toolsCalled.success', 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      summary: stats[0] || {
        totalQueries: 0,
        totalCost: 0,
        totalTokens: 0,
        avgCost: 0,
        avgTokens: 0,
        avgDuration: 0
      },
      toolUsage
    });

  } catch (error) {
    console.error('Failed to fetch AI audit logs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

// Delete old audit logs (for data retention compliance)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '90');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await AIAgentAudit.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    console.log(`🗑️ Deleted ${result.deletedCount} AI audit logs older than ${olderThanDays} days`);

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} audit logs older than ${olderThanDays} days`
    });

  } catch (error) {
    console.error('Failed to delete AI audit logs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete audit logs' },
      { status: 500 }
    );
  }
}

