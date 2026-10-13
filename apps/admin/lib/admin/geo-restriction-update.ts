/**
 * Validates an operator's edit to the country-restriction settings. Pure, so the rule is
 * testable without a request.
 *
 * An unknown field is REFUSED with its name rather than dropped: dropping means the edit
 * appears to save while doing nothing. A malformed country code is refused too, because
 * the model's setter would otherwise discard it silently and the operator would believe
 * a market was restricted when it was not.
 */

export const GEO_BOOLEAN_FIELDS = [
  "enabled",
  "blockRegistration",
  "blockPaidEntry",
  "blockUnknownNetworkCountry",
] as const;

type GeoBooleanField = (typeof GEO_BOOLEAN_FIELDS)[number];

export interface GeoRestrictionUpdate {
  enabled?: boolean;
  blockRegistration?: boolean;
  blockPaidEntry?: boolean;
  blockUnknownNetworkCountry?: boolean;
  restrictedCountries?: string[];
}

export type GeoUpdateResult =
  | { ok: true; update: GeoRestrictionUpdate }
  | { ok: false; error: string };

// Reason: a Set has no prototype chain, so a request key such as "constructor" cannot
// pass the lookup.
const BOOLEAN_FIELDS = new Set<string>(GEO_BOOLEAN_FIELDS);
const ISO2 = /^[A-Z]{2}$/;

export function validateGeoRestrictionUpdate(body: unknown): GeoUpdateResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be an object." };
  }
  const update: GeoRestrictionUpdate = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (BOOLEAN_FIELDS.has(key)) {
      if (typeof value !== "boolean") {
        return { ok: false, error: `${key} must be true or false.` };
      }
      update[key as GeoBooleanField] = value;
      continue;
    }
    if (key === "restrictedCountries") {
      if (!Array.isArray(value)) {
        return { ok: false, error: "restrictedCountries must be a list." };
      }
      const codes = new Set<string>();
      for (const raw of value) {
        const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
        if (!ISO2.test(code)) {
          return {
            ok: false,
            error: `"${String(raw)}" is not a two-letter country code.`,
          };
        }
        codes.add(code);
      }
      update.restrictedCountries = [...codes].sort();
      continue;
    }
    return { ok: false, error: `Unknown field: ${key}` };
  }
  if (Object.keys(update).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }
  return { ok: true, update };
}
