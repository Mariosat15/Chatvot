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

// Veriff sends GET requests to verify webhook URL
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

