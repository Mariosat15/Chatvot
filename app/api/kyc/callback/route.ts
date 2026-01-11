import { NextRequest, NextResponse } from 'next/server';

// This route handles the redirect from Veriff after user completes verification
// The actual verification result comes via webhook, this just redirects the user

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');
  
  // Redirect user to their profile verification tab
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  console.log('📥 [KYC Callback] User returned from Veriff, session:', sessionId);
  
  // Redirect to profile with verification tab active
  return NextResponse.redirect(`${baseUrl}/profile?tab=verification`);
}

export async function POST(req: NextRequest) {
  // Veriff may also POST to callback in some configurations
  // Redirect to the proper webhook handler or handle inline
  const body = await req.json();
  
  console.log('📥 [KYC Callback POST] Received:', {
    status: body.status,
    verification: body.verification?.id,
  });
  
  // If this is a decision webhook, forward to webhook handler logic
  if (body.verification) {
    const { connectToDatabase } = await import('@/database/mongoose');
    const veriffService = (await import('@/lib/services/veriff.service')).default;
    
    try {
      await connectToDatabase();
      const signature = req.headers.get('x-hmac-signature') || '';
      await veriffService.handleDecision(body, signature);
    } catch (error) {
      console.error('Error processing callback webhook:', error);
    }
  }
  
  return NextResponse.json({ success: true });
}

