import {
  Clock,
  Globe,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  HERO_FEATURE_ICONS,
  resolveHeroFeatureIcon,
  type HeroFeatureIcon,
} from "@/lib/services/games/hero-features";

/**
 * Lucide glyphs for `HERO_FEATURE_ICONS` slugs — shared by the arena hero, game
 * tips, and how-it-works steps so a picker choice always draws the same mark.
 *
 * EVERY SLUG IN `HERO_FEATURE_ICONS` MUST HAVE AN ENTRY. An offer without a
 * glyph puts a neutral mark on a live screen while the admin form showed the
 * icon the operator picked.
 *
 * No `"use client"` — pure map, safe from RSC play pages and client game pages.
 */

const FEATURE_ICONS = new Map<HeroFeatureIcon, LucideIcon>([
  ["speed", Zap],
  ["clock", Clock],
  ["players", Users],
  ["skill", Shield],
  ["ranking", Globe],
  ["reward", Trophy],
  ["target", Target],
  ["spark", Sparkles],
]);

const FALLBACK_ICONS: LucideIcon[] = [
  Zap,
  Trophy,
  Clock,
  Target,
  Sparkles,
  Shield,
];

export function resolveFeatureLucideIcon(
  slug: string | undefined,
  fallbackIndex = 0,
): LucideIcon {
  const known = resolveHeroFeatureIcon(slug);
  if (known) {
    return FEATURE_ICONS.get(known) ?? Zap;
  }
  // Reason: index is from a capped list length, never from caller input.
   
  return FALLBACK_ICONS[fallbackIndex % FALLBACK_ICONS.length] ?? Zap;
}

export { HERO_FEATURE_ICONS };
