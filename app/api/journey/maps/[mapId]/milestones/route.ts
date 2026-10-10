import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import { getBadgesFromDB } from "@/lib/services/badge-config-seed.service";
import { resolveBadgeDisplayName } from "@/lib/utils/badge-display-name";

interface RouteParams {
  params: Promise<{ mapId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();

    const { mapId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const whitelabelId = searchParams.get("whitelabelId");

    if (!mapId) {
      return NextResponse.json(
        { success: false, error: "Map ID is required" },
        { status: 400 }
      );
    }

    // Get map config
    const mapQuery: Record<string, unknown> = { mapId, isActive: true };
    if (whitelabelId) {
      mapQuery.whitelabelId = whitelabelId;
    }

    const mapConfig = await JourneyMapConfig.findOne(mapQuery).lean();

    if (!mapConfig) {
      return NextResponse.json(
        { success: false, error: "Map not found" },
        { status: 404 }
      );
    }

    // Get milestones for this map
    const milestoneQuery: Record<string, unknown> = { mapId, isActive: true };
    if (whitelabelId) {
      milestoneQuery.whitelabelId = whitelabelId;
    }

    type LeanMilestone = {
      isSeasonal?: boolean;
      seasonEnd?: Date | string | null;
      requiredBadgeIds?: string[] | null;
      [key: string]: unknown;
    };

    const allMilestones = (await JourneyMilestone.find(milestoneQuery)
      .sort({ orderInMap: 1 })
      .lean()) as LeanMilestone[];

    // Filter out expired seasonal milestones, but keep future/active ones
    const now = new Date();
    const milestones = allMilestones.filter((m) => {
      if (!m.isSeasonal) return true; // Non-seasonal always shown
      // Show if season hasn't ended yet (or no end date)
      if (m.seasonEnd && now > new Date(m.seasonEnd)) return false;
      return true;
    });

    // Reason: the player dialog used to map ids through `lib/constants/badges`
    // only, so blueprint ids like `trading_beat_top_trader_flag` rendered as
    // raw slugs. Resolve against the live catalogue and humanise any miss.
    const badges = await getBadgesFromDB();
    const nameById = new Map(
      badges.map((b: { id: string; name: string }) => [b.id, b.name]),
    );
    const enriched = milestones.map((m) => {
      const ids: string[] = Array.isArray(m.requiredBadgeIds) ? m.requiredBadgeIds : [];
      return {
        ...m,
        requiredBadgeNames: ids.map((id) => resolveBadgeDisplayName(id, null, nameById)),
      };
    });

    return NextResponse.json({
      success: true,
      mapConfig,
      milestones: enriched,
      totalMilestones: enriched.length,
    });
  } catch (error) {
    console.error("Error fetching map milestones:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch map milestones" },
      { status: 500 }
    );
  }
}
