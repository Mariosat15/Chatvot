import { Schema, model, models, Document } from "mongoose";

/**
 * Countries where paid play is not offered (legal opinion s9 item 7: "geo-gate paid entry
 * to reviewed markets only"). One document, read by the main app and edited in the admin
 * app; mirrored in both.
 *
 * `enabled` defaults to FALSE so the deploy changes nothing until an operator has chosen
 * the list. The two scopes are separate switches: blocking sign-up and blocking paid
 * entry are different decisions. An existing player from a newly restricted market
 * should usually keep their account and their withdrawal route while losing paid entry.
 */
export interface IGeoRestrictionSettings extends Document {
  enabled: boolean;
  /** ISO 3166-1 alpha-2, upper case. */
  restrictedCountries: string[];
  blockRegistration: boolean;
  blockPaidEntry: boolean;
  /**
   * Refuse when the network country cannot be determined (no Cloudflare header, or
   * Cloudflare's `XX` / `T1` Tor codes). Off by default because local development and
   * any deployment not behind Cloudflare have no header at all.
   */
  blockUnknownNetworkCountry: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function normaliseCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const v of value) {
    if (typeof v !== "string") continue;
    const code = v.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) out.add(code);
  }
  return [...out].sort();
}

const GeoRestrictionSettingsSchema = new Schema<IGeoRestrictionSettings>(
  {
    enabled: { type: Boolean, default: false },
    restrictedCountries: { type: [String], default: [], set: normaliseCodes },
    blockRegistration: { type: Boolean, default: true },
    blockPaidEntry: { type: Boolean, default: true },
    blockUnknownNetworkCountry: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const GeoRestrictionSettings =
  models?.GeoRestrictionSettings ||
  model<IGeoRestrictionSettings>("GeoRestrictionSettings", GeoRestrictionSettingsSchema);

export default GeoRestrictionSettings;
