import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/database/mongoose";
import { CookieConsent } from "@/database/models/cookie-consent.model";
import { getAdminJwtSecret } from "@/lib/admin/jwt-secret";

const JWT_SECRET = getAdminJwtSecret();

async function verifyAdminToken(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_token")?.value;
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET) as { email: string };
    return payload;
  } catch {
    return null;
  }
}

// GET — Fetch cookie consent settings (admin)
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    let settings = await CookieConsent.findOne();

    // Auto-create defaults on first access
    if (!settings) {
      settings = await CookieConsent.create({});
    }

    return NextResponse.json({ success: true, settings: settings.toObject() });
  } catch (error) {
    console.error("❌ Cookie consent GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cookie consent settings" },
      { status: 500 },
    );
  }
}

// POST — Update cookie consent settings (admin)
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const body = (await request.json()) as Record<string, unknown>;

    // Find or create
    let settings = await CookieConsent.findOne();
    if (!settings) {
      settings = new CookieConsent();
    }

    // Reason: Update only the fields the admin sent, preserving anything unset.
    // Reason: Avoid dynamic object indexing to satisfy security lint rules.
    if (typeof body.enabled === "boolean") settings.enabled = body.enabled;
    if (typeof body.title === "string") settings.title = body.title;
    if (typeof body.message === "string") settings.message = body.message;
    if (typeof body.acceptAllText === "string") {
      settings.acceptAllText = body.acceptAllText;
    }
    if (typeof body.rejectAllText === "string") {
      settings.rejectAllText = body.rejectAllText;
    }
    if (typeof body.customizeText === "string") {
      settings.customizeText = body.customizeText;
    }
    if (typeof body.savePreferencesText === "string") {
      settings.savePreferencesText = body.savePreferencesText;
    }
    if (Array.isArray(body.categories)) {
      settings.categories = body.categories as typeof settings.categories;
    }
    if (typeof body.cookiePolicyUrl === "string") {
      settings.cookiePolicyUrl = body.cookiePolicyUrl;
    }
    if (typeof body.privacyPolicyUrl === "string") {
      settings.privacyPolicyUrl = body.privacyPolicyUrl;
    }
    if (
      body.position === "bottom" ||
      body.position === "bottom-left" ||
      body.position === "bottom-right"
    ) {
      settings.position = body.position;
    }
    if (typeof body.showDeclineButton === "boolean") {
      settings.showDeclineButton = body.showDeclineButton;
    }
    if (typeof body.showCustomizeButton === "boolean") {
      settings.showCustomizeButton = body.showCustomizeButton;
    }
    if (typeof body.backdropEnabled === "boolean") {
      settings.backdropEnabled = body.backdropEnabled;
    }
    if (typeof body.autoExpireDays === "number" && body.autoExpireDays > 0) {
      settings.autoExpireDays = body.autoExpireDays;
    }

    await settings.save();

    return NextResponse.json({
      success: true,
      message: "Cookie consent settings updated",
      settings: settings.toObject(),
    });
  } catch (error) {
    console.error("❌ Cookie consent POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update cookie consent settings" },
      { status: 500 },
    );
  }
}
