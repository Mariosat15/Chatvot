import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import Incident from '@/database/models/incident.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';
import { notificationService } from '@/lib/services/notification.service';
import { auditLogService } from '@/lib/services/audit-log.service';
import mongoose from 'mongoose';

// Helper to get user from collection
async function getUserById(userId: string) {
  const usersCollection = mongoose.connection.collection('user');
  try {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const user = await usersCollection.findOne({ 
        _id: new mongoose.Types.ObjectId(userId)
      });
      return user;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to get competition from collection
async function getCompetitionById(competitionId: string) {
  const competitionsCollection = mongoose.connection.collection('competitions');
  try {
    if (mongoose.Types.ObjectId.isValid(competitionId)) {
      const competition = await competitionsCollection.findOne({ 
        _id: new mongoose.Types.ObjectId(competitionId)
      });
      return competition;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to get all participants for a competition
async function getCompetitionParticipants(competitionId: string) {
  const participantsCollection = mongoose.connection.collection('competitionparticipants');
  try {
    return await participantsCollection.find({ competitionId }).toArray();
  } catch {
    return [];
  }
}

export type ResolutionType = 'no_compensation' | 'partial_refund' | 'full_refund' | 'result_adjustment';

interface ResolveRequestBody {
  resolutionType: ResolutionType;
  notes: string;
  customAmounts?: Array<{ userId: string; amount: number }>;
}

/**
 * GET /api/incidents/[id]/resolve
 * Get resolution options and calculate amounts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: incidentId } = await params;
    await connectToDatabase();

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // Check if already resolved
    if (incident.status === 'resolved') {
      return NextResponse.json({
        error: 'Incident is already resolved',
        resolution: incident.resolution,
      }, { status: 400 });
    }

    // Get competition details if linked
    let competition = null;
    let participants: unknown[] = [];
    let entryFee = 0;

    if (incident.competitionId) {
      competition = await getCompetitionById(incident.competitionId);
      if (competition) {
        entryFee = competition.entryFee || 0;
        participants = await getCompetitionParticipants(incident.competitionId);
      }
    }

    // Calculate affected users
    // If no specific affected users are marked but competition is linked, use all participants
    const specifiedAffectedUsers = incident.affectedUsers || [];
    const totalParticipants = participants.length;
    
    // Smart affected count: use specified affected users, or all participants if none specified
    const effectiveAffectedCount = specifiedAffectedUsers.length > 0 
      ? specifiedAffectedUsers.length 
      : totalParticipants;
    
    const hasSpecificAffected = specifiedAffectedUsers.length > 0;

    // Calculate compensation options
    const options = {
      no_compensation: {
        type: 'no_compensation',
        label: 'No Compensation',
        description: 'Close the incident without issuing any compensation',
        totalAmount: 0,
        affectedUsers: 0,
        perUserAmount: 0,
      },
      partial_refund: {
        type: 'partial_refund',
        label: hasSpecificAffected 
          ? 'Partial Refund (Affected Users)' 
          : 'Partial Refund (All Participants)',
        description: hasSpecificAffected
          ? `Refund entry fees to the ${specifiedAffectedUsers.length} specifically affected user(s)`
          : `Refund entry fees to all ${totalParticipants} participant(s) (no specific users marked)`,
        totalAmount: entryFee * effectiveAffectedCount,
        affectedUsers: effectiveAffectedCount,
        perUserAmount: entryFee,
      },
      full_refund: {
        type: 'full_refund',
        label: 'Full Refund (All Participants)',
        description: `Refund entry fees to all ${totalParticipants} participant(s)`,
        totalAmount: entryFee * totalParticipants,
        affectedUsers: totalParticipants,
        perUserAmount: entryFee,
      },
      result_adjustment: {
        type: 'result_adjustment',
        label: 'Result Adjustment',
        description: 'Recalculate competition results using snapshot prices (requires manual review)',
        totalAmount: 0, // Variable - requires manual calculation
        affectedUsers: totalParticipants,
        perUserAmount: 0,
        requiresManualReview: true,
      },
    };

    return NextResponse.json({
      success: true,
      incident: {
        id: incident._id,
        title: incident.title,
        type: incident.type,
        severity: incident.severity,
        status: incident.status,
        affectedUsers: incident.affectedUsers,
        competitionId: incident.competitionId,
      },
      competition: competition ? {
        id: competition._id,
        name: competition.name,
        entryFee: competition.entryFee,
        status: competition.status,
        participantCount: totalParticipants,
      } : null,
      options,
      summary: {
        specifiedAffectedCount: specifiedAffectedUsers.length,
        effectiveAffectedCount,
        totalParticipants,
        entryFee,
        hasSpecificAffected,
      },
    });

  } catch (error) {
    console.error('Error getting resolve options:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/incidents/[id]/resolve
 * Resolve an incident with automatic compensation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: incidentId } = await params;
    const body: ResolveRequestBody = await request.json();
    const { resolutionType, notes, customAmounts } = body;

    if (!resolutionType || !notes) {
      return NextResponse.json(
        { error: 'resolutionType and notes are required' },
        { status: 400 }
      );
    }

    const validTypes: ResolutionType[] = ['no_compensation', 'partial_refund', 'full_refund', 'result_adjustment'];
    if (!validTypes.includes(resolutionType)) {
      return NextResponse.json(
        { error: 'Invalid resolutionType' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get incident
    const incident = await Incident.findById(incidentId).session(mongoSession);
    if (!incident) {
      await mongoSession.abortTransaction();
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // Check if already resolved
    if (incident.status === 'resolved') {
      await mongoSession.abortTransaction();
      return NextResponse.json({ error: 'Incident is already resolved' }, { status: 400 });
    }

    console.log(`🔧 [IncidentResolve] Processing incident ${incidentId} with type: ${resolutionType}`);

    // Get competition if linked
    let competition = null;
    let participants: unknown[] = [];
    let entryFee = 0;

    if (incident.competitionId) {
      competition = await getCompetitionById(incident.competitionId);
      if (competition) {
        entryFee = competition.entryFee || 0;
        participants = await getCompetitionParticipants(incident.competitionId);
      }
    }

    // Determine users to compensate and amounts
    let usersToCompensate: Array<{ userId: string; amount: number }> = [];
    let totalCompensation = 0;
    
    // Smart affected users: use specified or all participants
    const specifiedAffectedUsers = incident.affectedUsers || [];
    const hasSpecificAffected = specifiedAffectedUsers.length > 0;

    if (resolutionType === 'no_compensation') {
      // No compensation needed
      usersToCompensate = [];
    } else if (resolutionType === 'partial_refund') {
      // Refund affected users (or all participants if none specified)
      if (customAmounts && customAmounts.length > 0) {
        usersToCompensate = customAmounts;
      } else if (hasSpecificAffected) {
        // Use specifically marked affected users
        usersToCompensate = specifiedAffectedUsers.map((userId: string) => ({
          userId,
          amount: entryFee,
        }));
      } else {
        // No specific users marked - use all participants
        usersToCompensate = participants.map((p: Record<string, unknown>) => ({
          userId: p.userId as string,
          amount: entryFee,
        }));
      }
    } else if (resolutionType === 'full_refund') {
      // Refund all participants
      usersToCompensate = participants.map((p: Record<string, unknown>) => ({
        userId: p.userId as string,
        amount: entryFee,
      }));
    } else if (resolutionType === 'result_adjustment') {
      // Use custom amounts or skip compensation (manual adjustment)
      if (customAmounts && customAmounts.length > 0) {
        usersToCompensate = customAmounts;
      }
    }

    // Calculate total
    totalCompensation = usersToCompensate.reduce((sum, u) => sum + u.amount, 0);

    // Process compensations
    const compensationResults: Array<{
      userId: string;
      username?: string;
      amount: number;
      success: boolean;
      error?: string;
      newBalance?: number;
    }> = [];

    let successCount = 0;
    let actualTotalCompensated = 0;

    for (const comp of usersToCompensate) {
      if (comp.amount <= 0) continue;

      try {
        const user = await getUserById(comp.userId);
        if (!user) {
          compensationResults.push({
            userId: comp.userId,
            amount: comp.amount,
            success: false,
            error: 'User not found',
          });
          continue;
        }
        const username = (user.username || user.name || user.email || 'Unknown') as string;

        const wallet = await CreditWallet.findOne({ userId: comp.userId }).session(mongoSession);
        if (!wallet) {
          compensationResults.push({
            userId: comp.userId,
            username,
            amount: comp.amount,
            success: false,
            error: 'Wallet not found',
          });
          continue;
        }

        const newBalance = wallet.creditBalance + comp.amount;

        // Update wallet
        await CreditWallet.findByIdAndUpdate(
          wallet._id,
          { $inc: { creditBalance: comp.amount } },
          { session: mongoSession }
        );

        // Create transaction
        await WalletTransaction.create([{
          userId: comp.userId,
          transactionType: 'incident_compensation',
          amount: comp.amount,
          balanceBefore: wallet.creditBalance,
          balanceAfter: newBalance,
          status: 'completed',
          description: `${resolutionType === 'partial_refund' ? 'Partial' : 'Full'} refund for incident #${incidentId.slice(-6)}`,
          metadata: {
            incidentId,
            incidentType: incident.type,
            resolutionType,
            competitionId: incident.competitionId,
            issuedBy: auth.adminId,
            issuedByEmail: auth.email,
          },
        }], { session: mongoSession });

        // Send notification
        try {
          await notificationService.sendInstant({
            userId: comp.userId,
            title: '💰 Compensation Received',
            message: `You have been credited €${comp.amount.toFixed(2)} as compensation for incident resolution.`,
            icon: 'gift',
            category: 'trading',
            priority: 'high',
            color: 'green',
          });
        } catch {
          // Don't fail if notification fails
        }

        compensationResults.push({
          userId: comp.userId,
          username,
          amount: comp.amount,
          success: true,
          newBalance,
        });

        actualTotalCompensated += comp.amount;
        successCount++;

        console.log(`   ✅ Compensated ${username}: €${comp.amount.toFixed(2)}`);

      } catch (error) {
        compensationResults.push({
          userId: comp.userId,
          amount: comp.amount,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update incident with resolution
    incident.status = 'resolved';
    incident.resolvedBy = auth.adminId;
    incident.resolvedByEmail = auth.email;
    incident.resolvedAt = new Date();

    incident.resolution = {
      summary: notes,
      action: resolutionType,
      compensations: compensationResults
        .filter(r => r.success)
        .map(r => ({
          userId: r.userId,
          username: r.username,
          amount: r.amount,
          reason: `${resolutionType}: ${notes}`,
          status: 'paid' as const,
          paidAt: new Date(),
        })),
      resultAdjustments: [],
      resolvedAt: new Date(),
    };

    // Add audit entry
    incident.auditLog.push({
      timestamp: new Date(),
      action: 'incident_resolved',
      by: auth.adminId || 'admin',
      byEmail: auth.email,
      details: `Resolved with ${resolutionType}. ${successCount} compensations issued totaling €${actualTotalCompensated.toFixed(2)}`,
      metadata: {
        resolutionType,
        totalCompensation: actualTotalCompensated,
        successCount,
        failedCount: usersToCompensate.length - successCount,
      },
    });

    await incident.save({ session: mongoSession });

    // Record platform expense if any compensation was issued
    if (actualTotalCompensated > 0) {
      await PlatformTransaction.create([{
        transactionType: 'incident_compensation',
        amount: -actualTotalCompensated, // Negative = platform expense
        amountEUR: -actualTotalCompensated,
        sourceType: 'incident',
        sourceId: incidentId,
        sourceName: incident.title || `Incident #${incidentId.slice(-6)}`,
        compensationDetails: {
          incidentId,
          incidentType: incident.type,
          affectedUsersCount: successCount,
          compensationPerUser: successCount > 0 ? actualTotalCompensated / successCount : 0,
          resolutionType,
          competitionId: incident.competitionId,
          competitionName: competition?.name,
        },
        description: `Incident resolution (${resolutionType}): ${successCount} users, €${actualTotalCompensated.toFixed(2)} total`,
        processedBy: auth.adminId,
        processedByEmail: auth.email,
      }], { session: mongoSession });

      console.log(`   📊 [PlatformTransaction] Recorded expense: -€${actualTotalCompensated.toFixed(2)}`);
    }

    await mongoSession.commitTransaction();

    console.log(`🔧 [IncidentResolve] Complete: ${resolutionType}, ${successCount} compensations, €${actualTotalCompensated.toFixed(2)} total`);

    // Log to audit trail
    try {
      await auditLogService.logIncidentResolved(
        {
          id: auth.adminId || 'unknown',
          email: auth.email || 'admin@system',
          name: auth.email?.split('@')[0],
          role: 'admin',
        },
        incidentId,
        incident.title || `Incident #${incidentId.slice(-6)}`,
        resolutionType,
        actualTotalCompensated,
        successCount
      );
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Incident resolved with ${resolutionType}`,
      resolution: {
        type: resolutionType,
        notes,
        totalCompensation: actualTotalCompensated,
        compensationsIssued: successCount,
        compensationsFailed: usersToCompensate.length - successCount,
      },
      compensationResults,
    });

  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error resolving incident:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    mongoSession.endSession();
  }
}
