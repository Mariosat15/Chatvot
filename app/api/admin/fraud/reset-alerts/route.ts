import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';
import UserRestriction from '@/database/models/user-restriction.model';
import SuspicionScore from '@/database/models/fraud/suspicion-score.model';
import PaymentFingerprint from '@/database/models/fraud/payment-fingerprint.model';
import BehavioralSimilarity from '@/database/models/fraud/behavioral-similarity.model';
import TradingBehaviorProfile from '@/database/models/fraud/trading-behavior-profile.model';
import bcrypt from 'bcryptjs';

/**
 * Reset ALL fraud alerts and related data
 * 
 * ⚠️ WARNING: This will:
 * - Delete all fraud alerts
 * - Delete all device fingerprints
 * - Delete all user restrictions (bans/suspensions)
 * - Delete all suspicion scores (Device Match, Mirror Trading, Payment, etc.)
 * - Delete all payment fingerprints
 * - Delete all behavioral similarity data
 * - Delete all trading behavior profiles
 * - Clear all flags and suspicions
 * 
 * Requires admin password verification!
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    const isAdmin = authHeader && (await verifyAdminAuth(authHeader.replace('Bearer ', '')));
    
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ 
        success: false, 
        message: 'Admin password is required' 
      }, { status: 400 });
    }

    // Verify admin password
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json({ 
        success: false, 
        message: 'Admin password not configured' 
      }, { status: 500 });
    }

    // Check if password is hashed or plain text
    const isPasswordValid = adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$')
      ? await bcrypt.compare(password, adminPassword)
      : password === adminPassword;

    if (!isPasswordValid) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid password' 
      }, { status: 401 });
    }

    await connectToDatabase();

    // Count before reset
    const alertCountBefore = await FraudAlert.countDocuments();
    const deviceCountBefore = await DeviceFingerprint.countDocuments();
    const restrictionCountBefore = await UserRestriction.countDocuments();
    const suspicionScoreCountBefore = await SuspicionScore.countDocuments();
    const paymentFingerprintCountBefore = await PaymentFingerprint.countDocuments();
    const behavioralSimilarityCountBefore = await BehavioralSimilarity.countDocuments();
    const tradingProfileCountBefore = await TradingBehaviorProfile.countDocuments();

    console.log(`🗑️ BEFORE RESET:`);
    console.log(`   - Alerts: ${alertCountBefore}`);
    console.log(`   - Device Fingerprints: ${deviceCountBefore}`);
    console.log(`   - User Restrictions: ${restrictionCountBefore}`);
    console.log(`   - Suspicion Scores: ${suspicionScoreCountBefore}`);
    console.log(`   - Payment Fingerprints: ${paymentFingerprintCountBefore}`);
    console.log(`   - Behavioral Similarities: ${behavioralSimilarityCountBefore}`);
    console.log(`   - Trading Profiles: ${tradingProfileCountBefore}`);

    // Delete all fraud alerts
    const alertDeleteResult = await FraudAlert.deleteMany({});
    console.log(`✅ Alerts deleted: ${alertDeleteResult.deletedCount}`);

    // DELETE all device fingerprints for completely fresh start
    const deviceDeleteResult = await DeviceFingerprint.deleteMany({});
    console.log(`✅ Device fingerprints deleted: ${deviceDeleteResult.deletedCount}`);

    // DELETE all user restrictions (unban/unsuspend all users)
    const restrictionDeleteResult = await UserRestriction.deleteMany({});
    console.log(`✅ User restrictions deleted: ${restrictionDeleteResult.deletedCount}`);

    // DELETE all suspicion scores (Device Match, Mirror Trading, Payment, etc.)
    const suspicionScoreDeleteResult = await SuspicionScore.deleteMany({});
    console.log(`✅ Suspicion scores deleted: ${suspicionScoreDeleteResult.deletedCount}`);

    // DELETE all payment fingerprints
    const paymentFingerprintDeleteResult = await PaymentFingerprint.deleteMany({});
    console.log(`✅ Payment fingerprints deleted: ${paymentFingerprintDeleteResult.deletedCount}`);

    // DELETE all behavioral similarity data
    const behavioralSimilarityDeleteResult = await BehavioralSimilarity.deleteMany({});
    console.log(`✅ Behavioral similarities deleted: ${behavioralSimilarityDeleteResult.deletedCount}`);

    // DELETE all trading behavior profiles
    const tradingProfileDeleteResult = await TradingBehaviorProfile.deleteMany({});
    console.log(`✅ Trading profiles deleted: ${tradingProfileDeleteResult.deletedCount}`);

    // Verify deletion
    const alertCountAfter = await FraudAlert.countDocuments();
    const deviceCountAfter = await DeviceFingerprint.countDocuments();
    const restrictionCountAfter = await UserRestriction.countDocuments();
    const suspicionScoreCountAfter = await SuspicionScore.countDocuments();

    console.log(`🔍 AFTER RESET:`);
    console.log(`   - Alerts remaining: ${alertCountAfter}`);
    console.log(`   - Device Fingerprints remaining: ${deviceCountAfter}`);
    console.log(`   - User Restrictions remaining: ${restrictionCountAfter}`);
    console.log(`   - Suspicion Scores remaining: ${suspicionScoreCountAfter}`);

    const allCleared = alertCountAfter === 0 && deviceCountAfter === 0 && 
                       restrictionCountAfter === 0 && suspicionScoreCountAfter === 0;

    if (!allCleared) {
      console.error(`⚠️ WARNING: Some data still remains after reset!`);
    } else {
      console.log(`✅ All fraud data successfully deleted from database`);
      console.log(`   All users are now unrestricted and can access the platform`);
      console.log(`   All fraud scores reset to 0%`);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Reset complete: Deleted ${alertDeleteResult.deletedCount} alerts, ${deviceDeleteResult.deletedCount} device fingerprints, ${restrictionDeleteResult.deletedCount} user restrictions, ${suspicionScoreDeleteResult.deletedCount} suspicion scores, ${paymentFingerprintDeleteResult.deletedCount} payment fingerprints, ${behavioralSimilarityDeleteResult.deletedCount} behavioral similarities, and ${tradingProfileDeleteResult.deletedCount} trading profiles. All fraud scores reset to 0%.`,
      data: {
        alertsDeleted: alertDeleteResult.deletedCount,
        deviceFingerprintsDeleted: deviceDeleteResult.deletedCount,
        userRestrictionsDeleted: restrictionDeleteResult.deletedCount,
        suspicionScoresDeleted: suspicionScoreDeleteResult.deletedCount,
        paymentFingerprintsDeleted: paymentFingerprintDeleteResult.deletedCount,
        behavioralSimilaritiesDeleted: behavioralSimilarityDeleteResult.deletedCount,
        tradingProfilesDeleted: tradingProfileDeleteResult.deletedCount
      }
    });
  } catch (error) {
    console.error('Error resetting fraud alerts:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to reset alerts' 
    }, { status: 500 });
  }
}

