import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { clearEmailBrandCache } from "@/lib/nodemailer/email-brand";
import { DEFAULT_EMAIL_DISCLAIMER } from "@/lib/nodemailer/chartvolt-email-layout";

const FALLBACK_ERROR = "Something went wrong. Please contact support.";
const MAX_DISCLAIMER_LENGTH = 2000;

// GET - the platform-wide email disclaimer shown at the foot of every email
export async function GET() {
  try {
    const guard = await guardSection("email-templates");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const wl = await WhiteLabel.findOne()
      .select("emailDisclaimer showEmailDisclaimer")
      .lean<{ emailDisclaimer?: string; showEmailDisclaimer?: boolean }>();

    return NextResponse.json({
      success: true,
      emailDisclaimer: wl?.emailDisclaimer ?? "",
      // Reason: an absent stored flag reads as on - a schema default fixes
      // future rows only, and the sender treats only an explicit false as off.
      showEmailDisclaimer: wl?.showEmailDisclaimer !== false,
      defaultDisclaimer: DEFAULT_EMAIL_DISCLAIMER,
    });
  } catch (error) {
    console.error("❌ Error loading email disclaimer:", error);
    return NextResponse.json({ success: false, error: FALLBACK_ERROR }, { status: 500 });
  }
}

// PUT - update the disclaimer text and/or its on/off switch
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("email-templates");
    if (!guard.ok) return guard.response;

    const body = (await request.json().catch(() => null)) as {
      emailDisclaimer?: unknown;
      showEmailDisclaimer?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const updates: { emailDisclaimer?: string; showEmailDisclaimer?: boolean } = {};
    if (body.emailDisclaimer !== undefined) {
      if (typeof body.emailDisclaimer !== "string") {
        return NextResponse.json({ success: false, error: "Disclaimer must be text" }, { status: 400 });
      }
      const text = body.emailDisclaimer.trim();
      if (text.length > MAX_DISCLAIMER_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Disclaimer must be at most ${MAX_DISCLAIMER_LENGTH} characters` },
          { status: 400 },
        );
      }
      updates.emailDisclaimer = text;
    }
    if (body.showEmailDisclaimer !== undefined) {
      if (typeof body.showEmailDisclaimer !== "boolean") {
        return NextResponse.json({ success: false, error: "showEmailDisclaimer must be true or false" }, { status: 400 });
      }
      updates.showEmailDisclaimer = body.showEmailDisclaimer;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    await connectToDatabase();
    await WhiteLabel.findOneAndUpdate({}, { $set: updates }, { upsert: true });
    // Reason: the brand is cached for 60s per process; this clears the admin
    // process now, and the player app picks the change up within a minute.
    clearEmailBrandCache();

    const admin = guard.admin;
    if (admin) {
      await auditLogService.logSettingsUpdated(
        { id: admin.id, email: admin.email || "admin", name: admin.name },
        "email_disclaimer",
        null,
        Object.keys(updates),
      );
    }

    return NextResponse.json({ success: true, message: "Email disclaimer updated" });
  } catch (error) {
    console.error("❌ Error updating email disclaimer:", error);
    return NextResponse.json({ success: false, error: FALLBACK_ERROR }, { status: 500 });
  }
}
