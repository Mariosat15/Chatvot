import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import { auth } from '@/lib/better-auth/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user) {
      return NextResponse.json({ balance: 0 });
    }

    await connectToDatabase();

    const wallet = await CreditWallet.findOne({ userId: session.user.id }).lean() as any;
    
    return NextResponse.json({
      balance: wallet?.creditBalance ?? 0,
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet balance' },
      { status: 500 }
    );
  }
}

