import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { guardAnySection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import {
  ensureCatalogueEntries,
  ensureProviderCatalogueEntry,
  ensureTradingCatalogueEntry,
  getCatalogueMerchandising,
  updateCatalogueMerchandising,
  type CatalogueMerchandisingPatch,
} from "@/lib/services/games/game-catalogue-entry.service";
import ProviderGame from "@/database/models/games/provider-game.model";

/**
 * GET / PATCH /api/games/catalogue/[gameKey] — thin merchandising for one shop-window row.
 *
 * Content (name, rules, artwork) stays on provider_game / trading page content.
 * Guarded by game-providers OR trading-page: All Games and Trading Page both edit this.
 *
 * gameKey may contain colons (provider:key:code) — Next passes the decoded segment.
 */

export const dynamic = "force-dynamic";

function decodeGameKey(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameKey: string }> },
) {
  const guard = await guardAnySection(["game-providers", "trading-page"]);
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
    const { gameKey: raw } = await params;
    const gameKey = decodeGameKey(raw);
    if (!gameKey) {
      return NextResponse.json({ error: "Missing game key." }, { status: 400 });
    }

    if (gameKey === TRADING_GAME_TYPE) {
      await ensureTradingCatalogueEntry();
    } else {
      const title = await ProviderGame.findOne({ gameKey })
        .select("providerKey gameCode gameKey")
        .lean<{ providerKey: string; gameCode: string; gameKey: string } | null>();
      if (title) {
        await ensureProviderCatalogueEntry(title);
      } else {
        await ensureCatalogueEntries();
      }
    }

    const merchandising = await getCatalogueMerchandising(gameKey);
    if (!merchandising) {
      return NextResponse.json(
        { error: "No catalogue entry for that game. Enable the title first." },
        { status: 404 },
      );
    }

    return NextResponse.json({ merchandising });
  } catch (error) {
    console.error("❌ Failed to load catalogue merchandising:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameKey: string }> },
) {
  const guard = await guardAnySection(["game-providers", "trading-page"]);
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
    const { gameKey: raw } = await params;
    const gameKey = decodeGameKey(raw);
    if (!gameKey) {
      return NextResponse.json({ error: "Missing game key." }, { status: 400 });
    }

    if (gameKey === TRADING_GAME_TYPE) {
      await ensureTradingCatalogueEntry();
    } else {
      const title = await ProviderGame.findOne({ gameKey })
        .select("providerKey gameCode gameKey")
        .lean<{ providerKey: string; gameCode: string; gameKey: string } | null>();
      if (title) await ensureProviderCatalogueEntry(title);
    }

    const body = (await request.json()) as CatalogueMerchandisingPatch;
    const result = await updateCatalogueMerchandising(gameKey, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const changed = Object.keys(body).filter(
      (k) => body[k as keyof CatalogueMerchandisingPatch] !== undefined,
    );

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Catalogue merchandising updated for "${gameKey}": ${changed.join(", ")}`,
      targetType: "settings",
      targetId: gameKey,
    });

    const merchandising = await getCatalogueMerchandising(gameKey);
    return NextResponse.json({ success: true, merchandising });
  } catch (error) {
    console.error("❌ Failed to update catalogue merchandising:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
