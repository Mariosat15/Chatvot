import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import FraudSettings, { DEFAULT_FRAUD_SETTINGS } from '@/database/models/fraud/fraud-settings.model';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * POST /api/fraud/settings/reset
 * Reset to default settings AND clear ALL security/fraud-related data (admin only)
 * Clears: fraud alerts, fraud history, suspicion scores, device fingerprints,
 * payment fingerprints, behavioral profiles, security logs, account lockouts
 */
export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const clearAllSecurityData = body.clearAllSecurityData || body.clearFraudData;

    // Reset settings to defaults
    let settings = await FraudSettings.findOne();
    
    if (!settings) {
      settings = await FraudSettings.create(DEFAULT_FRAUD_SETTINGS);
    } else {
      Object.assign(settings, DEFAULT_FRAUD_SETTINGS);
      settings.updatedAt = new Date();
      await settings.save();
    }

    const clearedData: Record<string, number> = {};
    const db = mongoose.connection.db;

    if (clearAllSecurityData && db) {
      console.log('🚨 [ADMIN] Starting FULL SECURITY DATA RESET...');

      // List of all security-related collections to DELETE
      const collectionsToDelete = [
        'fraudalerts',
        'fraudhistories',
        'fraudhistory',
        'suspicionscores',
        'devicefingerprints',
        'paymentfingerprints',
        'behavioralsimilarities',
        'tradingbehaviorprofiles',
        'securitylogs',
        'accountlockouts',
      ];

      for (const collectionName of collectionsToDelete) {
        try {
          const result = await db.collection(collectionName).deleteMany({});
          clearedData[collectionName] = result.deletedCount;
          if (result.deletedCount > 0) {
            console.log(`   ✅ Deleted ${collectionName}: ${result.deletedCount} documents`);
          }
        } catch (err) {
          clearedData[collectionName] = 0;
        }
      }

      // Also try to call main app to clear in-memory lockouts
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
        console.log(`   ✅ In-memory lockouts cleared on main app`);
      } catch (memoryError) {
        console.warn('   ⚠️ Could not clear in-memory lockouts on main app');
      }

      console.log('🚨 [ADMIN] SECURITY DATA RESET COMPLETE');
    }

    const totalDeleted = Object.values(clearedData).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      success: true,
      settings: JSON.parse(JSON.stringify(settings)),
      clearedData,
      totalDeleted,
      message: clearAllSecurityData 
        ? `All security data cleared! Deleted ${totalDeleted} documents. Settings reset to defaults.`
        : 'Settings reset to defaults'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error resetting fraud settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset settings' },
      { status: 500 }
    );
  }
}

