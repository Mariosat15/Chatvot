"use client";

import { useState, useEffect, useCallback } from "react";

/** Square brand mark — never the wide wordmark. */
const FALLBACK_BRAND_ICON = "/assets/images/brand-icon.jpg";

function stripQuery(url: string): string {
  return url.split("?")[0] ?? url;
}

function fileName(url: string): string {
  const path = stripQuery(url);
  const parts = path.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

/**
 * True when a stored avatar URL is actually the wide App/Email wordmark.
 * Putting that file in a circle crops "ChartVolt" into nonsense — treat it as
 * "no personal photo" and fall back to the brand icon instead.
 */
function isBrandWordmarkUrl(
  url: string,
  appLogo?: string,
  emailLogo?: string,
): boolean {
  const name = fileName(url);
  if (
    name.includes("applogo") ||
    name.includes("emaillogo") ||
    name === "logo.png" ||
    name === "logo.svg" ||
    name === "logo.jpg" ||
    name === "logo.jpeg" ||
    name === "logo.webp"
  ) {
    return true;
  }
  const base = stripQuery(url);
  if (appLogo && base === stripQuery(appLogo)) return true;
  if (emailLogo && base === stripQuery(emailLogo)) return true;
  return false;
}

/** Generic /favicon.ico is not our square brand mark. */
function isUsableBrandIcon(url: string | undefined | null): url is string {
  if (!url || typeof url !== "string") return false;
  const path = stripQuery(url).toLowerCase();
  if (path === "/favicon.ico" || path.endsWith("/favicon.ico")) return false;
  return true;
}

/**
 * Hook to fetch and manage the current user's profile image and frame.
 * Default (no personal photo) is the Brand Icon / favicon — the square mark —
 * never the App Logo wordmark.
 */
export function useUserProfileImage() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [brandIcon, setBrandIcon] = useState(FALLBACK_BRAND_ICON);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileImage = useCallback(async () => {
    try {
      const [profileRes, brandingRes] = await Promise.all([
        fetch("/api/user/profile", { cache: "no-store" }),
        fetch(`/api/whitelabel/images?_=${Date.now()}`, { cache: "no-store" }),
      ]);

      let appLogo: string | undefined;
      let emailLogo: string | undefined;
      let icon = FALLBACK_BRAND_ICON;

      // Reason: Brand Icon (favicon) is the square mark for collapsed nav and
      // default avatars. profileImage was often filled with the wordmark by
      // mistake; prefer a real favicon upload, then a non-wordmark profileImage.
      if (brandingRes.ok) {
        const branding = await brandingRes.json();
        appLogo = branding.appLogo;
        emailLogo = branding.emailLogo;
        if (isUsableBrandIcon(branding.favicon)) {
          icon = branding.favicon;
        } else if (
          typeof branding.profileImage === "string" &&
          branding.profileImage &&
          !isBrandWordmarkUrl(branding.profileImage, appLogo, emailLogo)
        ) {
          icon = branding.profileImage;
        }
        setBrandIcon(icon);
      }

      if (profileRes.ok) {
        const data = await profileRes.json();
        const userImage = data.user?.profileImage || data.profileImage || null;
        const userFrame = data.user?.activeFrameUrl || null;
        if (
          userImage &&
          !isBrandWordmarkUrl(String(userImage), appLogo, emailLogo)
        ) {
          setProfileImage(String(userImage));
        } else {
          setProfileImage(null);
        }
        setFrameUrl(userFrame || null);
      } else {
        setProfileImage(null);
        setFrameUrl(null);
      }
    } catch (error) {
      console.error("Failed to fetch user profile image:", error);
      setProfileImage(null);
      setFrameUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileImage();
  }, [fetchProfileImage]);

  const hasCustomImage = !!profileImage;
  const displayImage = profileImage || brandIcon;

  return {
    profileImage: displayImage,
    brandIcon,
    frameUrl,
    hasCustomImage,
    hasFrame: !!frameUrl,
    loading,
    refresh: fetchProfileImage,
  };
}
