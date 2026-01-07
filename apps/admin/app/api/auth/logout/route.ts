import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';

export async function POST() {
  try {
    // Get current admin and set them offline
    const auth = await verifyAdminAuth();
    
    if (auth.isAuthenticated && auth.adminId) {
      await connectToDatabase();
      await Admin.updateOne(
        { _id: auth.adminId },
        { isOnline: false, lastActivity: new Date() }
      );
      console.log(`👋 Admin logged out: ${auth.email}`);
    }
  } catch (error) {
    console.error('Error updating admin status on logout:', error);
    // Continue with logout even if update fails
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('admin_token');
  
  return response;
}

