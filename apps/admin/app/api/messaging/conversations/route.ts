import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';

interface DecodedToken {
  adminId: string;
  email: string;
  name?: string;
  role: string;
  isSuperAdmin?: boolean;
}

/**
 * GET /api/messaging/conversations
 * Get conversations for admin/employees with proper access control:
 * 
 * - Super Admin / Admin: Can see ALL conversations
 * - Employees: Can ONLY see:
 *   - Support conversations with their assigned customers
 *   - Internal conversations they're part of
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as DecodedToken;
    const { adminId, email, role, isSuperAdmin } = decoded;

    console.log(`📥 [GetConv] Request from: ${email} (${role}), isSuperAdmin: ${isSuperAdmin}`);

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'support', 'internal', 'all'
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check if user is super admin or admin (can see everything)
    const isFullAdmin = isSuperAdmin || role === 'admin' || role === 'Admin' || role === 'Full Admin';

    // Get assigned customer IDs for non-admin employees
    let assignedCustomerIds: string[] = [];
    if (!isFullAdmin) {
      const assignments = await db.collection('customer_assignments').find({
        employeeId: adminId,
        isActive: true,
      }).toArray();
      assignedCustomerIds = assignments.map(a => a.customerId?.toString()).filter(Boolean);
      console.log(`📥 [GetConv] Employee ${email} has ${assignedCustomerIds.length} assigned customers`);
    }

    // Build query based on user type and filter
    const query: any = {};

    if (type === 'support') {
      query.type = 'user-to-support';
      
      // Non-admin employees can only see their assigned customers' conversations
      if (!isFullAdmin) {
        query.$or = [
          // Conversations with assigned customers (check participants)
          { 'participants.id': { $in: assignedCustomerIds } },
          // Or conversations directly assigned to this employee
          { assignedEmployeeId: new Types.ObjectId(adminId) },
        ];
      }
    } else if (type === 'internal') {
      query.type = 'employee-internal';
      // Internal chats - only show conversations where current user is a participant
      query['participants.id'] = adminId;
    } else {
      // All conversations
      if (isFullAdmin) {
        query.$or = [
          { type: 'user-to-support' },
          { type: 'employee-internal', 'participants.id': adminId }
        ];
      } else {
        // Non-admin: Only their assigned customers' support convos + internal convos they're in
        query.$or = [
          { 
            type: 'user-to-support',
            $or: [
              { 'participants.id': { $in: assignedCustomerIds } },
              { assignedEmployeeId: new Types.ObjectId(adminId) },
            ]
          },
          { type: 'employee-internal', 'participants.id': adminId }
        ];
      }
    }

    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    console.log(`📥 [GetConv] Query:`, JSON.stringify(query, null, 2));

    const conversations = await db.collection('conversations')
      .find(query)
      .sort({ lastActivityAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await db.collection('conversations').countDocuments(query);

    console.log(`📥 [GetConv] Found ${conversations.length} conversations (total: ${total})`);

    // Map conversations with proper unread counts
    const mappedConversations = conversations.map((conv: any) => {
      let unreadCount = 0;
      if (conv.unreadCounts) {
        if (typeof conv.unreadCounts.get === 'function') {
          unreadCount = conv.unreadCounts.get(adminId) || 0;
        } else if (typeof conv.unreadCounts === 'object') {
          unreadCount = conv.unreadCounts[adminId] || 0;
        }
      }

      // Find the customer in participants (for support conversations)
      const customer = conv.participants?.find((p: any) => p.type === 'user');

      return {
        id: conv._id.toString(),
        type: conv.type,
        status: conv.status,
        participants: conv.participants?.filter((p: any) => p.isActive) || [],
        customer: customer ? {
          id: customer.id,
          name: customer.name,
          avatar: customer.avatar,
        } : null,
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
    });

    return NextResponse.json({
      conversations: mappedConversations,
      total,
      hasMore: offset + limit < total,
      isFullAdmin,
      assignedCustomerCount: assignedCustomerIds.length,
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as DecodedToken;
    const { adminId, email, name } = decoded;

    console.log(`💬 [CreateConv] Request from: ${email}, adminId: ${adminId}`);

    const body = await request.json();
    const { participantIds, participantNames, title, type: convType, customerId, customerName } = body;

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    // Creating conversation with a customer (admin initiating chat with customer)
    if (convType === 'user-to-support' && customerId) {
      console.log(`💬 [CreateConv] Creating/finding support conversation with customer: ${customerName} (${customerId})`);
      
      // Find existing conversation with this customer
      let conversation = await db.collection('conversations').findOne({
        type: 'user-to-support',
        status: { $ne: 'closed' },
        'participants.id': customerId,
        'participants.type': 'user',
      });

      if (conversation) {
        // Add employee as participant if not already
        const hasEmployee = conversation.participants?.some((p: any) => p.id === adminId);
        if (!hasEmployee) {
          await db.collection('conversations').updateOne(
            { _id: conversation._id },
            {
              $push: {
                participants: {
                  id: adminId,
                  type: 'employee',
                  name: name || email.split('@')[0],
                  joinedAt: new Date(),
                  isActive: true,
                }
              },
              $set: {
                assignedEmployeeId: new Types.ObjectId(adminId),
                assignedEmployeeName: name || email.split('@')[0],
                lastActivityAt: new Date(),
              }
            }
          );
        }

        return NextResponse.json({
          conversation: {
            id: conversation._id.toString(),
            type: conversation.type,
            status: conversation.status,
            participants: conversation.participants,
            existing: true,
          },
        });
      }

      // Create new support conversation
      const result = await db.collection('conversations').insertOne({
        type: 'user-to-support',
        status: 'active',
        participants: [
          {
            id: customerId,
            type: 'user',
            name: customerName || 'Customer',
            joinedAt: new Date(),
            isActive: true,
          },
          {
            id: adminId,
            type: 'employee',
            name: name || email.split('@')[0],
            joinedAt: new Date(),
            isActive: true,
          }
        ],
        assignedEmployeeId: new Types.ObjectId(adminId),
        assignedEmployeeName: name || email.split('@')[0],
        isAIHandled: false,
        unreadCounts: {},
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return NextResponse.json({
        conversation: {
          id: result.insertedId.toString(),
          type: 'user-to-support',
          status: 'active',
          createdAt: new Date(),
        },
      });
    }

    // Internal employee conversation
    if (!participantIds || participantIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one participant is required' },
        { status: 400 }
      );
    }

    console.log(`💬 [CreateConv] Creating internal conversation with: ${participantIds}`);

    // For 1-to-1 internal chat, check if already exists
    if (participantIds.length === 1) {
      const existingConv = await db.collection('conversations').findOne({
        type: 'employee-internal',
        status: { $ne: 'closed' },
        'participants.id': { $all: [adminId, participantIds[0]] },
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
        id: adminId,
        type: 'employee',
        name: name || email.split('@')[0],
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
