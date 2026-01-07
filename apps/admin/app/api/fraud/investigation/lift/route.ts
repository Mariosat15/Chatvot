import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { verifyAdminAuth } from '@/lib/admin/auth';
import UserRestriction from '@/database/models/user-restriction.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import { getUserById } from '@/lib/utils/user-lookup';
import { FraudHistoryService } from '@/lib/services/fraud/fraud-history.service';
import { auditLogService } from '@/lib/services/audit-log.service';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminAuth();
    if (!adminUser || !adminUser.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { 
      restrictionId, 
      userId,
      reason = 'Admin lifted restriction',
      adminNotes = ''
    } = await request.json();

    if (!restrictionId && !userId) {
      return NextResponse.json(
        { success: false, error: 'Restriction ID or User ID required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find and deactivate restriction(s)
    let restrictions;
    if (restrictionId) {
      restrictions = await UserRestriction.find({ _id: restrictionId, isActive: true });
    } else {
      restrictions = await UserRestriction.find({ userId, isActive: true });
    }

    if (!restrictions || restrictions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active restrictions found' },
        { status: 404 }
      );
    }

    const adminInfo = {
      adminId: adminUser.adminId,
      adminEmail: adminUser.email,
      adminName: adminUser.email?.split('@')[0],
    };

    const liftedRestrictions = [];

    for (const restriction of restrictions) {
      // Get user info
      const user = await getUserById(restriction.userId.toString());
      
      // Deactivate restriction
      restriction.isActive = false;
      restriction.liftedAt = new Date();
      restriction.liftedBy = adminUser.adminId || 'unknown';
      restriction.liftReason = reason;
      await restriction.save();

      liftedRestrictions.push({
        id: restriction._id,
        userId: restriction.userId,
        type: restriction.restrictionType,
      });

      // Log to fraud history
      if (user) {
        const userInfo = {
          userId: restriction.userId.toString(),
          email: user.email,
          name: user.name,
        };

        if (restriction.restrictionType === 'banned') {
          await FraudHistoryService.logBanLifted(
            userInfo,
            reason,
            `Ban lifted by admin. ${adminNotes ? `Notes: ${adminNotes}` : ''}`,
            adminInfo,
            { accountStatus: 'banned' }
          );
        } else if (restriction.restrictionType === 'suspended') {
          await FraudHistoryService.logSuspensionLifted(
            userInfo,
            reason,
            `Suspension lifted by admin. ${adminNotes ? `Notes: ${adminNotes}` : ''}`,
            adminInfo,
            { accountStatus: 'suspended' }
          );
        } else {
          await FraudHistoryService.logRestrictionRemoved(
            userInfo,
            restriction.restrictionType,
            reason,
            `Restriction removed by admin. ${adminNotes ? `Notes: ${adminNotes}` : ''}`,
            adminInfo,
            restriction._id.toString()
          );
        }
      }
    }

    console.log(`✅ Lifted ${liftedRestrictions.length} restriction(s)`);

    // IMPORTANT: Mark the related fraud alert as "cleared" 
    // This allows NEW fraud activity to generate NEW alerts
    const relatedAlertIds = new Set<string>();
    for (const restriction of restrictions) {
      if (restriction.relatedFraudAlertId) {
        relatedAlertIds.add(restriction.relatedFraudAlertId.toString());
      }
    }

    if (relatedAlertIds.size > 0) {
      const clearanceTimestamp = new Date();
      const clearanceNote = `User cleared by admin: ${adminInfo.adminEmail || 'Unknown'}. Reason: ${reason}`;
      
      const updateResult = await FraudAlert.updateMany(
        { _id: { $in: Array.from(relatedAlertIds) } },
        {
          $set: {
            investigationClearedAt: clearanceTimestamp,
            clearanceNote: clearanceNote,
          }
        }
      );
      
      console.log(`📝 Marked ${updateResult.modifiedCount} fraud alert(s) as cleared`);
      console.log(`   Alert IDs: ${Array.from(relatedAlertIds).join(', ')}`);
      console.log(`   Cleared at: ${clearanceTimestamp.toISOString()}`);
      console.log(`   → Future fraud activity by these users will generate NEW alerts`);
    }

    // Send account restored notifications
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      for (const lifted of liftedRestrictions) {
        await notificationService.notifyAccountRestored(lifted.userId.toString());
      }
      console.log(`🔔 Sent account restored notifications to ${liftedRestrictions.length} users`);
    } catch (notifError) {
      console.error('Error sending account restored notifications:', notifError);
    }

    // Log audit action
    try {
      for (const lifted of liftedRestrictions) {
        await auditLogService.logUserUnbanned(
          {
            id: adminUser.adminId || 'admin',
            email: adminUser.email || 'admin',
            name: (adminUser.email || 'admin').split('@')[0],
            role: 'admin',
          },
          lifted.userId,
          `User ${lifted.userId}`
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully lifted ${liftedRestrictions.length} restriction(s)`,
      data: {
        liftedRestrictions,
        count: liftedRestrictions.length,
      }
    });

  } catch (error) {
    console.error('Error lifting restriction:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

