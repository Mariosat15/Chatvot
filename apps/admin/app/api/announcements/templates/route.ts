import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import AnnouncementTemplate from "@/database/models/announcement-template.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";

export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    // Seed defaults on first load
    await AnnouncementTemplate.seedDefaults();

    const templates = await AnnouncementTemplate.find()
      .sort({ isDefault: -1, name: 1 })
      .lean();

    return NextResponse.json({ success: true, templates });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAuth();
    const session = await getAdminSession();
    await connectToDatabase();

    const { name, title, message, type = "info" } = await req.json();

    if (!name || !title || !message) {
      return NextResponse.json(
        { error: "Name, title, and message are required" },
        { status: 400 },
      );
    }

    const template = await AnnouncementTemplate.create({
      name: name.slice(0, 100),
      title: title.slice(0, 200),
      message: message.slice(0, 2000),
      type,
      isDefault: false,
      createdBy: session?.adminId || "unknown",
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 },
    );
  }
}
