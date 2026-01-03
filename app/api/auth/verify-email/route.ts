import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken, resendVerificationEmail } from '@/lib/services/email-verification.service';

/**
 * GET /api/auth/verify-email
 * Verify email with token from email link
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');
    
    if (!token || !userId) {
      // Redirect to sign-in with error
      return NextResponse.redirect(
        new URL('/sign-in?verification=invalid', request.url)
      );
    }
    
    const result = await verifyEmailToken(token, userId);
    
    if (result.success) {
      // Redirect to sign-in with success message
      return NextResponse.redirect(
        new URL('/sign-in?verification=success', request.url)
      );
    } else {
      // Redirect to sign-in with error
      const errorParam = result.error?.includes('expired') ? 'expired' : 'invalid';
      return NextResponse.redirect(
        new URL(`/sign-in?verification=${errorParam}`, request.url)
      );
    }
  } catch (error) {
    console.error('❌ Email verification error:', error);
    return NextResponse.redirect(
      new URL('/sign-in?verification=error', request.url)
    );
  }
}

/**
 * POST /api/auth/verify-email
 * Resend verification email
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
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

