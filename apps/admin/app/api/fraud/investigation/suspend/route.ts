import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { verifyAdminAuth } from '@/lib/admin/auth';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import UserRestriction from '@/database/models/user-restriction.model';
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

    const { 
      alertId, 
      userIds, 
      suspendUntil, 
      reason = 'multi_accounting',
      customReason = '',
      restrictions = {}
    } = await request.json();

    if (!alertId || !userIds || !Array.isArray(userIds) || !suspendUntil) {
      return NextResponse.json(
        { success: false, error: 'Alert ID, user IDs, and suspension duration required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Create UserRestriction records for each user
    const restrictionPromises = userIds.map(userId =>
      UserRestriction.create({
        userId,
        restrictionType: 'suspended',
        reason,
        customReason: customReason || `Account suspended until ${new Date(suspendUntil).toLocaleString()}`,
        canTrade: restrictions.canTrade !== undefined ? restrictions.canTrade : false,
        canEnterCompetitions: restrictions.canEnterCompetitions !== undefined ? restrictions.canEnterCompetitions : false,
        canDeposit: restrictions.canDeposit !== undefined ? restrictions.canDeposit : false,
        canWithdraw: restrictions.canWithdraw !== undefined ? restrictions.canWithdraw : false,
        expiresAt: new Date(suspendUntil),
        restrictedBy: adminUser.adminId || 'unknown',
        relatedFraudAlertId: alertId,
        relatedUserIds: userIds,
        isActive: true
      })
    );

    const _restrictionResults = await Promise.all(restrictionPromises);

    // Update fraud alert
    const updatedAlert = await FraudAlert.findByIdAndUpdate(
      alertId,
      {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: adminUser.adminId || adminUser.email || 'system',
        actionTaken: 'account_suspended',
        resolution: `Suspended ${userIds.length} account(s) until ${new Date(suspendUntil).toLocaleString()}. Restricted trading, competitions, deposits, and withdrawals.`
      },
      { new: true }
    );

    if (!updatedAlert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Log to fraud history for each suspended user
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

      await FraudHistoryService.logSuspension(
        userInfo,
        reason === 'multi_accounting' ? 'Multi-accounting fraud' : customReason || reason,
        `Account suspended until ${new Date(suspendUntil).toLocaleString()}. Reason: ${customReason || reason}`,
        {
          startDate: new Date(),
          endDate: new Date(suspendUntil),
          isPermanent: false,
          durationDays: Math.ceil((new Date(suspendUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        },
        adminInfo,
        alertId,
        { accountStatus: 'active' }
      );
    }

    console.log(`✅ Suspended ${userIds.length} accounts until ${suspendUntil} (Alert: ${alertId})`);

    // Send account suspended notifications to each user
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      for (const userId of userIds) {
        await notificationService.notifyAccountSuspended(
          userId,
          customReason || `Account suspended for ${reason.replace(/_/g, ' ')}`
        );
      }
      console.log(`🔔 Sent suspension notifications to ${userIds.length} users`);
    } catch (notifError) {
      console.error('Error sending suspension notifications:', notifError);
    }

    // Log audit action for each suspended user
    try {
      for (const userId of userIds) {
        const user = usersMap.get(userId);
        await auditLogService.logUserRestricted(
          {
            id: adminUser.adminId || 'admin',
            email: adminUser.email || 'admin',
            name: (adminUser.email || 'admin').split('@')[0],
            role: 'admin',
          },
          userId,
          user?.name || userId,
          ['suspended', `until ${new Date(suspendUntil).toLocaleString()}`]
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully suspended ${userIds.length} account(s) until ${new Date(suspendUntil).toLocaleString()}`,
      data: updatedAlert
    });

  } catch (error) {
    console.error('Error suspending accounts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

