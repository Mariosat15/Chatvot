import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { MarketplaceItem } from '@/database/models/marketplace/marketplace-item.model';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import GameMasterSubscription from '@/database/models/gamemaster/gamemaster-subscription.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import mongoose from 'mongoose';

/**
 * POST /api/marketplace/purchase
 * Purchase a marketplace item
 */
export async function POST(request: NextRequest) {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  
  try {
    await connectToDatabase();
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const { itemId } = await request.json();
    
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'Item ID is required' },
        { status: 400 }
      );
    }
    
    // Get the item
    const item = await MarketplaceItem.findById(itemId).session(mongoSession);
    if (!item) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }
    
    if (!item.isPublished || item.status !== 'active') {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Item is not available for purchase' },
        { status: 400 }
      );
    }
    
    // Check if already purchased
    const existingPurchase = await UserPurchase.findOne({
      userId,
      itemId: item._id,
    }).session(mongoSession);
    
    if (existingPurchase) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'You already own this item' },
        { status: 400 }
      );
    }
    
    // Get user wallet
    const wallet = await CreditWallet.findOne({ userId }).session(mongoSession);
    if (!wallet) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Check balance (skip for free items)
    if (!item.isFree && wallet.creditBalance < item.price) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Insufficient credits' },
        { status: 400 }
      );
    }
    
    // Deduct credits (if not free)
    let transaction = null;
    if (!item.isFree && item.price > 0) {
      const balanceBefore = wallet.creditBalance;
      wallet.creditBalance -= item.price;
      wallet.totalSpentOnMarketplace = (wallet.totalSpentOnMarketplace || 0) + item.price;
      await wallet.save({ session: mongoSession });
      
      // Create transaction record
      transaction = await WalletTransaction.create(
        [{
          userId,
          transactionType: 'marketplace_purchase',
          amount: -item.price,
          balanceBefore: balanceBefore,
          balanceAfter: wallet.creditBalance,
          currency: 'EUR',
          exchangeRate: 1,
          status: 'completed',
          description: `Purchased: ${item.name}`,
          processedAt: new Date(),
          metadata: {
            itemId: item._id.toString(),
            itemName: item.name,
            itemCategory: item.category,
          },
        }],
        { session: mongoSession }
      );
    }
    
    // Create purchase record
    const purchase = await UserPurchase.create(
      [{
        userId,
        itemId: item._id,
        pricePaid: item.isFree ? 0 : item.price,
        transactionId: transaction ? transaction[0]._id.toString() : undefined,
        customSettings: item.defaultSettings,
      }],
      { session: mongoSession }
    );
    
    // Update item stats
    await MarketplaceItem.findByIdAndUpdate(
      item._id,
      { $inc: { totalPurchases: 1 } },
      { session: mongoSession }
    );
    
    // If this is a Game Master package, auto-activate the subscription
    let gameMasterSubscription = null;
    if (item.category === 'gamemaster' && item.gameMasterConfig) {
      const config = item.gameMasterConfig;
      const now = new Date();
      const durationDays = config.subscriptionDurationDays || 30;
      const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      // Generate unique referral code
      let referralCode = '';
      let codeExists = true;
      while (codeExists) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        referralCode = 'GM';
        for (let i = 0; i < 6; i++) {
          referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existing = await GameMasterSubscription.findOne({ referralCode }).session(mongoSession);
        codeExists = !!existing;
      }
      
      // Check if user already has a subscription (upgrade/renew scenario)
      const existingSubscription = await GameMasterSubscription.findOne({ userId }).session(mongoSession);
      
      if (existingSubscription) {
        // Update existing subscription (upgrade or renew)
        existingSubscription.packageId = item._id.toString();
        existingSubscription.packageName = item.name;
        existingSubscription.status = 'active';
        existingSubscription.startDate = now;
        existingSubscription.endDate = endDate;
        existingSubscription.nextRenewalDate = endDate;
        existingSubscription.renewalPrice = item.price;
        existingSubscription.limits = {
          maxCompetitionsPerDay: config.maxCompetitionsPerDay || 1,
          maxUsersPerCompetition: config.maxUsersPerCompetition || 50,
          referralFeePercentage: config.referralFeePercentage || 5,
          canCreateCompetitions: config.canCreateCompetitions !== false, // Default to true if not specified
        };
        existingSubscription.currentPeriodCompetitionsCreated = 0;
        existingSubscription.lastCompetitionResetDate = now;
        await existingSubscription.save({ session: mongoSession });
        gameMasterSubscription = existingSubscription;
      } else {
        // Create new subscription
        const newSubscription = await GameMasterSubscription.create(
          [{
            userId,
            userEmail: session.user.email || '',
            userName: session.user.name || session.user.email || 'Game Master',
            packageId: item._id.toString(),
            packageName: item.name,
            status: 'active',
            activatedAt: now,
            startDate: now,
            endDate: endDate,
            nextRenewalDate: endDate,
            autoRenew: true,
            renewalPrice: item.price,
            referralCode,
            limits: {
              maxCompetitionsPerDay: config.maxCompetitionsPerDay || 1,
              maxUsersPerCompetition: config.maxUsersPerCompetition || 50,
              referralFeePercentage: config.referralFeePercentage || 5,
              canCreateCompetitions: config.canCreateCompetitions !== false, // Default to true if not specified
            },
            currentPeriodCompetitionsCreated: 0,
            lastCompetitionResetDate: now,
            totalCompetitionsCreated: 0,
            totalEarnings: 0,
            pendingEarnings: 0,
            totalReferredUsers: 0,
            activeReferredUsers: 0,
            renewalHistory: [],
          }],
          { session: mongoSession }
        );
        gameMasterSubscription = newSubscription[0];
      }
      
      console.log(`✅ Game Master subscription activated for user ${userId}, referral code: ${gameMasterSubscription.referralCode}`);
    }
    
    await mongoSession.commitTransaction();
    
    return NextResponse.json({
      success: true,
      purchase: purchase[0],
      newBalance: wallet.creditBalance,
      gameMasterActivated: !!gameMasterSubscription,
      gameMasterSubscription: gameMasterSubscription ? {
        referralCode: gameMasterSubscription.referralCode,
        endDate: gameMasterSubscription.endDate,
        limits: gameMasterSubscription.limits,
      } : null,
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error purchasing item:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    mongoSession.endSession();
  }
}

