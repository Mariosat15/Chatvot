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
 * This clears database lockouts AND calls main app to clear in-memory lockouts
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

    // CRITICAL: Call main app to clear in-memory lockouts
    // Without this, user stays blocked even though database shows unlocked!
    let inMemoryCleared = false;
    if (userEmail) {
      try {
        const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const adminApiKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;
        
        console.log(`📡 [Admin] Calling main app to clear in-memory lockouts...`);
        console.log(`📡 [Admin] Main app URL: ${mainAppUrl}`);
        
        const response = await fetch(`${mainAppUrl}/api/admin/lockouts/unlock`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-admin-api-key': adminApiKey || '',
          },
          body: JSON.stringify({ 
            email: userEmail,
            userId,
            adminId: session.id,
            reason: reason || 'Admin manual unlock' 
          }),
        });
        
        const responseData = await response.json().catch(() => ({}));
        
        if (response.ok) {
          console.log(`✅ [Admin] In-memory lockouts cleared for user: ${userId}`, responseData);
          inMemoryCleared = true;
        } else {
          console.error(`❌ [Admin] Main app returned error:`, response.status, responseData);
        }
      } catch (memoryError) {
        console.error('❌ [Admin] Could not call main app to clear in-memory lockouts:', memoryError);
        // Log full error for debugging
        if (memoryError instanceof Error) {
          console.error('Error details:', memoryError.message, memoryError.stack);
        }
      }
    }
    
    // Log to FraudHistory
    try {
      const FraudHistory = (await import('@/database/models/fraud/fraud-history.model')).FraudHistory;
      await FraudHistory.logAction({
        userId: userId,
        userEmail: userEmail || 'unknown',
        userName: userEmail?.split('@')[0] || 'Unknown',
        actionType: 'account_unlocked',
        actionSeverity: 'medium',
        performedBy: {
          type: 'admin',
          adminId: session.id,
          adminEmail: session.email || undefined,
          adminName: session.name || undefined,
        },
        reason: reason || 'Admin manual unlock',
        details: `Account unlocked by admin. Database lockouts cleared: ${result.modifiedCount}. In-memory cleared: ${inMemoryCleared}`,
      });
      console.log(`📝 [Admin] Fraud history logged for unlock`);
    } catch (historyError) {
      console.error('Failed to log unlock to fraud history:', historyError);
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

