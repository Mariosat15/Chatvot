import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { requireSectionAccess } from '@/lib/admin/auth';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

/**
 * GET /api/gamemasters/[id]
 * Get detailed info about a specific game master
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSectionAccess('gamemaster-management');
    
    const { id } = await params;

    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get game master subscription
    const subscription = await db.collection('gamemastersubscriptions').findOne({
      _id: new ObjectId(id),
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Game master not found' }, { status: 404 });
    }

    // Get referred users
    const referredUsers = await db.collection('user').find({
      referredByGameMasterId: subscription.userId,
    }).project({
      _id: 1,
      id: 1,
      name: 1,
      email: 1,
      createdAt: 1,
      referredAt: 1,
    }).sort({ referredAt: -1 }).limit(50).toArray();

    // Get competitions created
    const competitions = await db.collection('competitions').find({
      gameMasterId: subscription.userId,
    }).project({
      _id: 1,
      name: 1,
      status: 1,
      currentParticipants: 1,
      prizePool: 1,
      startTime: 1,
      endTime: 1,
    }).sort({ createdAt: -1 }).limit(20).toArray();

    // Get earnings history
    const earnings = await db.collection('gamemasterearnings').find({
      gameMasterId: subscription.userId,
    }).sort({ createdAt: -1 }).limit(50).toArray();

    return NextResponse.json({
      subscription: {
        id: subscription._id.toString(),
        userId: subscription.userId,
        userEmail: subscription.userEmail,
        userName: subscription.userName,
        packageId: subscription.packageId,
        packageName: subscription.packageName,
        status: subscription.status,
        activatedAt: subscription.activatedAt,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextRenewalDate: subscription.nextRenewalDate,
        autoRenew: subscription.autoRenew,
        renewalPrice: subscription.renewalPrice,
        referralCode: subscription.referralCode,
        referralLink: subscription.referralLink,
        limits: {
          ...subscription.limits,
          canCreateCompetitions: subscription.limits?.canCreateCompetitions ?? true,
        },
        competitionCreationOverride: subscription.competitionCreationOverride || null,
        overrideLimits: subscription.overrideLimits || null,
        currentPeriodCompetitionsCreated: subscription.currentPeriodCompetitionsCreated,
        totalCompetitionsCreated: subscription.totalCompetitionsCreated,
        totalEarnings: subscription.totalEarnings,
        pendingEarnings: subscription.pendingEarnings,
        totalReferredUsers: subscription.totalReferredUsers,
        activeReferredUsers: subscription.activeReferredUsers,
        renewalHistory: subscription.renewalHistory,
        suspendedAt: subscription.suspendedAt,
        suspendedReason: subscription.suspendedReason,
        createdAt: subscription.createdAt,
      },
      referredUsers: referredUsers.map(u => ({
        id: (u.id || u._id).toString(),
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        referredAt: u.referredAt,
      })),
      competitions: competitions.map(c => ({
        id: c._id.toString(),
        name: c.name,
        status: c.status,
        participants: c.currentParticipants,
        prizePool: c.prizePool,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
      earnings: earnings.map(e => ({
        id: e._id.toString(),
        sourceType: e.sourceType,
        sourceName: e.sourceName,
        referredUserName: e.referredUserName,
        entryFeeAmount: e.entryFeeAmount,
        netEarning: e.netEarning,
        status: e.status,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching game master details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/gamemasters/[id]
 * Update a game master (suspend, change limits, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSectionAccess('gamemaster-management');
    
    const { id } = await params;
    const body = await request.json();
    const { action, reason, limits, override, overrideLimits } = body;

    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const subscription = await db.collection('gamemastersubscriptions').findOne({
      _id: new ObjectId(id),
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Game master not found' }, { status: 404 });
    }

    const now = new Date();
    let updateData: Record<string, unknown> = { updatedAt: now };

    switch (action) {
      case 'suspend':
        updateData = {
          ...updateData,
          status: 'suspended',
          suspendedAt: now,
          suspendedReason: reason || 'Suspended by admin',
        };
        break;
      
      case 'reactivate':
        if (new Date(subscription.endDate) < now) {
          return NextResponse.json(
            { error: 'Cannot reactivate expired subscription' },
            { status: 400 }
          );
        }
        updateData = {
          ...updateData,
          status: 'active',
          suspendedAt: null,
          suspendedReason: null,
        };
        break;
      
      case 'update_limits':
        if (limits) {
          updateData = {
            ...updateData,
            limits: {
              ...subscription.limits,
              ...limits,
            },
          };
        }
        break;
      
      case 'extend':
        const extensionDays = body.extensionDays || 30;
        const newEndDate = new Date(subscription.endDate);
        newEndDate.setDate(newEndDate.getDate() + extensionDays);
        updateData = {
          ...updateData,
          endDate: newEndDate,
          nextRenewalDate: newEndDate,
        };
        break;
      
      case 'toggleCompetitionCreation':
        // Set override: 'enabled', 'disabled', or null (to use package default)
        const validOverrides = ['enabled', 'disabled', null];
        if (!validOverrides.includes(override)) {
          return NextResponse.json({ error: 'Invalid override value' }, { status: 400 });
        }
        updateData = {
          ...updateData,
          competitionCreationOverride: override,
        };
        // If enabling, also save the custom limits
        if (override === 'enabled' && overrideLimits) {
          updateData.overrideLimits = {
            maxCompetitionsPerDay: overrideLimits.maxCompetitionsPerDay || 1,
            maxUsersPerCompetition: overrideLimits.maxUsersPerCompetition || 50,
          };
        }
        // If disabling, clear the override limits
        if (override === 'disabled' || override === null) {
          updateData.overrideLimits = null;
        }
        break;
      
      case 'clearCompetitionOverride':
        // Reset to package default
        updateData = {
          ...updateData,
          competitionCreationOverride: null,
        };
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await db.collection('gamemastersubscriptions').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    return NextResponse.json({
      success: true,
      message: `Game master ${action} successful`,
    });
  } catch (error) {
    console.error('Error updating game master:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gamemasters/[id]
 * Revoke a game master subscription
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSectionAccess('gamemaster-management');
    
    const { id } = await params;

    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Soft delete - set status to cancelled
    const result = await db.collection('gamemastersubscriptions').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: 'Revoked by admin',
          updatedAt: new Date(),
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Game master not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Game master subscription revoked',
    });
  } catch (error) {
    console.error('Error revoking game master:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 500 }
    );
  }
}
