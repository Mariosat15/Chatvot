/**
 * One-time script to apply suspensions to users with existing duplicate KYC fraud alerts
 * 
 * Run with: npx ts-node scripts/apply-duplicate-kyc-suspensions.ts
 * Or: npx tsx scripts/apply-duplicate-kyc-suspensions.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import FraudAlert from '../database/models/fraud/fraud-alert.model';
import FraudSettings from '../database/models/fraud/fraud-settings.model';
import UserRestriction from '../database/models/user-restriction.model';

async function applyDuplicateKYCSuspensions() {
  console.log('\n🔐 Applying suspensions to existing duplicate KYC alerts...\n');

  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    // Get fraud settings
    const fraudSettings = await FraudSettings.findOne();
    
    if (!fraudSettings?.duplicateKYCAutoSuspend) {
      console.log('⚠️  Duplicate KYC auto-suspend is DISABLED in fraud settings.');
      console.log('   Enable it first in Admin → Security → Fraud Settings');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 Fraud Settings:');
    console.log(`   Auto-suspend enabled: ${fraudSettings.duplicateKYCAutoSuspend}`);
    console.log(`   Block deposits: ${fraudSettings.duplicateKYCBlockDeposits}`);
    console.log(`   Block trading: ${fraudSettings.duplicateKYCBlockTrading}`);
    console.log(`   Block competitions: ${fraudSettings.duplicateKYCBlockCompetitions}`);
    console.log(`   Block challenges: ${fraudSettings.duplicateKYCBlockChallenges}`);
    console.log(`   Allow withdrawals: ${fraudSettings.duplicateKYCAllowWithdrawals}`);
    console.log('');

    // Find all duplicate KYC fraud alerts
    const duplicateAlerts = await FraudAlert.find({
      alertType: 'duplicate_kyc',
      status: { $in: ['pending', 'investigating'] }, // Active alerts only
    }).lean();

    console.log(`📊 Found ${duplicateAlerts.length} active duplicate KYC alert(s)\n`);

    if (duplicateAlerts.length === 0) {
      console.log('✅ No active duplicate KYC alerts found. Nothing to do.');
      await mongoose.disconnect();
      return;
    }

    let totalUsersSuspended = 0;
    let totalUsersAlreadySuspended = 0;

    for (const alert of duplicateAlerts) {
      console.log(`\n🚨 Processing Alert: ${alert._id}`);
      console.log(`   Title: ${alert.title}`);
      console.log(`   Involved users: ${alert.suspiciousUserIds?.length || 0}`);

      const involvedUserIds = alert.suspiciousUserIds || [];

      for (const userId of involvedUserIds) {
        // Check if user already has an active KYC fraud restriction
        const existingRestriction = await UserRestriction.findOne({
          userId,
          reason: 'kyc_fraud',
          isActive: true,
        });

        if (existingRestriction) {
          console.log(`   ⏭️  User ${userId} already suspended`);
          totalUsersAlreadySuspended++;
          continue;
        }

        // Create restriction
        await UserRestriction.create({
          userId,
          restrictionType: 'suspended',
          reason: 'kyc_fraud',
          customReason: `Duplicate KYC detected. Applied by migration script. Alert ID: ${alert._id}`,
          canTrade: !fraudSettings.duplicateKYCBlockTrading,
          canEnterCompetitions: !fraudSettings.duplicateKYCBlockCompetitions,
          canDeposit: !fraudSettings.duplicateKYCBlockDeposits,
          canWithdraw: fraudSettings.duplicateKYCAllowWithdrawals,
          restrictedBy: 'system-migration',
          relatedFraudAlertId: alert._id.toString(),
          relatedUserIds: involvedUserIds.filter((id: string) => id !== userId),
          isActive: true,
        });

        console.log(`   ✅ Suspended user: ${userId}`);
        totalUsersSuspended++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Total alerts processed: ${duplicateAlerts.length}`);
    console.log(`   Users newly suspended: ${totalUsersSuspended}`);
    console.log(`   Users already suspended: ${totalUsersAlreadySuspended}`);
    console.log('='.repeat(50));

    await mongoose.disconnect();
    console.log('\n✅ Done! Database disconnected.\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
applyDuplicateKYCSuspensions();

