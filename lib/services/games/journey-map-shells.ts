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

export const JOURNEY_MAP_SHELLS: readonly {
  mapId: string;
  name: string;
  description: string;
  theme: MapTheme;
  backgroundColor: string;
}[] = [
  {
    mapId: "pirate_cove",
    name: "Pirate Cove",
    description: "Begin your voyage — trade or play your first contests.",
    theme: "pirate",
    backgroundColor: "#1a3a5c",
  },
  {
    mapId: "space_station",
    name: "Space Station",
    description: "Build momentum among the stars.",
    theme: "space",
    backgroundColor: "#0B1026",
  },
  {
    mapId: "medieval_castle",
    name: "Medieval Castle",
    description: "Prove yourself in contests and competitions.",
    theme: "medieval",
    backgroundColor: "#2A1810",
  },
  {
    mapId: "cyber_city",
    name: "Cyber City",
    description: "Precision and streaks under neon lights.",
    theme: "cyber",
    backgroundColor: "#0A1628",
  },
  {
    mapId: "ancient_temple",
    name: "Ancient Temple",
    description: "Deeper volume and podium finishes.",
    theme: "ancient",
    backgroundColor: "#1C1408",
  },
  {
    mapId: "volcanic_island",
    name: "Volcanic Island",
    description: "Heat rises — harder targets, bigger rewards.",
    theme: "volcanic",
    backgroundColor: "#1A0A0A",
  },
  {
    mapId: "arctic_fortress",
    name: "Arctic Fortress",
    description: "Endurance across many sessions.",
    theme: "arctic",
    backgroundColor: "#0A1A28",
  },
  {
    mapId: "dragon_realm",
    name: "Dragon Realm",
    description: "High stakes — wins and podiums matter.",
    theme: "dragon",
    backgroundColor: "#1A0A14",
  },
  {
    mapId: "celestial_kingdom",
    name: "Celestial Kingdom",
    description: "Near the top of the ladder.",
    theme: "celestial",
    backgroundColor: "#120A28",
  },
  {
    mapId: "hall_of_legends",
    name: "Hall of Legends",
    description: "The ultimate challenge for traders and gamers alike.",
    theme: "legendary",
    backgroundColor: "#1A1A2E",
  },
];

/** Schema hard cap on `JourneyMapConfig.sequenceOrder`. */
export const MAX_JOURNEY_MAPS = 10;
export const DEFAULT_MAP_COUNT = 10;
