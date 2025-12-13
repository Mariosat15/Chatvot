import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';

/**
 * Admin actions on suspicious devices
 * 
 * Actions:
 * - suspend: Suspend all users linked to this device
 * - dismiss: Mark device as safe (ignore)
 * - ban: Permanently ban all users linked to this device
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await verifyAdminAuth();
    
    if (!admin.isAuthenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { deviceId, action, reason } = await request.json();

    if (!deviceId || !action) {
      return NextResponse.json({ 
        success: false, 
        message: 'Device ID and action are required' 
      }, { status: 400 });
    }

    await connectToDatabase();

    // Get the device
    const device = await DeviceFingerprint.findById(deviceId);
    if (!device) {
      return NextResponse.json({ success: false, message: 'Device not found' }, { status: 404 });
    }

    // Get all linked user IDs (including primary user)
    const userIds = [device.userId, ...(device.linkedUserIds || [])];

    switch (action) {
      case 'dismiss':
        // Mark device as safe
        device.flaggedForReview = false;
        device.riskScore = 0;
        await device.save();

        // Dismiss related alerts
        await FraudAlert.updateMany(
          { involvedDevices: deviceId, status: { $ne: 'resolved' } },
          { 
            $set: { 
              status: 'dismissed',
              resolvedBy: 'admin',
              resolvedAt: new Date(),
              resolution: reason || 'Dismissed by admin - device marked as safe'
            } 
          }
        );

        return NextResponse.json({ 
          success: true, 
          message: `Device dismissed. ${userIds.length} user(s) marked as safe.` 
        });

      case 'suspend':
        // Mark device as suspended
        device.flaggedForReview = true;
        device.riskScore = Math.max(device.riskScore, 80);
        await device.save();

        // Create alerts for all users
        const suspendAlert = new FraudAlert({
          alertType: 'admin_action',
          severity: 'high',
          status: 'investigating',
          title: 'Admin Suspended Device',
          description: `Device suspended by admin. Reason: ${reason || 'Manual review required'}`,
          involvedUsers: userIds,
          involvedDevices: [deviceId],
          evidence: [{
            type: 'admin_action',
            description: 'Device flagged by administrator',
            data: { action: 'suspend', reason }
          }]
        });
        await suspendAlert.save();

        return NextResponse.json({ 
          success: true, 
          message: `Device suspended. ${userIds.length} user(s) flagged for review.` 
        });

      case 'ban':
        // Mark device as banned
        device.flaggedForReview = true;
        device.riskScore = 100;
        await device.save();

        // Create critical alerts
        const banAlert = new FraudAlert({
          alertType: 'admin_action',
          severity: 'critical',
          status: 'resolved',
          title: 'Admin Banned Device',
          description: `Device banned by admin. Reason: ${reason || 'Confirmed fraudulent activity'}`,
          involvedUsers: userIds,
          involvedDevices: [deviceId],
          evidence: [{
            type: 'admin_action',
            description: 'Device banned by administrator',
            data: { action: 'ban', reason }
          }],
          resolvedBy: 'admin',
          resolvedAt: new Date(),
          resolution: `Banned ${userIds.length} user(s)`
        });
        await banAlert.save();

        return NextResponse.json({ 
          success: true, 
          message: `Device banned. ${userIds.length} user(s) permanently flagged.` 
        });

      default:
        return NextResponse.json({ 
          success: false, 
          message: 'Invalid action' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error performing device action:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to perform action' 
    }, { status: 500 });
  }
}

