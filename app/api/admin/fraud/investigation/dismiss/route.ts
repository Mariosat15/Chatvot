import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { verifyAdminAuth } from '@/lib/admin/auth';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';
import { getUsersByIds } from '@/lib/utils/user-lookup';
import { FraudHistoryService } from '@/lib/services/fraud/fraud-history.service';
import { auditLogService } from '@/lib/services/audit-log.service';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth();
    if (!adminUser.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { alertId, userIds } = await request.json();

    if (!alertId || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { success: false, error: 'Alert ID and user IDs required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Update fraud alert to dismissed
    const updatedAlert = await FraudAlert.findByIdAndUpdate(
      alertId,
      {
        status: 'dismissed',
        resolvedAt: new Date(),
        resolvedBy: adminUser.adminId || adminUser.email || 'system',
        actionTaken: 'none',
        resolution: `Investigation dismissed - Marked as false positive. After investigation, this alert was determined to be a false positive or acceptable use case (e.g., family members, shared device).`
      },
      { new: true }
    );

    if (!updatedAlert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Reduce risk scores on device fingerprints
    await DeviceFingerprint.updateMany(
      { userId: { $in: userIds } },
      { 
        $set: { 
          riskScore: 0,
          flaggedForReview: false
        }
      }
    );

    // Log to fraud history for each cleared user
    const usersMap = await getUsersByIds(userIds);
    const adminInfo = {
      adminId: adminUser.adminId,
      adminEmail: adminUser.email,
      adminName: adminUser.email?.split('@')[0],
    };

    for (const userId of userIds) {
      const user = usersMap.get(userId);
      if (!user) continue;
      
      const userInfo = {
        userId: userId,
        email: user.email,
        name: user.name,
      };

      await FraudHistoryService.logAlertDismissed(
        userInfo,
        'Investigation dismissed - False positive',
        'After investigation, this alert was determined to be a false positive or acceptable use case (e.g., family members, shared device). Risk scores have been reset.',
        adminInfo,
        alertId
      );
    }

    console.log(`✅ Dismissed investigation for ${userIds.length} accounts (Alert: ${alertId})`);

    // Log audit action
    try {
      await auditLogService.logSecurityAlertHandled(
        {
          id: adminUser.adminId || 'admin',
          email: adminUser.email || 'admin',
          name: (adminUser.email || 'admin').split('@')[0],
          role: 'admin',
        },
        alertId,
        'fraud_investigation',
        'dismissed'
      );
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Investigation dismissed - ${userIds.length} account(s) cleared`,
      data: updatedAlert
    });

  } catch (error) {
    console.error('Error dismissing investigation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

