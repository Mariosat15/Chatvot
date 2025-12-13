'use client';

import { useEffect, useState } from 'react';
import { trackDeviceFingerprint } from '@/lib/services/device-fingerprint.service';

/**
 * Global Fingerprint Provider
 * 
 * Tracks device fingerprints on EVERY page of the app.
 * This ensures we capture existing users who logged in before
 * the fraud detection system was implemented.
 */
export function FingerprintProvider({ children }: { children: React.ReactNode }) {
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    // Only track once per session
    if (tracked) return;

    const trackFingerprint = async () => {
      try {
        const result = await trackDeviceFingerprint();
        
        if (result.success) {
          console.log('✅ Global fingerprint tracked');
          setTracked(true);
          
          // Show warning if suspicious
          if (result.suspicious) {
            console.warn('⚠️ Suspicious device detected:', result.message);
          }
        }
      } catch (error) {
        console.error('Failed to track fingerprint:', error);
        // Don't block the app if fingerprinting fails
      }
    };

    // Track after a short delay to not block initial page load
    const timer = setTimeout(trackFingerprint, 1000);

    return () => clearTimeout(timer);
  }, [tracked]);

  return <>{children}</>;
}

