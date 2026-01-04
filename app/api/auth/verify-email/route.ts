import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken, resendVerificationEmail } from '@/lib/services/email-verification.service';

/**
 * GET /api/auth/verify-email
 * Verify email with token from email link
 */
export async function GET(request: NextRequest) {
  // Get base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');
    
    console.log('📧 Email verification request:', { token: token?.substring(0, 10) + '...', userId });
    
    if (!token || !userId) {
      console.log('❌ Missing token or userId');
      return NextResponse.redirect(`${baseUrl}/sign-in?verification=invalid`);
    }
    
    const result = await verifyEmailToken(token, userId);
    console.log('📧 Verification result:', result);
    
    if (result.success) {
      // Redirect to sign-in with success message
      console.log('✅ Email verified successfully, redirecting to sign-in');
      return NextResponse.redirect(`${baseUrl}/sign-in?verification=success`);
    } else {
      // Redirect to sign-in with error
      const errorParam = result.error?.includes('expired') ? 'expired' : 'invalid';
      console.log(`❌ Verification failed: ${result.error}`);
      return NextResponse.redirect(`${baseUrl}/sign-in?verification=${errorParam}`);
    }
  } catch (error) {
    console.error('❌ Email verification error:', error);
    return NextResponse.redirect(`${baseUrl}/sign-in?verification=error`);
  }
}

/**
 * POST /api/auth/verify-email
 * Resend verification email
 * Can be called with email in body OR uses logged-in user's email
 */
export async function POST(request: NextRequest) {
  try {
    // Try to get email from body first
    let email: string | undefined;
    
    try {
      const body = await request.json();
      email = body.email;
    } catch {
      // No body or invalid JSON - try to get from session
    }
    
    // If no email in body, try to get from logged-in user's session
    if (!email) {
      const { auth } = await import('@/lib/better-auth/auth');
      const { headers } = await import('next/headers');
      const session = await auth.api.getSession({ headers: await headers() });
      
      if (session?.user?.email) {
        email = session.user.email;
      }
    }
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    const result = await resendVerificationEmail(email);
    
    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    );
  }
}

