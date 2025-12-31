/**
 * Nuvei Account Capture Callback
 * Handles the return from Nuvei after user enters bank details
 * 
 * The userPaymentOptionId is received here AND via DMN webhook.
 * We save it here for immediate feedback, DMN is backup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Log all parameters for debugging
  console.log('🏦 Account capture callback received:');
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  console.log(JSON.stringify(params, null, 2));
  
  // Get status from Nuvei - can be SUCCESS, OK, or APPROVED
  const status = searchParams.get('status') || searchParams.get('Status');
  const reason = searchParams.get('reason') || searchParams.get('Reason');
  const userPaymentOptionId = searchParams.get('userPaymentOptionId');
  const pppStatus = searchParams.get('ppp_status');
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chartvolt.com';
  
  // Check for explicit failure status
  const isExplicitFailure = status === 'FAIL' || status === 'FAILED' || status === 'ERROR' || 
                            pppStatus === 'FAIL' || pppStatus === 'ERROR';
  
  // Nuvei's internal redirect often doesn't pass any parameters
  // If we get no params OR explicit success, assume success (DMN handles actual processing)
  const hasNoParams = Object.keys(params).length === 0;
  const isExplicitSuccess = status === 'SUCCESS' || status === 'OK' || status === 'APPROVED' ||
                            pppStatus === 'OK' || pppStatus === 'SUCCESS';
  
  if (isExplicitFailure) {
    console.log('🏦 Account capture explicitly failed:', reason || status);
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=failed&error=${encodeURIComponent(reason || 'Bank verification failed. Please try again.')}`
    );
  }
  
  // Success case: explicit success OR no params (Nuvei's internal redirect)
  // The DMN webhook handles the actual UPO saving
  if (hasNoParams || isExplicitSuccess) {
    console.log('🏦 Account capture callback - assuming success (DMN handles processing)');
    console.log('🏦 hasNoParams:', hasNoParams, 'isExplicitSuccess:', isExplicitSuccess);
    
    // If we have a UPO ID, log it (DMN already saved it)
    if (userPaymentOptionId) {
      console.log('🏦 userPaymentOptionId from callback:', userPaymentOptionId);
    }
    
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=success&message=${encodeURIComponent('Bank account connected! You can now use automatic withdrawals.')}`
    );
  }
  
  // Unknown status - treat as potential failure but with friendly message
  console.log('🏦 Account capture callback - unknown status:', status, pppStatus);
  return NextResponse.redirect(
    `${baseUrl}/wallet?bank_setup=pending&message=${encodeURIComponent('Bank verification is being processed. Check back shortly.')}`
  );
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
  const userPaymentOptionId = params.get('userPaymentOptionId');
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chartvolt.com';
  
  // Handle APPROVED, SUCCESS, or OK as success
  if (status === 'SUCCESS' || status === 'OK' || status === 'APPROVED') {
    console.log('🏦 Account capture (POST) successful, UPO:', userPaymentOptionId);
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=success&message=${encodeURIComponent('Bank account connected successfully!')}`
    );
  } else {
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=failed&error=${encodeURIComponent(reason || 'Failed to add bank account')}`
    );
  }
}

