import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { ADMIN_SECTIONS } from '@/database/models/admin-employee.model';
import { verifyAdminAuth } from '@/lib/admin/auth';

// POST - Upgrade current admin to super admin (only if no super admin exists)
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Check if any super admin exists
    const superAdminExists = await Admin.findOne({ isSuperAdmin: true });
    
    if (superAdminExists) {
      // If super admin exists and it's the current user, just confirm
      if (superAdminExists._id.toString() === auth.adminId) {
        return NextResponse.json({
          success: true,
          message: 'You are already the super admin',
          admin: {
            id: superAdminExists._id.toString(),
            email: superAdminExists.email,
            name: superAdminExists.name,
            isSuperAdmin: true,
          },
        });
      }
      
      return NextResponse.json({
        error: 'A super admin already exists. Contact them for access.',
      }, { status: 403 });
    }

    // No super admin exists - upgrade current admin
    const admin = await Admin.findById(auth.adminId);
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    admin.isSuperAdmin = true;
    admin.role = 'Super Admin';
    admin.allowedSections = [...ADMIN_SECTIONS];
    await admin.save();

    console.log(`🔐 Upgraded admin to Super Admin: ${admin.email}`);

    return NextResponse.json({
      success: true,
      message: 'You have been upgraded to Super Admin! Please log out and log back in.',
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        isSuperAdmin: true,
      },
    });
  } catch (error) {
    console.error('Error upgrading to super admin:', error);
    return NextResponse.json({ error: 'Failed to upgrade' }, { status: 500 });
  }
}

// GET - Check super admin status
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const admin = await Admin.findById(auth.adminId).select('-password');
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const superAdminCount = await Admin.countDocuments({ isSuperAdmin: true });

    return NextResponse.json({
      success: true,
      currentAdmin: {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        isSuperAdmin: admin.isSuperAdmin || false,
        role: admin.role,
        allowedSections: admin.allowedSections || [],
      },
      superAdminCount,
      needsUpgrade: superAdminCount === 0,
    });
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

