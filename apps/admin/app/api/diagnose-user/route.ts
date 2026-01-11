import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * GET /api/admin/diagnose-user?userId=xxx or ?email=xxx
 * Comprehensive diagnostic for a user's data
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    
    if (!userId && !email) {
      return NextResponse.json({
        success: false,
        error: 'Please provide userId or email query parameter'
      }, { status: 400 });
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }

    // Find user
    const userCollection = db.collection('user');
    let user: any = null;
    
    if (userId) {
      user = await userCollection.findOne({ 
        $or: [
          { id: userId },
          { _id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
        ]
      });
    } else if (email) {
      user = await userCollection.findOne({ email });
    }
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        query: { userId, email },
      }, { status: 404 });
    }
    
    const resolvedUserId = user._id.toString();
    
    // Import models
    const CreditWallet = (await import('@/database/models/trading/credit-wallet.model')).default;
    const WalletTransaction = (await import('@/database/models/trading/wallet-transaction.model')).default;
    const UserLevel = (await import('@/database/models/user-level.model')).default;
    const UserBadge = (await import('@/database/models/user-badge.model')).default;
    
    // Get all related data
    const [wallet, transactions, userLevel, badges, notifications] = await Promise.all([
      CreditWallet.findOne({ userId: resolvedUserId }).lean(),
      WalletTransaction.find({ userId: resolvedUserId }).sort({ createdAt: -1 }).lean(),
      UserLevel.findOne({ userId: resolvedUserId }).lean(),
      UserBadge.find({ userId: resolvedUserId }).lean(),
      db.collection('notifications').find({ userId: resolvedUserId }).sort({ createdAt: -1 }).limit(10).toArray(),
    ]);
    
    // Analyze deposits
    const deposits = transactions.filter(t => t.transactionType === 'deposit');
    const completedDeposits = deposits.filter(t => t.status === 'completed');
    const pendingDeposits = deposits.filter(t => t.status === 'pending');
    const failedDeposits = deposits.filter(t => t.status === 'failed');
    
    // Check for issues
    const issues: string[] = [];
    
    if (!wallet) {
      issues.push('❌ No wallet found - user never initiated a deposit');
    } else if (wallet.creditBalance === 0 && wallet.totalDeposited === 0) {
      issues.push('⚠️ Wallet exists but empty - no successful deposits');
    }
    
    if (completedDeposits.length > 0 && !userLevel) {
      issues.push('❌ Has completed deposits but no UserLevel - badge evaluation never ran');
    }
    
    if (wallet && wallet.creditBalance > 0 && !userLevel) {
      issues.push('❌ Has credits but no UserLevel - needs sync');
    }
    
    if (pendingDeposits.length > 0) {
      issues.push(`⚠️ Has ${pendingDeposits.length} pending deposits - may be waiting for webhook`);
    }
    
    if (failedDeposits.length > 0) {
      issues.push(`⚠️ Has ${failedDeposits.length} failed deposits`);
    }
    
    if (notifications.length === 0) {
      issues.push('⚠️ No notifications found');
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: resolvedUserId,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      wallet: wallet ? {
        creditBalance: wallet.creditBalance,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        isActive: wallet.isActive,
      } : null,
      deposits: {
        total: deposits.length,
        completed: completedDeposits.length,
        pending: pendingDeposits.length,
        failed: failedDeposits.length,
        recentDeposits: deposits.slice(0, 5).map(d => ({
          id: d._id,
          amount: d.amount,
          status: d.status,
          provider: d.provider,
          createdAt: d.createdAt,
          processedAt: d.processedAt,
          failureReason: d.failureReason,
          clientUniqueId: d.metadata?.clientUniqueId,
        })),
      },
      gamification: {
        hasUserLevel: !!userLevel,
        userLevel: userLevel ? {
          currentXP: userLevel.currentXP,
          currentLevel: userLevel.currentLevel,
          currentTitle: userLevel.currentTitle,
          totalBadgesEarned: userLevel.totalBadgesEarned,
        } : null,
        badgeCount: badges.length,
        badges: badges.map(b => ({ badgeId: b.badgeId, earnedAt: b.earnedAt })),
      },
      notifications: notifications.slice(0, 5).map(n => ({
        type: n.type,
        title: n.title,
        createdAt: n.createdAt,
        read: n.read,
      })),
      issues: issues.length > 0 ? issues : ['✅ No issues detected'],
      recommendation: issues.length > 0 
        ? 'Run POST /api/admin/sync-missing-users to fix missing UserLevel records'
        : 'User data looks healthy',
    });
  } catch (error) {
    console.error('❌ Error diagnosing user:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to diagnose user'
    }, { status: 500 });
  }
}

