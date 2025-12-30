/**
 * Nuvei User Payment Options (UPOs) API
 * Gets the user's stored payment methods from previous deposits
 * These can be used for card refund withdrawals
 * 
 * GET /api/nuvei/user-payment-options
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import NuveiUserPaymentOption from '@/database/models/nuvei-user-payment-option.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';

export async function GET() {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    await connectToDatabase();

    // Get stored UPOs from our database (captured from deposit DMNs)
    const storedUPOs = await NuveiUserPaymentOption.getActiveUPOs(userId);
    
    console.log(`💳 Found ${storedUPOs.length} stored UPOs for user ${userId}`);

    // Build combined payment options
    const paymentOptions: Array<{
      id: string;
      type: 'card' | 'bank';
      label: string;
      details: string;
      cardBrand?: string;
      cardLast4?: string;
      expiryDate?: string;
      userPaymentOptionId?: string;
      isFromNuvei: boolean;
    }> = [];

    // Add stored UPOs (these are valid for card refunds)
    for (const upo of storedUPOs) {
      const expiryStr = upo.expMonth && upo.expYear 
        ? `${upo.expMonth}/${upo.expYear}` 
        : undefined;
        
      paymentOptions.push({
        id: `upo_${upo.userPaymentOptionId}`,
        type: 'card',
        label: `${upo.cardBrand || 'Card'} •••• ${upo.cardLast4 || '****'}`,
        details: expiryStr ? `Expires ${expiryStr}` : 'Stored from deposit',
        cardBrand: upo.cardBrand,
        cardLast4: upo.cardLast4,
        expiryDate: expiryStr,
        userPaymentOptionId: upo.userPaymentOptionId,
        isFromNuvei: true, // Can be used for card refunds
      });
    }

    // If no UPOs stored, try to get from deposit metadata as fallback display
    // (these won't work for refunds without the UPO ID)
    if (paymentOptions.length === 0) {
      const recentDeposits = await WalletTransaction.find({
        userId,
        transactionType: 'deposit',
        status: 'completed',
        provider: 'nuvei',
        'metadata.cardLast4': { $exists: true },
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('metadata createdAt');
        
      // Check if any deposits have UPO stored in metadata
      for (const deposit of recentDeposits) {
        const upoId = deposit.metadata?.userPaymentOptionId;
        const cardLast4 = deposit.metadata?.cardLast4;
        
        if (upoId && cardLast4) {
          // This deposit has a UPO - can use for refunds
          paymentOptions.push({
            id: `dep_${upoId}`,
            type: 'card',
            label: `${deposit.metadata?.cardBrand || 'Card'} •••• ${cardLast4}`,
            details: 'From previous deposit',
            cardBrand: deposit.metadata?.cardBrand,
            cardLast4,
            userPaymentOptionId: upoId,
            isFromNuvei: true,
          });
        } else if (cardLast4) {
          // No UPO - show card but can't use for automatic refund
          paymentOptions.push({
            id: `local_${deposit._id}`,
            type: 'card',
            label: `${deposit.metadata?.cardBrand || 'Card'} •••• ${cardLast4}`,
            details: '⚠️ No UPO - use bank transfer instead',
            cardBrand: deposit.metadata?.cardBrand,
            cardLast4,
            isFromNuvei: false, // Cannot use for automatic card refund
          });
        }
      }
    }

    return NextResponse.json({
      paymentOptions,
      hasNuveiOptions: paymentOptions.some(p => p.isFromNuvei && p.userPaymentOptionId),
      message: paymentOptions.length === 0 
        ? 'No saved payment methods. Make a deposit first to enable card refunds.'
        : paymentOptions.every(p => !p.isFromNuvei)
          ? 'Your cards are from older deposits without UPO. Please use bank transfer for withdrawals.'
          : undefined,
    });
  } catch (error) {
    console.error('Error getting user payment options:', error);
    return NextResponse.json(
      { error: 'Failed to get payment options' },
      { status: 500 }
    );
  }
}

