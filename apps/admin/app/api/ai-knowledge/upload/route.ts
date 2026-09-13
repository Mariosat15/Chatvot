import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { aiKnowledgeService } from "@/lib/services/ai-knowledge.service";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import DOMPurify from "isomorphic-dompurify";

// Supported file types
const SUPPORTED_TYPES = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/html": "html",
};

// POST - Upload document for processing
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "";
    const category = (formData.get("category") as string) || "General";
    const description = (formData.get("description") as string) || "";
    const tags = (formData.get("tags") as string) || "";
    const audienceRaw = (formData.get("audience") as string) || "customer";

    // Validate audience - default to customer for safety
    const validAudiences = ["customer", "admin", "both"];
    const audience = validAudiences.includes(audienceRaw)
      ? audienceRaw
      : "customer";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file type
    const mimeType = file.type;
    const extension = SUPPORTED_TYPES[mimeType as keyof typeof SUPPORTED_TYPES];

    if (!extension) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${mimeType}. Supported: PDF, TXT, MD, DOCX, HTML`,
        },
        { status: 400 },
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 },
      );
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    let content = "";

    // Parse based on file type
    if (extension === "txt" || extension === "md" || extension === "html") {
      content = buffer.toString("utf-8");

      // Safe HTML stripping for HTML files using DOMPurify
      if (extension === "html") {
        // Use DOMPurify to strip all HTML tags safely
        content = DOMPurify.sanitize(content, { ALLOWED_TAGS: [] });
        // Clean up whitespace
        content = content.replace(/\s+/g, " ").trim();
      }
    } else if (extension === "pdf") {
      // For PDF, we'll create the source and process later with a PDF library
      // For now, return that PDF processing will be done asynchronously
      content = `[PDF Content from: ${file.name}]\n\nThis PDF needs to be processed. Please use a PDF text extraction tool and re-upload as text.`;
    } else if (extension === "docx") {
      // For DOCX, similar to PDF
      content = `[DOCX Content from: ${file.name}]\n\nThis DOCX needs to be processed. Please use a DOCX text extraction tool and re-upload as text.`;
    }

    // Save file for reference
    const uploadsDir = path.join(process.cwd(), "uploads", "ai-knowledge");
    await mkdir(uploadsDir, { recursive: true });

    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = path.join(uploadsDir, `${timestamp}-${safeFileName}`);
    await writeFile(filePath, buffer);

    // Create knowledge source with audience
    const source = await aiKnowledgeService.createSource({
      name: name || file.name.replace(/\.[^/.]+$/, ""),
      type: "document",
      audience: audience as "customer" | "admin" | "both", // Include audience
      content,
      originalFileName: file.name,
      fileUrl: `/uploads/ai-knowledge/${timestamp}-${safeFileName}`,
      mimeType,
      fileSize: file.size,
      metadata: {
        title: name || file.name,
        description,
        category,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      },
      createdBy: admin.adminId || "system",
    });

    return NextResponse.json({
      success: true,
      source,
      message: "Document uploaded and processed successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error uploading document:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload document",
      },
      { status: 500 },
    );
  }
}
