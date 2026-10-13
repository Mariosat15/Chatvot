import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import GeoRestrictionSettings from "@/database/models/geo-restriction-settings.model";
import { validateGeoRestrictionUpdate } from "@/lib/admin/geo-restriction-update";

/**
 * GET / PUT /api/geo-restrictions - the countries where sign-up and paid entry are
 * refused (legal opinion s9 item 7). The main app enforces it in `signUpWithEmail`,
 * `enterContest` and both challenge routes, reading through a 30-second cache.
 */

export const dynamic = "force-dynamic";

const DEFAULTS = {
  enabled: false,
  restrictedCountries: [] as string[],
  blockRegistration: true,
  blockPaidEntry: true,
  blockUnknownNetworkCountry: false,
};

function toDto(doc: Record<string, unknown> | null) {
  if (!doc) return { ...DEFAULTS, updatedAt: null };
  return {
    enabled: doc.enabled === true,
    restrictedCountries: Array.isArray(doc.restrictedCountries)
      ? (doc.restrictedCountries as string[])
      : [],
    blockRegistration: doc.blockRegistration !== false,
    blockPaidEntry: doc.blockPaidEntry !== false,
    blockUnknownNetworkCountry: doc.blockUnknownNetworkCountry === true,
    updatedAt: doc.updatedAt ?? null,
  };
}

export async function GET() {
  const guard = await guardSection("geo-restrictions");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
    const doc = await GeoRestrictionSettings.findOne({}).lean();
    return NextResponse.json({ success: true, settings: toDto(doc as Record<string, unknown> | null) });
  } catch (error) {
    console.error("❌ Failed to load country restrictions:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const guard = await guardSection("geo-restrictions");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const result = validateGeoRestrictionUpdate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const doc = await GeoRestrictionSettings.findOneAndUpdate(
      {},
      { $set: result.update },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();
    return NextResponse.json({ success: true, settings: toDto(doc as Record<string, unknown> | null) });
  } catch (error) {
    console.error("❌ Failed to save country restrictions:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
