import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

/**
 * GET /api/journey-map
 * Get the journey map configuration
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get("mapId") || "traders_journey";

    const mapConfig = await JourneyMapConfig.findOne({ mapId }).lean();

    if (!mapConfig) {
      return NextResponse.json({
        success: false,
        error: "Map not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      mapConfig,
    });
  } catch (error) {
    console.error("Error fetching journey map:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journey map" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/journey-map
 * Create a new journey map configuration
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const data = await request.json();

    // Check if map with this ID already exists
    const existing = await JourneyMapConfig.findOne({ mapId: data.mapId });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Map with this ID already exists" },
        { status: 400 }
      );
    }

    const mapConfig = await JourneyMapConfig.create({
      mapId: data.mapId || "traders_journey",
      name: data.name || "Trader's Journey",
      description: data.description || "",
      zones: data.zones || [],
      defaultStartNode: data.defaultStartNode || "account_created",
      backgroundColor: data.backgroundColor || "#0F172A",
      backgroundImage: data.backgroundImage,
      isActive: data.isActive ?? true,
      version: 1,
    });

    return NextResponse.json({
      success: true,
      message: "Journey map created successfully",
      mapConfig,
    });
  } catch (error) {
    console.error("Error creating journey map:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create journey map" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/journey-map
 * Update journey map configuration
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const data = await request.json();

    if (!data.mapId) {
      return NextResponse.json(
        { success: false, error: "Map ID is required" },
        { status: 400 }
      );
    }

    const mapConfig = await JourneyMapConfig.findOneAndUpdate(
      { mapId: data.mapId },
      {
        name: data.name,
        description: data.description,
        zones: data.zones,
        defaultStartNode: data.defaultStartNode,
        backgroundColor: data.backgroundColor,
        backgroundImage: data.backgroundImage,
        isActive: data.isActive,
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!mapConfig) {
      return NextResponse.json(
        { success: false, error: "Map not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Journey map updated successfully",
      mapConfig,
    });
  } catch (error) {
    console.error("Error updating journey map:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update journey map" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journey-map
 * Delete a journey map, zones, or specific zone
 * Query params:
 * - mapId: the map to operate on (required)
 * - zoneId: delete specific zone from the map
 * - clearZones=true: delete all zones from the map
 * - permanent=true: permanently delete the map (not just deactivate)
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get("mapId");
    const zoneId = searchParams.get("zoneId");
    const clearZones = searchParams.get("clearZones") === "true";
    const permanent = searchParams.get("permanent") === "true";

    if (!mapId) {
      return NextResponse.json(
        { success: false, error: "Map ID is required" },
        { status: 400 }
      );
    }

    // Delete specific zone
    if (zoneId) {
      const mapConfig = await JourneyMapConfig.findOneAndUpdate(
        { mapId },
        { $pull: { zones: { id: zoneId } } },
        { new: true }
      );

      if (!mapConfig) {
        return NextResponse.json(
          { success: false, error: "Map not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Zone '${zoneId}' deleted successfully`,
        mapConfig,
      });
    }

    // Clear all zones
    if (clearZones) {
      const mapConfig = await JourneyMapConfig.findOneAndUpdate(
        { mapId },
        { zones: [] },
        { new: true }
      );

      if (!mapConfig) {
        return NextResponse.json(
          { success: false, error: "Map not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "All zones cleared successfully",
        mapConfig,
      });
    }

    // Permanent delete
    if (permanent) {
      const result = await JourneyMapConfig.deleteOne({ mapId });
      
      if (result.deletedCount === 0) {
        return NextResponse.json(
          { success: false, error: "Map not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Journey map permanently deleted",
      });
    }

    // Soft delete by setting isActive to false
    const mapConfig = await JourneyMapConfig.findOneAndUpdate(
      { mapId },
      { isActive: false },
      { new: true }
    );

    if (!mapConfig) {
      return NextResponse.json(
        { success: false, error: "Map not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Journey map deactivated successfully",
    });
  } catch (error) {
    console.error("Error deleting journey map:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete journey map" },
      { status: 500 }
    );
  }
}
