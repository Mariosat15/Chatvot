"use client";

import { useState, useEffect, useCallback } from "react";

const DEFAULT_PROFILE_IMAGE = "/assets/images/PROFILE.png";

/**
 * Hook to fetch and manage the current user's profile image and frame
 * This is different from useWhiteLabelImages which provides branding images
 */
export function useUserProfileImage() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileImage = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile", {
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        const userImage = data.user?.profileImage || data.profileImage;
        const userFrame = data.user?.activeFrameUrl || null;
        setProfileImage(userImage || null);
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

  // Return the actual image or default if none exists
  const displayImage = profileImage || DEFAULT_PROFILE_IMAGE;

  return {
    profileImage: displayImage,
    frameUrl,
    hasCustomImage: !!profileImage,
    hasFrame: !!frameUrl,
    loading,
    refresh: fetchProfileImage,
  };
}
