/**
 * Scan all KYC sessions for duplicates
 * 
 * This script:
 * 1. Scans ALL approved KYC sessions in the database
 * 2. Groups them by document number, ID number, or fingerprint
 * 3. Creates fraud alerts for any duplicates found
 * 4. Applies suspensions if auto-suspend is enabled
 * 5. Updates fraud scores for all involved users
 * 
 * Run with: npx tsx scripts/scan-duplicate-kyc.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import KYCSession from '../database/models/kyc-session.model';
import FraudAlert from '../database/models/fraud/fraud-alert.model';
import FraudSettings from '../database/models/fraud/fraud-settings.model';
import UserRestriction from '../database/models/user-restriction.model';
import SuspicionScore from '../database/models/fraud/suspicion-score.model';

interface DuplicateGroup {
  key: string;
  matchType: 'document_number' | 'id_number' | 'fingerprint' | 'name_dob';
  sessions: any[];
}

async function scanForDuplicateKYC() {
  console.log('\n🔍 Scanning all KYC sessions for duplicates...\n');

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
    
    console.log('📋 Fraud Settings:');
    console.log(`   Auto-suspend enabled: ${fraudSettings?.duplicateKYCAutoSuspend ?? false}`);
    console.log(`   Block deposits: ${fraudSettings?.duplicateKYCBlockDeposits ?? true}`);
    console.log(`   Block trading: ${fraudSettings?.duplicateKYCBlockTrading ?? true}`);
    console.log(`   Block competitions: ${fraudSettings?.duplicateKYCBlockCompetitions ?? true}`);
    console.log(`   Block challenges: ${fraudSettings?.duplicateKYCBlockChallenges ?? true}`);
    console.log(`   Allow withdrawals: ${fraudSettings?.duplicateKYCAllowWithdrawals ?? true}`);
    console.log('');

    // Get all approved KYC sessions
    const approvedSessions = await KYCSession.find({
      status: 'approved',
    }).lean();

    console.log(`📊 Found ${approvedSessions.length} approved KYC session(s)\n`);

    if (approvedSessions.length < 2) {
      console.log('✅ Not enough sessions to have duplicates. Done.');
      await mongoose.disconnect();
      return;
    }

    // Group by various identifiers to find duplicates
    const duplicateGroups: DuplicateGroup[] = [];

    // Group 1: By document number + country
    const byDocNumber: Record<string, any[]> = {};
    for (const session of approvedSessions) {
      if (session.documentData?.number && session.documentData?.country) {
        const key = `${session.documentData.number.toUpperCase().replace(/\s/g, '')}|${session.documentData.country.toUpperCase()}`;
        if (!byDocNumber[key]) byDocNumber[key] = [];
        byDocNumber[key].push(session);
      }
    }
    for (const [key, sessions] of Object.entries(byDocNumber)) {
      if (sessions.length > 1) {
        duplicateGroups.push({ key, matchType: 'document_number', sessions });
      }
    }

    // Group 2: By ID number
    const byIdNumber: Record<string, any[]> = {};
    for (const session of approvedSessions) {
      if (session.personData?.idNumber) {
        const key = session.personData.idNumber.toUpperCase().replace(/\s/g, '');
        if (!byIdNumber[key]) byIdNumber[key] = [];
        byIdNumber[key].push(session);
      }
    }
    for (const [key, sessions] of Object.entries(byIdNumber)) {
      if (sessions.length > 1) {
        // Check if we already have this group from document number
        const existingUserIds = new Set(sessions.map(s => s.userId));
        const alreadyGrouped = duplicateGroups.some(g => {
          const gUserIds = new Set(g.sessions.map(s => s.userId));
          return sessions.every(s => gUserIds.has(s.userId));
        });
        if (!alreadyGrouped) {
          duplicateGroups.push({ key, matchType: 'id_number', sessions });
        }
      }
    }

    // Group 3: By document fingerprint
    const byFingerprint: Record<string, any[]> = {};
    for (const session of approvedSessions) {
      if (session.documentFingerprint) {
        const key = session.documentFingerprint;
        if (!byFingerprint[key]) byFingerprint[key] = [];
        byFingerprint[key].push(session);
      }
    }
    for (const [key, sessions] of Object.entries(byFingerprint)) {
      if (sessions.length > 1) {
        const alreadyGrouped = duplicateGroups.some(g => {
          const gUserIds = new Set(g.sessions.map(s => s.userId));
          return sessions.every(s => gUserIds.has(s.userId));
        });
        if (!alreadyGrouped) {
          duplicateGroups.push({ key, matchType: 'fingerprint', sessions });
        }
      }
    }

    // Group 4: By name + date of birth
    const byNameDob: Record<string, any[]> = {};
    for (const session of approvedSessions) {
      if (session.personData?.firstName && session.personData?.lastName && session.personData?.dateOfBirth) {
        const key = `${session.personData.firstName.toUpperCase()}|${session.personData.lastName.toUpperCase()}|${session.personData.dateOfBirth}`;
        if (!byNameDob[key]) byNameDob[key] = [];
        byNameDob[key].push(session);
      }
    }
    for (const [key, sessions] of Object.entries(byNameDob)) {
      if (sessions.length > 1) {
        const alreadyGrouped = duplicateGroups.some(g => {
          const gUserIds = new Set(g.sessions.map(s => s.userId));
          return sessions.every(s => gUserIds.has(s.userId));
        });
        if (!alreadyGrouped) {
          duplicateGroups.push({ key, matchType: 'name_dob', sessions });
        }
      }
    }

    console.log(`🔎 Found ${duplicateGroups.length} duplicate group(s)\n`);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found. All KYC sessions are unique.');
      await mongoose.disconnect();
      return;
    }

    let alertsCreated = 0;
    let usersSuspended = 0;
    let scoresUpdated = 0;

    for (const group of duplicateGroups) {
      const userIds = [...new Set(group.sessions.map(s => s.userId))];
      
      console.log(`\n🚨 Duplicate Group: ${group.matchType}`);
      console.log(`   Key: ${group.key.substring(0, 30)}...`);
      console.log(`   Involved users: ${userIds.length}`);
      userIds.forEach(id => console.log(`     - ${id}`));

      // Check if alert already exists
      const existingAlert = await FraudAlert.findOne({
        alertType: 'duplicate_kyc',
        suspiciousUserIds: { $all: userIds },
        status: { $in: ['pending', 'investigating'] },
      });

      if (existingAlert) {
        console.log(`   ⏭️  Alert already exists: ${existingAlert._id}`);
        continue;
      }

      // Get document info from first session
      const firstSession = group.sessions[0];
      const docInfo = {
        type: firstSession.documentData?.type || 'Unknown',
        country: firstSession.documentData?.country || 'Unknown',
        numberMasked: firstSession.documentData?.number 
          ? maskDocNumber(firstSession.documentData.number)
          : 'Unknown',
      };

      // Create fraud alert
      const alert = await FraudAlert.create({
        alertType: 'duplicate_kyc',
        severity: 'critical',
        status: 'pending',
        primaryUserId: userIds[0],
        suspiciousUserIds: userIds,
        confidence: group.matchType === 'document_number' ? 0.95 
          : group.matchType === 'id_number' ? 0.95 
          : group.matchType === 'fingerprint' ? 0.90 
          : 0.70,
        evidence: [{
          type: 'duplicate_document',
          description: `Same identity document used across ${userIds.length} accounts`,
          data: {
            matchType: group.matchType,
            documentInfo: docInfo,
            accounts: group.sessions.map(s => ({
              userId: s.userId,
              userEmail: s.userEmail,
              userName: s.userName,
              verifiedAt: s.completedAt || s.createdAt,
            })),
          },
        }],
        title: '🚨 Duplicate KYC Document Detected',
        description: `The same identity document was used to verify ${userIds.length} different accounts. ` +
          `Document: ${docInfo.type} from ${docInfo.country}. ` +
          `Match type: ${group.matchType}. ` +
          `This is a strong indicator of potential fraud or multi-accounting.`,
        detectedAt: new Date(),
        autoGenerated: true,
        notificationSent: false,
      });

      console.log(`   ✅ Created fraud alert: ${alert._id}`);
      alertsCreated++;

      // Update suspicion scores
      const evidenceText = `Duplicate KYC document detected with ${userIds.length - 1} other account(s). Match type: ${group.matchType}`;
      
      for (const userId of userIds) {
        try {
          let score = await SuspicionScore.findOne({
            userId: new mongoose.Types.ObjectId(userId),
          });

          if (!score) {
            score = new SuspicionScore({
              userId: new mongoose.Types.ObjectId(userId),
              totalScore: 0,
              riskLevel: 'low',
            });
          }

          score.addPercentage('kycDuplicate', 50, evidenceText);

          for (const otherId of userIds) {
            if (otherId !== userId) {
              score.addLinkedAccount(
                new mongoose.Types.ObjectId(otherId),
                'kyc_duplicate',
                0.95
              );
            }
          }

          await score.save();
          console.log(`   📊 Updated score for ${userId}: ${score.totalScore}% (${score.riskLevel})`);
          scoresUpdated++;
        } catch (err) {
          console.log(`   ⚠️  Failed to update score for ${userId}`);
        }
      }

      // Apply suspensions if enabled
      if (fraudSettings?.duplicateKYCAutoSuspend) {
        for (const userId of userIds) {
          const existingRestriction = await UserRestriction.findOne({
            userId,
            reason: 'kyc_fraud',
            isActive: true,
          });

          if (existingRestriction) {
            console.log(`   ⏭️  User ${userId} already suspended`);
            continue;
          }

          await UserRestriction.create({
            userId,
            restrictionType: 'suspended',
            reason: 'kyc_fraud',
            customReason: `Duplicate KYC detected. Found by scan script. Alert ID: ${alert._id}`,
            canTrade: !(fraudSettings.duplicateKYCBlockTrading ?? true),
            canEnterCompetitions: !(fraudSettings.duplicateKYCBlockCompetitions ?? true),
            canDeposit: !(fraudSettings.duplicateKYCBlockDeposits ?? true),
            canWithdraw: fraudSettings.duplicateKYCAllowWithdrawals ?? true,
            restrictedBy: 'system-scan',
            relatedFraudAlertId: alert._id.toString(),
            relatedUserIds: userIds.filter(id => id !== userId),
            isActive: true,
          });

          console.log(`   🔒 Suspended user: ${userId}`);
          usersSuspended++;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   KYC sessions scanned: ${approvedSessions.length}`);
    console.log(`   Duplicate groups found: ${duplicateGroups.length}`);
    console.log(`   Alerts created: ${alertsCreated}`);
    console.log(`   Fraud scores updated: ${scoresUpdated}`);
    console.log(`   Users suspended: ${usersSuspended}`);
    console.log('='.repeat(50));

    await mongoose.disconnect();
    console.log('\n✅ Done! Database disconnected.\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

function maskDocNumber(num: string): string {
  if (num.length <= 4) return '****';
  return num.slice(0, 2) + '*'.repeat(num.length - 4) + num.slice(-2);
}

// Run
scanForDuplicateKYC();

