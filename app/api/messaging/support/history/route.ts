import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * GET /api/messaging/support/history
 * Get all support tickets (conversations) for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    // Fetch all conversations for this user (excluding those they deleted)
    const conversations = await db.collection('conversations')
      .find({
        type: 'user-to-support',
        'participants.id': session.user.id,
        'participants.type': 'user',
        // Exclude conversations deleted by this user
        deletedByUsers: { $ne: session.user.id },
      })
      .sort({ lastActivityAt: -1 })
      .toArray();

    console.log(`📋 [Support History] Found ${conversations.length} tickets for user ${session.user.name}`);

    const tickets = conversations.map(conv => ({
      id: conv._id.toString(),
      ticketNumber: conv.ticketNumber || null,
      status: conv.status,
      isArchived: conv.isArchived || false,
      isResolved: conv.isResolved || false,
      archivedAt: conv.archivedAt?.toISOString() || null,
      resolvedAt: conv.resolvedAt?.toISOString() || null,
      resolvedByName: conv.resolvedByName || null,
      isAIHandled: conv.isAIHandled || false,
      assignedEmployeeName: conv.assignedEmployeeName || null,
      lastMessage: conv.lastMessage,
      createdAt: conv.createdAt?.toISOString(),
      lastActivityAt: conv.lastActivityAt?.toISOString(),
    }));

    return NextResponse.json({
      tickets,
      total: tickets.length,
      activeCount: tickets.filter(t => !t.isArchived && !t.isResolved).length,
      archivedCount: tickets.filter(t => t.isArchived || t.isResolved).length,
    });
  } catch (error) {
    console.error('❌ [Support History] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get ticket history' },
      { status: 500 }
    );
  }
}
