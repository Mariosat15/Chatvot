import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * GET /api/messaging/conversations
 * Get support conversations for admin/employees
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      console.log('❌ [GetConv] No admin token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jwtSecret = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';
    const decoded = verify(token, jwtSecret) as {
      adminId: string;
      email: string;
      role: string;
      isSuperAdmin?: boolean;
    };

    console.log(`📥 [GetConv] Request from: ${decoded.email}, adminId: ${decoded.adminId}`);

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'support', 'internal', 'all'
    const status = searchParams.get('status') || 'active';
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`📥 [GetConv] Params: type=${type}, status=${status}, assignedToMe=${assignedToMe}`);

    const query: any = {};

    // Filter by type
    if (type === 'support') {
      query.type = 'user-to-support';
    } else if (type === 'internal') {
      query.type = 'employee-internal';
      // For internal chats, only show conversations where current user is a participant
      query['participants.id'] = decoded.adminId;
    } else {
      query.$or = [
        { type: 'user-to-support' },
        { type: 'employee-internal', 'participants.id': decoded.adminId }
      ];
    }

    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    // Filter by assignment (only for support)
    if (assignedToMe && type === 'support') {
      try {
        query.assignedEmployeeId = new Types.ObjectId(decoded.adminId);
      } catch {
        query.assignedEmployeeId = decoded.adminId;
      }
    }

    console.log(`📥 [GetConv] Query:`, JSON.stringify(query));

    const conversations = await db.collection('conversations')
      .find(query)
      .sort({ lastActivityAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await db.collection('conversations').countDocuments(query);

    console.log(`📥 [GetConv] Found ${conversations.length} conversations (total: ${total})`);

    return NextResponse.json({
      conversations: conversations.map((conv: any) => {
        // Handle unreadCounts - it might be stored as object or Map
        let unreadCount = 0;
        if (conv.unreadCounts) {
          if (typeof conv.unreadCounts.get === 'function') {
            unreadCount = conv.unreadCounts.get(decoded.adminId) || 0;
          } else if (typeof conv.unreadCounts === 'object') {
            unreadCount = conv.unreadCounts[decoded.adminId] || 0;
          }
        }

        return {
          id: conv._id.toString(),
          type: conv.type,
          status: conv.status,
          participants: conv.participants?.filter((p: any) => p.isActive) || [],
          lastMessage: conv.lastMessage,
          unreadCount,
          isAIHandled: conv.isAIHandled,
          assignedEmployeeId: conv.assignedEmployeeId?.toString(),
          assignedEmployeeName: conv.assignedEmployeeName,
          originalEmployeeId: conv.originalEmployeeId?.toString(),
          originalEmployeeName: conv.originalEmployeeName,
          temporarilyRedirected: conv.temporarilyRedirected || false,
          redirectedAt: conv.redirectedAt,
          metadata: conv.metadata,
          createdAt: conv.createdAt,
          lastActivityAt: conv.lastActivityAt,
        };
      }),
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('❌ [GetConv] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messaging/conversations
 * Create internal employee conversation
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      console.log('❌ [CreateConv] No admin token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jwtSecret = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';
    const decoded = verify(token, jwtSecret) as {
      adminId: string;
      email: string;
      name?: string;
      role: string;
    };

    console.log(`💬 [CreateConv] Request from: ${decoded.email}, adminId: ${decoded.adminId}`);

    const body = await request.json();
    const { participantIds, participantNames, title } = body;

    console.log(`💬 [CreateConv] participantIds: ${JSON.stringify(participantIds)}, names: ${JSON.stringify(participantNames)}`);

    if (!participantIds || participantIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one participant is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    // For 1-to-1 internal chat, check if already exists
    if (participantIds.length === 1) {
      console.log(`💬 [CreateConv] Checking for existing 1-to-1 chat between ${decoded.adminId} and ${participantIds[0]}`);
      
      const existingConv = await db.collection('conversations').findOne({
        type: 'employee-internal',
        status: { $ne: 'closed' },
        'participants.id': { $all: [decoded.adminId, participantIds[0]] },
      });

      if (existingConv) {
        console.log(`💬 [CreateConv] Found existing conversation: ${existingConv._id}`);
        return NextResponse.json({
          conversation: {
            id: existingConv._id.toString(),
            type: existingConv.type,
            status: existingConv.status,
            participants: existingConv.participants,
            existing: true,
          },
        });
      }
    }

    // Build participants array
    const participants = [
      {
        id: decoded.adminId,
        type: 'employee',
        name: decoded.name || decoded.email,
        joinedAt: new Date(),
        isActive: true,
      },
      ...participantIds.map((id: string, index: number) => ({
        id,
        type: 'employee',
        name: participantNames?.[index] || 'Employee',
        joinedAt: new Date(),
        isActive: true,
      })),
    ];

    console.log(`💬 [CreateConv] Creating new conversation with participants:`, participants.map(p => `${p.name} (${p.id})`));

    const result = await db.collection('conversations').insertOne({
      type: 'employee-internal',
      status: 'active',
      participants,
      title,
      unreadCounts: {},
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`💬 [CreateConv] Created conversation: ${result.insertedId}`);

    return NextResponse.json({
      conversation: {
        id: result.insertedId.toString(),
        type: 'employee-internal',
        status: 'active',
        participants,
        title,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('❌ [CreateConv] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

