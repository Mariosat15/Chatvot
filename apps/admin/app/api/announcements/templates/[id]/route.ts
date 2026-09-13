import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import AnnouncementTemplate from "@/database/models/announcement-template.model";
import { requireAdminAuth } from "@/lib/admin/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;
    const template = await AnnouncementTemplate.findById(id);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    if (template.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete default templates" },
        { status: 400 },
      );
    }

    await AnnouncementTemplate.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete template error:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 },
    );
  }
}
