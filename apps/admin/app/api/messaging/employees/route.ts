import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * GET /api/messaging/employees
 * Get list of employees for internal messaging
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jwtSecret = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';
    const decoded = verify(token, jwtSecret) as {
      id: string;
      email: string;
      role: string;
    };

    await connectToDatabase();

    const Admin = mongoose.models.Admin || 
      mongoose.model('Admin', new mongoose.Schema({}, { strict: false, collection: 'admins' }));

    // Get all active employees except current user
    let currentUserId;
    try {
      currentUserId = new mongoose.Types.ObjectId(decoded.id);
    } catch {
      currentUserId = decoded.id;
    }

    const employees = await Admin.find({
      _id: { $ne: currentUserId },
      status: 'active',
      isLockedOut: { $ne: true },
    }).select('_id name email role avatar lastLoginAt profileImage');
    
    console.log(`📧 [Messaging] Fetched ${employees.length} employees for internal chat (excluding ${decoded.email})`);

    // Get online status from presence collection
    const UserPresence = mongoose.models.UserPresence || 
      mongoose.model('UserPresence', new mongoose.Schema({}, { strict: false, collection: 'user_presence' }));

    const employeeIds = employees.map((e: any) => e._id.toString());
    const presences = await UserPresence.find({
      participantId: { $in: employeeIds },
      participantType: 'employee',
    }).select('participantId status lastSeen');

    const presenceMap = new Map(
      presences.map((p: any) => [p.participantId, { status: p.status, lastSeen: p.lastSeen }])
    );

    return NextResponse.json({
      employees: employees.map((emp: any) => {
        const presence = presenceMap.get(emp._id.toString());
        return {
          id: emp._id.toString(),
          name: emp.name || emp.email?.split('@')[0] || 'Employee',
          email: emp.email,
          role: emp.role,
          avatar: emp.profileImage || emp.avatar,
          status: presence?.status || 'offline',
          lastSeen: presence?.lastSeen,
          lastLoginAt: emp.lastLoginAt,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

