import mongoose from "mongoose";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import GeoRestrictionSettings from "@/database/models/geo-restriction-settings.model";
import { getRequestGeo } from "@/lib/utils/request-geo";
import {
  evaluateGeoAccess,
  type GeoAction,
  type GeoDecision,
  type GeoRestrictionFacts,
} from "./geo-access-rule";

/**
 * Server half of the geo-gate. Reads the settings, the caller's network country and
 * the player's declared country, then asks `geo-access-rule.ts` for the decision.
 * Main app only. The admin app writes the settings and enforces nothing.
 */

export const GEO_DEFAULTS: GeoRestrictionFacts = {
  enabled: false,
  restrictedCountries: [],
  blockRegistration: true,
  blockPaidEntry: true,
  blockUnknownNetworkCountry: false,
};

const CACHE_MS = 30_000;
let cached: { facts: GeoRestrictionFacts; at: number } | null = null;

export function clearGeoRestrictionCache(): void {
  cached = null;
}

export async function getGeoRestrictionFacts(): Promise<GeoRestrictionFacts> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.facts;
  try {
    await connectToDatabase();
    const doc = await GeoRestrictionSettings.findOne()
      .lean<Partial<GeoRestrictionFacts> | null>();
    const facts: GeoRestrictionFacts = {
      enabled: doc?.enabled === true,
      restrictedCountries: Array.isArray(doc?.restrictedCountries) ? doc.restrictedCountries : [],
      blockRegistration: doc?.blockRegistration !== false,
      blockPaidEntry: doc?.blockPaidEntry !== false,
      blockUnknownNetworkCountry: doc?.blockUnknownNetworkCountry === true,
    };
    cached = { facts, at: Date.now() };
    return facts;
  } catch (error) {
    // Reason: keep enforcing the last list we read rather than dropping the gate during
    // a database hiccup. With no list read yet there is nothing to enforce.
    console.warn("⚠️ Geo restriction settings unavailable:", error);
    return cached?.facts ?? GEO_DEFAULTS;
  }
}

/** The caller's network country, or undefined outside a request or behind no CDN. */
export async function readNetworkCountry(): Promise<string | undefined> {
  try {
    return getRequestGeo(await headers()).country;
  } catch {
    return undefined;
  }
}

/** The country stored on the player's profile at sign-up. */
export async function getDeclaredCountry(userId: string): Promise<string | undefined> {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return undefined;
    // Reason: Better Auth keeps identity in `_id`; some rows also carry `id` (R68).
    const or: Record<string, unknown>[] = [{ id: userId }];
    if (mongoose.Types.ObjectId.isValid(userId)) {
      or.push({ _id: new mongoose.Types.ObjectId(userId) });
    }
    const user = await db
      .collection("user")
      .findOne({ $or: or }, { projection: { country: 1 } });
    return typeof user?.country === "string" ? user.country : undefined;
  } catch {
    return undefined;
  }
}

export async function checkGeoAccess(
  action: GeoAction,
  input: { userId?: string; declaredCountry?: string | null; networkCountry?: string | null },
): Promise<GeoDecision> {
  const facts = await getGeoRestrictionFacts();
  if (!facts.enabled) return { allowed: true };
  const networkCountry = input.networkCountry ?? (await readNetworkCountry());
  const declaredCountry =
    input.declaredCountry ?? (input.userId ? await getDeclaredCountry(input.userId) : undefined);
  const decision = evaluateGeoAccess(facts, action, { networkCountry, declaredCountry });
  if (!decision.allowed) {
    console.warn(
      `⚠️ Geo gate refused ${action}: basis=${decision.basis} country=${decision.country ?? "unknown"} user=${input.userId ?? "-"}`,
    );
  }
  return decision;
}
