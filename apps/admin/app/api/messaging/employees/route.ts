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
      console.log('❌ [Employees] No admin token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jwtSecret = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';
    const decoded = verify(token, jwtSecret) as {
      adminId: string;
      email: string;
      role: string;
    };

    console.log(`📧 [Employees] Request from: ${decoded.email}, adminId: ${decoded.adminId}`);

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      console.log('❌ [Employees] Database not connected');
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    // Get all active employees except current user
    let currentUserId: mongoose.Types.ObjectId;
    try {
      currentUserId = new mongoose.Types.ObjectId(decoded.adminId);
    } catch {
      console.log(`❌ [Employees] Invalid adminId: ${decoded.adminId}`);
      return NextResponse.json({ error: 'Invalid admin ID' }, { status: 400 });
    }

    console.log(`📧 [Employees] Current user ObjectId: ${currentUserId}`);

    // Use raw collection for more reliable query
    const allAdmins = await db.collection('admins').find({}).toArray();
    console.log(`📧 [Employees] Total admins in DB: ${allAdmins.length}`);
    allAdmins.forEach((admin: any) => {
      console.log(`   - ${admin.email} (${admin._id}) status: ${admin.status}, role: ${admin.role}, isSuperAdmin: ${admin.isSuperAdmin}`);
    });

    // Get ALL active employees/admins (including super admin) - exclude only current user
    const employees = await db.collection('admins').find({
      _id: { $ne: currentUserId },
      $or: [
        { status: 'active' },
        { isSuperAdmin: true }, // Always include super admin
      ],
      isLockedOut: { $ne: true },
    }).toArray();
    
    console.log(`📧 [Employees] Found ${employees.length} team members (excluding current user)`);
    employees.forEach((emp: any) => {
      console.log(`   ✓ ${emp.email} (${emp.role}${emp.isSuperAdmin ? ' - SUPER ADMIN' : ''})`);
    });
    
    console.log(`📧 [Employees] Fetched ${employees.length} employees for internal chat (excluding ${decoded.email})`);

    // Get online status from presence collection
    const employeeIds = employees.map((e: any) => e._id.toString());
    
    let presenceMap = new Map();
    try {
      const presences = await db.collection('user_presence').find({
        participantId: { $in: employeeIds },
        participantType: 'employee',
      }).toArray();

      presenceMap = new Map(
        presences.map((p: any) => [p.participantId, { status: p.status, lastSeen: p.lastSeen }])
      );
    } catch (e) {
      console.log('📧 [Employees] No presence data found');
    }

    const result = employees.map((emp: any) => {
      const presence = presenceMap.get(emp._id.toString());
      return {
        id: emp._id.toString(),
        name: emp.name || emp.email?.split('@')[0] || 'Employee',
        email: emp.email,
        role: emp.isSuperAdmin ? 'Super Admin' : (emp.role || 'Employee'),
        isSuperAdmin: emp.isSuperAdmin || false,
        avatar: emp.profileImage || emp.avatar,
        status: presence?.status || (emp.isOnline ? 'online' : 'offline'),
        lastSeen: presence?.lastSeen,
        lastLoginAt: emp.lastLoginAt,
        isAvailableForChat: emp.isAvailableForChat !== false,
      };
    });

    console.log(`📧 [Employees] Returning ${result.length} employees:`, result.map(e => e.email));

    return NextResponse.json({
      employees: result,
    });
  } catch (error) {
    console.error('❌ [Employees] Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

