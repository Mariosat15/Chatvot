/**
 * Ready-made visual themes for the player `/games/[slug]` page.
 *
 * MODEL-FREE AND CLIENT-SAFE. The admin All Games workspace and the player page both need
 * the same preset list; a module that reached Mongoose could not be imported by a
 * `"use client"` picker (R58). Mirrored into `apps/admin/lib/services/games/`;
 * `check:mirrors` compares models only, so these copies must stay byte-identical by test.
 *
 * AN EXPLICIT `pageThemeId` WINS. Absent means map from the title's category slug, then the
 * ChartVolt default. Never invent a theme from a display name — labels are editable content.
 */

export type GamePageThemeId =
  | "circuit-neon"
  | "racing-heat"
  | "strategy-steel"
  | "arcade-volt"
  | "trading-forge"
  | "default";

export interface GamePageTheme {
  id: GamePageThemeId;
  label: string;
  description: string;
  /** Category slugs that resolve to this theme when `pageThemeId` is absent. */
  categoryHints: string[];
  /**
   * CSS custom properties applied on the page root.
   * Keys are full custom-property names (with `--`).
   */
  cssVars: Record<string, string>;
}

const THEME_IDS: readonly GamePageThemeId[] = [
  "circuit-neon",
  "racing-heat",
  "strategy-steel",
  "arcade-volt",
  "trading-forge",
  "default",
] as const;

function vars(parts: {
  background: string;
  panel: string;
  panel2?: string;
  accent: string;
  accent2: string;
  accent3: string;
  text: string;
  muted: string;
  border: string;
  glow: string;
  ctaFrom: string;
  ctaTo: string;
  badge: string;
  gold?: string;
  green?: string;
}): Record<string, string> {
  return {
    "--gp-background": parts.background,
    "--gp-panel": parts.panel,
    "--gp-panel2": parts.panel2 ?? "#091b35",
    "--gp-accent": parts.accent,
    "--gp-accent2": parts.accent2,
    "--gp-accent3": parts.accent3,
    "--gp-text": parts.text,
    "--gp-muted": parts.muted,
    "--gp-border": parts.border,
    "--gp-glow": parts.glow,
    "--gp-cta-from": parts.ctaFrom,
    "--gp-cta-to": parts.ctaTo,
    "--gp-badge": parts.badge,
    "--gp-gold": parts.gold ?? "#ffd33d",
    "--gp-green": parts.green ?? "#15e89d",
    "--gp-card-border": "rgba(40,130,255,.35)",
    "--gp-card-shadow": "inset 0 0 24px rgba(0,130,255,.05)",
  };
}

/**
 * First theme = Circuit Sprint mock (cyan / purple neon on deep navy).
 * Reason: owner brief — ready-made themes by category; this is the reference look.
 */
export const GAME_PAGE_THEMES: readonly GamePageTheme[] = [
  {
    id: "circuit-neon",
    label: "Circuit Neon",
    description: "Deep navy with cyan and purple neon — Circuit Sprint mock.",
    categoryHints: ["puzzle", "circuit"],
    cssVars: vars({
      background: "#0a0e1a",
      panel: "#0d1225",
      accent: "#00e5ff",
      accent2: "#a855f7",
      accent3: "#ec4899",
      text: "#ffffff",
      muted: "#8ea9c9",
      border: "rgba(0, 229, 255, 0.35)",
      glow: "rgba(0, 229, 255, 0.45)",
      ctaFrom: "#a855f7",
      ctaTo: "#00e5ff",
      badge: "#00e5ff",
    }),
  },
  {
    id: "racing-heat",
    label: "Racing Heat",
    description: "Orange and red heat for racing titles.",
    categoryHints: ["racing"],
    cssVars: vars({
      background: "#120806",
      panel: "#1a0e0a",
      accent: "#ff6b2c",
      accent2: "#ef4444",
      accent3: "#fbbf24",
      text: "#fff7ed",
      muted: "#c4a484",
      border: "rgba(255, 107, 44, 0.4)",
      glow: "rgba(239, 68, 68, 0.4)",
      ctaFrom: "#ef4444",
      ctaTo: "#ff6b2c",
      badge: "#ff6b2c",
    }),
  },
  {
    id: "strategy-steel",
    label: "Strategy Steel",
    description: "Cool blue and silver for strategy titles.",
    categoryHints: ["strategy", "board", "card"],
    cssVars: vars({
      background: "#0a1018",
      panel: "#111827",
      accent: "#60a5fa",
      accent2: "#94a3b8",
      accent3: "#38bdf8",
      text: "#f1f5f9",
      muted: "#94a3b8",
      border: "rgba(148, 163, 184, 0.35)",
      glow: "rgba(96, 165, 250, 0.35)",
      ctaFrom: "#3b82f6",
      ctaTo: "#94a3b8",
      badge: "#60a5fa",
    }),
  },
  {
    id: "arcade-volt",
    label: "Arcade Volt",
    description: "Green and lime energy for arcade titles.",
    categoryHints: ["arcade", "reflex", "shooter"],
    cssVars: vars({
      background: "#061208",
      panel: "#0c1a10",
      accent: "#22c55e",
      accent2: "#a3e635",
      accent3: "#4ade80",
      text: "#f0fdf4",
      muted: "#86efac",
      border: "rgba(34, 197, 94, 0.4)",
      glow: "rgba(163, 230, 53, 0.4)",
      ctaFrom: "#16a34a",
      ctaTo: "#a3e635",
      badge: "#a3e635",
    }),
  },
  {
    id: "trading-forge",
    label: "Trading Forge",
    description: "Deep navy with cyan and purple — Trading premium mock.",
    categoryHints: ["trading"],
    cssVars: vars({
      background: "#020817",
      panel: "#07152c",
      panel2: "#091b35",
      accent: "#00d9ff",
      accent2: "#a855f7",
      accent3: "#ffd33d",
      text: "#f4f8ff",
      muted: "#8ea9c9",
      border: "rgba(40, 130, 255, 0.35)",
      glow: "rgba(0, 217, 255, 0.45)",
      ctaFrom: "#1d8fff",
      ctaTo: "#00d9ff",
      badge: "#a855f7",
      gold: "#ffd33d",
      green: "#15e89d",
    }),
  },
  {
    id: "default",
    label: "ChartVolt Default",
    description: "Platform violet and sky when no category theme applies.",
    categoryHints: [],
    cssVars: vars({
      background: "#020817",
      panel: "#07152c",
      accent: "#a855f7",
      accent2: "#38bdf8",
      accent3: "#818cf8",
      text: "#f4f8ff",
      muted: "#8ea9c9",
      border: "rgba(168, 85, 247, 0.35)",
      glow: "rgba(56, 189, 248, 0.35)",
      ctaFrom: "#7c3aed",
      ctaTo: "#38bdf8",
      badge: "#a855f7",
    }),
  },
];

const BY_ID: ReadonlyMap<string, GamePageTheme> = new Map(
  GAME_PAGE_THEMES.map((theme) => [theme.id, theme]),
);

/** Category slug → theme. Built once so resolution never scans the whole list twice. */
const BY_CATEGORY: ReadonlyMap<string, GamePageTheme> = (() => {
  const map = new Map<string, GamePageTheme>();
  for (const theme of GAME_PAGE_THEMES) {
    for (const hint of theme.categoryHints) {
      map.set(hint, theme);
    }
  }
  return map;
})();

export function isGamePageThemeId(value: string): value is GamePageThemeId {
  return THEME_IDS.includes(value as GamePageThemeId);
}

export function listGamePageThemes(): GamePageTheme[] {
  return [...GAME_PAGE_THEMES];
}

/**
 * Pick the theme for a game page.
 *
 * Reason: explicit operator choice (`pageThemeId`) must survive a category rename; category
 * is only a fallback when nobody has chosen. Unknown ids fall through rather than crashing.
 */
export function resolveGamePageTheme(
  themeId?: string | null,
  categorySlug?: string | null,
): GamePageTheme {
  if (typeof themeId === "string") {
    const trimmed = themeId.trim();
    if (trimmed !== "") {
      const explicit = BY_ID.get(trimmed);
      if (explicit) return explicit;
    }
  }

  if (typeof categorySlug === "string") {
    const slug = categorySlug.trim().toLowerCase();
    if (slug !== "") {
      const fromCategory = BY_CATEGORY.get(slug);
      if (fromCategory) return fromCategory;
    }
  }

  // Reason: BY_ID always has "default"; non-null assertion avoided for clarity.
  return BY_ID.get("default")!;
}

/**
 * Flatten a theme for a React `style` prop on the page root.
 *
 * Stored keys use camel-ish names (`--gp-background`, `--gp-accent2`). The page chrome
 * reads shorter / hyphenated aliases (`--gp-bg`, `--gp-accent-2`) so both stay set.
 */
export function themeCssVariables(
  theme: GamePageTheme,
): Record<string, string> {
  const src = theme.cssVars;
  return {
    ...src,
    "--gp-bg": src["--gp-background"] ?? "",
    "--gp-panel-2": src["--gp-panel2"] ?? "#091b35",
    "--gp-accent-2": src["--gp-accent2"] ?? "",
    "--gp-accent-3": src["--gp-accent3"] ?? "",
  };
}
