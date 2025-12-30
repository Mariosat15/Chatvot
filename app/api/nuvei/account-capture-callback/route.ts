/**
 * Nuvei Account Capture Callback
 * Handles the return from Nuvei after user enters bank details
 * 
 * Note: The actual userPaymentOptionId comes via DMN webhook, not this callback.
 * This just redirects the user back to the wallet page.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Log all parameters for debugging
  console.log('🏦 Account capture callback received:');
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  console.log(JSON.stringify(params, null, 2));
  
  // Get status from Nuvei
  const status = searchParams.get('status') || searchParams.get('Status');
  const reason = searchParams.get('reason') || searchParams.get('Reason');
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chartvolt.com';
  
  if (status === 'SUCCESS' || status === 'OK') {
    // Success - redirect to wallet with success message
    console.log('🏦 Account capture successful, redirecting to wallet');
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=success&message=${encodeURIComponent('Bank account added successfully! You can now use it for withdrawals.')}`
    );
  } else {
    // Failed - redirect with error
    console.log('🏦 Account capture failed:', reason || status);
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=failed&error=${encodeURIComponent(reason || 'Failed to add bank account')}`
    );
  }
}

// Also handle POST in case Nuvei sends POST
export async function POST(request: NextRequest) {
  const body = await request.text();
  console.log('🏦 Account capture callback (POST) received:');
  console.log(body);
  
  // Parse the body if it's form data
  const params = new URLSearchParams(body);
  const status = params.get('status') || params.get('Status') || params.get('ppp_status');
  const reason = params.get('reason') || params.get('Reason');
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chartvolt.com';
  
  if (status === 'SUCCESS' || status === 'OK') {
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=success&message=${encodeURIComponent('Bank account added successfully!')}`
    );
  } else {
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=failed&error=${encodeURIComponent(reason || 'Failed to add bank account')}`
    );
  }
}

