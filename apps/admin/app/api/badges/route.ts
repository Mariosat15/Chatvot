import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import { getBadgesFromDB } from "@/lib/services/badge-config-seed.service";
import { guardSection } from "@/lib/admin/section-route-guard";
import {
  BADGE_CATEGORY_IDS,
  conditionAllowedOnBadge,
} from "@/lib/services/games/badge-condition-registry";

function normalizeGameTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["trading"];
  return raw
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
}

function validateBadgePayload(badge: {
  category?: string;
  condition?: { type?: string };
  gameTypes?: unknown;
}): string | null {
  if (badge.category && !BADGE_CATEGORY_IDS.includes(badge.category)) {
    return `Unknown category: ${badge.category}`;
  }
  const gameTypes = normalizeGameTypes(badge.gameTypes);
  const type = badge.condition?.type;
  if (type && !conditionAllowedOnBadge(type, gameTypes)) {
    return `Condition "${type}" is not allowed for gameTypes [${gameTypes.join(", ") || "platform"}]`;
  }
  return null;
}
/**
 * GET /api/admin/badges
 * Get all badges from database
 */
export async function GET() {
  try {
    const guard = await guardSection("badges");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
    const badges = await getBadgesFromDB();

    return NextResponse.json({
      success: true,
      badges,
      total: badges.length,
    });
  } catch (error) {
    console.error("Error fetching badges:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch badges" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/badges
 * Add a new badge to database
 */
export async function POST(request: NextRequest) {
  try {
    // Reason: a badge's `condition` is the rule deciding who earns it, so an anonymous write
    // here changes what every player can achieve. Guarded per handler rather than once at the
    // top of the file - a file-level convention is invisible to a reviewer reading one export.
    const guard = await guardSection("badges");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
    const badge = await request.json();

    // Validate badge structure
    if (!badge.id || !badge.name || !badge.category || !badge.rarity) {
      return NextResponse.json(
        { success: false, error: "Invalid badge structure" },
        { status: 400 },
      );
    }

    // Check if badge ID already exists
    const existing = await BadgeConfig.findOne({ id: badge.id });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Badge ID already exists" },
        { status: 400 },
      );
    }

    const gameTypes = normalizeGameTypes(badge.gameTypes);
    const validationError = validateBadgePayload({ ...badge, gameTypes });
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 },
      );
    }

    // Create badge in database
    const newBadge = await BadgeConfig.create({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      icon: badge.icon || "🏆",
      rarity: badge.rarity,
      condition: badge.condition || { type: "manual" },
      minLevel: badge.minLevel ?? 0,
      gameTypes,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      message: "Badge created successfully!",
      badge: newBadge,
    });
  } catch (error) {
    console.error("Error adding badge:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add badge" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/badges
 * Update an existing badge in database
 */
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("badges");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
    const badge = await request.json();

    if (!badge.id) {
      return NextResponse.json(
        { success: false, error: "Badge ID required" },
        { status: 400 },
      );
    }

    // Validate badge structure
    if (!badge.name || !badge.category || !badge.rarity) {
      return NextResponse.json(
        { success: false, error: "Invalid badge structure" },
        { status: 400 },
      );
    }

    // Update badge in database
    // Reason: omit gameTypes from the body must mean "keep", never silently
    // rewrite a platform badge to trading-only.
    const existingDoc = await BadgeConfig.findOne({ id: badge.id }).lean();
    if (!existingDoc) {
      return NextResponse.json(
        { success: false, error: "Badge not found" },
        { status: 404 },
      );
    }
    const gameTypes = Array.isArray(badge.gameTypes)
      ? normalizeGameTypes(badge.gameTypes)
      : normalizeGameTypes((existingDoc as { gameTypes?: string[] }).gameTypes);
    const validationError = validateBadgePayload({ ...badge, gameTypes });
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 },
      );
    }

    const updatedBadge = await BadgeConfig.findOneAndUpdate(
      { id: badge.id },
      {
        name: badge.name,
        description: badge.description,
        category: badge.category,
        icon: badge.icon || "🏆",
        rarity: badge.rarity,
        condition: badge.condition || { type: "manual" },
        minLevel: badge.minLevel ?? 0,
        gameTypes,
      },
      { new: true },
    );

    if (!updatedBadge) {
      return NextResponse.json(
        { success: false, error: "Badge not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Badge updated successfully!",
      badge: updatedBadge,
    });
  } catch (error) {
    console.error("Error updating badge:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update badge" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/badges
 * Delete a badge from database (soft delete by setting isActive to false)
 */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await guardSection("badges");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const badgeId = searchParams.get("badgeId");

    if (!badgeId) {
      return NextResponse.json(
        { success: false, error: "Badge ID required" },
        { status: 400 },
      );
    }

    // Soft delete - set isActive to false
    const deletedBadge = await BadgeConfig.findOneAndUpdate(
      { id: badgeId },
      { isActive: false },
      { new: true },
    );

    if (!deletedBadge) {
      return NextResponse.json(
        { success: false, error: "Badge not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Badge deleted successfully!",
      badgeId,
    });
  } catch (error) {
    console.error("Error deleting badge:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete badge" },
      { status: 500 },
    );
  }
}
