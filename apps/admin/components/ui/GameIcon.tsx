"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { getGameIconPath, type GameIconName, isValidGameIconName } from "@/lib/constants/game-icons";

interface GameIconProps {
  /** Icon name from the GAME_ICONS registry */
  name: GameIconName | string;
  /** Size in pixels (width and height) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Alt text for accessibility (defaults to icon name) */
  alt?: string;
}

/**
 * GameIcon Component for Admin
 * 
 * A reusable component for displaying game-themed icons in the admin panel.
 * Supports white-label deployments by using dynamic asset URLs.
 * Uses regular img tag for API routes and external URLs, Next.js Image for static paths.
 */
export function GameIcon({
  name,
  size = 24,
  className,
  alt,
}: GameIconProps) {
  // Handle both valid GameIconNames and legacy emoji/string icons
  if (!isValidGameIconName(name)) {
    // For backward compatibility, render as text if not a valid icon name
    return <span className={cn("flex-shrink-0", className)} style={{ fontSize: size * 0.75 }}>{name}</span>;
  }

  // Get the full icon path (supports dynamic base URL for white-label)
  const iconPath = getGameIconPath(name);
  
  if (!iconPath) {
    return <span className={cn("flex-shrink-0", className)} style={{ fontSize: size * 0.75 }}>{name}</span>;
  }

  // Use regular img tag for external URLs, API routes, and white-label paths
  // Next.js Image optimization can have issues with dynamic API routes
  const useRegularImg = iconPath.startsWith('http') || iconPath.startsWith('/api/');
  
  if (useRegularImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconPath}
        alt={alt || name.replace(/([A-Z])/g, ' $1').trim()}
        width={size}
        height={size}
        className={cn("object-contain flex-shrink-0", className)}
        draggable={false}
        loading="lazy"
      />
    );
  }

  return (
    <Image
      src={iconPath}
      alt={alt || name.replace(/([A-Z])/g, ' $1').trim()}
      width={size}
      height={size}
      className={cn("object-contain flex-shrink-0", className)}
      draggable={false}
    />
  );
}

export default GameIcon;
