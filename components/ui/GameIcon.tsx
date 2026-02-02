"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { GAME_ICONS, type GameIconName } from "@/lib/constants/game-icons";

interface GameIconProps {
  /** Icon name from the GAME_ICONS registry */
  name: GameIconName;
  /** Size in pixels (width and height) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Alt text for accessibility (defaults to icon name) */
  alt?: string;
  /** Whether to add a glow effect on hover */
  glow?: boolean;
  /** Whether to animate the icon (pulse, bounce, etc.) */
  animate?: "pulse" | "bounce" | "spin" | "none";
  /** Custom inline styles */
  style?: React.CSSProperties;
}

/**
 * GameIcon Component
 * 
 * A reusable component for displaying game-themed icons throughout the app.
 * Uses Next.js Image component for optimization.
 * 
 * @example
 * // Basic usage
 * <GameIcon name="trophy" size={24} />
 * 
 * @example
 * // With glow and animation
 * <GameIcon name="coin" size={32} glow animate="pulse" />
 */
export function GameIcon({
  name,
  size = 24,
  className,
  alt,
  glow = false,
  animate = "none",
  style,
}: GameIconProps) {
  const iconPath = GAME_ICONS[name];
  
  if (!iconPath) {
    console.warn(`GameIcon: Unknown icon name "${name}"`);
    return null;
  }

  const animationClasses = {
    pulse: "animate-pulse",
    bounce: "animate-bounce",
    spin: "animate-spin",
    none: "",
  };

  return (
    <Image
      src={iconPath}
      alt={alt || name.replace(/([A-Z])/g, ' $1').trim()}
      width={size}
      height={size}
      className={cn(
        "object-contain flex-shrink-0",
        glow && "drop-shadow-[0_0_8px_rgba(255,215,0,0.6)] hover:drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]",
        animationClasses[animate],
        className
      )}
      style={style}
      draggable={false}
    />
  );
}

/**
 * GameIconInline - A simpler version for inline text contexts
 */
export function GameIconInline({
  name,
  size = 16,
  className,
}: {
  name: GameIconName;
  size?: number;
  className?: string;
}) {
  const iconPath = GAME_ICONS[name];
  
  if (!iconPath) return null;

  return (
    <Image
      src={iconPath}
      alt={name}
      width={size}
      height={size}
      className={cn("inline-block align-middle", className)}
      draggable={false}
    />
  );
}

/**
 * RankIcon - Specialized component for displaying rank badges
 */
export function RankIcon({
  rank,
  size = 24,
  className,
}: {
  rank: number;
  size?: number;
  className?: string;
}) {
  const getRankIconName = (rank: number): GameIconName => {
    switch (rank) {
      case 1: return "rank1"; // Crown
      case 2: return "rank2"; // Medal 1
      case 3: return "rank3"; // Medal 2
      case 4: return "rank4"; // Medal 3
      case 5: return "rank5"; // Medal 4
      case 6: return "rank6"; // Medal 5
      case 7: return "rank7"; // Medal 6
      default: return "starBadge"; // Default star badge
    }
  };

  return (
    <GameIcon
      name={getRankIconName(rank)}
      size={size}
      className={cn(rank <= 3 && "drop-shadow-[0_0_6px_rgba(255,215,0,0.5)]", className)}
      glow={rank <= 3}
    />
  );
}

/**
 * CurrencyIcon - Specialized component for currency displays
 */
export function CurrencyIcon({
  type = "credits",
  size = 20,
  className,
  animate = false,
}: {
  type?: "credits" | "gems" | "treasure";
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  const iconMap: Record<string, GameIconName> = {
    credits: "coin",
    gems: "gems",
    treasure: "treasure",
  };

  return (
    <GameIcon
      name={iconMap[type]}
      size={size}
      className={className}
      glow={animate}
      animate={animate ? "pulse" : "none"}
    />
  );
}

/**
 * NavIcon - Specialized component for navigation items
 */
export function NavIcon({
  page,
  size = 20,
  className,
  active = false,
}: {
  page: "dashboard" | "competitions" | "challenges" | "leaderboard" | "wallet" | "profile" | "marketplace" | "help";
  size?: number;
  className?: string;
  active?: boolean;
}) {
  return (
    <GameIcon
      name={page as GameIconName}
      size={size}
      className={cn(
        "transition-all duration-200",
        active && "drop-shadow-[0_0_8px_rgba(147,51,234,0.6)]",
        className
      )}
    />
  );
}

export default GameIcon;
