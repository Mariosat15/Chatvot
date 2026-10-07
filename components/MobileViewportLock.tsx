"use client";

import { useEffect } from "react";

const LOCKED =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

/**
 * Reason (7 Oct 2026, owner): phones opened the player app already zoomed in.
 * Safari can keep a visual-viewport scale from an earlier pinch (or from focusing
 * a <16px field) and `maximum-scale=1` then blocks zooming back out — so the
 * page looks permanently magnified.
 *
 * Amended same day after a second report: a tiny initial-scale nudge was not
 * enough. Briefly unlock maximum-scale so WebKit can honour initial-scale=1,
 * then re-lock pinch. Also re-run on pageshow / orientation / focus return.
 */
function ensureMeta(): HTMLMetaElement {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "viewport");
    document.head.appendChild(meta);
  }
  return meta as HTMLMetaElement;
}

export function applyMobileViewportLock(): void {
  if (typeof document === "undefined") return;
  const meta = ensureMeta();
  // Reason: with maximum-scale already 1, Safari ignores a re-set of the same
  // locked string while a visual zoom is active. Unlock → paint → re-lock.
  meta.setAttribute(
    "content",
    "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=10, user-scalable=yes, viewport-fit=cover",
  );
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    meta.setAttribute("content", LOCKED);
    requestAnimationFrame(() => {
      meta.setAttribute("content", LOCKED);
    });
  });
}

export default function MobileViewportLock() {
  useEffect(() => {
    applyMobileViewportLock();

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) applyMobileViewportLock();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") applyMobileViewportLock();
    };
    // Reason: rotating a phone can leave the old visual scale applied.
    const onOrient = () => applyMobileViewportLock();

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("orientationchange", onOrient);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("orientationchange", onOrient);
    };
  }, []);

  return null;
}
