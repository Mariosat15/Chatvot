import { NextResponse } from 'next/server';

/**
 * Test endpoint to verify Massive.com API is working
 * Visit: http://localhost:3000/api/test-massive
 */
export async function GET() {
  const apiKey = process.env.MASSIVE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'MASSIVE_API_KEY not set in .env file',
      instructions: 'Add MASSIVE_API_KEY=OtxXHtJGi3vIVBmZp29ndCZXJ6E3nzHj to your .env file',
    }, { status: 500 });
  }

  const results: any = {
    apiKeyPresent: true,
    apiKey: `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`,
    tests: {},
  };

  // Test 1: Simple quote request
  try {
    console.log('Testing Massive.com API: GET /v1/forex/quotes/EURUSD');
    const response = await fetch(
      'https://api.massive.com/v1/forex/quotes/EURUSD',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    results.tests.quotes = {
      status: response.status,
      success: response.ok,
      data: data,
    };
  } catch (error) {
    results.tests.quotes = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Test 2: Historical data request
  try {
    console.log('Testing Massive.com API: GET /v1/forex/historical/EURUSD');
    const response = await fetch(
      'https://api.massive.com/v1/forex/historical/EURUSD?interval=5min&limit=10',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    results.tests.historical = {
      status: response.status,
      success: response.ok,
      dataLength: Array.isArray(data.candles) ? data.candles.length : 0,
      sampleData: data,
    };
  } catch (error) {
    results.tests.historical = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return NextResponse.json(results, { status: 200 });
}

