import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * GET /api/messaging/assigned-support
 * Get the user's assigned support agent (account manager)
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
      return NextResponse.json({ assignedAgent: null });
    }

    console.log(`🔍 [Support] Looking for assignment for user: ${session.user.id}`);

    // Check if user has an assigned employee (try both string and ObjectId formats)
    const assignment = await db.collection('customer_assignments').findOne({
      $or: [
        { customerId: session.user.id },
        { customerId: session.user.id.toString() },
      ]
    });

    console.log(`📋 [Support] Assignment found:`, assignment ? 'Yes' : 'No');

    if (!assignment || !assignment.employeeId) {
      return NextResponse.json({ assignedAgent: null });
    }

    // Get employee details
    const employee = await db.collection('admins').findOne({
      _id: new mongoose.Types.ObjectId(assignment.employeeId),
      status: 'active',
    });

    if (!employee) {
      return NextResponse.json({ assignedAgent: null });
    }

    return NextResponse.json({
      assignedAgent: {
        id: employee._id.toString(),
        name: employee.name || employee.email.split('@')[0],
        email: employee.email,
        role: assignment.department || employee.role,
        avatar: employee.profileImage,
        assignedAt: assignment.assignedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching assigned support:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assigned support', assignedAgent: null },
      { status: 500 }
    );
  }
}

