import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserRestriction from '@/database/models/user-restriction.model';
import bcrypt from 'bcryptjs';

/**
 * POST /api/admin/fraud/unrestrict
 * Unrestrict users (unban/unsuspend)
 */
export async function POST(request: NextRequest) {
  try {
    const { userIds, adminPassword } = await request.json();

    console.log('🔓 Unrestrict request:', { userIds, hasPassword: !!adminPassword });

    // Validate input
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User IDs required (must be an array)' },
        { status: 400 }
      );
    }

    if (!adminPassword) {
      return NextResponse.json(
        { success: false, message: 'Admin password required' },
        { status: 400 }
      );
    }

    // Verify admin password
    const envPassword = process.env.ADMIN_PASSWORD;
    if (!envPassword) {
      return NextResponse.json({
        success: false,
        message: 'Admin password not configured'
      }, { status: 500 });
    }

    const isPasswordValid = envPassword.startsWith('$2a$') || envPassword.startsWith('$2b$')
      ? await bcrypt.compare(adminPassword, envPassword)
      : adminPassword === envPassword;

    if (!isPasswordValid) {
      return NextResponse.json({
        success: false,
        message: 'Invalid admin password'
      }, { status: 401 });
    }

    await connectToDatabase();

    // Unrestrict all specified users by marking restrictions as inactive
    const result = await UserRestriction.updateMany(
      { 
        userId: { $in: userIds },
        isActive: true 
      },
      { 
        $set: { isActive: false },
        $currentDate: { updatedAt: true }
      }
    );

    console.log(`✅ Unrestricted ${result.modifiedCount} user(s):`, userIds);

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'No active restrictions found for these users' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully unrestricted ${result.modifiedCount} user(s)`,
      unrestrictedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Error unrestricting users:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

