import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import veriffService from '@/lib/services/veriff.service';
import KYCSession from '@/database/models/kyc-session.model';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const signature = req.headers.get('x-hmac-signature') || '';
    const payload = await req.json();

    console.log('📥 [KYC Webhook] Received Veriff webhook:', {
      status: payload.status,
      verificationId: payload.verification?.id,
      verificationStatus: payload.verification?.status,
    });

    // Handle different webhook types
    if (payload.verification) {
      await veriffService.handleDecision(payload, signature);
    } else if (payload.action) {
      // Handle session events (started, submitted, etc.)
      await handleSessionEvent(payload);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error processing KYC webhook:', error);
    // Return 200 to prevent Veriff from retrying
    return NextResponse.json({ received: true, error: error.message }, { status: 200 });
  }
}

async function handleSessionEvent(payload: any) {
  const { action, verification } = payload;

  if (!verification?.id) return;

  const statusMap: Record<string, string> = {
    started: 'started',
    submitted: 'submitted',
    abandoned: 'abandoned',
  };

  const newStatus = statusMap[action];
  if (!newStatus) return;

  await KYCSession.findOneAndUpdate(
    { veriffSessionId: verification.id },
    {
      status: newStatus,
      ...(action === 'submitted' ? { submittedAt: new Date() } : {}),
    }
  );

  console.log(`📝 [KYC Webhook] Updated session ${verification.id} status to: ${newStatus}`);
}

// Handle GET requests - either Veriff testing webhook or user redirect after verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isVeriffTest = req.headers.get('user-agent')?.includes('Veriff') || 
                       req.headers.get('x-auth-client');
  
  // If it's Veriff testing the webhook endpoint, return JSON
  if (isVeriffTest) {
    return NextResponse.json({ status: 'ok' });
  }
  
  // If it's a user browser redirect after verification, redirect to profile
  const sessionId = searchParams.get('session_id');
  const redirectUrl = new URL('/profile', req.url);
  redirectUrl.searchParams.set('tab', 'verification');
  
  if (sessionId) {
    redirectUrl.searchParams.set('sessionId', sessionId);
  }
  
  // Add a flag to trigger status refresh on the profile page
  redirectUrl.searchParams.set('checkStatus', 'true');
  
  return NextResponse.redirect(redirectUrl.toString());
}

