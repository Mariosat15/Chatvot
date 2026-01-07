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
    
    const body = await request.json();
    const { email, password } = body;

    console.log('🔐 Login attempt for:', email);

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find admin
    let admin = await Admin.findOne({ email: normalizedEmail });

    // If no admin exists, check if this is the default admin trying to login for the first time
    if (!admin) {
      const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@email.com').toLowerCase().trim();
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

      console.log('🔐 No admin found, checking default credentials...');
      console.log('🔐 Default email:', defaultEmail);
      console.log('🔐 Provided email:', normalizedEmail);

      if (normalizedEmail === defaultEmail && password === defaultPassword) {
        // Count existing admins to determine if this is the first one
        const adminCount = await Admin.countDocuments();
        
        admin = new Admin({
          email: normalizedEmail,
          password: defaultPassword,
          name: 'Admin',
          isFirstLogin: true,
          isSuperAdmin: true, // First admin is always super admin
          role: 'Super Admin',
        });
        await admin.save();
        
        console.log(`🔐 Super Admin created: ${normalizedEmail}`);
      } else {
        console.log('🔐 Credentials do not match default');
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }
    }

    console.log('🔐 Admin found:', admin.email, 'isSuperAdmin:', admin.isSuperAdmin);

    // Verify password
    const isValidPassword = await admin.comparePassword(password);
    if (!isValidPassword) {
      console.log('🔐 Password verification failed');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('🔐 Password verified successfully');

    // Check if this existing admin needs to be marked as super admin (migration)
    // Use updateOne to avoid schema validation issues with new fields
    if (!admin.isSuperAdmin) {
      const superAdminExists = await Admin.exists({ isSuperAdmin: true });
      if (!superAdminExists) {
        // This is the first admin ever - mark as super admin
        await Admin.updateOne(
          { _id: admin._id },
          { 
            $set: { 
              isSuperAdmin: true, 
              role: 'Super Admin' 
            } 
          }
        );
        admin.isSuperAdmin = true;
        admin.role = 'Super Admin';
        console.log(`🔐 Migrated existing admin to Super Admin: ${admin.email}`);
      }
    }

    // Update last login using updateOne to avoid schema issues
    try {
      await Admin.updateOne(
        { _id: admin._id },
        { 
          $set: { 
            lastLogin: new Date(),
            isOnline: true 
          } 
        }
      );
    } catch (updateError) {
      // Non-critical, continue with login
      console.warn('Could not update last login:', updateError);
    }

    // Generate JWT with role information
    const adminId = (admin._id as any).toString();
    const token = await new SignJWT({ 
      adminId, 
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin || false,
      role: admin.role || 'admin',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(SECRET_KEY);

    console.log('🔐 JWT generated successfully');

    const response = NextResponse.json({
      success: true,
      isFirstLogin: admin.isFirstLogin || false,
      admin: {
        id: adminId,
        email: admin.email,
        name: admin.name || 'Admin',
        isSuperAdmin: admin.isSuperAdmin || false,
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

    // Log admin login (non-blocking)
    auditLogService.logAdminLogin({
      id: adminId,
      email: admin.email,
      name: admin.name || admin.email.split('@')[0],
      role: admin.role || 'admin',
    }).catch(auditError => {
      console.error('Failed to log admin login:', auditError);
    });

    console.log('🔐 Login successful for:', admin.email);
    return response;
  } catch (error) {
    console.error('❌ Admin login error:', error);
    return NextResponse.json(
      { error: 'Login failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

