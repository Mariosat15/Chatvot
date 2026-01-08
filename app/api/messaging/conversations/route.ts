import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * GET /api/messaging/conversations
 * Get user's conversations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'user-to-user' | 'user-to-support' | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const conversations = await MessagingService.getUserConversations(
      session.user.id,
      { type: type || undefined, limit, offset }
    );

    // Get online status for participants
    const allParticipantIds = new Set<string>();
    for (const conv of conversations) {
      for (const p of conv.participants) {
        if (p.id !== session.user.id) {
          allParticipantIds.add(p.id);
        }
      }
    }

    return NextResponse.json({
      conversations: conversations.map(conv => ({
        id: conv._id.toString(),
        type: conv.type,
        status: conv.status,
        participants: conv.participants.filter(p => p.isActive),
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCounts.get(session.user.id) || 0,
        isAIHandled: conv.isAIHandled,
        assignedEmployeeName: conv.assignedEmployeeName,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastActivityAt: conv.lastActivityAt,
      })),
      total: conversations.length,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messaging/conversations
 * Create a new conversation (direct message)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { participantId, participantName, participantAvatar } = body;

    if (!participantId) {
      return NextResponse.json(
        { error: 'Participant ID is required' },
        { status: 400 }
      );
    }

    // Get messaging settings
    const settings = await MessagingService.getSettings();
    
    if (!settings.allowUserToUserChat) {
      return NextResponse.json(
        { error: 'User-to-user chat is disabled' },
        { status: 403 }
      );
    }

    // Check friendship if required
    if (settings.requireFriendshipForChat) {
      const { Friendship } = await import('@/database/models/messaging/friend.model');
      const areFriends = await Friendship.areFriends(session.user.id, participantId);
      
      if (!areFriends) {
        return NextResponse.json(
          { error: 'You must be friends with this user to start a conversation' },
          { status: 403 }
        );
      }
    }

    const conversation = await MessagingService.findOrCreateDirectConversation(
      {
        id: session.user.id,
        name: session.user.name || 'User',
        avatar: session.user.image,
      },
      {
        id: participantId,
        name: participantName || 'User',
        avatar: participantAvatar,
      }
    );

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        participants: conversation.participants,
        lastMessage: conversation.lastMessage,
        unreadCount: conversation.unreadCounts.get(session.user.id) || 0,
        createdAt: conversation.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

