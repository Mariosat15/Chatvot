import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/admin/fraud/alerts
 * Get all fraud alerts (admin only)
 */
export async function GET(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'investigating', 'resolved', 'dismissed'
    const severity = searchParams.get('severity'); // 'low', 'medium', 'high', 'critical'
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    const query: any = {};
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (type) query.alertType = type;

    // Fetch alerts
    const alerts = await FraudAlert.find(query)
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();

    // Get statistics
    const stats = {
      total: await FraudAlert.countDocuments({}),
      pending: await FraudAlert.countDocuments({ status: 'pending' }),
      investigating: await FraudAlert.countDocuments({ status: 'investigating' }),
      resolved: await FraudAlert.countDocuments({ status: 'resolved' }),
      dismissed: await FraudAlert.countDocuments({ status: 'dismissed' }),
      critical: await FraudAlert.countDocuments({ severity: 'critical', status: { $in: ['pending', 'investigating'] } }),
      high: await FraudAlert.countDocuments({ severity: 'high', status: { $in: ['pending', 'investigating'] } }),
    };

    // Get alert type breakdown
    const alertTypes = await FraudAlert.aggregate([
      { $match: { status: { $in: ['pending', 'investigating'] } } },
      { $group: { _id: '$alertType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return NextResponse.json({
      success: true,
      alerts,
      stats,
      alertTypes
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching fraud alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

