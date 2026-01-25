import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { requireSectionAccess } from '@/lib/admin/auth';
import mongoose from 'mongoose';

/**
 * GET /api/gamemasters
 * List all game masters (Super Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSectionAccess('gamemaster-management');
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Build query
    const query: Record<string, unknown> = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } },
      ];
    }

    // Get game masters with pagination
    const gamemasters = await db.collection('gamemastersubscriptions')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await db.collection('gamemastersubscriptions').countDocuments(query);

    // Get summary stats
    const stats = await db.collection('gamemastersubscriptions').aggregate([
      {
        $group: {
          _id: null,
          totalActive: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalExpired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
          totalSuspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
          totalEarnings: { $sum: '$totalEarnings' },
          totalReferrals: { $sum: '$totalReferredUsers' },
          totalCompetitions: { $sum: '$totalCompetitionsCreated' },
        }
      }
    ]).toArray();

    // Get all unique package IDs and look up CURRENT package settings
    const packageIds = [...new Set(gamemasters.map(gm => gm.packageId).filter(Boolean))];
    const packages = await db.collection('marketplaceitems').find({
      _id: { $in: packageIds.map(id => {
        try { return new mongoose.Types.ObjectId(id); } catch { return null; }
      }).filter(Boolean) }
    }).toArray();
    
    // Create a map of package ID -> current settings
    const packageSettingsMap = new Map(
      packages.map(pkg => [pkg._id.toString(), pkg.gameMasterConfig])
    );

    return NextResponse.json({
      gamemasters: gamemasters.map(gm => {
        // Get CURRENT package settings (not cached subscription limits)
        const currentPackageSettings = gm.packageId ? packageSettingsMap.get(gm.packageId.toString()) : null;
        const currentLimits = currentPackageSettings ? {
          maxCompetitionsPerDay: currentPackageSettings.maxCompetitionsPerDay,
          maxUsersPerCompetition: currentPackageSettings.maxUsersPerCompetition,
          referralFeePercentage: currentPackageSettings.referralFeePercentage,
          canCreateCompetitions: currentPackageSettings.canCreateCompetitions !== false,
        } : {
          ...gm.limits,
          canCreateCompetitions: gm.limits?.canCreateCompetitions ?? true,
        };
        
        return {
          id: gm._id.toString(),
          userId: gm.userId,
          userEmail: gm.userEmail,
          userName: gm.userName,
          packageName: gm.packageName,
          status: gm.status,
          referralCode: gm.referralCode,
          referralLink: gm.referralLink,
          startDate: gm.startDate,
          endDate: gm.endDate,
          autoRenew: gm.autoRenew,
          renewalPrice: gm.renewalPrice,
          limits: currentLimits,
          totalReferredUsers: gm.totalReferredUsers,
          activeReferredUsers: gm.activeReferredUsers,
          totalEarnings: gm.totalEarnings,
          pendingEarnings: gm.pendingEarnings,
          totalCompetitionsCreated: gm.totalCompetitionsCreated,
          createdAt: gm.createdAt,
        };
      }),
      stats: stats[0] || {
        totalActive: 0,
        totalExpired: 0,
        totalSuspended: 0,
        totalEarnings: 0,
        totalReferrals: 0,
        totalCompetitions: 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching game masters:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 500 }
    );
  }
}
