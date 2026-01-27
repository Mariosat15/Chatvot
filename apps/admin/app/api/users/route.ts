import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';
// Force model registration before populate is called
import '@/database/models/marketplace/marketplace-item.model';

/**
 * GET /api/admin/users
 * Get users with pagination and search
 * 
 * Query params:
 * - userId: Get specific user by ID
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100, 0 = all)
 * - search: Search by name or email
 * - sort: Sort field (default 'createdAt')
 * - order: Sort order 'asc' or 'desc' (default 'desc')
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get query params
    const { searchParams } = new URL(request.url);
    const userIdFilter = searchParams.get('userId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limitParam = parseInt(searchParams.get('limit') || '20');
    const limit = limitParam === 0 ? 0 : Math.min(100, Math.max(1, limitParam)); // 0 = all, max 100
    const search = searchParams.get('search')?.toLowerCase() || '';
    const sortField = searchParams.get('sort') || 'createdAt';
    const sortOrder = searchParams.get('order') === 'asc' ? 1 : -1;

    // Get users from the 'user' collection (created by better-auth)
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database connection not found');
    }

    // Get users from better-auth collection
    let users;
    let totalCount = 0;
    
    if (userIdFilter) {
      // Try to find user by 'id' field first (better-auth custom id)
      users = await db.collection('user').find({ id: userIdFilter }).toArray();
      
      // If not found, try by _id as ObjectId
      if (users.length === 0) {
        try {
          const { ObjectId } = await import('mongodb');
          if (ObjectId.isValid(userIdFilter)) {
            users = await db.collection('user').find({ _id: new ObjectId(userIdFilter) }).toArray();
          }
        } catch {
          // Not a valid ObjectId, skip
        }
      }
      
      // If still not found, try by _id as string (for non-ObjectId string IDs)
      if (users.length === 0) {
        users = await db.collection('user').find({ _id: userIdFilter as any }).toArray();
      }
      
      totalCount = users.length;
      console.log(`📊 Fetching user with ID: ${userIdFilter} - Found ${users.length} user(s)`);
    } else {
      // Build query for search
      const query: Record<string, unknown> = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // Get total count for pagination
      totalCount = await db.collection('user').countDocuments(query);

      // Get paginated users
      if (limit === 0) {
        // Get all (backward compatibility)
        users = await db.collection('user')
          .find(query)
          .sort({ [sortField]: sortOrder })
          .toArray();
      } else {
        const skip = (page - 1) * limit;
        users = await db.collection('user')
          .find(query)
          .sort({ [sortField]: sortOrder })
          .skip(skip)
          .limit(limit)
          .toArray();
      }
      
      console.log(`📊 Fetching users - Page ${page}, Limit ${limit}, Found ${users.length}/${totalCount} user(s)`);
    }

    // Get admin email from environment
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || '';

    // OPTIMIZATION: Only load related data for the users we're displaying
    const userIds = users.map((u: any) => u.id || u._id?.toString()).filter(Boolean);

    // Get wallet data only for displayed users
    const wallets = await CreditWallet.find({ userId: { $in: userIds } }).lean();
    const walletMap = new Map(wallets.map((w: any) => [w.userId, w]));

    // Get competition stats only for displayed users
    const participants = await CompetitionParticipant.find({ userId: { $in: userIds } })
      .select('userId status totalTrades pnl winningTrades')
      .lean();
    
    // Group participants by user (O(n) with Map)
    const userParticipants = new Map<string, any[]>();
    for (const p of participants) {
      const userId = (p as any).userId;
      if (!userParticipants.has(userId)) {
        userParticipants.set(userId, []);
      }
      userParticipants.get(userId)!.push(p);
    }

    // Get challenge stats only for displayed users
    const challengeParticipants = await ChallengeParticipant.find({ userId: { $in: userIds } })
      .select('userId status isWinner')
      .lean();
    
    // Group challenge participants by user (O(n) with Map)
    const userChallenges = new Map<string, any[]>();
    for (const cp of challengeParticipants) {
      const odId = (cp as any).userId;
      if (!userChallenges.has(odId)) {
        userChallenges.set(odId, []);
      }
      userChallenges.get(odId)!.push(cp);
    }

    // Get marketplace purchases only for displayed users
    const purchases = await UserPurchase.find({ userId: { $in: userIds } })
      .populate('itemId', 'name')
      .select('userId pricePaid itemId')
      .lean();
    
    // Group purchases by user (O(n) with Map)
    const userPurchases = new Map<string, any[]>();
    for (const p of purchases) {
      const userId = (p as any).userId;
      if (!userPurchases.has(userId)) {
        userPurchases.set(userId, []);
      }
      userPurchases.get(userId)!.push(p);
    }

    // Get Game Master subscriptions for displayed users
    const gmSubscriptions = await db.collection('gamemastersubscriptions').find({ 
      userId: { $in: userIds } 
    }).toArray();
    const gmSubscriptionMap = new Map(gmSubscriptions.map((gm: any) => [gm.userId, gm]));
    
    // Get actual pending earnings from gamemasterearnings collection (source of truth)
    const pendingEarningsAgg = await db.collection('gamemasterearnings').aggregate([
      { $match: { gameMasterId: { $in: userIds }, status: 'pending' } },
      { $group: { _id: '$gameMasterId', pendingEarnings: { $sum: '$netEarning' } } }
    ]).toArray();
    const actualPendingEarnings = new Map(pendingEarningsAgg.map((e: any) => [e._id, e.pendingEarnings || 0]));

    // Combine all data
    const usersWithData = users.map((user: any) => {
      const userId = user.id || user._id?.toString();
      const wallet = walletMap.get(userId) || null;
      const userComps = userParticipants.get(userId) || [];
      const userChalls = userChallenges.get(userId) || [];
      const userPurchs = userPurchases.get(userId) || [];
      const gmSubscription = gmSubscriptionMap.get(userId) || null;
      
      // Calculate competition stats
      const totalCompetitions = userComps.length;
      const activeCompetitions = userComps.filter((p: any) => p.status === 'active').length;
      const completedCompetitions = userComps.filter((p: any) => p.status === 'completed').length;
      
      const totalTrades = userComps.reduce((sum: number, p: any) => sum + (p.totalTrades || 0), 0);
      const totalPnl = userComps.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);
      const totalWinningTrades = userComps.reduce((sum: number, p: any) => sum + (p.winningTrades || 0), 0);
      const overallWinRate = totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;

      // Calculate challenge stats - use wallet data for actual money spent/won
      const totalChallenges = userChalls.length;
      const activeChallenges = userChalls.filter((c: any) => c.status === 'active').length;
      const wonChallenges = userChalls.filter((c: any) => c.isWinner).length;
      const lostChallenges = userChalls.filter((c: any) => c.status === 'completed' && !c.isWinner).length;
      // Use wallet data for actual entry fees spent and prizes won (not virtual trading capital)
      const challengeSpent = wallet?.totalSpentOnChallenges || 0;
      const challengeWon = wallet?.totalWonFromChallenges || 0;

      // Calculate marketplace stats
      const marketplacePurchases = userPurchs.length;
      const marketplaceSpent = userPurchs.reduce((sum: number, p: any) => sum + (p.pricePaid || 0), 0);
      const marketplaceItems = userPurchs.map((p: any) => p.itemId?.name || 'Unknown').filter(Boolean);

      // Determine role - check GM subscription first, then stored role, fallback to email-based detection
      const storedRole = user.role || (user.email?.toLowerCase() === adminEmail ? 'admin' : 'trader');
      // If user has active GM subscription, their effective role is 'gamemaster'
      const hasActiveGM = gmSubscription && gmSubscription.status === 'active';
      const effectiveRole = hasActiveGM ? 'gamemaster' : storedRole;
      
      return {
        id: userId,
        name: user.name || 'N/A',
        email: user.email,
        role: effectiveRole, // Effective role considering GM subscription
        isAdmin: storedRole === 'admin',
        createdAt: user.createdAt,
        emailVerified: user.emailVerified || false,
        
        // Address fields
        country: user.country || '',
        city: user.city || '',
        address: user.address || '',
        postalCode: user.postalCode || '',
        phone: user.phone || '',
        
        // Wallet data
        wallet: wallet ? {
          balance: wallet.creditBalance || 0,
          totalDeposited: wallet.totalDeposited || 0,
          totalWithdrawn: wallet.totalWithdrawn || 0,
          totalSpent: (wallet.totalSpentOnCompetitions || 0) + (wallet.totalSpentOnChallenges || 0),
          totalWon: (wallet.totalWonFromCompetitions || 0) + (wallet.totalWonFromChallenges || 0),
          netProfit: ((wallet.totalWonFromCompetitions || 0) + (wallet.totalWonFromChallenges || 0)) - 
                     ((wallet.totalSpentOnCompetitions || 0) + (wallet.totalSpentOnChallenges || 0)),
        } : {
          balance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          totalSpent: 0,
          totalWon: 0,
          netProfit: 0,
        },
        
        // Competition stats
        competitions: {
          total: totalCompetitions,
          active: activeCompetitions,
          completed: completedCompetitions,
          totalTrades,
          totalPnl,
          overallWinRate,
        },

        // Challenge stats
        challenges: {
          total: totalChallenges,
          active: activeChallenges,
          won: wonChallenges,
          lost: lostChallenges,
          totalSpent: challengeSpent,
          totalWon: challengeWon,
        },

        // Marketplace stats
        marketplace: {
          totalPurchases: marketplacePurchases,
          totalSpent: marketplaceSpent,
          items: marketplaceItems,
        },

        // Game Master subscription (if any)
        gameMaster: gmSubscription ? {
          isGameMaster: true,
          subscriptionId: gmSubscription._id?.toString(),
          status: gmSubscription.status,
          packageName: gmSubscription.packageName,
          referralCode: gmSubscription.referralCode,
          startDate: gmSubscription.startDate,
          endDate: gmSubscription.endDate,
          autoRenew: gmSubscription.autoRenew,
          totalReferredUsers: gmSubscription.totalReferredUsers || 0,
          totalEarnings: gmSubscription.totalEarnings || 0,
          // Use calculated pending earnings from gamemasterearnings (source of truth)
          pendingEarnings: actualPendingEarnings.get(userId) || 0,
          totalCompetitionsCreated: gmSubscription.totalCompetitionsCreated || 0,
          limits: gmSubscription.limits,
          isPaused: gmSubscription.isPaused || false,
          scheduledForDeletion: gmSubscription.scheduledForDeletion || false,
        } : {
          isGameMaster: false,
        },
      };
    });

    // Note: Sorting is now done at database level for paginated queries
    // Only sort in JS if we got all users (limit=0 or single user lookup)
    if (limit === 0 || userIdFilter) {
      usersWithData.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return NextResponse.json({
      success: true,
      users: usersWithData,
      total: totalCount,
      pagination: limit > 0 ? {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      } : null,
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch users',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

