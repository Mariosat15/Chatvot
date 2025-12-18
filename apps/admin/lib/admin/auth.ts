import { jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';

const SECRET_KEY = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
);

export async function verifyAdminAuth(): Promise<{
  isAuthenticated: boolean;
  adminId?: string;
  email?: string;
  name?: string;
}> {
  try {
    // Try cookie-based auth first
    const cookieStore = await cookies();
    let token = cookieStore.get('admin_token')?.value;

    // If no cookie, try Bearer token from Authorization header
    if (!token) {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return { isAuthenticated: false };
    }

    const { payload } = await jwtVerify(token, SECRET_KEY);
    
    // Fetch admin name from database
    let adminName = 'Admin';
    try {
      await connectToDatabase();
      const admin = await Admin.findById(payload.adminId).select('name').lean();
      if (admin?.name) {
        adminName = admin.name;
      }
    } catch (dbError) {
      console.error('Error fetching admin name:', dbError);
    }

    return {
      isAuthenticated: true,
      adminId: payload.adminId as string,
      email: payload.email as string,
      name: adminName,
    };
  } catch {
    return { isAuthenticated: false };
  }
}

export async function requireAdminAuth() {
  const auth = await verifyAdminAuth();
  
  if (!auth.isAuthenticated) {
    throw new Error('Unauthorized');
  }
  
  return auth;
}

/**
 * Get current admin session info (returns null if not authenticated)
 */
export async function getAdminSession(): Promise<{
  id: string;
  email: string;
  name?: string;
} | null> {
  try {
    const auth = await verifyAdminAuth();
    
    if (!auth.isAuthenticated || !auth.adminId || !auth.email) {
      return null;
    }
    
    return {
      id: auth.adminId,
      email: auth.email,
      name: auth.name,
    };
  } catch {
    return null;
  }
}

