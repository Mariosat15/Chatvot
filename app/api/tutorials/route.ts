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
        "slug title description category source youtubeId filename mimeType sizeBytes durationSec thumbnailFilename order",
      )
      .lean();

    const enriched = items.map((it) => {
      const isYouTube = it.source === "youtube" && it.youtubeId;

      // Prefer a custom uploaded thumbnail; otherwise fall back to the
      // YouTube-generated thumbnail for YouTube-hosted tutorials.
      const thumbnailUrl = it.thumbnailFilename
        ? `/api/tutorials/videos/thumbnails/${encodeURIComponent(it.thumbnailFilename)}`
        : isYouTube
          ? `https://i.ytimg.com/vi/${it.youtubeId}/hqdefault.jpg`
          : null;

      return {
        _id: String(it._id),
        slug: it.slug,
        title: it.title,
        description: it.description || "",
        category: it.category,
        source: it.source || "file",
        youtubeId: isYouTube ? it.youtubeId : null,
        // Privacy-friendly embed for YouTube; null for file-hosted videos.
        embedUrl: isYouTube
          ? `https://www.youtube-nocookie.com/embed/${it.youtubeId}`
          : null,
        mimeType: it.mimeType || "",
        sizeBytes: it.sizeBytes || 0,
        durationSec: it.durationSec || null,
        // Stream URL only for file-hosted videos.
        videoUrl: isYouTube
          ? null
          : it.filename
            ? `/api/tutorials/videos/${encodeURIComponent(it.filename)}`
            : null,
        thumbnailUrl,
        order: it.order,
      };
    });

    return NextResponse.json({ success: true, items: enriched });
  } catch (err) {
    console.error("❌ [Tutorials list] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load tutorials" },
      { status: 500 },
    );
  }
}
