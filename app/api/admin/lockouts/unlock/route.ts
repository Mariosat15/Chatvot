import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import AccountLockout from '@/database/models/account-lockout.model';
import { adminUnlockAccount } from '@/lib/services/registration-security.service';

/**
 * POST /api/admin/lockouts/unlock
 * Admin endpoint to unlock an account - clears both database AND in-memory lockouts
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin API key or session
    const headersList = await headers();
    const apiKey = headersList.get('x-admin-api-key');
    const expectedKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;
    
    // Also accept requests from localhost (same server)
    const isLocalRequest = req.headers.get('host')?.includes('localhost') || 
                           req.headers.get('x-forwarded-for')?.includes('127.0.0.1');
    
    if (!isLocalRequest && apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, userId, adminId, reason } = body;

    if (!email && !userId) {
      return NextResponse.json({ error: 'Email or userId is required' }, { status: 400 });
    }

    await connectToDatabase();

    let emailToUnlock = email;

    // If only userId provided, get email from user collection
    if (!emailToUnlock && userId) {
      const mongoose = await import('mongoose');
      const db = mongoose.default.connection.db;
      if (db) {
        const user = await db.collection('user').findOne({
          $or: [
            { id: userId },
            { _id: userId }
          ]
        });
        emailToUnlock = user?.email;
      }
    }

    if (!emailToUnlock) {
      return NextResponse.json({ error: 'Could not find email for user' }, { status: 404 });
    }

    // Use the service function that clears both in-memory and database
    const success = await adminUnlockAccount({
      email: emailToUnlock,
      adminId: adminId || 'admin',
      reason: reason || 'Admin manual unlock',
    });

    if (success) {
      console.log(`🔓 [Admin API] Account unlocked: ${emailToUnlock}`);
      return NextResponse.json({ 
        success: true, 
        message: `Account unlocked for ${emailToUnlock}`,
        email: emailToUnlock 
      });
    } else {
      // Even if no active lockouts found, return success (might be already unlocked)
      return NextResponse.json({ 
        success: true, 
        message: 'No active lockouts found (may already be unlocked)',
        email: emailToUnlock 
      });
    }
  } catch (error) {
    console.error('Error unlocking account:', error);
    return NextResponse.json({ error: 'Failed to unlock account' }, { status: 500 });
  }
}

