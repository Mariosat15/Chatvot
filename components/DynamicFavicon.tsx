'use client';

import { useEffect } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';

export default function DynamicFavicon() {
  const { settings, loading } = useAppSettings();

  useEffect(() => {
    if (loading || !settings?.branding?.favicon) return;

    const favicon = settings.branding.favicon;
    
    // Update existing favicon links
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());

    // Create new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = favicon;
    
    // Determine type based on extension
    if (favicon.endsWith('.ico')) {
      link.type = 'image/x-icon';
    } else if (favicon.endsWith('.png')) {
      link.type = 'image/png';
    } else if (favicon.endsWith('.svg')) {
      link.type = 'image/svg+xml';
    }

    document.head.appendChild(link);

    // Also add apple-touch-icon if it's a PNG
    if (favicon.endsWith('.png')) {
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = favicon;
      document.head.appendChild(appleLink);
    }
  }, [settings, loading]);

  return null; // This component doesn't render anything
}
