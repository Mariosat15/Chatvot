import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';

/**
 * GET /api/messaging/assigned-customers
 * Get customers assigned to the current employee
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
      isSuperAdmin?: boolean;
    };

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ customers: [] });
    }

    console.log(`🔍 [Messaging] Fetching assigned customers for employee: ${decoded.email} (ID: ${decoded.adminId})`);

    // Convert adminId to ObjectId for comparison
    let employeeObjectId;
    try {
      employeeObjectId = new mongoose.Types.ObjectId(decoded.adminId);
    } catch {
      console.log(`⚠️ [Messaging] Could not convert adminId to ObjectId: ${decoded.adminId}`);
    }

    // Get assignments for this employee (try both string and ObjectId formats)
    const query = {
      $or: [
        { employeeId: decoded.adminId },
        { employeeId: decoded.adminId?.toString() },
        ...(employeeObjectId ? [{ employeeId: employeeObjectId }] : []),
      ]
    };
    
    console.log(`🔍 [Messaging] Query:`, JSON.stringify(query));
    
    const assignments = await db.collection('customer_assignments')
      .find(query)
      .toArray();

    console.log(`📋 [Messaging] Found ${assignments.length} customer assignments`);
    if (assignments.length > 0) {
      console.log(`📋 [Messaging] First assignment:`, JSON.stringify(assignments[0]));
    }

    if (assignments.length === 0) {
      return NextResponse.json({ customers: [] });
    }

    // Get customer details
    const customerIds = assignments.map(a => a.customerId);
    const customers = await db.collection('user')
      .find({ _id: { $in: customerIds.map(id => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return id;
        }
      }) } })
      .project({ _id: 1, name: 1, email: 1, image: 1, createdAt: 1 })
      .toArray();

    // Map customer data with assignment info
    const customersWithAssignment = customers.map(customer => {
      const assignment = assignments.find(a => a.customerId === customer._id.toString());
      return {
        id: customer._id.toString(),
        name: customer.name || customer.email?.split('@')[0] || 'Unknown',
        email: customer.email,
        avatar: customer.image,
        assignedAt: assignment?.assignedAt,
        department: assignment?.department,
      };
    });

    return NextResponse.json({ customers: customersWithAssignment });
  } catch (error) {
    console.error('Error fetching assigned customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assigned customers', customers: [] },
      { status: 500 }
    );
  }
}

