import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";

/**
 * GET /api/journey-milestones
 * Get all milestones for a map or a specific milestone
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get("mapId") || "traders_journey";
    const milestoneId = searchParams.get("id");
    const zoneId = searchParams.get("zoneId");

    // If specific milestone ID provided
    if (milestoneId) {
      const milestone = await JourneyMilestone.findOne({ id: milestoneId }).lean();
      if (!milestone) {
        return NextResponse.json(
          { success: false, error: "Milestone not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, milestone });
    }

    // Build query
    const query: any = { mapId };
    if (zoneId) query.zoneId = zoneId;

    const milestones = await JourneyMilestone.find(query)
      .sort({ order: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      milestones,
      total: milestones.length,
    });
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch milestones" },
      { status: 500 }
    );
  }
}

/** Build a milestone document from raw data */
function buildMilestoneDoc(data: any) {
  return {
    id: data.id,
    mapId: data.mapId || "traders_journey",
    name: data.name,
    description: data.description || "",
    shortDescription: data.shortDescription || "",
    zoneId: data.zoneId,
    position: data.position || { x: 0, y: 0 },
    nodeType: data.nodeType || "milestone",
    icon: data.icon || "target",
    color: data.color || "#3B82F6",
    size: data.size || "medium",
    unlockCondition: data.unlockCondition,
    completeCondition: data.completeCondition,
    rewards: data.rewards || { xp: 10 },
    connectedTo: data.connectedTo || [],
    connectedFrom: data.connectedFrom || [],
    isRequired: data.isRequired ?? true,
    isAutoComplete: data.isAutoComplete ?? false,
    order: data.order || 0,
    tooltipText: data.tooltipText,
    celebrationText: data.celebrationText,
    isActive: data.isActive ?? true,
    // Badge-gated milestone support
    requiredBadgeIds: data.requiredBadgeIds || [],
    // Seasonal milestone support
    isSeasonal: data.isSeasonal || false,
    seasonStart: data.seasonStart || undefined,
    seasonEnd: data.seasonEnd || undefined,
    seasonTag: data.seasonTag || undefined,
  };
}

/**
 * POST /api/journey-milestones
 * Create a new milestone or batch-create multiple milestones
 * 
 * Single: { id, name, zoneId, completeCondition, ... }
 * Batch:  { batch: true, milestones: [...], mapId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const data = await request.json();

    // === BATCH MODE: Save many milestones in one request ===
    if (data.batch && Array.isArray(data.milestones)) {
      const milestones = data.milestones;
      const results: { saved: number; skipped: number; errors: string[] } = {
        saved: 0,
        skipped: 0,
        errors: [],
      };

      // Get existing IDs in one query to avoid N+1
      const incomingIds = milestones.map((m: any) => m.id).filter(Boolean);
      const existingDocs = await JourneyMilestone.find(
        { id: { $in: incomingIds } },
        { id: 1 }
      ).lean();
      const existingIds = new Set(existingDocs.map((d: any) => d.id));

      // Split into new and updates
      const toInsert: any[] = [];
      const toUpdate: any[] = [];

      for (const m of milestones) {
        if (!m.id || !m.name) {
          results.errors.push(`Skipped milestone: missing id or name`);
          results.skipped++;
          continue;
        }
        const doc = buildMilestoneDoc(m);
        if (existingIds.has(m.id)) {
          toUpdate.push(doc);
        } else {
          toInsert.push(doc);
        }
      }

      // Bulk insert new milestones
      if (toInsert.length > 0) {
        try {
          await JourneyMilestone.insertMany(toInsert, { ordered: false });
          results.saved += toInsert.length;
        } catch (insertError: any) {
          // Some may have succeeded in unordered insert
          results.saved += insertError.insertedDocs?.length || 0;
          results.errors.push(`Bulk insert error: ${insertError.message}`);
        }
      }

      // Bulk update existing milestones
      if (toUpdate.length > 0) {
        const bulkOps = toUpdate.map((doc) => ({
          updateOne: {
            filter: { id: doc.id },
            update: { $set: doc },
          },
        }));
        try {
          const bulkResult = await JourneyMilestone.bulkWrite(bulkOps);
          results.saved += bulkResult.modifiedCount;
        } catch (updateError: any) {
          results.errors.push(`Bulk update error: ${updateError.message}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Batch complete: ${results.saved} saved, ${results.skipped} skipped`,
        ...results,
        total: milestones.length,
      });
    }

    // === SINGLE MODE: Original behavior ===
    // Validate required fields
    if (!data.id || !data.name || !data.zoneId || !data.completeCondition) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: id, name, zoneId, completeCondition" },
        { status: 400 }
      );
    }

    // Check if milestone ID already exists
    const existing = await JourneyMilestone.findOne({ id: data.id });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Milestone with this ID already exists" },
        { status: 400 }
      );
    }

    const milestone = await JourneyMilestone.create(buildMilestoneDoc(data));

    return NextResponse.json({
      success: true,
      message: "Milestone created successfully",
      milestone,
    });
  } catch (error) {
    console.error("Error creating milestone:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create milestone" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/journey-milestones
 * Update an existing milestone
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const data = await request.json();

    if (!data.id) {
      return NextResponse.json(
        { success: false, error: "Milestone ID is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    
    // Only update fields that are provided
    const allowedFields = [
      "name", "description", "shortDescription", "zoneId", "position",
      "nodeType", "icon", "color", "size", "unlockCondition", "completeCondition",
      "rewards", "connectedTo", "connectedFrom", "isRequired", "isAutoComplete",
      "order", "tooltipText", "celebrationText", "isActive",
      // Badge-gated milestone fields
      "requiredBadgeIds",
      // Seasonal milestone fields
      "isSeasonal", "seasonStart", "seasonEnd", "seasonTag",
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const milestone = await JourneyMilestone.findOneAndUpdate(
      { id: data.id },
      updateData,
      { new: true }
    );

    if (!milestone) {
      return NextResponse.json(
        { success: false, error: "Milestone not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Milestone updated successfully",
      milestone,
    });
  } catch (error) {
    console.error("Error updating milestone:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update milestone" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journey-milestones
 * Delete a milestone permanently or all milestones
 * Query params:
 * - id: delete specific milestone
 * - all=true&mapId=xxx: delete all milestones for a map
 * - all=true&deleteAllMaps=true: delete ALL milestones from ALL maps
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";
    const deleteAllMaps = searchParams.get("deleteAllMaps") === "true";
    const mapId = searchParams.get("mapId") || "traders_journey";

    // Delete ALL milestones from ALL maps
    if (deleteAll && deleteAllMaps) {
      const result = await JourneyMilestone.deleteMany({});
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.deletedCount} milestones from all maps`,
        deletedCount: result.deletedCount,
      });
    }

    // Delete all milestones for a specific map
    if (deleteAll) {
      const result = await JourneyMilestone.deleteMany({ mapId });
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.deletedCount} milestones`,
        deletedCount: result.deletedCount,
      });
    }

    // Delete specific milestone
    if (!milestoneId) {
      return NextResponse.json(
        { success: false, error: "Milestone ID is required" },
        { status: 400 }
      );
    }

    // Permanently delete the milestone
    const result = await JourneyMilestone.deleteOne({ id: milestoneId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Milestone not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Milestone deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete milestone" },
      { status: 500 }
    );
  }
}
