import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Import to access the in-memory maps
import { clearAllLockouts } from '@/lib/services/registration-security.service';

/**
 * POST /api/admin/lockouts/clear-all
 * Admin endpoint to clear ALL in-memory lockouts (used during fraud settings reset)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin API key
    const headersList = await headers();
    const apiKey = headersList.get('x-admin-api-key');
    const expectedKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_KEY;
    
    // Also accept requests from localhost (same server)
    const isLocalRequest = req.headers.get('host')?.includes('localhost') || 
                           req.headers.get('x-forwarded-for')?.includes('127.0.0.1');
    
    if (!isLocalRequest && apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear all in-memory lockouts
    const cleared = await clearAllLockouts();

    console.log(`🔓 [Admin API] Cleared all in-memory lockouts: ${cleared} entries`);

    return NextResponse.json({ 
      success: true, 
      message: `Cleared ${cleared} in-memory lockouts`,
      cleared 
    });
  } catch (error) {
    console.error('Error clearing all lockouts:', error);
    return NextResponse.json({ error: 'Failed to clear lockouts' }, { status: 500 });
  }
}

