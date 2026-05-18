import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { TutorialVideo } from "@/database/models/tutorial-video.model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/tutorials — public (authenticated user) list of ACTIVE tutorials.
 *
 * Reason: Returns only active tutorials, with stream URLs ready for the
 * dashboard "Tutorials" tab. Auth-gated so we can extend with
 * personalisation later (e.g. "watched" tracking) without breaking
 * the contract.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectToDatabase();
    const items = await TutorialVideo.find({ isActive: true })
      .sort({ category: 1, order: 1, createdAt: -1 })
      .select(
        "slug title description category filename mimeType sizeBytes durationSec thumbnailFilename order",
      )
      .lean();

    const enriched = items.map((it) => ({
      _id: String(it._id),
      slug: it.slug,
      title: it.title,
      description: it.description || "",
      category: it.category,
      mimeType: it.mimeType,
      sizeBytes: it.sizeBytes,
      durationSec: it.durationSec || null,
      videoUrl: `/api/tutorials/videos/${encodeURIComponent(it.filename)}`,
      thumbnailUrl: it.thumbnailFilename
        ? `/api/tutorials/videos/thumbnails/${encodeURIComponent(it.thumbnailFilename)}`
        : null,
      order: it.order,
    }));

    return NextResponse.json({ success: true, items: enriched });
  } catch (err) {
    console.error("❌ [Tutorials list] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load tutorials" },
      { status: 500 },
    );
  }
}
