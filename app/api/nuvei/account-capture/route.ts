/**
 * Nuvei Account Capture API
 * Initiates bank account capture flow for payouts
 * 
 * This redirects the user to Nuvei's hosted page to enter bank details.
 * After completion, Nuvei sends a DMN with the userPaymentOptionId.
 * 
 * Documentation: https://docs.nuvei.com/documentation/global-guides/local-bank-payouts/
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { nuveiService } from '@/lib/services/nuvei.service';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { countryCode, currencyCode = 'EUR' } = body;

    if (!countryCode) {
      return NextResponse.json(
        { error: 'Country code is required' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const userTokenId = `user_${userId}`;
    
    console.log('🏦 Initiating account capture for user:', userId);
    console.log('🏦 Country:', countryCode, 'Currency:', currencyCode);

    // Call Nuvei accountCapture
    const result = await nuveiService.accountCapture({
      userTokenId,
      paymentMethod: 'apmgw_BankPayouts',
      currencyCode,
      countryCode: countryCode.toUpperCase(),
      languageCode: 'en',
    });

    if ('error' in result) {
      console.error('🏦 Account capture failed:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    if (!result.redirectUrl) {
      return NextResponse.json(
        { error: 'No redirect URL received from Nuvei' },
        { status: 500 }
      );
    }

    console.log('🏦 Redirect URL obtained, user will be redirected to Nuvei');

    return NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      message: 'Redirect to Nuvei to enter bank details',
    });

  } catch (error) {
    console.error('🏦 Account capture error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate bank account setup' },
      { status: 500 }
    );
  }
}

