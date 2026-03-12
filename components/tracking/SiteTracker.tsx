"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * SiteTracker — Lightweight client component that reports page views.
 *
 * Placed in the root layout so every page navigation is tracked.
 * Uses requestIdleCallback (when available) to avoid impacting page performance.
 * Sends data to POST /api/tracking/pageview in a fire-and-forget manner.
 */
export default function SiteTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string>("");

  useEffect(() => {
    // Skip duplicate tracking for the same path (e.g. re-renders)
    if (pathname === lastTrackedPath.current) return;
    lastTrackedPath.current = pathname;

    const trackVisit = () => {
      const utmParams = new URLSearchParams(window.location.search);

      const payload = {
        path: pathname,
        referrer: document.referrer || "",
        userAgent: navigator.userAgent || "",
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language || "",
        utmSource: utmParams.get("utm_source") || "",
        utmMedium: utmParams.get("utm_medium") || "",
        utmCampaign: utmParams.get("utm_campaign") || "",
        utmTerm: utmParams.get("utm_term") || "",
        utmContent: utmParams.get("utm_content") || "",
      };

      // Reason: Use sendBeacon if available (survives page unload), fallback to fetch
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/tracking/pageview",
          new Blob([JSON.stringify(payload)], { type: "application/json" }),
        );
      } else {
        fetch("/api/tracking/pageview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true, // Allows request to survive page navigation
        }).catch(() => {});
      }
    };

    // Reason: Defer tracking to idle time so it doesn't block rendering
    if ("requestIdleCallback" in window) {
      (window as Window).requestIdleCallback(trackVisit, { timeout: 3000 });
    } else {
      setTimeout(trackVisit, 100);
    }
  }, [pathname]);

  return null; // This component renders nothing
}
