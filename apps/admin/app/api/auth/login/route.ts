import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { SignJWT } from 'jose';
import { auditLogService } from '@/lib/services/audit-log.service';

// All available admin sections - defined here to avoid circular import issues
const ALL_ADMIN_SECTIONS = [
  'overview', 'hero-page', 'marketplace', 'competitions', 'challenges',
  'trading-history', 'analytics', 'market', 'symbols', 'users', 'badges',
  'financial', 'payments', 'failed-deposits', 'withdrawals', 'pending-withdrawals',
  'kyc-settings', 'kyc-history', 'fraud', 'wiki', 'credentials', 'email-templates',
  'notifications', 'payment-providers', 'fee', 'invoicing', 'reconciliation',
  'database', 'ai-agent', 'whitelabel', 'audit-logs', 'employees',
];

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
    let isNewSuperAdmin = false;

    // If no admin exists, create default admin (first time setup - this is the SUPER ADMIN)
    if (!admin) {
      const defaultEmail = process.env.ADMIN_EMAIL || 'admin@email.com';
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

      if (email === defaultEmail && password === defaultPassword) {
        // Count existing admins to determine if this is the first one
        const adminCount = await Admin.countDocuments();
        
        admin = new Admin({
          email: defaultEmail,
          password: defaultPassword,
          isFirstLogin: true,
          isSuperAdmin: adminCount === 0, // First admin is always super admin
          role: 'Super Admin',
          allowedSections: [...ALL_ADMIN_SECTIONS], // Super admin has access to everything
        });
        await admin.save();
        isNewSuperAdmin = adminCount === 0;
        
        console.log(`🔐 ${isNewSuperAdmin ? 'Super Admin' : 'Admin'} created: ${defaultEmail}`);
      } else {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }
    }

    // Check if this existing admin needs to be marked as super admin (migration)
    if (!admin.isSuperAdmin) {
      const superAdminExists = await Admin.exists({ isSuperAdmin: true });
      if (!superAdminExists) {
        // This is the first admin ever - mark as super admin
        admin.isSuperAdmin = true;
        admin.role = 'Super Admin';
        admin.allowedSections = [...ALL_ADMIN_SECTIONS];
        await admin.save();
        console.log(`🔐 Migrated existing admin to Super Admin: ${admin.email}`);
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

    // Update last login and online status
    admin.lastLogin = new Date();
    admin.lastActivity = new Date();
    admin.isOnline = true;
    await admin.save();

    // Generate JWT with role information
    const adminId = (admin._id as any).toString();
    const token = await new SignJWT({ 
      adminId, 
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin,
      role: admin.role || 'admin',
      allowedSections: admin.allowedSections || [],
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
        name: admin.name,
        isSuperAdmin: admin.isSuperAdmin,
        role: admin.role || 'admin',
        allowedSections: admin.isSuperAdmin ? ALL_ADMIN_SECTIONS : (admin.allowedSections || []),
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
        role: admin.role || 'admin',
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

