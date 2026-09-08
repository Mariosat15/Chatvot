import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { storeGameArtwork } from "@/lib/admin/game-artwork-storage";

/**
 * POST /api/games/providers/[providerKey]/games/artwork - upload a title's logo or banner
 *
 * Returns the URL only. Writing it onto the title is a separate call to the `content` route,
 * deliberately: an upload that saved the file and then failed to store the URL would leave
 * an operator with no way to find the image again, whereas two steps means the second one
 * can be retried against a URL they can still see in the form.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const gameCode = form.get("gameCode");
    const slot = form.get("slot");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image was attached." }, { status: 400 });
    }
    if (typeof gameCode !== "string" || gameCode === "") {
      return NextResponse.json({ error: "A game code is required." }, { status: 400 });
    }
    // Compared against the two literals rather than cast, because the value reaches the
    // stored filename - an unchecked one is caller-supplied text in a path.
    if (slot !== "logo" && slot !== "banner") {
      return NextResponse.json(
        { error: "An image must be uploaded as either a logo or a banner." },
        { status: 400 },
      );
    }

    const result = await storeGameArtwork(file, providerKey, gameCode, slot);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error("❌ Failed to upload game artwork:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
