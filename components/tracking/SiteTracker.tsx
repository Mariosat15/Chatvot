"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

// ─── Session helpers ─────────────────────────────────────────────────────────

function secureRandomId(length: number): string {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (v) => v.toString(36)).join("").slice(0, length);
}

function getOrCreateSessionId(): string {
  const KEY = "cv_session_id";
  const TS_KEY = "cv_session_ts";
  const TIMEOUT = 30 * 60 * 1000; // 30 min inactivity = new session

  const existing = sessionStorage.getItem(KEY);
  const lastTs = sessionStorage.getItem(TS_KEY);

  // Reason: Reset session after 30 min inactivity (GA4 default behavior)
  if (existing && lastTs && Date.now() - parseInt(lastTs, 10) < TIMEOUT) {
    sessionStorage.setItem(TS_KEY, Date.now().toString());
    return existing;
  }

  const newId = `${Date.now()}-${secureRandomId(8)}`;
  sessionStorage.setItem(KEY, newId);
  sessionStorage.setItem(TS_KEY, Date.now().toString());
  return newId;
}

function isNewVisitor(): boolean {
  const KEY = "cv_returning";
  if (localStorage.getItem(KEY)) return false;
  localStorage.setItem(KEY, "1");
  return true;
}

function getSessionPageCount(): number {
  const KEY = "cv_page_count";
  const val = parseInt(sessionStorage.getItem(KEY) || "0", 10);
  const next = val + 1;
  sessionStorage.setItem(KEY, next.toString());
  return next;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SiteTracker — Enhanced client tracker that reports page views, duration,
 * scroll depth, and engagement metrics.
 *
 * Placed in the root layout so every page navigation is tracked.
 * Uses requestIdleCallback to avoid impacting page performance.
 * Sends data to POST /api/tracking/pageview in a fire-and-forget manner.
 * Sends duration/engagement data via beacon on page leave.
 */
export default function SiteTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string>("");
  const pageEnteredAt = useRef<number>(0);
  const maxScrollDepth = useRef<number>(0);
  const currentSessionId = useRef<string>("");

  // Reason: Send engagement data (duration, scroll depth) when user leaves page
  const sendEngagement = useCallback(() => {
    if (!pageEnteredAt.current || !lastTrackedPath.current) return;

    const duration = Math.round((Date.now() - pageEnteredAt.current) / 1000);
    // Skip trivially short visits (< 1s — likely prerender/bot)
    if (duration < 1) return;

    const payload = {
      type: "engagement",
      path: lastTrackedPath.current,
      sessionId: currentSessionId.current,
      duration,
      scrollDepth: Math.round(maxScrollDepth.current),
    };

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
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  // Track scroll depth
  useEffect(() => {
    maxScrollDepth.current = 0;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const depth = (scrollTop / docHeight) * 100;
        if (depth > maxScrollDepth.current) {
          maxScrollDepth.current = depth;
        }
      }
    };

    // Reason: Throttle scroll to 200ms to avoid perf impact
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
      }
    };

    window.addEventListener("scroll", throttledScroll, { passive: true });
    return () => window.removeEventListener("scroll", throttledScroll);
  }, [pathname]);

  // Send engagement on visibility change (tab switch) or beforeunload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendEngagement();
      }
    };
    const handleBeforeUnload = () => {
      sendEngagement();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sendEngagement]);

  // Track page views
  useEffect(() => {
    if (pathname === lastTrackedPath.current) return;

    // Send engagement for the PREVIOUS page before tracking new one
    if (lastTrackedPath.current) {
      sendEngagement();
    }

    lastTrackedPath.current = pathname;
    pageEnteredAt.current = Date.now();
    maxScrollDepth.current = 0;

    const trackVisit = () => {
      try {
        const sessionId = getOrCreateSessionId();
        currentSessionId.current = sessionId;
        const isNew = isNewVisitor();
        const pageCount = getSessionPageCount();
        const utmParams = new URLSearchParams(window.location.search);

        const payload = {
          type: "pageview",
          path: pathname,
          referrer: document.referrer || "",
          userAgent: navigator.userAgent || "",
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          language: navigator.language || "",
          sessionId,
          isNewVisitor: isNew,
          sessionPageCount: pageCount,
          // Reason: connection.effectiveType available in Chrome for network quality
          connectionType:
            (navigator as Navigator & { connection?: { effectiveType?: string } })
              .connection?.effectiveType || "",
          utmSource: utmParams.get("utm_source") || "",
          utmMedium: utmParams.get("utm_medium") || "",
          utmCampaign: utmParams.get("utm_campaign") || "",
          utmTerm: utmParams.get("utm_term") || "",
          utmContent: utmParams.get("utm_content") || "",
        };

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
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Reason: Tracking must never break the user experience
      }
    };

    if ("requestIdleCallback" in window) {
      (window as Window).requestIdleCallback(trackVisit, { timeout: 3000 });
    } else {
      setTimeout(trackVisit, 100);
    }
  }, [pathname, sendEngagement]);

  return null;
}
