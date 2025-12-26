import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import HeroSettings from '@/database/models/hero-settings.model';

/**
 * GET /api/auth-page-settings
 * Fetch auth page settings (testimonial, dashboard image)
 * This is public - no auth required
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    // Get hero settings
    const settings = await HeroSettings.findOne().select({
      authPageTestimonialText: 1,
      authPageTestimonialAuthor: 1,
      authPageTestimonialRole: 1,
      authPageTestimonialRating: 1,
      authPageDashboardImage: 1,
      siteName: 1,
      logo: 1,
    }).lean();

    // Return defaults if no settings found
    const authSettings = {
      testimonialText: settings?.authPageTestimonialText || 'chatvolt turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market',
      testimonialAuthor: settings?.authPageTestimonialAuthor || 'Ethan R.',
      testimonialRole: settings?.authPageTestimonialRole || 'Retail Investor',
      testimonialRating: settings?.authPageTestimonialRating || 5,
      dashboardImage: settings?.authPageDashboardImage || '/assets/images/dashboard.png',
      siteName: settings?.siteName || 'ChartVolt',
      logo: settings?.logo || '/assets/icons/logo.svg',
    };

    return NextResponse.json(authSettings);
  } catch (error) {
    console.error('Error fetching auth page settings:', error);
    
    // Return defaults on error
    return NextResponse.json({
      testimonialText: 'chatvolt turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market',
      testimonialAuthor: 'Ethan R.',
      testimonialRole: 'Retail Investor',
      testimonialRating: 5,
      dashboardImage: '/assets/images/dashboard.png',
      siteName: 'ChartVolt',
      logo: '/assets/icons/logo.svg',
    });
  }
}

