import { connectToDatabase } from '@/database/mongoose';
import { WhiteLabel } from '@/database/models/whitelabel.model';

// Cache for image paths (optional, for performance)
// Note: Cache is disabled in development for instant updates
let imageCache: {
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
  favicon: string;
} | null = null;

let cacheTime: number = 0;
// Short cache duration - images should update within 5 seconds
const CACHE_DURATION = process.env.NODE_ENV === 'production' ? 5 * 1000 : 0; // 5 seconds in prod, no cache in dev

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
        favicon: '/favicon.ico',
      };
    } else {
      imageCache = {
        appLogo: settings.appLogo || '/assets/images/logo.png',
        emailLogo: settings.emailLogo || '/assets/images/logo.png',
        profileImage: settings.profileImage || '/assets/images/PROFILE.png',
        dashboardPreview: settings.dashboardPreview || '/assets/images/dashboard-preview.png',
        favicon: settings.favicon || '/favicon.ico',
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
      favicon: '/favicon.ico',
    };
  }
}

export async function getFavicon() {
  const images = await getWhiteLabelImages();
  return images.favicon;
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

