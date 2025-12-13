'use client';

import { useState, useEffect } from 'react';

interface WhiteLabelImages {
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
}

const defaultImages: WhiteLabelImages = {
  appLogo: '/assets/images/logo.png',
  emailLogo: '/assets/images/logo.png',
  profileImage: '/assets/images/PROFILE.png',
  dashboardPreview: '/assets/images/dashboard-preview.png',
};

export function useWhiteLabelImages() {
  const [images, setImages] = useState<WhiteLabelImages>(defaultImages);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/whitelabel/images')
      .then((res) => res.json())
      .then((data) => {
        setImages(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load white label images:', error);
        setImages(defaultImages);
        setLoading(false);
      });
  }, []);

  return { images, loading };
}

