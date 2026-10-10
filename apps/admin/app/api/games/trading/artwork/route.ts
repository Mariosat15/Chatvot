import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { storeGameArtwork } from "@/lib/admin/game-artwork-storage";
import { isArtworkSlot } from "@/lib/admin/game-artwork-slots";
import {
  TRADING_PAGE_ARTWORK_CODE,
  TRADING_PAGE_ARTWORK_PROVIDER,
} from "@/lib/services/games/trading-page-defaults";

/**
 * POST /api/games/trading/artwork — upload an image for the Trading player page.
 *
 * Reuses `storeGameArtwork` with fixed provider/code slugs so filenames stay namespaced
 * without inventing a fake `provider_game` row. Returns the URL only; attaching it is a
 * separate PATCH to `/api/games/trading/page-content`.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await guardSection("trading-page");
  if (!guard.ok) return guard.response;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const slot = form.get("slot");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image was attached." }, { status: 400 });
    }
    if (!isArtworkSlot(slot)) {
      return NextResponse.json(
        { error: "That is not an image slot on a game title." },
        { status: 400 },
      );
    }

    const result = await storeGameArtwork(
      file,
      TRADING_PAGE_ARTWORK_PROVIDER,
      TRADING_PAGE_ARTWORK_CODE,
      slot,
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error("❌ Failed to upload trading page artwork:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
