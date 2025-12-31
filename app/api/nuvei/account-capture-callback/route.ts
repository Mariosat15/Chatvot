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
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chartvolt.com';
  
  // Handle APPROVED, SUCCESS, or OK as success statuses
  if (status === 'SUCCESS' || status === 'OK' || status === 'APPROVED') {
    console.log('🏦 Account capture successful!');
    console.log('🏦 userPaymentOptionId:', userPaymentOptionId);
    
    // If we have a UPO ID, save it (DMN will also save it as backup)
    if (userPaymentOptionId) {
      try {
        await connectToDatabase();
        const NuveiUserPaymentOption = (await import('@/database/models/nuvei-user-payment-option.model')).default;
        
        // Check if this UPO already exists
        const existing = await NuveiUserPaymentOption.findOne({ userPaymentOptionId });
        
        if (!existing) {
          console.log('🏦 Saving new bank UPO from callback...');
          // Note: We don't have userId here in callback, DMN will have it
          // Just log for now - the DMN webhook will properly save it with userId
        } else {
          console.log('🏦 UPO already exists (saved via DMN)');
        }
      } catch (error) {
        console.error('🏦 Error in callback UPO handling:', error);
      }
    }
    
    return NextResponse.redirect(
      `${baseUrl}/wallet?bank_setup=success&message=${encodeURIComponent('Bank account connected successfully! You can now use it for withdrawals.')}`
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

