import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { SignJWT } from 'jose';
import { auditLogService } from '@/lib/services/audit-log.service';

const SECRET_KEY = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
);

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find admin
    let admin = await Admin.findOne({ email: email.toLowerCase() });

    // If no admin exists, create default admin (first time setup)
    if (!admin) {
      const defaultEmail = process.env.ADMIN_EMAIL || 'admin@email.com';
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

      if (email.toLowerCase() === defaultEmail.toLowerCase() && password === defaultPassword) {
        admin = new Admin({
          email: defaultEmail.toLowerCase(),
          password: defaultPassword,
          isFirstLogin: true,
        });
        await admin.save();
      } else {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }
    }

    // Verify password
    const isValidPassword = await admin.comparePassword(password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT
    const adminId = (admin._id as any).toString();
    const token = await new SignJWT({ 
      adminId, 
      email: admin.email 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(SECRET_KEY);

    const response = NextResponse.json({
      success: true,
      isFirstLogin: admin.isFirstLogin,
      admin: {
        id: adminId,
        email: admin.email,
      },
    });

    // Set HTTP-only cookie
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Log admin login
    try {
      await auditLogService.logAdminLogin({
        id: adminId,
        email: admin.email,
        name: admin.name || admin.email.split('@')[0],
        role: 'admin',
      });
    } catch (auditError) {
      console.error('Failed to log admin login:', auditError);
    }

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
