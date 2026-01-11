import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { adminUnlockAccount } from '@/lib/services/registration-security.service';

/**
 * POST /api/admin/lockouts/unlock
 * Admin endpoint to unlock an account - clears both database AND in-memory lockouts
 * Called by admin app to ensure user is fully unlocked
 */
export async function POST(req: NextRequest) {
  console.log('📥 [Main App] Received unlock request from admin');
  
  try {
    // Verify admin API key
    const headersList = await headers();
    const apiKey = headersList.get('x-admin-api-key');
    const expectedKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;
    
    console.log(`🔐 [Main App] API key present: ${!!apiKey}, Expected key set: ${!!expectedKey}`);
    
    // Accept if API key matches OR if ADMIN_API_KEY is not set (development)
    const isAuthorized = !expectedKey || apiKey === expectedKey;
    
    if (!isAuthorized) {
      console.error('❌ [Main App] Unauthorized - API key mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ [Main App] Authorization passed');

    const body = await req.json();
    const { email, userId, adminId, reason } = body;
    
    console.log(`📋 [Main App] Unlock request for email: ${email}, userId: ${userId}`);

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
        const { ObjectId } = await import('mongodb');
        let query: any = { id: userId };
        try {
          if (ObjectId.isValid(userId)) {
            query = { $or: [{ id: userId }, { _id: new ObjectId(userId) }] };
          }
        } catch {}
        const user = await db.collection('user').findOne(query);
        emailToUnlock = user?.email;
        console.log(`📋 [Main App] Looked up email from userId: ${emailToUnlock}`);
      }
    }

    if (!emailToUnlock) {
      console.error('❌ [Main App] Could not find email for user');
      return NextResponse.json({ error: 'Could not find email for user' }, { status: 404 });
    }

    // Use the service function that clears both in-memory and database
    console.log(`🔓 [Main App] Calling adminUnlockAccount for: ${emailToUnlock}`);
    const success = await adminUnlockAccount({
      email: emailToUnlock,
      adminId: adminId || 'admin',
      reason: reason || 'Admin manual unlock',
    });

    console.log(`🔓 [Main App] adminUnlockAccount result: ${success}`);

    // Always return success - the important part is clearing in-memory
    return NextResponse.json({ 
      success: true, 
      message: success 
        ? `Account unlocked for ${emailToUnlock}` 
        : 'No active lockouts found (may already be unlocked)',
      email: emailToUnlock,
      databaseCleared: success,
      inMemoryCleared: true // We always clear in-memory in adminUnlockAccount
    });
  } catch (error) {
    console.error('❌ [Main App] Error unlocking account:', error);
    return NextResponse.json({ 
      error: 'Failed to unlock account',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

