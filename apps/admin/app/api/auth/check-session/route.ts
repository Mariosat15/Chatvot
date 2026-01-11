import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
);

/**
 * Session Check Endpoint
 * 
 * Called periodically by the client to verify session validity.
 * Returns { valid: false } if:
 * - Token is invalid/expired
 * - Admin account is disabled
 * - Admin was force logged out
 * - Token was issued before password change
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ valid: false, reason: 'no_token' });
    }

    // Verify JWT
    let payload: any;
    try {
      const verified = await jwtVerify(token, SECRET_KEY);
      payload = verified.payload;
    } catch {
      return NextResponse.json({ valid: false, reason: 'invalid_token' });
    }

    await connectToDatabase();

    // Get admin from database
    const admin = await Admin.findById(payload.adminId).select(
      'status forceLogoutAt passwordChangedAt isLockedOut'
    );

    if (!admin) {
      return NextResponse.json({ valid: false, reason: 'admin_not_found' });
    }

    // Check if account is disabled
    if (admin.status === 'disabled') {
      return NextResponse.json({ 
        valid: false, 
        reason: 'account_disabled',
        message: 'Your account has been suspended. Please contact the administrator.'
      });
    }

    // Check if account is locked out (toggle-based)
    // IMPORTANT: Treat undefined as false (not locked out)
    if ((admin as any).isLockedOut === true) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'locked_out',
        message: 'You have been logged out by an administrator. Contact the administrator to regain access.'
      });
    }

    // Check if force logged out
    if (admin.forceLogoutAt) {
      const tokenIssuedAt = new Date((payload.iat || 0) * 1000);
      if (tokenIssuedAt < new Date(admin.forceLogoutAt)) {
        return NextResponse.json({ 
          valid: false, 
          reason: 'force_logout',
          message: 'Your session has been terminated by an administrator.'
        });
      }
    }

    // Check if password was changed after token was issued
    if (admin.passwordChangedAt) {
      const tokenIssuedAt = new Date((payload.iat || 0) * 1000);
      if (tokenIssuedAt < new Date(admin.passwordChangedAt)) {
        return NextResponse.json({ 
          valid: false, 
          reason: 'password_changed',
          message: 'Your password was changed. Please log in again.'
        });
      }
    }

    // Update last activity
    await Admin.updateOne(
      { _id: payload.adminId },
      { lastActivity: new Date(), isOnline: true }
    );

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}

