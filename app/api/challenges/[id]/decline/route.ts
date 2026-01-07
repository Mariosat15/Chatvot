import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import Challenge from '@/database/models/trading/challenge.model';

// POST - Decline a challenge
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const challenge = await Challenge.findById(id);

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Only the challenged user can decline
    if (challenge.challengedId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the challenged user can decline' },
        { status: 403 }
      );
    }

    // Check status
    if (challenge.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot decline challenge with status: ${challenge.status}` },
        { status: 400 }
      );
    }

    // Update status
    challenge.status = 'declined';
    challenge.declinedAt = new Date();
    await challenge.save();

    // Send notification to challenger
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      await notificationService.send({
        userId: challenge.challengerId,
        templateId: 'challenge_declined',
        variables: {  // Changed from 'metadata' to 'variables'
          challengeId: challenge._id.toString(),
          challengeSlug: challenge.slug,  // For actionUrl
          challengedName: challenge.challengedName,
          opponentName: challenge.challengedName,  // Alias for template compatibility
          entryFee: challenge.entryFee,
        },
      });
    } catch (notifError) {
      console.error('Error sending decline notification:', notifError);
    }

    return NextResponse.json({
      success: true,
      message: 'Challenge declined',
    });
  } catch (error) {
    console.error('Error declining challenge:', error);
    return NextResponse.json(
      { error: 'Failed to decline challenge' },
      { status: 500 }
    );
  }
}

