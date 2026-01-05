import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { syncMissingUserLevels } from '@/lib/services/xp-level.service';

/**
 * POST /api/admin/sync-missing-users
 * Find all users with deposits but no UserLevel and create them
 * Also triggers badge evaluation for each synced user
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    console.log('🔄 Starting sync of missing users...');
    
    const result = await syncMissingUserLevels();
    
    return NextResponse.json({
      success: true,
      message: `Synced ${result.synced} users, evaluated ${result.evaluated}, awarded ${result.newBadgesAwarded} badges`,
      data: result,
    });
  } catch (error) {
    console.error('❌ Error syncing missing users:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to sync missing users'
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/sync-missing-users
 * Check how many users are missing UserLevel (dry run)
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database not connected');
    }
    
    // Get all users who have made deposits
    const WalletTransaction = (await import('@/database/models/trading/wallet-transaction.model')).default;
    const UserLevel = (await import('@/database/models/user-level.model')).default;
    
    const depositUserIds = await WalletTransaction.distinct('userId', { 
      transactionType: 'deposit', 
      status: 'completed' 
    });
    
    // Get all users who already have UserLevel
    const existingLevelUserIds = await UserLevel.distinct('userId');
    const existingSet = new Set(existingLevelUserIds);
    
    // Find users missing UserLevel
    const missingUserIds = depositUserIds.filter((id: string) => !existingSet.has(id));
    
    // Get details about missing users
    const usersCollection = db.collection('user');
    const CreditWallet = (await import('@/database/models/trading/credit-wallet.model')).default;
    
    const missingUsers = await Promise.all(
      missingUserIds.slice(0, 20).map(async (userId: string) => {
        const user = await usersCollection.findOne({ 
          $or: [
            { id: userId },
            { _id: new mongoose.Types.ObjectId(userId) }
          ]
        });
        const wallet = await CreditWallet.findOne({ userId });
        const deposits = await WalletTransaction.find({ 
          userId, 
          transactionType: 'deposit', 
          status: 'completed' 
        }).lean();
        
        return {
          userId,
          name: user?.name || 'Unknown',
          email: user?.email || 'No email',
          creditBalance: wallet?.creditBalance || 0,
          totalDeposited: wallet?.totalDeposited || 0,
          depositCount: deposits.length,
          userExists: !!user,
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      totalUsersWithDeposits: depositUserIds.length,
      usersWithUserLevel: existingLevelUserIds.length,
      missingCount: missingUserIds.length,
      missingUsers: missingUsers,
      message: missingUserIds.length > 0 
        ? `Found ${missingUserIds.length} users with deposits but no UserLevel. Run POST to sync.`
        : 'All users with deposits have UserLevel records.',
    });
  } catch (error) {
    console.error('❌ Error checking missing users:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check missing users'
    }, { status: 500 });
  }
}

