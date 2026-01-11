import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';

/**
 * GET /api/employees/availability
 * Get current employee's availability status
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as {
      adminId: string;
      email: string;
    };

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const employee = await db.collection('admins').findOne({
      _id: new mongoose.Types.ObjectId(decoded.adminId),
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({
      isAvailableForChat: employee.isAvailableForChat !== false, // Default true
      unavailableReason: employee.unavailableReason,
      unavailableSince: employee.unavailableSince,
      unavailableUntil: employee.unavailableUntil,
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employees/availability
 * Update current employee's availability status
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as {
      adminId: string;
      email: string;
    };

    const body = await request.json();
    const { isAvailable, reason, untilTime } = body;

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const updateData: any = {
      isAvailableForChat: isAvailable,
    };

    if (isAvailable) {
      // Becoming available - clear unavailable fields
      updateData.unavailableReason = null;
      updateData.unavailableSince = null;
      updateData.unavailableUntil = null;
    } else {
      // Becoming unavailable
      updateData.unavailableReason = reason || 'Away';
      updateData.unavailableSince = new Date();
      updateData.unavailableUntil = untilTime ? new Date(untilTime) : null;
    }

    await db.collection('admins').updateOne(
      { _id: new mongoose.Types.ObjectId(decoded.adminId) },
      { $set: updateData }
    );

    // If becoming unavailable, redirect active conversations to another employee
    if (!isAvailable) {
      await redirectActiveConversations(decoded.adminId, decoded.email);
    }

    console.log(`📋 [Availability] ${decoded.email} is now ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}${reason ? `: ${reason}` : ''}`);

    return NextResponse.json({
      success: true,
      isAvailableForChat: isAvailable,
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    );
  }
}

/**
 * Redirect active conversations when employee becomes unavailable
 */
async function redirectActiveConversations(employeeId: string, employeeEmail: string) {
  const db = mongoose.connection.db;
  if (!db) return;

  // Find active conversations assigned to this employee
  const activeConversations = await db.collection('conversations').find({
    assignedEmployeeId: new mongoose.Types.ObjectId(employeeId),
    status: 'active',
    type: 'user-to-support',
  }).toArray();

  if (activeConversations.length === 0) return;

  // Find another available employee to redirect to
  const availableEmployee = await db.collection('admins').findOne({
    _id: { $ne: new mongoose.Types.ObjectId(employeeId) },
    status: 'active',
    isLockedOut: { $ne: true },
    isAvailableForChat: { $ne: false },
    role: { $in: ['Backoffice', 'Support Agent', 'Full Admin'] },
  });

  if (!availableEmployee) {
    console.log(`⚠️ [Availability] No available employees to redirect conversations from ${employeeEmail}`);
    return;
  }

  // Redirect each conversation
  for (const conv of activeConversations) {
    await db.collection('conversations').updateOne(
      { _id: conv._id },
      {
        $set: {
          // Store original employee for later reassignment
          originalEmployeeId: new mongoose.Types.ObjectId(employeeId),
          originalEmployeeName: (await db.collection('admins').findOne({ _id: new mongoose.Types.ObjectId(employeeId) }))?.name || employeeEmail,
          // Assign to new employee
          assignedEmployeeId: availableEmployee._id,
          assignedEmployeeName: availableEmployee.name || availableEmployee.email,
          temporarilyRedirected: true,
          redirectedAt: new Date(),
        },
        $push: {
          participants: {
            id: availableEmployee._id.toString(),
            type: 'employee',
            name: availableEmployee.name || availableEmployee.email,
            avatar: availableEmployee.profileImage,
            joinedAt: new Date(),
            isActive: true,
          }
        }
      }
    );

    // Add system message about redirection
    await db.collection('messages').insertOne({
      conversationId: conv._id,
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      content: `Your support agent is temporarily unavailable. ${availableEmployee.name || 'Another agent'} will assist you.`,
      messageType: 'system',
      status: 'sent',
      readBy: [],
      createdAt: new Date(),
    });
  }

  console.log(`📋 [Availability] Redirected ${activeConversations.length} conversations from ${employeeEmail} to ${availableEmployee.email}`);
}

