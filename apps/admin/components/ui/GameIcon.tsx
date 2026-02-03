"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { GAME_ICONS, type GameIconName, isValidGameIconName } from "@/lib/constants/game-icons";

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
 * Uses Next.js Image component for optimization.
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

  const iconPath = GAME_ICONS[name];
  
  if (!iconPath) {
    return <span className={cn("flex-shrink-0", className)} style={{ fontSize: size * 0.75 }}>{name}</span>;
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
