/**
 * Historic 10-map journey shells. Kept as mapIds so existing progress / deep
 * links survive a regenerate, and so the editor's legacy fallbacks still resolve.
 *
 * Split from `journey-blueprint.ts` to keep that file under the 500-line limit.
 */

export type MapTheme =
  | "pirate"
  | "space"
  | "medieval"
  | "cyber"
  | "ancient"
  | "volcanic"
  | "arctic"
  | "dragon"
  | "celestial"
  | "legendary";

export type ThemeZoneTemplate = {
  suffix: string;
  name: string;
  description: string;
  color: string;
  icon: string;
};

/**
 * Reason: art files live at `/assets/maps/{mapId with dashes}.png`. Generation
 * must stamp this on every map — missing `backgroundImage` falls through to
 * pirate-cove ("Treasure Map") on every theme.
 */
export function backgroundImageForMapId(mapId: string): string {
  return `/assets/maps/${mapId.replace(/_/g, "-")}.png`;
}

/** Prefer stored URL; otherwise derive from mapId before any pirate default. */
export function resolveMapBackgroundImage(
  mapId?: string | null,
  stored?: string | null,
): string {
  if (typeof stored === "string" && stored.trim().length > 0) return stored.trim();
  if (typeof mapId === "string" && mapId.trim().length > 0) {
    return backgroundImageForMapId(mapId.trim());
  }
  return "/assets/maps/pirate-cove.png";
}

/**
 * Progressive XP budgets — restored from the pre-R106 sequence so later maps
 * pay more than early onboarding chapters.
 */
export const MAP_XP_BUDGETS = [
  150, 200, 300, 400, 500, 700, 1000, 1500, 2500, 5000,
] as const;

/** Progressive milestone counts — later maps are longer, not copies of map 1. */
export const MAP_MILESTONE_COUNTS = [
  12, 14, 16, 18, 18, 20, 22, 24, 26, 30,
] as const;

/** Theme-specific zone chrome (ids are still prefixed with mapId at build time). */
export const THEME_ZONES: Record<MapTheme, readonly ThemeZoneTemplate[]> = {
  pirate: [
    { suffix: "dock", name: "Starting Dock", description: "Where every voyage begins", color: "#22C55E", icon: "anchor" },
    { suffix: "harbor", name: "Harbor Town", description: "Learn the basics", color: "#3B82F6", icon: "compass" },
    { suffix: "cove", name: "Secret Cove", description: "First treasure awaits", color: "#F59E0B", icon: "treasure" },
  ],
  space: [
    { suffix: "launch", name: "Launch Bay", description: "Prepare for liftoff", color: "#8B5CF6", icon: "rocket" },
    { suffix: "orbit", name: "Orbital Deck", description: "Zero-gravity practice", color: "#06B6D4", icon: "planet" },
    { suffix: "cosmos", name: "Deep Space", description: "Galactic targets", color: "#F59E0B", icon: "star" },
  ],
  medieval: [
    { suffix: "village", name: "Village Gate", description: "Swear the oath", color: "#92400E", icon: "sword" },
    { suffix: "training", name: "Training Yard", description: "Build skill", color: "#B45309", icon: "shield1" },
    { suffix: "throne", name: "Throne Hall", description: "Prove mastery", color: "#F59E0B", icon: "crown" },
  ],
  cyber: [
    { suffix: "terminal", name: "System Terminal", description: "Boot the grid", color: "#00FFFF", icon: "power" },
    { suffix: "grid", name: "Data Grid", description: "Precision runs", color: "#22D3EE", icon: "cpu" },
    { suffix: "core", name: "Core Node", description: "High-stakes targets", color: "#A855F7", icon: "chip" },
  ],
  ancient: [
    { suffix: "entrance", name: "Temple Entrance", description: "Step into the ruins", color: "#D4A373", icon: "temple" },
    { suffix: "halls", name: "Inner Halls", description: "Deeper challenges", color: "#C2410C", icon: "scroll" },
    { suffix: "sanctum", name: "Inner Sanctum", description: "Sacred scores", color: "#F59E0B", icon: "gem" },
  ],
  volcanic: [
    { suffix: "shore", name: "Ash Shore", description: "Land on the island", color: "#DC2626", icon: "fire" },
    { suffix: "ridge", name: "Lava Ridge", description: "Heat rises", color: "#EA580C", icon: "volcano" },
    { suffix: "crater", name: "Crater Peak", description: "Hottest targets", color: "#F59E0B", icon: "flame" },
  ],
  arctic: [
    { suffix: "tundra", name: "Frozen Tundra", description: "Brave the cold", color: "#38BDF8", icon: "snowflake" },
    { suffix: "glacier", name: "Glacier Path", description: "Endurance runs", color: "#0EA5E9", icon: "ice" },
    { suffix: "fortress", name: "Ice Fortress", description: "Hold the line", color: "#F8FAFC", icon: "castle" },
  ],
  dragon: [
    { suffix: "gate", name: "Dragon's Gate", description: "Enter the realm", color: "#A855F7", icon: "dragonEgg" },
    { suffix: "lair", name: "Smoky Lair", description: "High stakes", color: "#7C3AED", icon: "dragon" },
    { suffix: "hoard", name: "Hoard Chamber", description: "Legendary prizes", color: "#F59E0B", icon: "gold" },
  ],
  celestial: [
    { suffix: "gates", name: "Heavenly Gates", description: "Rise higher", color: "#FFD700", icon: "angel" },
    { suffix: "clouds", name: "Cloud Walk", description: "Near the summit", color: "#FDE68A", icon: "cloud" },
    { suffix: "throne", name: "Celestial Throne", description: "Almost legend", color: "#FBBF24", icon: "sun" },
  ],
  legendary: [
    { suffix: "entrance", name: "Hall Entrance", description: "Join the legends", color: "#FFD700", icon: "legend" },
    { suffix: "gallery", name: "Heroes Gallery", description: "Elite company", color: "#EAB308", icon: "trophy" },
    { suffix: "apex", name: "Apex Chamber", description: "The ultimate test", color: "#F59E0B", icon: "crown" },
  ],
};

export const JOURNEY_MAP_SHELLS: readonly {
  mapId: string;
  name: string;
  description: string;
  theme: MapTheme;
  backgroundColor: string;
  backgroundImage: string;
}[] = [
  {
    mapId: "pirate_cove",
    name: "Pirate Cove",
    description: "Begin your voyage — account, KYC, deposit, then first contests.",
    theme: "pirate",
    backgroundColor: "#1a3a5c",
    backgroundImage: backgroundImageForMapId("pirate_cove"),
  },
  {
    mapId: "space_station",
    name: "Space Station",
    description: "Build momentum among the stars.",
    theme: "space",
    backgroundColor: "#0B1026",
    backgroundImage: backgroundImageForMapId("space_station"),
  },
  {
    mapId: "medieval_castle",
    name: "Medieval Castle",
    description: "Prove yourself in contests and competitions.",
    theme: "medieval",
    backgroundColor: "#2A1810",
    backgroundImage: backgroundImageForMapId("medieval_castle"),
  },
  {
    mapId: "cyber_city",
    name: "Cyber City",
    description: "Precision and streaks under neon lights.",
    theme: "cyber",
    backgroundColor: "#0A1628",
    backgroundImage: backgroundImageForMapId("cyber_city"),
  },
  {
    mapId: "ancient_temple",
    name: "Ancient Temple",
    description: "Deeper volume and podium finishes.",
    theme: "ancient",
    backgroundColor: "#1C1408",
    backgroundImage: backgroundImageForMapId("ancient_temple"),
  },
  {
    mapId: "volcanic_island",
    name: "Volcanic Island",
    description: "Heat rises — harder targets, bigger rewards.",
    theme: "volcanic",
    backgroundColor: "#1A0A0A",
    backgroundImage: backgroundImageForMapId("volcanic_island"),
  },
  {
    mapId: "arctic_fortress",
    name: "Arctic Fortress",
    description: "Endurance across many sessions.",
    theme: "arctic",
    backgroundColor: "#0A1A28",
    backgroundImage: backgroundImageForMapId("arctic_fortress"),
  },
  {
    mapId: "dragon_realm",
    name: "Dragon Realm",
    description: "High stakes — wins and podiums matter.",
    theme: "dragon",
    backgroundColor: "#1A0A14",
    backgroundImage: backgroundImageForMapId("dragon_realm"),
  },
  {
    mapId: "celestial_kingdom",
    name: "Celestial Kingdom",
    description: "Near the top of the ladder.",
    theme: "celestial",
    backgroundColor: "#120A28",
    backgroundImage: backgroundImageForMapId("celestial_kingdom"),
  },
  {
    mapId: "hall_of_legends",
    name: "Hall of Legends",
    description: "The ultimate challenge for traders and gamers alike.",
    theme: "legendary",
    backgroundColor: "#1A1A2E",
    backgroundImage: backgroundImageForMapId("hall_of_legends"),
  },
];

/** Schema hard cap on `JourneyMapConfig.sequenceOrder`. */
export const MAX_JOURNEY_MAPS = 10;
export const DEFAULT_MAP_COUNT = 10;
