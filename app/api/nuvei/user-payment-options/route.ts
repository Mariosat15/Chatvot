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
import { nuveiService } from '@/lib/services/nuvei.service';
import { connectToDatabase } from '@/database/mongoose';
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
    const userTokenId = `user_${userId}`;

    await connectToDatabase();

    // Get UPOs from Nuvei
    const nuveiResult = await nuveiService.getUserPaymentOptions(userTokenId);

    if (nuveiResult.error) {
      console.log('💳 No Nuvei UPOs found (may be new user):', nuveiResult.error);
    }

    // Also get card details from our successful deposits
    // This gives us info even if Nuvei UPO API doesn't return data
    const recentDeposits = await WalletTransaction.find({
      userId,
      transactionType: 'deposit',
      status: 'completed',
      provider: 'nuvei',
      'metadata.cardLast4': { $exists: true },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('metadata createdAt');

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

    // Add Nuvei UPOs
    if (nuveiResult.paymentMethods) {
      for (const pm of nuveiResult.paymentMethods) {
        if (pm.upoStatus === 'enabled' || !pm.upoStatus) {
          paymentOptions.push({
            id: `nuvei_${pm.userPaymentOptionId}`,
            type: 'card',
            label: pm.upoName || `${pm.cardType || 'Card'} ending in ${pm.cardLastFourDigits}`,
            details: pm.expiryDate ? `Expires ${pm.expiryDate}` : '',
            cardBrand: pm.cardType,
            cardLast4: pm.cardLastFourDigits,
            expiryDate: pm.expiryDate,
            userPaymentOptionId: pm.userPaymentOptionId,
            isFromNuvei: true,
          });
        }
      }
    }

    // Add cards from our deposit history (if not already in Nuvei list)
    const existingLast4s = new Set(paymentOptions.map(p => p.cardLast4));
    
    for (const deposit of recentDeposits) {
      const cardLast4 = deposit.metadata?.cardLast4;
      if (cardLast4 && !existingLast4s.has(cardLast4)) {
        paymentOptions.push({
          id: `local_${deposit._id}`,
          type: 'card',
          label: `${deposit.metadata?.cardBrand || 'Card'} ending in ${cardLast4}`,
          details: 'From previous deposit',
          cardBrand: deposit.metadata?.cardBrand,
          cardLast4,
          isFromNuvei: false, // Can't use for automatic refund without UPO
        });
        existingLast4s.add(cardLast4);
      }
    }

    return NextResponse.json({
      paymentOptions,
      hasNuveiOptions: paymentOptions.some(p => p.isFromNuvei),
      message: paymentOptions.length === 0 
        ? 'No saved payment methods. Make a deposit first to enable card refunds.'
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

