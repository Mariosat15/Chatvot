import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import AccountLockout from '@/database/models/account-lockout.model';

/**
 * GET /api/lockouts - List all active account lockouts
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const now = new Date();

    // Get all active lockouts (temporary that haven't expired + permanent)
    const lockouts = await AccountLockout.find({
      isActive: true,
      $or: [
        { lockedUntil: { $gt: now } },
        { lockedUntil: null }
      ]
    }).sort({ lockedAt: -1 }).lean();

    // Get lockout history (last 100)
    const history = await AccountLockout.find({
      isActive: false
    }).sort({ unlockedAt: -1 }).limit(100).lean();

    // Get stats
    const stats = {
      activeLockouts: lockouts.length,
      temporaryLockouts: lockouts.filter(l => l.lockedUntil).length,
      permanentLockouts: lockouts.filter(l => !l.lockedUntil).length,
      totalHistoric: await AccountLockout.countDocuments({ isActive: false }),
    };

    return NextResponse.json({
      lockouts,
      history,
      stats,
    });
  } catch (error) {
    console.error('Error fetching lockouts:', error);
    return NextResponse.json({ error: 'Failed to fetch lockouts' }, { status: 500 });
  }
}

/**
 * POST /api/lockouts - Manually lock an account (admin action)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, userId, reason, permanent, durationMinutes } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await connectToDatabase();

    const lockoutData: Record<string, any> = {
      email,
      userId,
      reason: 'admin_action',
      failedAttempts: 0,
      lastAttemptAt: new Date(),
      lockedAt: new Date(),
      isActive: true,
    };

    if (!permanent && durationMinutes) {
      lockoutData.lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    }

    const lockout = await AccountLockout.create(lockoutData);

    // Create audit log
    const AuditLog = (await import('@/database/models/audit-log.model')).default;
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'account_lock',
      actionCategory: 'security',
      description: `Manually locked account: ${email}`,
      targetType: 'user',
      targetId: userId || email,
      metadata: { reason, permanent, durationMinutes },
      status: 'success',
    });

    return NextResponse.json({ success: true, lockout });
  } catch (error) {
    console.error('Error locking account:', error);
    return NextResponse.json({ error: 'Failed to lock account' }, { status: 500 });
  }
}

