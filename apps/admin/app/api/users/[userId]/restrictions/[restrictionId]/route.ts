import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserRestriction from '@/database/models/user-restriction.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import AuditLog from '@/database/models/audit-log.model';
import UserNote from '@/database/models/user-notes.model';
import { getAdminSession } from '@/lib/admin/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; restrictionId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, restrictionId } = await params;
    await connectToDatabase();

    const restriction = await UserRestriction.findByIdAndUpdate(
      restrictionId,
      {
        isActive: false,
        unrestrictedAt: new Date(),
        unrestrictedBy: session.id,
      },
      { new: true }
    );

    if (!restriction) {
      return NextResponse.json({ error: 'Restriction not found' }, { status: 404 });
    }

    // Auto-add a note about lifting the restriction
    await UserNote.create({
      userId,
      adminId: session.id,
      adminName: session.name || session.email || 'Admin',
      content: `Restriction removed. Original reason: ${restriction.reason}${
        restriction.customReason ? ` - ${restriction.customReason}` : ''
      }`,
      category: 'general',
      priority: 'medium',
    });

    // Create audit log
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'restriction_removed',
      actionCategory: 'user_management',
      description: `Removed restriction from user ${userId}. Original reason: ${restriction.reason}`,
      targetType: 'user',
      targetId: userId,
      metadata: {
        restrictionId,
        originalType: restriction.restrictionType,
        originalReason: restriction.reason,
      },
      status: 'success',
    });

    // Mark related fraud alert as "cleared" so NEW fraud can generate NEW alerts
    if (restriction.relatedFraudAlertId) {
      const clearanceTimestamp = new Date();
      await FraudAlert.findByIdAndUpdate(
        restriction.relatedFraudAlertId,
        {
          $set: {
            investigationClearedAt: clearanceTimestamp,
            clearanceNote: `User cleared by admin: ${session.email || 'Unknown'}`,
          }
        }
      );
      console.log(`📝 Marked fraud alert ${restriction.relatedFraudAlertId} as cleared`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing restriction:', error);
    return NextResponse.json({ error: 'Failed to remove restriction' }, { status: 500 });
  }
}

