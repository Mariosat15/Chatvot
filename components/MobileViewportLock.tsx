"use client";

import { useEffect } from "react";

const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

/**
 * Reason (7 Oct 2026, owner): phones opened the player app already zoomed in.
 * Safari can keep a visual-viewport scale from an earlier pinch (or from focusing
 * a <16px field) and `maximum-scale=1` then blocks zooming back out — so the
 * page looks permanently magnified. Re-applying the meta tag on load / pageshow
 * forces scale back to 1 without re-enabling pinch.
 */
function applyViewport(): void {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "viewport");
    document.head.appendChild(meta);
  }
  // Reason: a no-op setAttribute is ignored; nudge then restore so WebKit re-parses.
  meta.setAttribute(
    "content",
    "width=device-width, initial-scale=1.0001, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
  );
  requestAnimationFrame(() => {
    meta.setAttribute("content", VIEWPORT_CONTENT);
  });
}

export default function MobileViewportLock() {
  useEffect(() => {
    applyViewport();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) applyViewport();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
