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
      reason = 'multi_accounting',
      customReason = '',
      restrictions = {}
    } = await request.json();

    if (!alertId || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { success: false, error: 'Alert ID and user IDs required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Create UserRestriction records for each user (permanent ban - no expiresAt)
    const restrictionPromises = userIds.map(userId =>
      UserRestriction.create({
        userId,
        restrictionType: 'banned',
        reason,
        customReason: customReason || 'Account permanently banned for multi-accounting fraud',
        canTrade: restrictions.canTrade !== undefined ? restrictions.canTrade : false,
        canEnterCompetitions: restrictions.canEnterCompetitions !== undefined ? restrictions.canEnterCompetitions : false,
        canDeposit: restrictions.canDeposit !== undefined ? restrictions.canDeposit : false,
        canWithdraw: restrictions.canWithdraw !== undefined ? restrictions.canWithdraw : false,
        // No expiresAt = permanent ban
        restrictedBy: adminUser.adminId || 'unknown',
        relatedFraudAlertId: alertId,
        relatedUserIds: userIds,
        isActive: true
      })
    );

    await Promise.all(restrictionPromises);

    // Update fraud alert
    const updatedAlert = await FraudAlert.findByIdAndUpdate(
      alertId,
      {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: adminUser.adminId || adminUser.email || 'system',
        actionTaken: 'account_banned',
        resolution: `Permanently banned ${userIds.length} account(s). All access to trading, competitions, deposits, and withdrawals has been revoked.`
      },
      { new: true }
    );

    if (!updatedAlert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Log to fraud history for each banned user
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

      await FraudHistoryService.logBan(
        userInfo,
        reason === 'multi_accounting' ? 'Multi-accounting fraud' : customReason || reason,
        `Account permanently banned. Reason: ${customReason || reason}. All platform access revoked.`,
        true, // isPermanent
        adminInfo,
        alertId,
        { accountStatus: 'active' }
      );
    }

    console.log(`✅ Banned ${userIds.length} accounts (Alert: ${alertId})`);
    console.log(`   User IDs:`, userIds);

    // Log audit action for each banned user
    try {
      for (const userId of userIds) {
        const user = usersMap.get(userId);
        await auditLogService.logUserBanned(
          {
            id: adminUser.adminId || 'admin',
            email: adminUser.email || 'admin',
            name: (adminUser.email || 'admin').split('@')[0],
            role: 'admin',
          },
          userId,
          user?.name || userId,
          customReason || reason
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully banned ${userIds.length} account(s) permanently`,
      data: updatedAlert
    });

  } catch (error) {
    console.error('Error banning accounts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

