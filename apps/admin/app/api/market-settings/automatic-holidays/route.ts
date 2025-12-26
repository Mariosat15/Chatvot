import { NextResponse } from 'next/server';

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const MASSIVE_API_BASE_URL = 'https://api.massive.com/v1';

interface MassiveHoliday {
  date: string;
  name: string;
  exchange: string;
  status: string;
  open?: string;
  close?: string;
}

/**
 * GET /api/market-settings/automatic-holidays
 * Fetch upcoming market holidays directly from Massive.com API
 */
export async function GET() {
  try {
    if (!MASSIVE_API_KEY) {
      return NextResponse.json({ 
        holidays: [],
        error: 'MASSIVE_API_KEY not configured',
        message: 'Configure your Massive.com API key to enable automatic holiday detection'
      });
    }

    const url = `${MASSIVE_API_BASE_URL}/marketstatus/upcoming?apiKey=${MASSIVE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'GET',
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const apiHolidays: MassiveHoliday[] = data.response || [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Transform and filter holidays
    const holidays = apiHolidays
      .map((h: MassiveHoliday) => {
        const holidayDate = new Date(h.date);
        holidayDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: `auto_${h.date}_${h.exchange}`,
          name: h.name,
          date: h.date,
          exchange: h.exchange,
          status: h.status,
          daysUntil,
        };
      })
      .filter((h: { daysUntil: number }) => h.daysUntil >= -1) // Include today and future
      .sort((a: { daysUntil: number }, b: { daysUntil: number }) => a.daysUntil - b.daysUntil);

    return NextResponse.json({ 
      holidays,
      source: 'Massive.com API',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching automatic holidays:', error);
    return NextResponse.json({ 
      holidays: [],
      error: error instanceof Error ? error.message : 'Failed to fetch holidays'
    }, { status: 500 });
  }
}

