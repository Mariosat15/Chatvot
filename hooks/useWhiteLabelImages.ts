"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";

interface WhiteLabelImages {
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
  favicon: string;
}

const defaultImages: WhiteLabelImages = {
  appLogo: "/assets/images/logo.png",
  emailLogo: "/assets/images/logo.png",
  profileImage: "/assets/images/brand-icon.jpg",
  dashboardPreview: "/assets/images/dashboard-preview.png",
  // Reason: square controller+bolt mark — never the wide App Logo wordmark.
  favicon: "/assets/images/brand-icon.jpg",
};

const STORAGE_KEY = "cv:whitelabel-images:v1";

// Reason: useLayoutEffect warns during server rendering; on the client it runs
// before the browser paints, which is what lets the remembered logo replace
// the bundled default without the default ever being shown.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

interface StoredImages {
  raw: WhiteLabelImages;
  shown: WhiteLabelImages;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function toImages(source: unknown): WhiteLabelImages {
  const s = (source ?? {}) as Partial<Record<keyof WhiteLabelImages, unknown>>;
  return {
    appLogo: asString(s.appLogo, defaultImages.appLogo),
    emailLogo: asString(s.emailLogo, defaultImages.emailLogo),
    profileImage: asString(s.profileImage, defaultImages.profileImage),
    dashboardPreview: asString(s.dashboardPreview, defaultImages.dashboardPreview),
    favicon: asString(s.favicon, defaultImages.favicon),
  };
}

function readStored(): StoredImages | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed?.raw || !parsed?.shown) return null;
    return { raw: toImages(parsed.raw), shown: toImages(parsed.shown) };
  } catch {
    return null;
  }
}

function writeStored(value: StoredImages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Reason: storage can throw (privacy mode, quota) — the logo still works,
    // it just cannot be remembered for the next visit.
  }
}

function addCacheBuster(url: string): string {
  if (!url || url.startsWith("data:")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

/**
 * Reason: the busted URL is only regenerated when the stored image actually
 * changed (uploads get a new timestamped filename). Regenerating it on every
 * load — the old 10-second rotation — made the browser re-download the same
 * logo on each refresh, so it popped in late.
 */
function keepOrBust(raw: string, prevRaw?: string, prevShown?: string): string {
  return prevShown && prevRaw === raw ? prevShown : addCacheBuster(raw);
}

function resolveShown(
  raw: WhiteLabelImages,
  prev: StoredImages | null,
): WhiteLabelImages {
  return {
    appLogo: keepOrBust(raw.appLogo, prev?.raw.appLogo, prev?.shown.appLogo),
    emailLogo: keepOrBust(raw.emailLogo, prev?.raw.emailLogo, prev?.shown.emailLogo),
    profileImage: keepOrBust(
      raw.profileImage,
      prev?.raw.profileImage,
      prev?.shown.profileImage,
    ),
    dashboardPreview: keepOrBust(
      raw.dashboardPreview,
      prev?.raw.dashboardPreview,
      prev?.shown.dashboardPreview,
    ),
    favicon: keepOrBust(raw.favicon, prev?.raw.favicon, prev?.shown.favicon),
  };
}

export function useWhiteLabelImages() {
  const [images, setImages] = useState<WhiteLabelImages>(defaultImages);
  const [loading, setLoading] = useState(true);
  // Reason: false until the real images are known (remembered or fetched),
  // so screens can hide the logo instead of flashing the bundled default.
  const [ready, setReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const stored = readStored();
    if (stored) {
      setImages(stored.shown);
      setReady(true);
    }
  }, []);

  const fetchImages = useCallback(() => {
    fetch(`/api/whitelabel/images?_=${Date.now()}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        const raw = toImages(data);
        const shown = resolveShown(raw, readStored());
        writeStored({ raw, shown });
        setImages(shown);
        setReady(true);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load white label images:", error);
        const stored = readStored();
        setImages(stored ? stored.shown : defaultImages);
        setReady(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return { images, loading, ready, refresh: fetchImages };
}
