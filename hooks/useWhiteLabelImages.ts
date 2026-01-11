'use client';

import { useState, useEffect, useCallback } from 'react';

interface WhiteLabelImages {
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
  favicon: string;
}

const defaultImages: WhiteLabelImages = {
  appLogo: '/assets/images/logo.png',
  emailLogo: '/assets/images/logo.png',
  profileImage: '/assets/images/PROFILE.png',
  dashboardPreview: '/assets/images/dashboard-preview.png',
  favicon: '/favicon.ico',
};

// Add cache-busting query param to image URLs
function addCacheBuster(url: string): string {
  if (!url || url.startsWith('data:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  // Use a random value that changes every 10 seconds to allow some caching but force refresh
  const cacheBuster = Math.floor(Date.now() / 10000);
  return `${url}${separator}v=${cacheBuster}`;
}

export function useWhiteLabelImages() {
  const [images, setImages] = useState<WhiteLabelImages>(defaultImages);
  const [loading, setLoading] = useState(true);

  const fetchImages = useCallback(() => {
    // Add cache-busting to the API request
    fetch(`/api/whitelabel/images?_=${Date.now()}`, {
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        // Add cache-busting to each image URL
        setImages({
          appLogo: addCacheBuster(data.appLogo || defaultImages.appLogo),
          emailLogo: addCacheBuster(data.emailLogo || defaultImages.emailLogo),
          profileImage: addCacheBuster(data.profileImage || defaultImages.profileImage),
          dashboardPreview: addCacheBuster(data.dashboardPreview || defaultImages.dashboardPreview),
          favicon: addCacheBuster(data.favicon || defaultImages.favicon),
        });
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load white label images:', error);
        setImages(defaultImages);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Return a refresh function in case components need to force refresh
  return { images, loading, refresh: fetchImages };
}

