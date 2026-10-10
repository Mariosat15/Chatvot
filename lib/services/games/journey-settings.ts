/**
 * Platform-wide journey master switch.
 *
 * Reason: operators need one control to hide the whole journey system from
 * players without deleting maps. Missing document = enabled (fail open) so
 * existing installs keep working until someone flips it off.
 */

import { connectToDatabase } from "@/database/mongoose";
import XPConfig from "@/database/models/xp-config.model";

export const JOURNEY_SETTINGS_CONFIG_TYPE = "journey_settings" as const;

export interface JourneySettings {
  /** When false, player APIs return no maps and the /journey page shows disabled. */
  enabled: boolean;
}

export const DEFAULT_JOURNEY_SETTINGS: JourneySettings = {
  enabled: true,
};

export async function getJourneySettings(): Promise<JourneySettings> {
  await connectToDatabase();
  const doc = await XPConfig.findOne({
    configType: JOURNEY_SETTINGS_CONFIG_TYPE,
    isActive: true,
  })
    .lean<{ data?: { enabled?: boolean } }>();
  if (!doc?.data || typeof doc.data.enabled !== "boolean") {
    return { ...DEFAULT_JOURNEY_SETTINGS };
  }
  return { enabled: doc.data.enabled };
}

export async function setJourneySettings(
  settings: JourneySettings,
): Promise<JourneySettings> {
  await connectToDatabase();
  const enabled = settings.enabled === true;
  await XPConfig.findOneAndUpdate(
    { configType: JOURNEY_SETTINGS_CONFIG_TYPE },
    {
      $set: {
        configType: JOURNEY_SETTINGS_CONFIG_TYPE,
        data: { enabled },
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );
  return { enabled };
}

export async function areJourneysEnabled(): Promise<boolean> {
  const settings = await getJourneySettings();
  return settings.enabled;
}
