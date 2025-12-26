import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { getAdminSession } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * POST /api/admin/users/credit
 * Credit a user with specified amount of credits
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('📥 Received credit request:', body);
    
    const { userId, amount, reason } = body;

    // Validation
    if (!userId) {
      console.error('❌ User ID is missing from request body:', body);
      return NextResponse.json(
        { success: false, message: 'User ID is required', receivedBody: body },
        { status: 400 }
      );
    }

    if (!amount || amount === 0) {
      return NextResponse.json(
        { success: false, message: 'Amount cannot be zero' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find or create wallet
    let wallet = await CreditWallet.findOne({ userId });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await CreditWallet.create({
        userId,
        creditBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSpentOnCompetitions: 0,
        totalWonFromCompetitions: 0,
        isActive: true,
        kycVerified: false,
        withdrawalEnabled: false,
      });
    }

    // Check if removing credits would result in negative balance
    const previousBalance = wallet.creditBalance;
    const newBalance = previousBalance + amount;
    
    if (newBalance < 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Cannot remove ${Math.abs(amount)} credits. User only has ${previousBalance.toFixed(2)} credits available.` 
        },
        { status: 400 }
      );
    }

    // Update wallet balance
    wallet.creditBalance = newBalance;
    
    // Only update totalDeposited/totalWithdrawn if adding/removing credits
    if (amount > 0) {
      wallet.totalDeposited += amount;
    } else {
      wallet.totalWithdrawn += Math.abs(amount);
    }
    
    await wallet.save();

    // Create transaction record
    await WalletTransaction.create({
      userId,
      transactionType: 'admin_adjustment',
      amount,
      balanceBefore: previousBalance,
      balanceAfter: wallet.creditBalance,
      currency: 'EUR',
      exchangeRate: 1,
      description: reason || `Admin ${amount > 0 ? 'added' : 'removed'} ${Math.abs(amount)} credits`,
      status: 'completed',
      processedAt: new Date(),
      metadata: {
        source: 'admin',
        adminAdjustment: true,
        adjustmentAmount: amount,
        adjustmentType: amount > 0 ? 'credit' : 'debit',
      },
    });

    const actionText = amount > 0 ? 'added' : 'removed';
    console.log(`✅ Admin ${actionText} ${Math.abs(amount)} credits ${amount > 0 ? 'to' : 'from'} user ${userId}`);

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logCreditsAdjusted(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split('@')[0],
            role: 'admin',
          },
          userId,
          userId,
          previousBalance,
          newBalance,
          reason || `Admin ${actionText} ${Math.abs(amount)} credits`
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ${actionText} ${Math.abs(amount)} credits`,
      wallet: {
        userId: wallet.userId,
        balance: wallet.creditBalance,
        previousBalance,
        adjustedAmount: amount,
      },
    });
  } catch (error) {
    console.error('❌ Error crediting user:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to credit user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

