import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';
import { MarketplaceItem } from '@/database/models/marketplace/marketplace-item.model';

/**
 * GET /api/admin/users
 * Get all users with their complete data
 * Supports optional ?userId=xxx parameter to get a specific user
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get optional userId filter from query params
    const { searchParams } = new URL(request.url);
    const userIdFilter = searchParams.get('userId');

    // Get users from the 'user' collection (created by better-auth)
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database connection not found');
    }

    // Get users from better-auth collection
    let users;
    
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
      
      console.log(`📊 Fetching user with ID: ${userIdFilter} - Found ${users.length} user(s)`);
    } else {
      // Get all users
      users = await db.collection('user').find({}).toArray();
      console.log(`📊 Fetching all users - Found ${users.length} user(s)`);
    }

    // Get admin email from environment
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || '';

    // Get wallet data for all users
    const wallets = await CreditWallet.find({}).lean();
    const walletMap = new Map(wallets.map((w: any) => [w.userId, w]));

    // Get competition stats for all users
    const participants = await CompetitionParticipant.find({}).lean();
    
    // Group participants by user
    const userParticipants = new Map<string, any[]>();
    participants.forEach((p: any) => {
      const userId = p.userId;
      if (!userParticipants.has(userId)) {
        userParticipants.set(userId, []);
      }
      userParticipants.get(userId)!.push(p);
    });

    // Get challenge stats for all users
    const challengeParticipants = await ChallengeParticipant.find({}).lean();
    
    // Group challenge participants by user
    const userChallenges = new Map<string, any[]>();
    challengeParticipants.forEach((cp: any) => {
      const odId = cp.userId;
      if (!userChallenges.has(odId)) {
        userChallenges.set(odId, []);
      }
      userChallenges.get(odId)!.push(cp);
    });

    // Get marketplace purchases for all users
    const purchases = await UserPurchase.find({}).populate('itemId', 'name').lean();
    
    // Group purchases by user
    const userPurchases = new Map<string, any[]>();
    purchases.forEach((p: any) => {
      const userId = p.userId;
      if (!userPurchases.has(userId)) {
        userPurchases.set(userId, []);
      }
      userPurchases.get(userId)!.push(p);
    });

    // Combine all data
    const usersWithData = users.map((user: any) => {
      const userId = user.id || user._id?.toString();
      const wallet = walletMap.get(userId) || null;
      const userComps = userParticipants.get(userId) || [];
      const userChalls = userChallenges.get(userId) || [];
      const userPurchs = userPurchases.get(userId) || [];
      
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

      // Determine role - check stored role first, fallback to email-based detection
      const storedRole = user.role || (user.email?.toLowerCase() === adminEmail ? 'admin' : 'trader');
      
      return {
        id: userId,
        name: user.name || 'N/A',
        email: user.email,
        role: storedRole, // 'admin', 'trader', 'backoffice', etc.
        isAdmin: storedRole === 'admin',
        createdAt: user.createdAt,
        emailVerified: user.emailVerified || false,
        
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
      };
    });

    // Sort by created date (newest first)
    usersWithData.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      users: usersWithData,
      total: usersWithData.length,
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

