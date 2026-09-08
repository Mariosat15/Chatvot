import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { verifyAdminAuth } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";
import { connectToDatabase } from "@/database/mongoose";
import {
  putBrandingAsset,
  deleteBrandingAsset,
} from "@/lib/services/branding-assets.service";

// POST - Upload hero images
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated || !auth.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // 'hero', 'logo', 'favicon', 'screenshot', 'testimonial'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "video/mp4",
      "video/webm",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Validate file size (max 10MB for images, 50MB for videos)
    const maxSize = file.type.startsWith("video/")
      ? 50 * 1024 * 1024
      : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    // Try multiple upload directories (production first)
    const possibleUploadDirs = [
      path.join("/var/www/chartvolt", "public", "uploads", "hero"),
      path.join(process.cwd(), "..", "..", "public", "uploads", "hero"),
      path.join(process.cwd(), "public", "uploads", "hero"),
    ];

    // Generate unique filename
    const ext = file.name.split(".").pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${type}-${timestamp}-${randomStr}.${ext}`;

    // Write file to first writable directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let uploadDir: string | null = null;
    for (const dir of possibleUploadDirs) {
      try {
        if (!existsSync(dir)) await mkdir(dir, { recursive: true });
        const filepath = path.join(dir, filename);
        await writeFile(filepath, buffer);
        uploadDir = dir;
        break;
      } catch {
        continue;
      }
    }

    if (!uploadDir) {
      return NextResponse.json(
        { error: "No writable upload directory available" },
        { status: 500 },
      );
    }

    // Backup file to MongoDB for persistence across servers/deployments
    try {
      await connectToDatabase();
      // A Map rather than an object literal, so a crafted extension cannot reach
      // Object.prototype and return something that is not a content type.
      const contentTypes = new Map<string, string>([
        ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"],
        ["gif", "image/gif"], ["webp", "image/webp"], ["svg", "image/svg+xml"],
        ["mp4", "video/mp4"], ["webm", "video/webm"],
      ]);
      const contentType =
        contentTypes.get((ext || "png").toLowerCase()) || file.type;

      // Reason: one document per image, because this used to be an entry in the shared
      // WhiteLabel document and that document reached MongoDB's 16MB ceiling on
      // 8 September 2026, at which point no image on the platform could be stored.
      await putBrandingAsset(filename, buffer, contentType);
      console.log(`💾 [Hero Upload] Backed up to DB: ${filename}`);
    } catch (dbErr) {
      console.warn(`⚠️ [Hero Upload] Could not backup to DB:`, dbErr);
    }

    // Create audit log
    await auditLogService.log({
      admin: {
        id: auth.adminId,
        email: auth.email || "unknown",
        name: auth.name,
      },
      action: "UPLOAD_HERO_IMAGE",
      category: "content",
      description: `Uploaded ${type} image: ${filename}`,
      metadata: { filename, type, size: file.size },
    });

    // Return API-served path so it works across all servers
    return NextResponse.json({
      success: true,
      url: `/api/assets/hero/${filename}`,
      filename,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading hero image:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}

// DELETE - Delete hero image
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated || !auth.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json(
        { error: "No filename provided" },
        { status: 400 },
      );
    }

    // Security: Ensure filename doesn't contain path traversal
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filepath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "hero",
      filename,
    );

    // Check if file exists and delete from disk
    if (existsSync(filepath)) {
      const { unlink } = await import("fs/promises");
      await unlink(filepath);
    }

    // Also remove from database backup - both the collection and, for an image uploaded
    // before 8 September 2026, the legacy map. Missing either leaves the file being served
    // from the database after the operator has deleted it.
    try {
      await deleteBrandingAsset(filename);
    } catch {}

    // Create audit log
    await auditLogService.log({
      admin: {
        id: auth.adminId,
        email: auth.email || "unknown",
        name: auth.name,
      },
      action: "DELETE_HERO_IMAGE",
      category: "content",
      description: `Deleted hero image: ${filename}`,
      metadata: { filename },
    });

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting hero image:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }
}
