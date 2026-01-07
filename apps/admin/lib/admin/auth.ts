import { jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { ADMIN_SECTIONS, type AdminSection } from '@/database/models/admin-employee.model';

const SECRET_KEY = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
);

export interface AdminAuthResult {
  isAuthenticated: boolean;
  adminId?: string;
  email?: string;
  name?: string;
  isSuperAdmin?: boolean;
  role?: string;
  allowedSections?: AdminSection[];
}

export async function verifyAdminAuth(): Promise<AdminAuthResult> {
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
    
    // Fetch admin details from database for fresh data
    // This also validates that the admin still exists (wasn't deleted)
    let adminName = 'Admin';
    let isSuperAdmin = payload.isSuperAdmin as boolean || false;
    let role = payload.role as string || 'admin';
    let allowedSections = payload.allowedSections as AdminSection[] || [];
    
    try {
      await connectToDatabase();
      const admin = await Admin.findById(payload.adminId)
        .select('name email role allowedSections status createdAt')
        .lean();
      
      // If admin doesn't exist anymore (deleted), return unauthenticated
      if (!admin) {
        console.log(`❌ Admin ${payload.adminId} no longer exists - session invalidated`);
        return { isAuthenticated: false };
      }
      
      // If admin is disabled, return unauthenticated
      if (admin.status === 'disabled') {
        console.log(`❌ Admin ${admin.email} is disabled - session invalidated`);
        return { isAuthenticated: false };
      }
      
      adminName = admin.name || 'Admin';
      
      // Determine if this is the original/super admin (check by email or first created)
      const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@email.com').toLowerCase();
      const oldestAdmin = await Admin.findOne({}).sort({ createdAt: 1 }).select('_id');
      const isOriginalAdmin = admin.email.toLowerCase() === defaultAdminEmail || 
        (oldestAdmin && oldestAdmin._id.toString() === (admin._id as any).toString());
      
      isSuperAdmin = isOriginalAdmin;
      role = isOriginalAdmin ? 'Super Admin' : (admin.role || 'Employee');
      
      // Super admins have access to all sections, others get their assigned sections
      allowedSections = isOriginalAdmin ? [...ADMIN_SECTIONS] : (admin.allowedSections as AdminSection[] || []);
    } catch (dbError) {
      console.error('Error fetching admin details:', dbError);
      // On database error, be safe and invalidate session
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      adminId: payload.adminId as string,
      email: payload.email as string,
      name: adminName,
      isSuperAdmin,
      role,
      allowedSections,
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
 * Check if admin has access to a specific section
 */
export function hasAccessToSection(auth: AdminAuthResult, section: AdminSection): boolean {
  if (!auth.isAuthenticated) return false;
  if (auth.isSuperAdmin) return true;
  return auth.allowedSections?.includes(section) || false;
}

/**
 * Require admin to have access to specific section
 */
export async function requireSectionAccess(section: AdminSection): Promise<AdminAuthResult> {
  const auth = await verifyAdminAuth();
  
  if (!auth.isAuthenticated) {
    throw new Error('Unauthorized');
  }
  
  if (!hasAccessToSection(auth, section)) {
    throw new Error(`Access denied to section: ${section}`);
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
  isSuperAdmin?: boolean;
  role?: string;
  allowedSections?: AdminSection[];
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
      isSuperAdmin: auth.isSuperAdmin,
      role: auth.role,
      allowedSections: auth.allowedSections,
    };
  } catch {
    return null;
  }
}

