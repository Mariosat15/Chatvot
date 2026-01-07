import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { SignJWT } from 'jose';
import { auditLogService } from '@/lib/services/audit-log.service';

const SECRET_KEY = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
);

// All available admin sections for super admin
const ALL_ADMIN_SECTIONS = [
  'overview', 'hero-page', 'marketplace', 'competitions', 'challenges',
  'trading-history', 'analytics', 'market', 'symbols', 'users', 'badges',
  'financial', 'payments', 'failed-deposits', 'withdrawals', 'pending-withdrawals',
  'kyc-settings', 'kyc-history', 'fraud', 'wiki', 'credentials', 'email-templates',
  'notifications', 'payment-providers', 'fee', 'invoicing', 'reconciliation',
  'database', 'ai-agent', 'whitelabel', 'audit-logs', 'employees'
];

// Check if admin is the original/super admin
async function isOriginalAdmin(admin: any): Promise<boolean> {
  const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@email.com').toLowerCase();
  const isDefaultEmail = admin.email.toLowerCase() === defaultAdminEmail;
  
  const oldestAdmin = await Admin.findOne({}).sort({ createdAt: 1 }).select('_id');
  const isFirstAdmin = oldestAdmin && oldestAdmin._id.toString() === admin._id.toString();
  
  return isDefaultEmail || isFirstAdmin;
}

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

    // Check if employee account is disabled
    if (admin.status === 'disabled') {
      return NextResponse.json(
        { error: 'Your account has been disabled. Contact the administrator.' },
        { status: 403 }
      );
    }

    // Check if temporary password has expired
    if (admin.tempPasswordExpiresAt && new Date() > new Date(admin.tempPasswordExpiresAt)) {
      return NextResponse.json(
        { error: 'Your temporary password has expired. Please contact the administrator to reset your password.' },
        { status: 403 }
      );
    }

    // Verify password
    console.log(`🔐 Verifying password for ${admin.email}`);
    console.log(`🔐 Input password length: ${password.length}`);
    console.log(`🔐 Stored hash starts with: ${admin.password.substring(0, 10)}...`);
    
    const isValidPassword = await admin.comparePassword(password);
    console.log(`🔐 Password valid: ${isValidPassword}`);
    
    if (!isValidPassword) {
      console.log(`❌ Invalid password for ${admin.email}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Determine if this is the super admin
    const isSuperAdmin = await isOriginalAdmin(admin);
    
    // Get allowed sections - super admin gets all, others get their assigned sections
    const allowedSections = isSuperAdmin ? ALL_ADMIN_SECTIONS : (admin.allowedSections || []);
    const role = isSuperAdmin ? 'Super Admin' : (admin.role || 'Employee');

    // Update last login
    admin.lastLogin = new Date();
    admin.isOnline = true;
    await Admin.updateOne({ _id: admin._id }, { lastLogin: new Date(), isOnline: true });

    // Generate JWT with role and sections
    const adminId = (admin._id as any).toString();
    const token = await new SignJWT({ 
      adminId, 
      email: admin.email,
      role,
      isSuperAdmin,
      allowedSections,
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
        role,
        isSuperAdmin,
        allowedSections,
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
        role,
      });
    } catch (auditError) {
      console.error('Failed to log admin login:', auditError);
    }

    console.log(`✅ Admin logged in: ${admin.email} (${role}) - Sections: ${allowedSections.length}`);
    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
