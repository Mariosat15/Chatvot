import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { getCacheStats } from '@/lib/services/redis.service';

export async function GET() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getCacheStats();

    if (!stats) {
      return NextResponse.json({
        connected: false,
        pricesCached: 0,
        queuePending: 0,
        queueProcessing: 0,
      });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch cache stats:', error);
    return NextResponse.json(
      { 
        connected: false,
        pricesCached: 0,
        queuePending: 0,
        queueProcessing: 0,
        error: 'Failed to fetch stats' 
      },
      { status: 500 }
    );
  }
}

