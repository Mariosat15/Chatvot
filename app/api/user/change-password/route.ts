import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

/**
 * POST /api/user/change-password
 * Change the current user's password
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // Use better-auth's changePassword API
    try {
      await auth.api.changePassword({
        body: {
          currentPassword,
          newPassword,
        },
        headers: await headers(),
      });

      console.log(`✅ Password changed for user: ${session.user.email}`);

      return NextResponse.json({ success: true, message: 'Password changed successfully' });
    } catch (authError: any) {
      console.error('Password change error:', authError);
      
      // Handle specific error cases
      if (authError.message?.includes('incorrect') || authError.message?.includes('invalid')) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      
      return NextResponse.json({ error: 'Failed to change password. Please check your current password.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}

