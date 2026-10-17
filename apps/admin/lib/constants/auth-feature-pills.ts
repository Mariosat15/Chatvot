/**
 * The feature pills under the sign-in card ("AI Markets Simulation", ...).
 *
 * Operator content stored on HeroSettings.authPageFeaturePills and edited in
 * admin Branding. This file is mirrored byte-for-byte into
 * apps/admin/lib/constants/ and must stay model-free: the admin editor is a
 * "use client" component (R58).
 */
import {
  Award,
  BarChart3,
  Brain,
  Coins,
  Crown,
  Flame,
  Gamepad2,
  Gift,
  Medal,
  Puzzle,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AuthFeaturePill = { label: string; icon: string };

export const AUTH_PILL_MAX_COUNT = 8;
export const AUTH_PILL_MAX_LABEL_LENGTH = 40;

// Reason: a Map, never an object, because the key arrives from a request body
// and a stored document; an object lookup walks the prototype chain and
// "__proto__" would pass as a known icon.
export const AUTH_PILL_ICONS: ReadonlyMap<string, LucideIcon> = new Map([
  ["bar-chart", BarChart3],
  ["gamepad", Gamepad2],
  ["swords", Swords],
  ["trophy", Trophy],
  ["gift", Gift],
  ["zap", Zap],
  ["star", Star],
  ["users", Users],
  ["brain", Brain],
  ["target", Target],
  ["coins", Coins],
  ["rocket", Rocket],
  ["shield", Shield],
  ["crown", Crown],
  ["puzzle", Puzzle],
  ["medal", Medal],
  ["sparkles", Sparkles],
  ["trending-up", TrendingUp],
  ["award", Award],
  ["flame", Flame],
]);

export const DEFAULT_AUTH_FEATURE_PILLS: readonly AuthFeaturePill[] = [
  { label: "AI Markets Simulation", icon: "bar-chart" },
  { label: "Skill Games & Puzzles", icon: "gamepad" },
  { label: "Competitions & Tournaments", icon: "swords" },
  { label: "Live Leaderboards", icon: "trophy" },
  { label: "Exciting Rewards", icon: "gift" },
];

type ValidationResult =
  | { ok: true; value: AuthFeaturePill[] }
  | { ok: false; error: string };

/**
 * Validates what the admin editor sends. Refuses rather than silently
 * dropping, so a save never appears to work while discarding a row.
 */
export function validateAuthFeaturePills(raw: unknown): ValidationResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Feature pills must be a list" };
  }
  if (raw.length > AUTH_PILL_MAX_COUNT) {
    return {
      ok: false,
      error: `At most ${AUTH_PILL_MAX_COUNT} feature pills are allowed`,
    };
  }
  const value: AuthFeaturePill[] = [];
  for (const [index, entry] of raw.entries()) {
    const row = entry as { label?: unknown; icon?: unknown } | null;
    const label = typeof row?.label === "string" ? row.label.trim() : "";
    const icon = typeof row?.icon === "string" ? row.icon : "";
    if (!label) {
      return { ok: false, error: `Pill ${index + 1} needs a label` };
    }
    if (label.length > AUTH_PILL_MAX_LABEL_LENGTH) {
      return {
        ok: false,
        error: `Pill ${index + 1} label is longer than ${AUTH_PILL_MAX_LABEL_LENGTH} characters`,
      };
    }
    if (!AUTH_PILL_ICONS.has(icon)) {
      return { ok: false, error: `Pill ${index + 1} has an unknown icon "${icon}"` };
    }
    value.push({ label, icon });
  }
  return { ok: true, value };
}

/**
 * What the sign-in page shows. Unset (never saved, or reset) means the shipped
 * defaults; a saved empty list means the operator removed every pill.
 */
export function resolveAuthFeaturePills(stored: unknown): AuthFeaturePill[] {
  if (stored === undefined || stored === null) {
    return DEFAULT_AUTH_FEATURE_PILLS.map((pill) => ({ ...pill }));
  }
  const checked = validateAuthFeaturePills(stored);
  return checked.ok
    ? checked.value
    : DEFAULT_AUTH_FEATURE_PILLS.map((pill) => ({ ...pill }));
}
