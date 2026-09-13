import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { seedMarketplaceItems } from "@/lib/services/marketplace-seed.service";

// Short TTL so admin price changes propagate quickly (5 seconds)
const MARKETPLACE_CACHE_TTL_MS = 5 * 1000;
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
            "Cache-Control": "private, no-cache, must-revalidate",
          },
        });
      }
    }

    const items = await MarketplaceItem.find(query)
      .sort({ isFeatured: -1, totalPurchases: -1, createdAt: -1 })
      .limit(100)
      .lean();

    let userPurchases: string[] = [];
    // Reason: needed by the marketplace UI to render "Renew" instead of
    // "Owned" on the user's own expired GameMaster package, and to short-
    // circuit the "owned -> arsenal" router push so the user can renew
    // without hunting through the profile section.
    let gmSubscription: {
      packageId?: string;
      status?: string;
      endDate?: Date | string;
      renewalPrice?: number;
      packageName?: string;
    } | null = null;
    if (userId) {
      const [purchases, gmSub] = await Promise.all([
        UserPurchase.find({ userId }).select("itemId").limit(500).lean(),
        GameMasterSubscription.findOne({ userId })
          .select("packageId status endDate renewalPrice packageName")
          .lean<{
            packageId?: string | { toString(): string };
            status?: string;
            endDate?: Date | string;
            renewalPrice?: number;
            packageName?: string;
          } | null>(),
      ]);
      userPurchases = purchases.map((p) => p.itemId.toString());
      gmSubscription = gmSub
        ? {
            packageId: gmSub.packageId
              ? typeof gmSub.packageId === "string"
                ? gmSub.packageId
                : gmSub.packageId.toString()
              : undefined,
            status: gmSub.status,
            endDate: gmSub.endDate,
            renewalPrice: gmSub.renewalPrice,
            packageName: gmSub.packageName,
          }
        : null;
    }

    // Pre-compute expiry once; identical for every GM item in this list.
    const gmExpired = gmSubscription
      ? gmSubscription.status === "expired" ||
        (gmSubscription.endDate
          ? new Date(gmSubscription.endDate).getTime() <= Date.now()
          : false)
      : false;

    const itemsWithOwnership = items.map((item) => {
      const itemId = item._id.toString();
      const owned = userPurchases.includes(itemId);
      const enriched: Record<string, unknown> = { ...item, owned };
      if (
        item.category === "gamemaster" &&
        gmSubscription?.packageId === itemId
      ) {
        enriched.gameMasterSubscriptionStatus = gmExpired
          ? "expired"
          : "active";
        enriched.gameMasterRenewalPrice = gmSubscription.renewalPrice;
      }
      return enriched;
    });

    const payload = { success: true as const, items: itemsWithOwnership };
    if (!search) {
      marketplaceListCache.set(cacheKey, { data: payload, ts: Date.now() });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch marketplace items" },
      { status: 500 },
    );
  }
}
