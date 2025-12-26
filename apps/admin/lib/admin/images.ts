import { connectToDatabase } from '@/database/mongoose';
import { WhiteLabel } from '@/database/models/whitelabel.model';

// Cache for image paths (optional, for performance)
let imageCache: {
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
} | null = null;

let cacheTime: number = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

export async function getWhiteLabelImages() {
  // Return cached if available and fresh
  if (imageCache && Date.now() - cacheTime < CACHE_DURATION) {
    return imageCache;
  }

  try {
    await connectToDatabase();
    
    const settings = await WhiteLabel.findOne().lean();
    
    if (!settings) {
      // Return defaults if no settings exist
      imageCache = {
        appLogo: '/assets/images/logo.png',
        emailLogo: '/assets/images/logo.png',
        profileImage: '/assets/images/PROFILE.png',
        dashboardPreview: '/assets/images/dashboard-preview.png',
      };
    } else {
      imageCache = {
        appLogo: settings.appLogo || '/assets/images/logo.png',
        emailLogo: settings.emailLogo || '/assets/images/logo.png',
        profileImage: settings.profileImage || '/assets/images/PROFILE.png',
        dashboardPreview: settings.dashboardPreview || '/assets/images/dashboard-preview.png',
      };
    }

    cacheTime = Date.now();
    return imageCache;
  } catch (error) {
    console.error('Error fetching white label images:', error);
    // Return defaults on error
    return {
      appLogo: '/assets/images/logo.png',
      emailLogo: '/assets/images/logo.png',
      profileImage: '/assets/images/PROFILE.png',
      dashboardPreview: '/assets/images/dashboard-preview.png',
    };
  }
}

// Get specific image type
export async function getAppLogo() {
  const images = await getWhiteLabelImages();
  return images.appLogo;
}

export async function getEmailLogo() {
  const images = await getWhiteLabelImages();
  return images.emailLogo;
}

export async function getProfileImage() {
  const images = await getWhiteLabelImages();
  return images.profileImage;
}

export async function getDashboardPreview() {
  const images = await getWhiteLabelImages();
  return images.dashboardPreview;
}

// Clear cache (call this after updating images in admin panel)
export function clearImageCache() {
  imageCache = null;
  cacheTime = 0;
}

