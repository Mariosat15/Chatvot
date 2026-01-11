import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import veriffService from '@/lib/services/veriff.service';

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();

    const result = await veriffService.createSession(session.user.id, {
      firstName: body.firstName || session.user.name?.split(' ')[0],
      lastName: body.lastName || session.user.name?.split(' ').slice(1).join(' '),
      email: session.user.email,
      dateOfBirth: body.dateOfBirth,
    });

    return NextResponse.json({
      success: true,
      sessionUrl: result.sessionUrl,
      sessionId: result.sessionId,
    });
  } catch (error: any) {
    console.error('Error starting KYC verification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start KYC verification' },
      { status: 500 }
    );
  }
}

