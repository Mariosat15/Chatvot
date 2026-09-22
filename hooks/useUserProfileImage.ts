"use client";

import { useState, useEffect, useCallback } from "react";

const FALLBACK_PROFILE_IMAGE = "/assets/images/PROFILE.png";

/**
 * Hook to fetch and manage the current user's profile image and frame
 * This is different from useWhiteLabelImages which provides branding images
 */
export function useUserProfileImage() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [brandingDefault, setBrandingDefault] = useState(FALLBACK_PROFILE_IMAGE);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileImage = useCallback(async () => {
    try {
      const [profileRes, brandingRes] = await Promise.all([
        fetch("/api/user/profile", { cache: "no-store" }),
        fetch(`/api/whitelabel/images?_=${Date.now()}`, { cache: "no-store" }),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        const userImage = data.user?.profileImage || data.profileImage;
        const userFrame = data.user?.activeFrameUrl || null;
        setProfileImage(userImage || null);
        setFrameUrl(userFrame || null);
      } else {
        setProfileImage(null);
        setFrameUrl(null);
      }

      // Reason: Branding → Profile Image is the operator-chosen default avatar.
      // Hard-coding PROFILE.png left the old mark on every account without a
      // personal photo after a logo refresh.
      if (brandingRes.ok) {
        const branding = await brandingRes.json();
        if (typeof branding.profileImage === "string" && branding.profileImage) {
          setBrandingDefault(branding.profileImage);
        }
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
  const displayImage = profileImage || brandingDefault;

  return {
    profileImage: displayImage,
    frameUrl,
    hasCustomImage,
    hasFrame: !!frameUrl,
    loading,
    refresh: fetchProfileImage,
  };
}
