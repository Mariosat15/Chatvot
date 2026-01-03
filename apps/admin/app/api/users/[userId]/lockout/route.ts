import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import AccountLockout from '@/database/models/account-lockout.model';

/**
 * GET /api/users/[userId]/lockout - Check if user is locked
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    await connectToDatabase();

    const now = new Date();
    
    // Find active lockout by userId or by looking up user email
    let lockout = await AccountLockout.findOne({
      userId,
      isActive: true,
      $or: [
        { lockedUntil: { $gt: now } },
        { lockedUntil: null }
      ]
    }).sort({ lockedAt: -1 }).lean();

    // If not found by userId, try to find by getting user's email
    if (!lockout) {
      const mongoose = await import('mongoose');
      const db = mongoose.connection.db;
      if (db) {
        const user = await db.collection('user').findOne({ 
          $or: [
            { id: userId },
            { _id: new (await import('mongodb')).ObjectId(userId) }
          ]
        });
        
        if (user?.email) {
          lockout = await AccountLockout.findOne({
            email: user.email,
            isActive: true,
            $or: [
              { lockedUntil: { $gt: now } },
              { lockedUntil: null }
            ]
          }).sort({ lockedAt: -1 }).lean();
        }
      }
    }

    // Get lockout history for this user
    const history = await AccountLockout.find({
      $or: [
        { userId },
        { email: lockout?.email }
      ].filter(Boolean)
    }).sort({ createdAt: -1 }).limit(10).lean();

    return NextResponse.json({
      isLocked: !!lockout,
      lockout: lockout || null,
      history,
    });
  } catch (error) {
    console.error('Error checking user lockout:', error);
    return NextResponse.json({ error: 'Failed to check lockout status' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[userId]/lockout - Unlock user account
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    await connectToDatabase();

    // Get user email first
    const mongoose = await import('mongoose');
    const db = mongoose.connection.db;
    let userEmail = '';
    
    if (db) {
      const user = await db.collection('user').findOne({ 
        $or: [
          { id: userId },
          { _id: new (await import('mongodb')).ObjectId(userId) }
        ]
      });
      userEmail = user?.email || '';
    }

    // Unlock by userId and email
    const query: any = { isActive: true };
    if (userEmail) {
      query.$or = [{ userId }, { email: userEmail }];
    } else {
      query.userId = userId;
    }

    const result = await AccountLockout.updateMany(
      query,
      {
        $set: {
          isActive: false,
          unlockedAt: new Date(),
          unlockedBy: session.id,
          unlockedReason: reason || 'Admin manual unlock',
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'No active lockouts found for this user' }, { status: 404 });
    }

    // Create audit log
    const AuditLog = (await import('@/database/models/audit-log.model')).default;
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'account_unlock',
      actionCategory: 'security',
      description: `Unlocked account for user ${userId}`,
      targetType: 'user',
      targetId: userId,
      metadata: { reason, lockoutsCleared: result.modifiedCount, userEmail },
      status: 'success',
    });

    console.log(`🔓 [Admin] Account unlocked for user ${userId} by ${session.email}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Account unlocked successfully',
      lockoutsCleared: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error unlocking user account:', error);
    return NextResponse.json({ error: 'Failed to unlock account' }, { status: 500 });
  }
}

