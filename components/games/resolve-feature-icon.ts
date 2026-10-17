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

/**
 * The owner's Menuitems artwork (converted into `public/assets/neon/icons/`) for the same
 * slugs, used by the arena band's How it works / Game tips rows since 15 Oct 2026 ("the
 * icons must come from Menuitems"). Same slug, same position fallback as the lucide map, so
 * an operator's pick draws the same meaning in both styles.
 */
const FEATURE_ICON_ART = new Map<HeroFeatureIcon, string>([
  ["speed", "bolt-blue"],
  ["clock", "clockbox"],
  ["players", "users-v2"],
  ["skill", "shield"],
  ["ranking", "chart-bars-blue"],
  ["reward", "trophy-gold"],
  ["target", "target-purple"],
  ["spark", "star"],
]);

const FALLBACK_ART = [
  "bolt-blue",
  "trophy-gold",
  "clockbox",
  "target-purple",
  "star",
  "shield",
];

export function resolveFeatureIconArt(
  slug: string | undefined,
  fallbackIndex = 0,
): string {
  const known = resolveHeroFeatureIcon(slug);
  const name = known
    ? (FEATURE_ICON_ART.get(known) ?? "bolt-blue")
    : (FALLBACK_ART[fallbackIndex % FALLBACK_ART.length] ?? "bolt-blue");
  return `/assets/neon/icons/${name}.webp`;
}

export { HERO_FEATURE_ICONS };
