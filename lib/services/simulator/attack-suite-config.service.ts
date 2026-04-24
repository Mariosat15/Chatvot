/**
 * Attack Suite configuration service.
 *
 * Single source of truth for whether the Attack Suite is enabled and for the
 * inter-service secret used by `/api/simulator/attack/*` routes. Config lives
 * in MongoDB so admins can toggle/rotate from the admin UI without touching
 * env vars or redeploying.
 */

import crypto from "crypto";
import { connectToDatabase } from "@/database/mongoose";
import {
  AttackSuiteConfig,
  type IAttackSuiteConfig,
} from "@/database/models/simulator/attack-suite-config.model";

export interface AttackSuiteAdmin {
  adminId: string;
  email: string;
  name?: string;
}

export interface PublicAttackSuiteConfig {
  enabled: boolean;
  secretSet: boolean;
  secretPreview: string | null; // e.g., "••••••••abcd" or null if unset
  secretSetAt: Date | null;
  updatedBy: AttackSuiteAdmin | null;
  updatedAt: Date | null;
}

/**
 * Fetch-or-create the singleton config doc. Always returns a doc with
 * `enabled: false` and `secret: null` on first call after a fresh deploy.
 */
export async function getOrCreateAttackSuiteConfig(): Promise<IAttackSuiteConfig> {
  await connectToDatabase();
  const existing = await AttackSuiteConfig.findOne({ slug: "attack-suite" });
  if (existing) return existing;

  // Reason: upsert-style create to survive race conditions if two servers hit
  // this at the same time after a fresh deploy.
  const created = await AttackSuiteConfig.findOneAndUpdate(
    { slug: "attack-suite" },
    {
      $setOnInsert: {
        slug: "attack-suite",
        enabled: false,
        secret: null,
        secretSetAt: null,
        updatedBy: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return created as IAttackSuiteConfig;
}

/**
 * Public view of the config — NEVER includes the raw secret. UI uses this
 * shape to decide whether to show the enabled toggle and whether to show a
 * "secret set" indicator.
 */
export async function getPublicAttackSuiteConfig(): Promise<PublicAttackSuiteConfig> {
  const cfg = await getOrCreateAttackSuiteConfig();
  const secretSet = typeof cfg.secret === "string" && cfg.secret.length > 0;
  return {
    enabled: cfg.enabled,
    secretSet,
    secretPreview: secretSet
      ? `••••••••${(cfg.secret as string).slice(-4)}`
      : null,
    secretSetAt: cfg.secretSetAt ?? null,
    updatedBy: cfg.updatedBy ?? null,
    updatedAt: cfg.updatedAt ?? null,
  };
}

/**
 * Internal read of the raw secret. NEVER expose the return value to any
 * client response. Only guard code (for compare) and the admin kickoff route
 * (for forwarding to the main app) should call this.
 */
export async function getAttackSuiteSecret(): Promise<string | null> {
  const cfg = await getOrCreateAttackSuiteConfig();
  return typeof cfg.secret === "string" && cfg.secret.length > 0
    ? cfg.secret
    : null;
}

/** True only if both the toggle is on AND a non-empty secret is configured. */
export async function isAttackSuiteEnabled(): Promise<boolean> {
  const cfg = await getOrCreateAttackSuiteConfig();
  if (!cfg.enabled) return false;
  if (typeof cfg.secret !== "string" || cfg.secret.length < 16) return false;
  return true;
}

/** Toggle enabled. Requires an admin. */
export async function setAttackSuiteEnabled(
  enabled: boolean,
  admin: AttackSuiteAdmin,
): Promise<PublicAttackSuiteConfig> {
  await connectToDatabase();
  await AttackSuiteConfig.findOneAndUpdate(
    { slug: "attack-suite" },
    {
      $set: {
        enabled,
        updatedBy: {
          adminId: admin.adminId,
          email: admin.email,
          name: admin.name,
        },
      },
      $setOnInsert: {
        slug: "attack-suite",
        secret: null,
        secretSetAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return getPublicAttackSuiteConfig();
}

/**
 * Generate a brand-new 32-byte hex secret and store it. Returns the plaintext
 * secret ONCE so the UI can show a copy-to-clipboard dialog. Callers must
 * treat this string as sensitive.
 */
export async function rotateAttackSuiteSecret(
  admin: AttackSuiteAdmin,
): Promise<{ secret: string; config: PublicAttackSuiteConfig }> {
  await connectToDatabase();
  const newSecret = crypto.randomBytes(32).toString("hex");
  await AttackSuiteConfig.findOneAndUpdate(
    { slug: "attack-suite" },
    {
      $set: {
        secret: newSecret,
        secretSetAt: new Date(),
        updatedBy: {
          adminId: admin.adminId,
          email: admin.email,
          name: admin.name,
        },
      },
      $setOnInsert: {
        slug: "attack-suite",
        enabled: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const config = await getPublicAttackSuiteConfig();
  return { secret: newSecret, config };
}

/**
 * Clear the stored secret (used by an explicit "Revoke Secret" action, which
 * also forces `enabled = false` because we require both).
 */
export async function clearAttackSuiteSecret(
  admin: AttackSuiteAdmin,
): Promise<PublicAttackSuiteConfig> {
  await connectToDatabase();
  await AttackSuiteConfig.findOneAndUpdate(
    { slug: "attack-suite" },
    {
      $set: {
        secret: null,
        secretSetAt: null,
        enabled: false,
        updatedBy: {
          adminId: admin.adminId,
          email: admin.email,
          name: admin.name,
        },
      },
      $setOnInsert: {
        slug: "attack-suite",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return getPublicAttackSuiteConfig();
}
