import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * POST /api/admin/reset-all-users
 * DANGER: Deletes ALL user accounts and ALL related user data
 * Includes: accounts, trading data, financial data, progress, etc.
 * Keeps: Competition/Challenge templates, admin settings, marketplace items
 * Requires explicit confirmation to prevent accidental data loss
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    
    const body = await request.json();
    const { confirmation } = body;
    
    // Require explicit confirmation
    if (confirmation !== 'DELETE_ALL_USERS') {
      return NextResponse.json(
        { error: 'Invalid confirmation. You must type "DELETE_ALL_USERS" exactly.' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }
    
    console.log('🚨 [ADMIN] Starting FULL USER DATA RESET...');
    
    const results: Record<string, number> = {};
    
    // ALL user-related collections to delete
    const collectionsToReset = [
      // User accounts
      'user',
      'account',
      'session',
      'accountlockouts',
      'useronlinestatuses',
      'userpresences',
      
      // User wallets & financial
      'creditwallets',
      'wallettransactions',
      'withdrawalrequests',
      'userbankaccounts',
      'nuveiuserpaymentoptions',
      
      // User trading data
      'competitionparticipants',
      'challengeparticipants',
      'tradingpositions',
      'tradehistories',
      'tradingorders',
      'positionevents',
      
      // User progress
      'userlevels',
      'userbadges',
      'userpurchases',
      
      // User settings & other
      'userrestrictions',
      'usernotificationpreferences',
      'notifications',
      'usernotes',
      'kycsessions',
      'alerts',
      
      // Verification tokens
      'verifications',
      
      // Audit data related to users
      'auditlogs',
      'customer_audit_trail',
      'userprofiles',
      
      // Messaging data
      'conversations',
      'messages',
      'friend_requests',
      'friendships',
    ];
    
    for (const collectionName of collectionsToReset) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        results[collectionName] = result.deletedCount;
        if (result.deletedCount > 0) {
          console.log(`   ✅ Cleared ${collectionName}: ${result.deletedCount} documents`);
        }
      } catch (collError) {
        results[collectionName] = 0;
      }
    }
    
    // Calculate total
    const totalDeleted = Object.values(results).reduce((sum, count) => sum + count, 0);
    
    console.log(`🚨 [ADMIN] USER DATA RESET COMPLETE - ${totalDeleted} total documents deleted`);
    
    // Log this action for audit purposes
    try {
      const AuditLog = (await import('@/database/models/audit-log.model')).default;
      await AuditLog.create({
        action: 'reset_all_users',
        actionCategory: 'system',
        description: `Full user data reset - deleted ${totalDeleted} documents across ${Object.keys(results).filter(k => results[k] > 0).length} collections`,
        metadata: results,
        status: 'success',
        userId: 'admin',
        userName: 'Admin',
        userEmail: 'admin@system',
        userRole: 'admin',
        timestamp: new Date(),
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${totalDeleted} documents across ${collectionsToReset.length} collections`,
      details: results,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error resetting user data:', error);
    return NextResponse.json(
      { error: 'Failed to reset user data' },
      { status: 500 }
    );
  }
}

