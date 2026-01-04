import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * POST /api/admin/reset-all-users
 * DANGER: Deletes ALL user data from the database
 * Requires explicit confirmation to prevent accidental data loss
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    
    const body = await request.json();
    const { confirmation } = body;
    
    // Require explicit confirmation
    if (confirmation !== 'DELETE ALL USERS') {
      return NextResponse.json(
        { error: 'Invalid confirmation. You must type "DELETE ALL USERS" exactly.' },
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
    
    // List of collections to clear
    const collectionsToReset = [
      'user',
      'account',
      'accountlockouts',
      'useronlinestatuses',
      'creditwallets',
      'worker_jobs',
      'securitylogs',
      // Also clear related collections
      'fraudalerts',
      'fraudhistory',
      'suspicionscores',
      'userrestrictions',
      'kycsessions',
      'notifications',
      'verifications',
      'sessions',
    ];
    
    for (const collectionName of collectionsToReset) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        results[collectionName] = result.deletedCount;
        console.log(`   ✅ Cleared ${collectionName}: ${result.deletedCount} documents`);
      } catch (collError) {
        // Collection might not exist, that's OK
        results[collectionName] = 0;
        console.log(`   ⚠️ Collection ${collectionName}: not found or empty`);
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
        description: `Full user data reset - deleted ${totalDeleted} documents`,
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

