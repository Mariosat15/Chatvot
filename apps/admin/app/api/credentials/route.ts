import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { WhiteLabel } from '@/database/models/whitelabel.model';
import { requireAdminAuth } from '@/lib/admin/auth';
import fs from 'fs/promises';
import path from 'path';
import { auditLogService } from '@/lib/services/audit-log.service';

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    const { email, currentPassword, newPassword, name } = await request.json();

    if (!email || !currentPassword) {
      return NextResponse.json(
        { error: 'Email and current password are required' },
        { status: 400 }
      );
    }

    // Find admin by ID from auth
    const admin = await Admin.findById(auth.adminId);
    if (!admin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isValidPassword = await admin.comparePassword(currentPassword);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Update email
    admin.email = email.toLowerCase();

    // Update name if provided
    if (name && name.trim()) {
      admin.name = name.trim();
    }

    // Update password if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }
      admin.password = newPassword;
    }

    // Mark as not first login anymore
    admin.isFirstLogin = false;

    await admin.save();

    console.log('✅ Admin model updated in database');

    // Also update WhiteLabel settings
    let settings = await WhiteLabel.findOne();
    if (!settings) {
      settings = new WhiteLabel();
    }
    
    settings.adminEmail = email.toLowerCase();
    if (newPassword) {
      settings.adminPassword = newPassword;
    }
    
    await settings.save();
    console.log('✅ WhiteLabel model updated in database');
    console.log('   - adminEmail:', settings.adminEmail);
    console.log('   - adminPassword:', newPassword ? '[SET]' : '[UNCHANGED]');

    // Update .env file
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = await fs.readFile(envPath, 'utf-8');
      
      // Update ADMIN_EMAIL
      if (envContent.includes('ADMIN_EMAIL=')) {
        envContent = envContent.replace(/^ADMIN_EMAIL=.*$/m, `ADMIN_EMAIL=${settings.adminEmail}`);
        console.log('✏️  Updated ADMIN_EMAIL in .env:', settings.adminEmail);
      }
      
      // Update ADMIN_PASSWORD if new password provided
      if (newPassword && envContent.includes('ADMIN_PASSWORD=')) {
        envContent = envContent.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${newPassword}`);
        console.log('✏️  Updated ADMIN_PASSWORD in .env');
      }
      
      await fs.writeFile(envPath, envContent, 'utf-8');
      console.log('✅ .env file updated successfully');
    } catch (envError) {
      console.error('❌ Failed to update .env file:', envError);
      // Don't fail the request if .env update fails
    }

    // Revalidate admin pages
    revalidatePath('/admin/dashboard');

    // Log audit action
    try {
      await auditLogService.logSettingsUpdated(
        {
          id: auth.adminId || 'admin',
          email: admin.email,
          name: admin.email.split('@')[0],
          role: 'admin',
        },
        'Admin Credentials',
        undefined,
        { emailChanged: true, passwordChanged: !!newPassword }
      );
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      email: admin.email,
      name: admin.name || 'Admin',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.error('Update credentials error:', error);
    return NextResponse.json(
      { error: 'Failed to update credentials' },
      { status: 500 }
    );
  }
}

