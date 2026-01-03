import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import AccountLockout from '@/database/models/account-lockout.model';

/**
 * POST /api/lockouts/clear-all
 * Clear all active lockouts OR clear lockout for specific email
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    let result;
    
    if (email) {
      // Clear lockout for specific email
      result = await AccountLockout.updateMany(
        { email, isActive: true },
        {
          $set: {
            isActive: false,
            unlockedAt: new Date(),
            unlockedBy: session.id,
            unlockedReason: 'Admin manual unlock',
          }
        }
      );
      
      // Also try to clear in-memory lockouts on main app
      try {
        const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const adminApiKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;
        
        await fetch(`${mainAppUrl}/api/admin/lockouts/unlock`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-admin-api-key': adminApiKey || '',
          },
          body: JSON.stringify({ email, adminId: session.id }),
        });
      } catch (e) {
        console.warn('Could not clear in-memory lockouts:', e);
      }
      
      console.log(`🔓 [Admin] Cleared lockout for ${email}: ${result.modifiedCount} cleared`);
    } else {
      // Clear ALL lockouts
      result = await AccountLockout.updateMany(
        { isActive: true },
        {
          $set: {
            isActive: false,
            unlockedAt: new Date(),
            unlockedBy: session.id,
            unlockedReason: 'Admin bulk unlock',
          }
        }
      );
      
      // Also clear all in-memory lockouts on main app
      try {
        const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const adminApiKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;
        
        await fetch(`${mainAppUrl}/api/admin/lockouts/clear-all`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-admin-api-key': adminApiKey || '',
          },
        });
      } catch (e) {
        console.warn('Could not clear all in-memory lockouts:', e);
      }
      
      console.log(`🔓 [Admin] Cleared ALL lockouts: ${result.modifiedCount} cleared`);
    }

    return NextResponse.json({ 
      success: true, 
      cleared: result.modifiedCount,
      message: email 
        ? `Unlocked account for ${email}` 
        : `Cleared ${result.modifiedCount} lockouts`
    });
  } catch (error) {
    console.error('Error clearing lockouts:', error);
    return NextResponse.json({ error: 'Failed to clear lockouts' }, { status: 500 });
  }
}

