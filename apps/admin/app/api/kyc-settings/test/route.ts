import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { apiKey, apiSecret, baseUrl } = body;

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        message: 'API Key is required' 
      });
    }

    // Test the connection by making a simple API call to Veriff
    // We'll try to create a session with minimal data just to verify credentials
    const testPayload = {
      verification: {
        callback: 'https://example.com/callback',
        person: {
          firstName: 'Test',
          lastName: 'User',
        },
        vendorData: 'test-connection',
        timestamp: new Date().toISOString(),
      },
    };

    const payloadString = JSON.stringify(testPayload);
    
    // Generate HMAC signature if secret is provided
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-AUTH-CLIENT': apiKey,
    };

    if (apiSecret) {
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(payloadString)
        .digest('hex');
      headers['X-HMAC-SIGNATURE'] = signature;
    }

    const response = await fetch(`${baseUrl || 'https://stationapi.veriff.com'}/v1/sessions`, {
      method: 'POST',
      headers,
      body: payloadString,
    });

    if (response.ok) {
      return NextResponse.json({ 
        success: true, 
        message: 'Connection successful! Credentials are valid.' 
      });
    }

    const errorText = await response.text();
    let errorMessage = 'Connection failed';

    if (response.status === 401) {
      errorMessage = 'Invalid API Key';
    } else if (response.status === 403) {
      errorMessage = 'Invalid signature - check your Shared Secret Key';
    } else {
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
    }

    return NextResponse.json({ 
      success: false, 
      message: errorMessage 
    });
  } catch (error: any) {
    console.error('Error testing KYC connection:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to test connection' 
    });
  }
}

