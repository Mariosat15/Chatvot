import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/admin/fraud/devices
 * Get suspicious devices (admin only)
 */
export async function GET(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const minRiskScore = parseInt(searchParams.get('minRiskScore') || '50');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query
    const query: any = {};
    if (userId) {
      // Find devices used by this user OR linked to this user
      query.$or = [
        { userId: userId },
        { linkedUserIds: userId }
      ];
    } else {
      // Only show suspicious devices (with linked accounts)
      query.$or = [
        { riskScore: { $gte: minRiskScore } },
        { linkedUserIds: { $exists: true, $ne: [] } }
      ];
    }

    const devices = await DeviceFingerprint.find(query)
      .sort({ riskScore: -1, lastSeen: -1 })
      .limit(limit)
      .lean();

    // Get statistics
    const stats = {
      totalDevices: await DeviceFingerprint.countDocuments({}),
      suspiciousDevices: await DeviceFingerprint.countDocuments({
        linkedUserIds: { $exists: true, $ne: [] }
      }),
      highRiskDevices: await DeviceFingerprint.countDocuments({
        riskScore: { $gte: 70 }
      }),
      vpnDevices: await DeviceFingerprint.countDocuments({ isVPN: true }),
      proxyDevices: await DeviceFingerprint.countDocuments({ isProxy: true }),
    };

    // Get device type breakdown
    const deviceTypes = await DeviceFingerprint.aggregate([
      { $group: { _id: '$deviceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return NextResponse.json({
      success: true,
      devices,
      stats,
      deviceTypes
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

