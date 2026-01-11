import { NextResponse } from 'next/server';
import { getWhiteLabelImages } from '@/lib/admin/images';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public endpoint for fetching white label images (no auth required)
export async function GET() {
  try {
    const images = await getWhiteLabelImages();
    
    console.log('[WhiteLabel Images API] Returning images:', images);
    
    // Add no-cache headers to ensure fresh data
    return NextResponse.json(images, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching white label images:', error);
    // Return defaults on error
    return NextResponse.json({
      appLogo: '/assets/images/logo.png',
      emailLogo: '/assets/images/logo.png',
      profileImage: '/assets/images/PROFILE.png',
      dashboardPreview: '/assets/images/dashboard-preview.png',
      favicon: '/favicon.ico',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}

