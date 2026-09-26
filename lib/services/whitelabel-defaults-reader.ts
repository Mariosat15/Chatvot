/**
 * White-Label Defaults Reader (Main App)
 *
 * Lightweight reader that checks for saved JSON default files.
 * The admin app writes these files; the main app only reads them.
 * Used during seed operations to prefer saved defaults over hardcoded constants.
 */

import path from "path";
import fs from "fs";

function resolveDefaultsDir(): string {
  const cwd = process.cwd();
  return path.join(cwd, "data", "defaults");
}

const DEFAULTS_DIR = resolveDefaultsDir();

function readDefaultFile(type: string): any | null {
  const filePath = path.join(DEFAULTS_DIR, `${type}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Defaults] Failed to read ${filePath}:`, err);
    return null;
  }
}

export function getDefaultBadges(): any[] | null {
  return readDefaultFile("badges");
}

export function getDefaultXPConfig(): { badgeXP: any; levels: any } | null {
  return readDefaultFile("xp_config");
}

export function getDefaultMilestones(): { milestones: any[]; maps: any[] } | null {
  return readDefaultFile("milestones");
}

export function getDefaultPages(): any[] | null {
  return readDefaultFile("pages");
}