import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import KYCSession from '@/database/models/kyc-session.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import FraudSettings from '@/database/models/fraud/fraud-settings.model';
import UserRestriction from '@/database/models/user-restriction.model';
import SuspicionScore from '@/database/models/fraud/suspicion-score.model';
import AuditLog from '@/database/models/audit-log.model';

interface DuplicateGroup {
  key: string;
  matchType: 'document_number' | 'id_number' | 'fingerprint' | 'name_dob';
  sessions: any[];
}

function maskDocNumber(num: string): string {
  if (num.length <= 4) return '****';
  return num.slice(0, 2) + '*'.repeat(num.length - 4) + num.slice(-2);
}

export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get fraud settings
    const fraudSettings = await FraudSettings.findOne();

    // Get all approved KYC sessions
    const approvedSessions = await KYCSession.find({
      status: 'approved',
    }).lean();

    if (approvedSessions.length < 2) {
      return NextResponse.json({
        success: true,
        message: 'Not enough sessions to have duplicates',
        stats: {
          sessionsScanned: approvedSessions.length,
          duplicateGroupsFound: 0,
          alertsCreated: 0,
          scoresUpdated: 0,
          usersSuspended: 0,
        },
        duplicates: [],
      });
    }

    // Group by various identifiers to find duplicates
    const duplicateGroups: DuplicateGroup[] = [];

    // Group 1: By document number + country
    const byDocNumber: Record<string, any[]> = {};
    for (const sess of approvedSessions) {
      if (sess.documentData?.number && sess.documentData?.country) {
        const key = `${sess.documentData.number.toUpperCase().replace(/\s/g, '')}|${sess.documentData.country.toUpperCase()}`;
        if (!byDocNumber[key]) byDocNumber[key] = [];
        byDocNumber[key].push(sess);
      }
    }
    for (const [key, sessions] of Object.entries(byDocNumber)) {
      if (sessions.length > 1) {
        duplicateGroups.push({ key, matchType: 'document_number', sessions });
      }
    }

    // Group 2: By ID number
    const byIdNumber: Record<string, any[]> = {};
    for (const sess of approvedSessions) {
      if (sess.personData?.idNumber) {
        const key = sess.personData.idNumber.toUpperCase().replace(/\s/g, '');
        if (!byIdNumber[key]) byIdNumber[key] = [];
        byIdNumber[key].push(sess);
      }
    }
    for (const [key, sessions] of Object.entries(byIdNumber)) {
      if (sessions.length > 1) {
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
    for (const sess of approvedSessions) {
      if (sess.documentFingerprint) {
        const key = sess.documentFingerprint;
        if (!byFingerprint[key]) byFingerprint[key] = [];
        byFingerprint[key].push(sess);
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
    for (const sess of approvedSessions) {
      if (sess.personData?.firstName && sess.personData?.lastName && sess.personData?.dateOfBirth) {
        const key = `${sess.personData.firstName.toUpperCase()}|${sess.personData.lastName.toUpperCase()}|${sess.personData.dateOfBirth}`;
        if (!byNameDob[key]) byNameDob[key] = [];
        byNameDob[key].push(sess);
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

    let alertsCreated = 0;
    let usersSuspended = 0;
    let scoresUpdated = 0;
    const duplicatesFound: any[] = [];

    for (const group of duplicateGroups) {
      const userIds = [...new Set(group.sessions.map(s => s.userId))];

      // Check if alert already exists
      const existingAlert = await FraudAlert.findOne({
        alertType: 'duplicate_kyc',
        suspiciousUserIds: { $all: userIds },
        status: { $in: ['pending', 'investigating'] },
      });

      if (existingAlert) {
        duplicatesFound.push({
          matchType: group.matchType,
          userIds,
          alertId: existingAlert._id.toString(),
          alertExisted: true,
        });
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
          scoresUpdated++;
        } catch (err) {
          console.error(`Failed to update score for ${userId}:`, err);
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

          if (existingRestriction) continue;

          await UserRestriction.create({
            userId,
            restrictionType: 'suspended',
            reason: 'kyc_fraud',
            customReason: `Duplicate KYC detected. Found by admin scan. Alert ID: ${alert._id}`,
            canTrade: !(fraudSettings.duplicateKYCBlockTrading ?? true),
            canEnterCompetitions: !(fraudSettings.duplicateKYCBlockCompetitions ?? true),
            canDeposit: !(fraudSettings.duplicateKYCBlockDeposits ?? true),
            canWithdraw: fraudSettings.duplicateKYCAllowWithdrawals ?? true,
            restrictedBy: session.id,
            relatedFraudAlertId: alert._id.toString(),
            relatedUserIds: userIds.filter(id => id !== userId),
            isActive: true,
          });

          usersSuspended++;
        }
      }

      duplicatesFound.push({
        matchType: group.matchType,
        userIds,
        alertId: alert._id.toString(),
        alertExisted: false,
        documentInfo: docInfo,
      });
    }

    // Log the action
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'kyc_duplicate_scan',
      actionCategory: 'security',
      description: `Scanned ${approvedSessions.length} KYC sessions. Found ${duplicateGroups.length} duplicate groups. Created ${alertsCreated} alerts, suspended ${usersSuspended} users.`,
      targetType: 'settings',
      targetId: 'kyc',
      metadata: {
        sessionsScanned: approvedSessions.length,
        duplicateGroupsFound: duplicateGroups.length,
        alertsCreated,
        scoresUpdated,
        usersSuspended,
      },
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      message: duplicateGroups.length > 0 
        ? `Found ${duplicateGroups.length} duplicate group(s). Created ${alertsCreated} new alert(s).`
        : 'No duplicates found. All KYC sessions are unique.',
      stats: {
        sessionsScanned: approvedSessions.length,
        duplicateGroupsFound: duplicateGroups.length,
        alertsCreated,
        scoresUpdated,
        usersSuspended,
      },
      duplicates: duplicatesFound,
    });

  } catch (error) {
    console.error('Error scanning for duplicate KYC:', error);
    return NextResponse.json(
      { error: 'Failed to scan for duplicates' },
      { status: 500 }
    );
  }
}

