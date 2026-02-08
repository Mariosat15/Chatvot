import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { seedMarketplaceItems } from "@/lib/services/marketplace-seed.service";

const MARKETPLACE_CACHE_TTL_MS = 60 * 1000;
const marketplaceListCache = new Map<
  string,
  { data: { success: true; items: unknown[] }; ts: number }
>();

// Escape special regex characters to prevent ReDoS attacks
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/marketplace
 * Get all marketplace items with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Auto-seed if no items exist
    const existingCount = await MarketplaceItem.countDocuments();
    if (existingCount === 0) {
      await seedMarketplaceItems();
    }

    // Check if Game Master packages exist and are published
    const publishedGMCount = await MarketplaceItem.countDocuments({
      category: "gamemaster",
      isPublished: true,
      status: "active",
    });
    if (publishedGMCount === 0) {
      await seedMarketplaceItems();
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");
    const free = searchParams.get("free");
    const search = searchParams.get("search");

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      isPublished: true,
      status: "active",
    };

    if (category) {
      query.category = category;
    }

    if (featured === "true") {
      query.isFeatured = true;
    }

    if (free === "true") {
      query.isFree = true;
    }

    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { shortDescription: { $regex: escapedSearch, $options: "i" } },
        { tags: { $in: [new RegExp(escapedSearch, "i")] } },
      ];
    }

    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      userId = session?.user?.id ?? null;
    } catch {
      // not authenticated
    }

    const cacheKey = searchParams.toString() + "|" + (userId ?? "anon");
    if (!search) {
      const cached = marketplaceListCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < MARKETPLACE_CACHE_TTL_MS) {
        return NextResponse.json(cached.data, {
          headers: {
            "Cache-Control":
              "private, s-maxage=60, stale-while-revalidate=120",
          },
        });
      }
    }

    const items = await MarketplaceItem.find(query)
      .sort({ isFeatured: -1, totalPurchases: -1, createdAt: -1 })
      .limit(100)
      .lean();

    let userPurchases: string[] = [];
    if (userId) {
      const purchases = await UserPurchase.find({
        userId,
      })
          .select("itemId")
          .limit(500)
          .lean();
      userPurchases = purchases.map((p) => p.itemId.toString());
    }

    const itemsWithOwnership = items.map((item) => ({
      ...item,
      owned: userPurchases.includes(item._id.toString()),
    }));

    const payload = { success: true as const, items: itemsWithOwnership };
    if (!search) {
      marketplaceListCache.set(cacheKey, { data: payload, ts: Date.now() });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch marketplace items" },
      { status: 500 },
    );
  }
}
