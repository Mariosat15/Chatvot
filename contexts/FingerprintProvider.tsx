"use client";

import { useEffect, useRef } from "react";
import { trackDeviceFingerprint } from "@/lib/services/device-fingerprint.service";

const SESSION_KEY = "fp_tracked";

/**
 * Global Fingerprint Provider
 *
 * Tracks device fingerprints ONCE per browser session (not on every navigation).
 * Uses sessionStorage to persist the "already tracked" flag across
 * Next.js client-side navigations, preventing redundant fraud detection
 * DB queries on every page load.
 */
export function FingerprintProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const didRun = useRef(false);

  useEffect(() => {
    // Prevent double-fire from React StrictMode and re-mounts
    if (didRun.current) return;

    // Check sessionStorage — survive navigations within the same tab
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // SSR or sessionStorage unavailable — fall through
    }

    didRun.current = true;

    const trackFingerprint = async () => {
      try {
        const result = await trackDeviceFingerprint();
        if (result.success) {
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {
            // ignore
          }
        }
      } catch (error) {
        console.error("Failed to track fingerprint:", error);
      }
    };

    // Track after a short delay to not block initial page load
    const timer = setTimeout(trackFingerprint, 2000);
    return () => clearTimeout(timer);
  }, []);

  return <>{children}</>;
}
