import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { PaymentFraudService } from '@/lib/services/fraud/payment-fraud.service';
import { connectToDatabase } from '@/database/mongoose';

/**
 * Payment Fraud Tracking API
 * 
 * GET /api/fraud/payment-tracking - Get payment fraud statistics
 * GET /api/fraud/payment-tracking?userId=xxx - Get user's payment fingerprints
 * GET /api/fraud/payment-tracking?shared=true - Get shared payment methods
 */

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    
    // Verify admin authentication
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const shared = searchParams.get('shared');
    const stats = searchParams.get('stats');

    // Get payment fraud statistics
    if (stats === 'true') {
      const statistics = await PaymentFraudService.getPaymentFraudStats();
      
      return NextResponse.json({
        success: true,
        stats: statistics
      });
    }

    // Get shared payment methods
    if (shared === 'true') {
      const sharedPayments = await PaymentFraudService.getSharedPayments();
      
      return NextResponse.json({
        success: true,
        sharedPayments: sharedPayments.map((payment: any) => ({
          _id: payment._id.toString(),
          userId: payment.userId.toString(),
          paymentProvider: payment.paymentProvider,
          paymentFingerprint: payment.paymentFingerprint,
          cardLast4: payment.cardLast4,
          cardBrand: payment.cardBrand,
          cardCountry: payment.cardCountry,
          cardFunding: payment.cardFunding,
          paypalEmail: payment.paypalEmail,
          linkedUserIds: payment.linkedUserIds.map((id: any) => id.toString()),
          isShared: payment.isShared,
          riskScore: payment.riskScore,
          firstUsed: payment.firstUsed,
          lastUsed: payment.lastUsed,
          timesUsed: payment.timesUsed
        }))
      });
    }

    // Get payment fingerprints for a specific user
    if (userId) {
      const userPayments = await PaymentFraudService.getUserPaymentFingerprints(userId);
      const hasShared = await PaymentFraudService.hasSharedPayments(userId);
      
      return NextResponse.json({
        success: true,
        userId,
        hasSharedPayments: hasShared,
        payments: userPayments.map((payment: any) => ({
          _id: payment._id.toString(),
          paymentProvider: payment.paymentProvider,
          paymentFingerprint: payment.paymentFingerprint,
          cardLast4: payment.cardLast4,
          cardBrand: payment.cardBrand,
          cardCountry: payment.cardCountry,
          linkedUserIds: payment.linkedUserIds.map((id: any) => id.toString()),
          isShared: payment.isShared,
          riskScore: payment.riskScore,
          firstUsed: payment.firstUsed,
          lastUsed: payment.lastUsed,
          timesUsed: payment.timesUsed
        }))
      });
    }

    // Default: Return payment fraud stats
    const statistics = await PaymentFraudService.getPaymentFraudStats();
    
    return NextResponse.json({
      success: true,
      stats: statistics
    });

  } catch (error) {
    console.error('❌ Payment fraud tracking API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch payment fraud data',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

