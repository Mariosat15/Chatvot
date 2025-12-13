import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getUserDashboardDataForApi } from '@/lib/actions/dashboard.actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    console.log('🔄 API: /api/dashboard/live-stats called');
    
    // Check authentication in the API route, not in the server action
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const dashboardData = await getUserDashboardDataForApi(session.user.id);
    
    if (!dashboardData) {
      return NextResponse.json(
        { error: 'Failed to fetch dashboard data' },
        { status: 500 }
      );
    }
    
    console.log('✅ API: Dashboard data fetched successfully');
    console.log(`   - Active competitions: ${dashboardData.activeCompetitions.length}`);
    console.log(`   - Total capital: $${dashboardData.overallStats.totalCapital}`);
    console.log(`   - Total P&L: $${dashboardData.overallStats.totalPnL}`);
    
    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('❌ API Error fetching live dashboard stats:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

