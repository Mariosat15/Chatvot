import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import Incident from '@/database/models/incident.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';
import { notificationService } from '@/lib/services/notification.service';
import mongoose from 'mongoose';

// Helper to get user from collection (admin app doesn't have User model)
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

/**
 * POST /api/incidents/[id]/compensate
 * Issue compensations for an incident
 * 
 * Body: {
 *   compensations: [{ userId: string, amount: number, reason: string }]
 * }
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
    const body = await request.json();
    const { compensations } = body;

    if (!compensations || !Array.isArray(compensations) || compensations.length === 0) {
      return NextResponse.json(
        { error: 'Compensations array is required' },
        { status: 400 }
      );
    }

    // Validate compensations
    for (const comp of compensations) {
      if (!comp.userId || typeof comp.amount !== 'number' || comp.amount <= 0 || !comp.reason) {
        return NextResponse.json(
          { error: 'Each compensation must have userId, positive amount, and reason' },
          { status: 400 }
        );
      }
    }

    await connectToDatabase();

    // Get incident
    const incident = await Incident.findById(incidentId).session(mongoSession);
    if (!incident) {
      await mongoSession.abortTransaction();
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    console.log(`💰 [Compensation] Processing ${compensations.length} compensations for incident ${incidentId}`);

    const results: Array<{
      userId: string;
      username?: string;
      amount: number;
      success: boolean;
      error?: string;
      newBalance?: number;
    }> = [];

    let totalCompensated = 0;
    let successCount = 0;

    for (const comp of compensations) {
      try {
        // Get user from collection
        const user = await getUserById(comp.userId);
        if (!user) {
          results.push({
            userId: comp.userId,
            amount: comp.amount,
            success: false,
            error: 'User not found',
          });
          continue;
        }
        const username = user.username || user.name || user.email || 'Unknown';

        // Get wallet
        const wallet = await CreditWallet.findOne({ userId: comp.userId }).session(mongoSession);
        if (!wallet) {
          results.push({
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
          description: `Compensation for incident #${incidentId.slice(-6)}: ${comp.reason}`,
          metadata: {
            incidentId,
            incidentType: incident.type,
            reason: comp.reason,
            issuedBy: auth.adminId,
            issuedByEmail: auth.email,
          },
        }], { session: mongoSession });

        // Send notification
        try {
          await notificationService.sendInstant({
            userId: comp.userId,
            title: '💰 Compensation Received',
            message: `You have been credited €${comp.amount.toFixed(2)} as compensation. Reason: ${comp.reason}`,
            icon: 'gift',
            category: 'trading',
            priority: 'high',
            color: 'green',
          });
        } catch {
          // Don't fail if notification fails
        }

        results.push({
          userId: comp.userId,
          username,
          amount: comp.amount,
          success: true,
          newBalance,
        });

        totalCompensated += comp.amount;
        successCount++;

        console.log(`   ✅ Compensated ${username}: €${comp.amount.toFixed(2)}`);

      } catch (error) {
        results.push({
          userId: comp.userId,
          amount: comp.amount,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update incident with compensation records
    if (!incident.resolution) {
      incident.resolution = {
        summary: '',
        action: '',
        compensations: [],
        resultAdjustments: [],
        resolvedAt: new Date(),
      };
    }

    for (const result of results) {
      if (result.success) {
        incident.resolution.compensations.push({
          userId: result.userId,
          username: result.username,
          amount: result.amount,
          reason: compensations.find(c => c.userId === result.userId)?.reason || '',
          status: 'paid',
          paidAt: new Date(),
        });
      }
    }

    // Add audit entry
    incident.auditLog.push({
      timestamp: new Date(),
      action: 'compensations_issued',
      by: auth.adminId || 'admin',
      byEmail: auth.email,
      details: `Issued ${successCount} compensations totaling €${totalCompensated.toFixed(2)}`,
      metadata: { results },
    });

    await incident.save({ session: mongoSession });

    // Record platform expense for compensation (negative amount = platform pays out)
    if (totalCompensated > 0) {
      await PlatformTransaction.create([{
        transactionType: 'incident_compensation',
        amount: -totalCompensated,  // Negative = platform expense
        amountEUR: -totalCompensated, // Credits = EUR 1:1
        sourceType: 'incident',
        sourceId: incidentId,
        sourceName: incident.title || `Incident #${incidentId.slice(-6)}`,
        compensationDetails: {
          incidentId,
          incidentType: incident.type,
          affectedUsersCount: successCount,
          compensationPerUser: successCount > 0 ? totalCompensated / successCount : 0,
          resolutionType: 'manual_compensation',
          competitionId: incident.competitionId,
        },
        description: `Compensation for incident #${incidentId.slice(-6)}: ${successCount} users, €${totalCompensated.toFixed(2)} total`,
        processedBy: auth.adminId,
        processedByEmail: auth.email,
      }], { session: mongoSession });
      
      console.log(`   📊 [PlatformTransaction] Recorded expense: -€${totalCompensated.toFixed(2)}`);
    }

    await mongoSession.commitTransaction();

    console.log(`💰 [Compensation] Complete: ${successCount}/${compensations.length} successful, €${totalCompensated.toFixed(2)} total`);

    return NextResponse.json({
      success: true,
      message: `Issued ${successCount} compensations totaling €${totalCompensated.toFixed(2)}`,
      results,
      totalCompensated,
      successCount,
      failedCount: compensations.length - successCount,
    });

  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error issuing compensations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    mongoSession.endSession();
  }
}

/**
 * GET /api/incidents/[id]/compensate
 * Get compensation history for an incident
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

    const incident = await Incident.findById(incidentId).select('resolution.compensations');
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      compensations: incident.resolution?.compensations || [],
    });

  } catch (error) {
    console.error('Error getting compensations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
