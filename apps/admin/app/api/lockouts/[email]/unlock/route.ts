import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import AccountLockout from '@/database/models/account-lockout.model';

/**
 * POST /api/lockouts/[email]/unlock - Unlock an account
 * This clears database lockouts AND calls main app to clear in-memory lockouts
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await params;
    const decodedEmail = decodeURIComponent(email);
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    await connectToDatabase();

    // Unlock all active lockouts for this email in database
    const result = await AccountLockout.updateMany(
      { email: decodedEmail, isActive: true },
      {
        $set: {
          isActive: false,
          unlockedAt: new Date(),
          unlockedBy: session.id,
          unlockedReason: reason || 'Admin manual unlock',
        }
      }
    );

    // Also call main app to clear in-memory lockouts
    try {
      const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const adminApiKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;
      
      await fetch(`${mainAppUrl}/api/admin/lockouts/unlock`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-api-key': adminApiKey || '',
        },
        body: JSON.stringify({ 
          email: decodedEmail, 
          adminId: session.id,
          reason: reason || 'Admin manual unlock' 
        }),
      });
      console.log(`✅ [Admin] In-memory lockouts cleared for: ${decodedEmail}`);
    } catch (memoryError) {
      console.warn('⚠️ Could not clear in-memory lockouts (main app may be unreachable):', memoryError);
      // Continue even if this fails - database is already cleared
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
      description: `Unlocked account: ${decodedEmail}`,
      targetType: 'user',
      targetId: decodedEmail,
      metadata: { reason, lockoutsCleared: result.modifiedCount },
      status: 'success',
    });

    console.log(`🔓 [Admin] Account unlocked: ${decodedEmail} by ${session.email} (${result.modifiedCount} lockouts cleared)`);

    return NextResponse.json({ 
      success: true, 
      message: `Account unlocked successfully`,
      lockoutsCleared: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error unlocking account:', error);
    return NextResponse.json({ error: 'Failed to unlock account' }, { status: 500 });
  }
}

