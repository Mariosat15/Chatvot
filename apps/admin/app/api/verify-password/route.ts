import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

/**
 * POST /api/admin/verify-password
 * Verify admin password for sensitive operations
 */
export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { success: false, message: 'Password is required' },
        { status: 400 }
      );
    }

    // Get admin password from environment
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('❌ ADMIN_PASSWORD not set in environment variables');
      return NextResponse.json(
        { success: false, message: 'Admin password not configured' },
        { status: 500 }
      );
    }

    // Check if the password is hashed or plain text
    const isHashed = adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$');
    
    let isValid = false;
    if (isHashed) {
      // Compare with hashed password
      isValid = await bcrypt.compare(password, adminPassword);
    } else {
      // Compare with plain text password
      isValid = password === adminPassword;
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password verified',
    });
  } catch (error) {
    console.error('❌ Error verifying password:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to verify password',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

