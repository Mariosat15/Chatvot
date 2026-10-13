/**
 * Who may register, and who may pay to enter, by country (legal opinion s9 item 7).
 *
 * PURE and model-free, so the sign-up form, the server gates and the tests share one rule
 * rather than three copies of it.
 *
 * Two countries are consulted and either one restricted is enough to refuse:
 *   - the NETWORK country, from Cloudflare's `cf-ipcountry`. Hard for a player to change,
 *     though a VPN can.
 *   - the DECLARED country, the one the player chose at sign-up and stored on the profile.
 *     Without it, a player from a restricted market could register on a VPN and then play
 *     from home.
 * The country list on the sign-up form hides restricted countries, but hiding is a
 * convenience, not a control. The server refuses a restricted declared country anyway.
 */

export type GeoAction = "register" | "paid_entry";

export interface GeoRestrictionFacts {
  enabled: boolean;
  restrictedCountries: readonly string[];
  blockRegistration: boolean;
  blockPaidEntry: boolean;
  blockUnknownNetworkCountry: boolean;
}

export type GeoDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: "GEO_RESTRICTED" | "GEO_UNKNOWN";
      basis: "network" | "declared" | "unknown";
      country?: string;
      message: string;
    };

export const GEO_RESTRICTED_REGISTER_MESSAGE =
  "Registration is not available in your country.";
export const GEO_RESTRICTED_ENTRY_MESSAGE =
  "Paid competitions and challenges are not available in your country.";
export const GEO_UNKNOWN_MESSAGE =
  "We could not confirm your location, so this is not available right now. Please disable any VPN or proxy and try again.";

/** Cloudflare codes meaning "no country": unknown and Tor exit nodes. */
const NO_COUNTRY_CODES = new Set(["XX", "T1"]);

/** Upper-case ISO alpha-2, or undefined for anything that is not a usable country. */
export function normaliseCountryCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{2}$/.test(code) || NO_COUNTRY_CODES.has(code)) return undefined;
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

/** True when the rule is live and lists this country. Used to filter the sign-up list. */
export function isCountryRestricted(facts: GeoRestrictionFacts, country: unknown): boolean {
  if (!facts.enabled) return false;
  const code = normaliseCountryCode(country);
  if (!code) return false;
  return facts.restrictedCountries.some((c) => c.toUpperCase() === code);
}

export function evaluateGeoAccess(
  facts: GeoRestrictionFacts,
  action: GeoAction,
  input: { networkCountry?: string | null; declaredCountry?: string | null },
): GeoDecision {
  if (!facts.enabled) return { allowed: true };
  if (action === "register" && !facts.blockRegistration) return { allowed: true };
  if (action === "paid_entry" && !facts.blockPaidEntry) return { allowed: true };

  const message =
    action === "register" ? GEO_RESTRICTED_REGISTER_MESSAGE : GEO_RESTRICTED_ENTRY_MESSAGE;
  const network = normaliseCountryCode(input.networkCountry);
  const declared = normaliseCountryCode(input.declaredCountry);

  if (network && isCountryRestricted(facts, network)) {
    return { allowed: false, code: "GEO_RESTRICTED", basis: "network", country: network, message };
  }
  if (declared && isCountryRestricted(facts, declared)) {
    return { allowed: false, code: "GEO_RESTRICTED", basis: "declared", country: declared, message };
  }
  if (!network && facts.blockUnknownNetworkCountry) {
    return { allowed: false, code: "GEO_UNKNOWN", basis: "unknown", message: GEO_UNKNOWN_MESSAGE };
  }
  return { allowed: true };
}
