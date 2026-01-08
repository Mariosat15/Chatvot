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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'default-secret';
    const decoded = verify(token, jwtSecret) as {
      id: string;
      email: string;
      role: string;
      isSuperAdmin?: boolean;
    };

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'support', 'internal', 'all'
    const status = searchParams.get('status') || 'active';
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const Conversation = mongoose.models.Conversation || 
      mongoose.model('Conversation', new mongoose.Schema({}, { strict: false, collection: 'conversations' }));

    const query: any = {};

    // Filter by type
    if (type === 'support') {
      query.type = 'user-to-support';
    } else if (type === 'internal') {
      query.type = 'employee-internal';
    } else {
      query.type = { $in: ['user-to-support', 'employee-internal'] };
    }

    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    // Filter by assignment
    if (assignedToMe) {
      query.assignedEmployeeId = new Types.ObjectId(decoded.id);
    }

    const conversations = await Conversation.find(query)
      .sort({ lastActivityAt: -1 })
      .skip(offset)
      .limit(limit);

    const total = await Conversation.countDocuments(query);

    return NextResponse.json({
      conversations: conversations.map((conv: any) => ({
        id: conv._id.toString(),
        type: conv.type,
        status: conv.status,
        participants: conv.participants?.filter((p: any) => p.isActive) || [],
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCounts?.get?.(decoded.id) || 0,
        isAIHandled: conv.isAIHandled,
        assignedEmployeeId: conv.assignedEmployeeId?.toString(),
        assignedEmployeeName: conv.assignedEmployeeName,
        metadata: conv.metadata,
        createdAt: conv.createdAt,
        lastActivityAt: conv.lastActivityAt,
      })),
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error fetching admin conversations:', error);
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'default-secret';
    const decoded = verify(token, jwtSecret) as {
      id: string;
      email: string;
      name: string;
      role: string;
    };

    const body = await request.json();
    const { participantIds, participantNames, title } = body;

    if (!participantIds || participantIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one participant is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const Conversation = mongoose.models.Conversation || 
      mongoose.model('Conversation', new mongoose.Schema({}, { strict: false, collection: 'conversations' }));

    // For 1-to-1 internal chat, check if already exists
    if (participantIds.length === 1) {
      const existingConv = await Conversation.findOne({
        type: 'employee-internal',
        status: { $ne: 'closed' },
        'participants.id': { $all: [decoded.id, participantIds[0]] },
        participants: { $size: 2 },
      });

      if (existingConv) {
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
        id: decoded.id,
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

    const conversation = await Conversation.create({
      type: 'employee-internal',
      status: 'active',
      participants,
      title,
      unreadCounts: new Map(),
      lastActivityAt: new Date(),
    });

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        participants: conversation.participants,
        title: conversation.title,
        createdAt: conversation.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating internal conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

