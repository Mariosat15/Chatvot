import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { clearPriceCache } from '@/lib/services/redis.service';

export async function POST() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = await clearPriceCache();

    if (success) {
      return NextResponse.json({ success: true, message: 'Cache cleared successfully' });
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to clear cache or Redis not connected' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

