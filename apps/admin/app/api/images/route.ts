import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { requireAdminAuth } from "@/lib/admin/auth";

export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    let settings = await WhiteLabel.findOne();
    if (!settings) {
      settings = new WhiteLabel();
      await settings.save();
    }

    return NextResponse.json({
      appLogo: settings.appLogo || "/assets/images/logo.png",
      emailLogo: settings.emailLogo || "/assets/images/logo.png",
      profileImage: settings.profileImage || "/assets/images/PROFILE.png",
      dashboardPreview:
        settings.dashboardPreview || "/assets/images/dashboard-preview.png",
      favicon: settings.favicon || "/favicon.ico",
      // SEO / Open Graph fields
      seoTitle: settings.seoTitle || "",
      seoDescription: settings.seoDescription || "",
      ogImageUrl: settings.ogImageUrl || "",
      siteUrl: settings.siteUrl || "",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get images error:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const {
      appLogo,
      emailLogo,
      profileImage,
      dashboardPreview,
      favicon,
      // SEO / Open Graph fields
      seoTitle,
      seoDescription,
      ogImageUrl,
      siteUrl,
    } = body;

    let settings = await WhiteLabel.findOne();
    if (!settings) {
      settings = new WhiteLabel();
    }

    if (appLogo !== undefined) settings.appLogo = appLogo;
    if (emailLogo !== undefined) settings.emailLogo = emailLogo;
    if (profileImage !== undefined) settings.profileImage = profileImage;
    if (dashboardPreview !== undefined)
      settings.dashboardPreview = dashboardPreview;
    if (favicon !== undefined) settings.favicon = favicon;
    // SEO fields
    if (seoTitle !== undefined) settings.seoTitle = seoTitle;
    if (seoDescription !== undefined) settings.seoDescription = seoDescription;
    if (ogImageUrl !== undefined) settings.ogImageUrl = ogImageUrl;
    if (siteUrl !== undefined) settings.siteUrl = siteUrl;

    await settings.save();

    return NextResponse.json({
      success: true,
      message: "Image configuration saved",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update images error:", error);
    return NextResponse.json(
      { error: "Failed to update images" },
      { status: 500 },
    );
  }
}
