/**
 * Phone number normalisation for registration and profile edits.
 *
 * Model-free and safe for client components (R58): it never imports a database
 * driver. The server still re-validates before any write — the browser check is
 * feedback only.
 *
 * Stored form is always E.164 (e.g. `+35799123456`). That is what makes
 * `+357 99 123456` and `0035799123456` the same number for the duplicate check.
 *
 * Reason the verification fields are NOT here: `phoneVerified` / `phoneVerifiedAt`
 * are write-time facts on the user document. This module only answers "is this a
 * real number for that country, and what is its canonical form?".
 */

import {
  parsePhoneNumberFromString,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
} from "libphonenumber-js";

export type PhoneParseOk = {
  ok: true;
  e164: string;
  country: CountryCode;
  nationalNumber: string;
};

export type PhoneParseFail = {
  ok: false;
  error: string;
};

export type PhoneParseResult = PhoneParseOk | PhoneParseFail;

/** ISO country codes libphonenumber can dial. */
export function listDialCountries(): CountryCode[] {
  return getCountries();
}

export function dialCodeFor(country: string): string | null {
  if (!isSupportedCountry(country)) return null;
  return `+${getCountryCallingCode(country)}`;
}

/**
 * Parse a national (or already-international) number for a chosen country into
 * E.164. Empty input is a distinct failure so callers can decide whether empty
 * is allowed (profile) or refused (registration).
 */
export function parsePhoneInput(
  raw: string | null | undefined,
  defaultCountry?: string | null,
): PhoneParseResult {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return { ok: false, error: "Phone number is required" };
  }

  const country =
    defaultCountry && isSupportedCountry(defaultCountry)
      ? (defaultCountry as CountryCode)
      : undefined;

  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (!parsed) {
    return {
      ok: false,
      error: "Enter a valid phone number for the selected country",
    };
  }
  if (!parsed.isValid()) {
    return {
      ok: false,
      error: "That phone number is not valid for the selected country",
    };
  }

  const resolvedCountry = parsed.country || country;
  // Reason: a valid E.164 without a country is rare (international-prefix only)
  // and we need an ISO code for the dial picker and admin flag. Refuse rather
  // than invent one.
  if (!resolvedCountry) {
    return {
      ok: false,
      error: "Select a country for this phone number",
    };
  }

  return {
    ok: true,
    e164: parsed.format("E.164"),
    country: resolvedCountry,
    nationalNumber: parsed.nationalNumber,
  };
}

/**
 * Optional-phone variant for profile edits: blank clears the number; anything
 * else must parse. Never invents a value from an absent one.
 */
export function parseOptionalPhoneInput(
  raw: string | null | undefined,
  defaultCountry?: string | null,
): PhoneParseResult | { ok: true; e164: null; country: null; nationalNumber: null } {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return { ok: true, e164: null, country: null, nationalNumber: null };
  }
  return parsePhoneInput(trimmed, defaultCountry);
}

/** True when the string is already a stored E.164 value we would accept. */
export function isE164Phone(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const parsed = parsePhoneNumberFromString(value.trim());
  return Boolean(parsed?.isValid() && parsed.format("E.164") === value.trim());
}
