import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import { notificationService } from '@/lib/services/notification.service';

/**
 * POST /api/competitions/[id]/pause
 * Pause or resume an active competition
 * 
 * Body: { action: 'pause' | 'resume', reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !['pause', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pause" or "resume"' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the competition
    const competition = await Competition.findById(id);
    if (!competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    // Only active competitions can be paused/resumed
    if (competition.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot ${action} a competition with status: ${competition.status}. Only active competitions can be paused/resumed.` },
        { status: 400 }
      );
    }

    const now = new Date();

    if (action === 'pause') {
      // Check if already paused
      if (competition.isPaused) {
        return NextResponse.json(
          { error: 'Competition is already paused' },
          { status: 400 }
        );
      }

      if (!reason) {
        return NextResponse.json(
          { error: 'Pause reason is required' },
          { status: 400 }
        );
      }

      // Pause the competition
      competition.isPaused = true;
      competition.pausedAt = now;
      competition.pauseReason = reason;
      
      // Add to pause history
      if (!competition.pauseHistory) {
        competition.pauseHistory = [];
      }
      competition.pauseHistory.push({
        pausedAt: now,
        reason,
        pausedBy: auth.adminId || 'unknown',
      });

      await competition.save();

      // Notify all participants
      const participants = await CompetitionParticipant.find({
        competitionId: id,
        status: { $in: ['active', 'joined'] },
      }).select('userId');

      for (const participant of participants) {
        await notificationService.createCustom({
          userId: participant.userId.toString(),
          type: 'competition_paused',
          title: '⏸️ Competition Paused',
          message: `${competition.name} has been paused. Trading is temporarily suspended. Reason: ${reason}`,
          icon: 'pause-circle',
          category: 'trading',
          priority: 'urgent',
          color: 'yellow',
        });
      }

      console.log(`⏸️ [Competition] Paused: ${competition.name} (${id}) - Reason: ${reason}`);

      return NextResponse.json({
        success: true,
        message: 'Competition paused successfully',
        competition: {
          id: competition._id,
          name: competition.name,
          isPaused: competition.isPaused,
          pausedAt: competition.pausedAt,
          pauseReason: competition.pauseReason,
        },
      });

    } else if (action === 'resume') {
      // Check if actually paused
      if (!competition.isPaused) {
        return NextResponse.json(
          { error: 'Competition is not paused' },
          { status: 400 }
        );
      }

      // Calculate pause duration
      const pausedAt = competition.pausedAt || now;
      const pauseDuration = now.getTime() - pausedAt.getTime();

      // Update the competition
      competition.isPaused = false;
      competition.pauseReason = undefined;
      
      // Add pause duration to total
      competition.totalPauseDuration = (competition.totalPauseDuration || 0) + pauseDuration;
      
      // Extend end time by pause duration to maintain fair competition time
      const currentEndTime = new Date(competition.endTime);
      competition.endTime = new Date(currentEndTime.getTime() + pauseDuration);

      // Update pause history
      if (competition.pauseHistory && competition.pauseHistory.length > 0) {
        const lastPause = competition.pauseHistory[competition.pauseHistory.length - 1];
        if (!lastPause.resumedAt) {
          lastPause.resumedAt = now;
          lastPause.duration = pauseDuration;
          lastPause.resumedBy = auth.adminId || 'unknown';
        }
      }

      await competition.save();

      // Notify all participants
      const participants = await CompetitionParticipant.find({
        competitionId: id,
        status: { $in: ['active', 'joined'] },
      }).select('userId');

      for (const participant of participants) {
        await notificationService.createCustom({
          userId: participant.userId.toString(),
          type: 'competition_resumed',
          title: '▶️ Competition Resumed',
          message: `${competition.name} has been resumed. Trading is now active again. End time extended by ${Math.round(pauseDuration / 60000)} minutes.`,
          icon: 'play-circle',
          category: 'trading',
          priority: 'high',
          color: 'green',
        });
      }

      console.log(`▶️ [Competition] Resumed: ${competition.name} (${id}) - Paused for ${Math.round(pauseDuration / 60000)} minutes`);

      return NextResponse.json({
        success: true,
        message: 'Competition resumed successfully',
        competition: {
          id: competition._id,
          name: competition.name,
          isPaused: competition.isPaused,
          totalPauseDuration: competition.totalPauseDuration,
          newEndTime: competition.endTime,
          pauseDuration,
        },
      });
    }

  } catch (error) {
    console.error('Error in competition pause/resume:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/competitions/[id]/pause
 * Get pause status for a competition
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const competition = await Competition.findById(id).select(
      'name isPaused pausedAt pauseReason totalPauseDuration pauseHistory status endTime'
    );

    if (!competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pauseStatus: {
        isPaused: competition.isPaused || false,
        pausedAt: competition.pausedAt,
        pauseReason: competition.pauseReason,
        totalPauseDuration: competition.totalPauseDuration || 0,
        pauseHistory: competition.pauseHistory || [],
        status: competition.status,
        endTime: competition.endTime,
      },
    });

  } catch (error) {
    console.error('Error getting pause status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
