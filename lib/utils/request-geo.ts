/**
 * Extracts the caller's IP and best-effort geo location from an incoming
 * Next.js request. Relies exclusively on Cloudflare request headers —
 * zero external lookups, zero extra server load.
 *
 * Header sources, in priority order:
 *   - ip        : cf-connecting-ip → x-real-ip → x-forwarded-for (first)
 *   - country   : cf-ipcountry
 *   - city      : cf-ipcity
 *   - region    : cf-region
 *
 * All fields are optional. When the site is NOT served behind Cloudflare,
 * geo fields will simply be undefined; callers should treat them as such
 * and fall back to "—" in the UI.
 */

export interface RequestGeo {
  ip?: string;
  country?: string;
  city?: string;
  region?: string;
}

type HeaderBag =
  | Headers
  | { get: (name: string) => string | null | undefined };

/**
 * Pull a header value from any source that implements `.get(name)`.
 */
function h(headers: HeaderBag, name: string): string | undefined {
  const v = headers.get(name);
  if (!v) return undefined;
  const trimmed = typeof v === "string" ? v.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extract the first candidate IP from an x-forwarded-for chain.
 * Example: "203.0.113.4, 10.0.0.1" → "203.0.113.4".
 */
function firstXff(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

export function getRequestGeo(req: { headers: HeaderBag } | HeaderBag): RequestGeo {
  const headers: HeaderBag = "headers" in req ? req.headers : req;

  const ip =
    h(headers, "cf-connecting-ip") ||
    h(headers, "x-real-ip") ||
    firstXff(h(headers, "x-forwarded-for")) ||
    undefined;

  const country = h(headers, "cf-ipcountry");
  const city = h(headers, "cf-ipcity");
  const region = h(headers, "cf-region");

  return { ip, country, city, region };
}

/**
 * Compact "City, Region, Country" string for displaying geo inline.
 * Returns undefined if no geo fields are present.
 */
export function formatGeo(geo: RequestGeo): string | undefined {
  const parts = [geo.city, geo.region, geo.country].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : undefined;
}
