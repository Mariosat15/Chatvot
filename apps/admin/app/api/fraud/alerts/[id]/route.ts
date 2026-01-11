import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import { requireAdminAuth } from '@/lib/admin/auth';
import { FraudHistoryService } from '@/lib/services/fraud/fraud-history.service';
import { getUsersByIds } from '@/lib/utils/user-lookup';

/**
 * PUT /api/admin/fraud/alerts/[id]
 * Update fraud alert status (admin only)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();
    const { status, resolution, actionTaken } = body;

    const alert = await FraudAlert.findById(id);
    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    const previousStatus = alert.status;

    // Update alert
    if (status) alert.status = status;
    if (resolution) alert.resolution = resolution;
    if (actionTaken) alert.actionTaken = actionTaken;

    if (status === 'resolved' || status === 'dismissed') {
      const resolvedTimestamp = new Date();
      alert.resolvedAt = resolvedTimestamp;
      alert.resolvedBy = auth.adminId || auth.email || 'system';
      
      // IMPORTANT: If dismissed (no action taken), mark as cleared immediately
      // so users can trigger NEW alerts if they commit fraud again
      if (status === 'dismissed') {
        alert.investigationClearedAt = resolvedTimestamp;
        alert.clearanceNote = `Dismissed by ${auth.email || 'admin'} - User cleared without restrictions`;
        console.log(`📝 Alert ${id} dismissed and marked as cleared - future fraud will generate NEW alerts`);
      }
    }

    await alert.save();

    // Log to fraud history for each involved user
    const adminInfo = {
      adminId: auth.adminId,
      adminEmail: auth.email,
      adminName: auth.email?.split('@')[0],
    };

    // Get all user IDs from alert
    const userIds = [
      alert.primaryUserId,
      ...(alert.suspiciousUserIds || [])
    ].filter((id, idx, arr) => id && arr.indexOf(id) === idx); // Remove duplicates and nulls
    
    const usersMap = await getUsersByIds(userIds);

    for (const userId of userIds) {
      const user = usersMap.get(userId);
      if (!user) continue;
      
      const userInfo = {
        userId: userId,
        email: user.email,
        name: user.name,
      };

      if (status === 'investigating' && previousStatus === 'pending') {
        await FraudHistoryService.logInvestigationStarted(
          userInfo,
          alert.title,
          `Investigation started for alert: ${alert.description}`,
          adminInfo,
          id
        );
      } else if (status === 'resolved') {
        await FraudHistoryService.logAlertResolved(
          userInfo,
          resolution || 'Alert resolved',
          `Alert resolved with action: ${actionTaken || 'none'}`,
          adminInfo,
          id
        );
      } else if (status === 'dismissed') {
        await FraudHistoryService.logAlertDismissed(
          userInfo,
          resolution || 'Alert dismissed',
          'Alert dismissed as false positive or acceptable use case',
          adminInfo,
          id
        );
      }
    }

    console.log(`✅ Fraud alert ${id} updated: ${status}`);

    return NextResponse.json({
      success: true,
      alert: JSON.parse(JSON.stringify(alert))
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating fraud alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/fraud/alerts/[id]
 * Delete fraud alert (admin only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;

    const alert = await FraudAlert.findByIdAndDelete(id);
    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    console.log(`🗑️ Fraud alert ${id} deleted`);

    return NextResponse.json({
      success: true,
      message: 'Alert deleted'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting fraud alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}

