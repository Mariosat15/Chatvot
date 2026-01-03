import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import FraudSettings, { DEFAULT_FRAUD_SETTINGS } from '@/database/models/fraud/fraud-settings.model';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * POST /api/fraud/settings/reset
 * Reset to default settings AND clear all fraud-related data (admin only)
 */
export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    // Parse body to check if we should also clear fraud data
    const body = await request.json().catch(() => ({}));
    const clearFraudData = body.clearFraudData !== false; // Default to true

    let settings = await FraudSettings.findOne();
    
    if (!settings) {
      settings = await FraudSettings.create(DEFAULT_FRAUD_SETTINGS);
    } else {
      Object.assign(settings, DEFAULT_FRAUD_SETTINGS);
      settings.updatedAt = new Date();
      await settings.save();
    }

    let clearedData = {
      lockouts: 0,
      fraudAlerts: 0,
      suspicionScores: 0,
    };

    // Also clear all fraud-related data if requested
    if (clearFraudData) {
      try {
        // Clear all active account lockouts
        const AccountLockout = (await import('@/database/models/account-lockout.model')).default;
        const lockoutResult = await AccountLockout.updateMany(
          { isActive: true },
          { 
            $set: { 
              isActive: false, 
              unlockedAt: new Date(),
              unlockedReason: 'Admin fraud settings reset' 
            }
          }
        );
        clearedData.lockouts = lockoutResult.modifiedCount;
        console.log(`🔓 Cleared ${lockoutResult.modifiedCount} active lockouts`);

        // Clear pending fraud alerts (mark as dismissed)
        const FraudAlert = (await import('@/database/models/fraud/fraud-alert.model')).default;
        const alertResult = await FraudAlert.updateMany(
          { status: { $in: ['pending', 'investigating'] } },
          { $set: { status: 'dismissed', resolvedAt: new Date(), resolvedBy: 'system_reset' } }
        );
        clearedData.fraudAlerts = alertResult.modifiedCount;
        console.log(`🚨 Dismissed ${alertResult.modifiedCount} fraud alerts`);

        // Reset all suspicion scores
        const SuspicionScore = (await import('@/database/models/fraud/suspicion-score.model')).default;
        const scoreResult = await SuspicionScore.updateMany(
          {},
          { 
            $set: { 
              totalScore: 0, 
              riskLevel: 'low',
              'scoreBreakdown.deviceMatch.percentage': 0,
              'scoreBreakdown.ipMatch.percentage': 0,
              'scoreBreakdown.ipBrowserMatch.percentage': 0,
              'scoreBreakdown.sameCity.percentage': 0,
              'scoreBreakdown.samePayment.percentage': 0,
              'scoreBreakdown.rapidCreation.percentage': 0,
              'scoreBreakdown.coordinatedEntry.percentage': 0,
              'scoreBreakdown.tradingSimilarity.percentage': 0,
              'scoreBreakdown.mirrorTrading.percentage': 0,
              'scoreBreakdown.timezoneLanguage.percentage': 0,
              'scoreBreakdown.deviceSwitching.percentage': 0,
              'scoreBreakdown.kycDuplicate.percentage': 0,
              'scoreBreakdown.bruteForce.percentage': 0,
              'scoreBreakdown.rateLimitExceeded.percentage': 0,
            }
          }
        );
        clearedData.suspicionScores = scoreResult.modifiedCount;
        console.log(`📊 Reset ${scoreResult.modifiedCount} suspicion scores`);

        // Also try to call main app to clear in-memory lockouts
        try {
          const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
          const adminApiKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;
          
          // This clears ALL in-memory lockouts on the main app
          await fetch(`${mainAppUrl}/api/admin/lockouts/clear-all`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-admin-api-key': adminApiKey || '',
            },
          });
          console.log(`✅ In-memory lockouts cleared on main app`);
        } catch (memoryError) {
          console.warn('⚠️ Could not clear in-memory lockouts on main app:', memoryError);
        }

      } catch (clearError) {
        console.error('Error clearing fraud data:', clearError);
        // Continue even if clearing fails
      }
    }

    console.log('✅ Fraud settings reset to defaults');

    return NextResponse.json({
      success: true,
      settings: JSON.parse(JSON.stringify(settings)),
      clearedData,
      message: clearFraudData 
        ? `Settings reset to defaults. Cleared ${clearedData.lockouts} lockouts, ${clearedData.fraudAlerts} alerts, and ${clearedData.suspicionScores} scores.`
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

