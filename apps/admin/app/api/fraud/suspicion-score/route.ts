import { NextResponse } from 'next/server';
import { SuspicionScoringService } from '@/lib/services/fraud/suspicion-scoring.service';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { cookies } from 'next/headers';

/**
 * GET /api/fraud/suspicion-score
 * Get suspicion scores
 * Query params:
 * - userId: Get score for specific user
 * - riskLevel: Filter by risk level
 * - highRisk: Get only high/critical risk users
 */
export async function GET(request: Request) {
  try {
    // Check admin auth
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_session')?.value;
    const admin = await verifyAdminAuth(adminToken);

    if (!admin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const riskLevel = searchParams.get('riskLevel');
    const highRisk = searchParams.get('highRisk');
    const stats = searchParams.get('stats');

    // Get statistics
    if (stats === 'true') {
      const statistics = await SuspicionScoringService.getStatistics();
      return NextResponse.json({
        success: true,
        stats: statistics
      });
    }

    // Get specific user score
    if (userId) {
      const score = await SuspicionScoringService.getScore(userId);
      
      if (!score) {
        return NextResponse.json({
          success: false,
          message: 'Score not found for this user'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        score
      });
    }

    // Get high-risk users
    if (highRisk === 'true') {
      const scores = await SuspicionScoringService.getHighRiskUsers();
      return NextResponse.json({
        success: true,
        scores,
        count: scores.length
      });
    }

    // Get users by risk level
    if (riskLevel && ['low', 'medium', 'high', 'critical'].includes(riskLevel)) {
      const scores = await SuspicionScoringService.getUsersByRiskLevel(
        riskLevel as 'low' | 'medium' | 'high' | 'critical'
      );
      return NextResponse.json({
        success: true,
        scores,
        count: scores.length
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid query parameters'
    }, { status: 400 });

  } catch (error) {
    console.error('Error fetching suspicion scores:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch scores' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fraud/suspicion-score
 * Manually update suspicion score (admin only)
 */
export async function POST(request: Request) {
  try {
    // Check admin auth
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_session')?.value;
    const admin = await verifyAdminAuth(adminToken);

    if (!admin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, method, points, evidence } = body;

    if (!userId || !method || !points || !evidence) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields'
      }, { status: 400 });
    }

    const score = await SuspicionScoringService.updateScore(userId, {
      method,
      percentage: points, // Use points as percentage
      evidence
    });

    return NextResponse.json({
      success: true,
      message: 'Score updated successfully',
      score
    });

  } catch (error) {
    console.error('Error updating suspicion score:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update score' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fraud/suspicion-score
 * Reset suspicion score (admin only)
 */
export async function DELETE(request: Request) {
  try {
    // Check admin auth
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_session')?.value;
    const admin = await verifyAdminAuth(adminToken);

    if (!admin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'User ID required'
      }, { status: 400 });
    }

    const score = await SuspicionScoringService.resetScore(userId);

    return NextResponse.json({
      success: true,
      message: 'Score reset successfully',
      score
    });

  } catch (error) {
    console.error('Error resetting suspicion score:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to reset score' },
      { status: 500 }
    );
  }
}

