/**
 * White-Label Defaults Service
 *
 * Saves and restores badge, XP, and milestone configurations as JSON files.
 * These files ship with the codebase so new white-label deployments
 * automatically get the curated defaults on first launch.
 *
 * Flow:
 *   Admin customizes -> "Save as Default" -> JSON written to data/defaults/
 *   New deployment / DB reset -> seed reads from JSON -> populated DB
 */

import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import XPConfig from "@/database/models/xp-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import path from "path";
import fs from "fs";

// ─── File paths ──────────────────────────────────────────────────────────────
// Resolve to the repo root's data/defaults/ directory so both the main app
// and admin app can read the same default files.
function resolveDefaultsDir(): string {
  const cwd = process.cwd();
  // If running from apps/admin, go up two levels to repo root
  if (cwd.endsWith("apps/admin") || cwd.endsWith("apps\\admin")) {
    return path.join(cwd, "..", "..", "data", "defaults");
  }
  return path.join(cwd, "data", "defaults");
}
const DEFAULTS_DIR = resolveDefaultsDir();

function ensureDir() {
  if (!fs.existsSync(DEFAULTS_DIR)) {
    fs.mkdirSync(DEFAULTS_DIR, { recursive: true });
  }
}

function defaultPath(type: string): string {
  return path.join(DEFAULTS_DIR, `${type}.json`);
}

// ─── Generic read / write ────────────────────────────────────────────────────

function writeDefaultFile(type: string, data: any): { count: number; path: string } {
  ensureDir();
  const filePath = defaultPath(type);
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, "utf-8");
  const count = Array.isArray(data) ? data.length : (data?.items?.length ?? 1);
  console.log(`[Defaults] Saved ${type} defaults (${count} items) -> ${filePath}`);
  return { count, path: filePath };
}

function readDefaultFile(type: string): any | null {
  const filePath = defaultPath(type);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Defaults] Failed to read ${filePath}:`, err);
    return null;
  }
}

export function hasDefaults(type: string): { exists: boolean; savedAt: Date | null; count: number } {
  const filePath = defaultPath(type);
  if (!fs.existsSync(filePath)) return { exists: false, savedAt: null, count: 0 };
  const stat = fs.statSync(filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    const count = Array.isArray(data) ? data.length : (data?.items?.length ?? 1);
    return { exists: true, savedAt: stat.mtime, count };
  } catch {
    return { exists: true, savedAt: stat.mtime, count: 0 };
  }
}

// ─── Save current DB state as defaults ───────────────────────────────────────

export async function saveBadgeDefaults() {
  await connectToDatabase();
  const badges = await BadgeConfig.find({}).lean();
  // Strip Mongo internals
  const clean = badges.map((b: any) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = b;
    return rest;
  });
  return writeDefaultFile("badges", clean);
}

export async function saveXPDefaults() {
  await connectToDatabase();
  const badgeXP = await XPConfig.findOne({ configType: "badge_xp", isActive: true }).lean();
  const levels = await XPConfig.findOne({ configType: "level_progression", isActive: true }).lean();
  const data = {
    badgeXP: badgeXP?.data ?? null,
    levels: levels?.data?.levels ?? levels?.data ?? null,
  };
  return writeDefaultFile("xp_config", data);
}

export async function saveMilestoneDefaults() {
  await connectToDatabase();
  const milestones = await JourneyMilestone.find({ isActive: true }).lean();
  const maps = await JourneyMapConfig.find({}).lean();

  const cleanMilestones = milestones.map((m: any) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = m;
    return rest;
  });
  const cleanMaps = maps.map((m: any) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = m;
    return rest;
  });

  const data = { milestones: cleanMilestones, maps: cleanMaps };
  return writeDefaultFile("milestones", data);
}

// ─── Restore defaults into DB ────────────────────────────────────────────────

export function getDefaultBadges(): any[] | null {
  return readDefaultFile("badges");
}

export function getDefaultXPConfig(): { badgeXP: any; levels: any } | null {
  return readDefaultFile("xp_config");
}

export function getDefaultMilestones(): { milestones: any[]; maps: any[] } | null {
  return readDefaultFile("milestones");
}

/**
 * Seed badges from saved defaults. Returns true if defaults were used.
 */
export async function seedBadgesFromDefaults(): Promise<boolean> {
  const defaults = getDefaultBadges();
  if (!defaults || defaults.length === 0) return false;

  await connectToDatabase();
  await BadgeConfig.deleteMany({});
  await BadgeConfig.insertMany(defaults);
  console.log(`[Defaults] Seeded ${defaults.length} badges from saved defaults`);
  return true;
}

/**
 * Seed XP config from saved defaults. Returns true if defaults were used.
 */
export async function seedXPFromDefaults(): Promise<boolean> {
  const defaults = getDefaultXPConfig();
  if (!defaults || !defaults.badgeXP) return false;

  await connectToDatabase();
  await XPConfig.deleteMany({});

  await XPConfig.create({
    configType: "badge_xp",
    data: defaults.badgeXP,
    isActive: true,
  });

  if (defaults.levels) {
    await XPConfig.create({
      configType: "level_progression",
      data: { levels: defaults.levels },
      isActive: true,
    });
  }

  console.log("[Defaults] Seeded XP config from saved defaults");
  return true;
}

/**
 * Seed milestones + maps from saved defaults. Returns true if defaults were used.
 */
export async function seedMilestonesFromDefaults(): Promise<boolean> {
  const defaults = getDefaultMilestones();
  if (!defaults || !defaults.milestones?.length) return false;

  await connectToDatabase();
  await JourneyMilestone.deleteMany({});
  await JourneyMapConfig.deleteMany({});

  if (defaults.milestones.length > 0) {
    await JourneyMilestone.insertMany(defaults.milestones, { ordered: false });
  }
  if (defaults.maps?.length > 0) {
    await JourneyMapConfig.insertMany(defaults.maps, { ordered: false });
  }

  console.log(`[Defaults] Seeded ${defaults.milestones.length} milestones + ${defaults.maps?.length || 0} maps from saved defaults`);
  return true;
}

/**
 * Get summary of all saved defaults
 */
export function getDefaultsSummary() {
  return {
    badges: hasDefaults("badges"),
    xp_config: hasDefaults("xp_config"),
    milestones: hasDefaults("milestones"),
  };
}
