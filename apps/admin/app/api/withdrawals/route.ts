import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import UserBankAccount from '@/database/models/user-bank-account.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { verifyAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/withdrawals
 * Get all withdrawal requests with filtering
 * 
 * MANUAL WITHDRAWAL FLOW:
 * 1. User requests withdrawal → System deducts credits
 * 2. Admin sees request here with user's bank details (IBAN)
 * 3. Admin logs into company bank & transfers money
 * 4. Admin marks withdrawal as "completed"
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const isSandbox = searchParams.get('sandbox');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    await connectToDatabase();

    // Build query
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (userId) {
      query.userId = userId;
    }
    if (isSandbox !== null && isSandbox !== undefined) {
      query.isSandbox = isSandbox === 'true';
    }

    // Get total count
    const total = await WithdrawalRequest.countDocuments(query);

    // Get paginated results
    const withdrawals = await WithdrawalRequest.find(query)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch bank/card details for each withdrawal (for admin to process)
    const withdrawalsWithDetails = await Promise.all(
      withdrawals.map(async (w: any) => {
        let userBankDetails = null;
        let originalCardDetails = w.originalCardDetails || null;
        let originalPaymentId = w.originalPaymentId || null;
        let originalPaymentMethod = w.originalPaymentMethod || null;
        
        // For original_method withdrawals OR if we need to show the user's original deposit card
        // Try to fetch card details from the user's last deposit if not already stored
        if (!originalCardDetails || !originalCardDetails.last4) {
          const lastDeposit = await WalletTransaction.findOne({
            userId: w.userId,
            transactionType: 'deposit',
            status: 'completed',
          }).sort({ createdAt: -1 }).lean();

          if (lastDeposit) {
            const metadata = (lastDeposit as any).metadata || {};
            // Try to extract card details from deposit metadata
            const cardBrand = metadata.cardBrand || metadata.brand;
            const cardLast4 = metadata.cardLast4 || metadata.last4;
            
            if (cardBrand || cardLast4) {
              originalCardDetails = {
                brand: cardBrand || 'Card',
                last4: cardLast4 || '****',
                expMonth: metadata.cardExpMonth || metadata.expMonth,
                expYear: metadata.cardExpYear || metadata.expYear,
                country: metadata.cardCountry || metadata.country,
              };
            }
            
            // Get payment ID from deposit if not stored in withdrawal
            if (!originalPaymentId) {
              originalPaymentId = metadata.paymentIntentId || (lastDeposit as any).paymentId;
            }
            if (!originalPaymentMethod) {
              originalPaymentMethod = (lastDeposit as any).paymentMethod;
            }
          }
        }
        
        // If the withdrawal has embedded bank details, use those
        if (w.bankDetails && w.bankDetails.accountHolderName) {
          userBankDetails = {
            accountHolderName: w.bankDetails.accountHolderName,
            iban: w.bankDetails.fullIban || w.bankDetails.iban,
            bankName: w.bankDetails.bankName,
            swiftBic: w.bankDetails.swiftBic,
            country: w.bankDetails.country,
            nickname: null,
            currency: 'EUR',
            ibanLast4: w.bankDetails.iban?.replace(/\*+/g, '').slice(-4),
          };
        } else if (w.payoutMethod !== 'original_method') {
          // Otherwise, fetch from user's bank accounts (fallback for older requests)
          const bankAccount = await UserBankAccount.findOne({
            userId: w.userId,
            isDefault: true,
            isActive: true,
          }).lean();

          if (bankAccount) {
            userBankDetails = {
              accountHolderName: (bankAccount as any).accountHolderName,
              iban: (bankAccount as any).iban,
              bankName: (bankAccount as any).bankName,
              swiftBic: (bankAccount as any).swiftBic,
              country: (bankAccount as any).country,
              nickname: (bankAccount as any).nickname,
              currency: (bankAccount as any).currency,
              ibanLast4: (bankAccount as any).ibanLast4,
            };
          }
        }

        return {
          ...w,
          // Include original card details - now always fetched from deposit if not stored
          originalCardDetails,
          originalPaymentId,
          originalPaymentMethod,
          userBankDetails,
        };
      })
    );

    // Get stats
    const stats = await WithdrawalRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amountEUR' },
        },
      },
    ]);

    const statsMap: any = {
      pending: { count: 0, totalAmount: 0 },
      approved: { count: 0, totalAmount: 0 },
      processing: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0 },
      rejected: { count: 0, totalAmount: 0 },
      cancelled: { count: 0, totalAmount: 0 },
      failed: { count: 0, totalAmount: 0 },
    };

    stats.forEach((s: any) => {
      statsMap[s._id] = { count: s.count, totalAmount: s.totalAmount };
    });

    return NextResponse.json({
      success: true,
      withdrawals: withdrawalsWithDetails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: statsMap,
    });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}
