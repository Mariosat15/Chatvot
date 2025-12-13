import { NextResponse } from 'next/server';
import { getWhiteLabelImages } from '@/lib/admin/images';

// Public endpoint for fetching white label images (no auth required)
export async function GET() {
  try {
    const images = await getWhiteLabelImages();
    
    return NextResponse.json(images);
  } catch (error) {
    console.error('Error fetching white label images:', error);
    // Return defaults on error
    return NextResponse.json({
      appLogo: '/assets/images/logo.png',
      emailLogo: '/assets/images/logo.png',
      profileImage: '/assets/images/PROFILE.png',
      dashboardPreview: '/assets/images/dashboard-preview.png',
    });
  }
}

