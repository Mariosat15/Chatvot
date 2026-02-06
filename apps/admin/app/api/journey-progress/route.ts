import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";

/**
 * GET /api/journey-progress
 * Get user journey progress data
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const mapId = searchParams.get("mapId") || "traders_journey";

    // If specific user ID provided
    if (userId) {
      const progress = await UserJourneyProgress.findOne({ userId, mapId }).lean();
      
      if (!progress) {
        return NextResponse.json({
          success: true,
          progress: null,
          message: "User has not started journey",
        });
      }

      // Get milestone details for completed milestones
      const completedIds = progress.completedMilestones?.map(m => m.milestoneId) || [];
      const milestones = await JourneyMilestone.find({
        id: { $in: [...completedIds, ...progress.unlockedMilestones] },
        mapId,
      }).lean();

      return NextResponse.json({
        success: true,
        progress,
        milestones,
      });
    }

    // Get all users' progress for leaderboard
    const allProgress = await UserJourneyProgress.find({ mapId })
      .sort({ totalMilestonesCompleted: -1, totalXPFromJourney: -1 })
      .limit(100)
      .lean();

    // Calculate stats
    const stats = {
      totalUsers: allProgress.length,
      averageMilestones: allProgress.length > 0
        ? Math.round(allProgress.reduce((sum, p) => sum + (p.totalMilestonesCompleted || 0), 0) / allProgress.length)
        : 0,
      averageXP: allProgress.length > 0
        ? Math.round(allProgress.reduce((sum, p) => sum + (p.totalXPFromJourney || 0), 0) / allProgress.length)
        : 0,
    };

    return NextResponse.json({
      success: true,
      progress: allProgress,
      stats,
    });
  } catch (error) {
    console.error("Error fetching journey progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journey progress" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/journey-progress
 * Initialize or manually award milestone progress (admin action)
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const data = await request.json();

    const { userId, action, milestoneId } = data;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const mapId = data.mapId || "traders_journey";

    switch (action) {
      case "initialize": {
        // Initialize journey for a user
        let progress = await UserJourneyProgress.findOne({ userId, mapId });
        
        if (progress) {
          return NextResponse.json({
            success: true,
            message: "Journey already initialized",
            progress,
          });
        }

        progress = await UserJourneyProgress.create({
          userId,
          mapId,
          currentZone: "starting_dock",
          currentMilestone: "account_created",
          completedMilestones: [{
            milestoneId: "account_created",
            completedAt: new Date(),
            rewards: { xp: 5 },
          }],
          unlockedMilestones: ["account_created", "first_deposit"],
          totalXPFromJourney: 5,
          totalMilestonesCompleted: 1,
          journeyStartedAt: new Date(),
          lastProgressAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: "Journey initialized",
          progress,
        });
      }

      case "complete_milestone": {
        if (!milestoneId) {
          return NextResponse.json(
            { success: false, error: "Milestone ID is required" },
            { status: 400 }
          );
        }

        // Find milestone
        const milestone = await JourneyMilestone.findOne({ id: milestoneId });
        if (!milestone) {
          return NextResponse.json(
            { success: false, error: "Milestone not found" },
            { status: 404 }
          );
        }

        // Find or create progress
        let progress = await UserJourneyProgress.findOne({ userId, mapId });
        if (!progress) {
          progress = await UserJourneyProgress.create({
            userId,
            mapId,
            currentZone: "starting_dock",
            currentMilestone: "account_created",
            completedMilestones: [],
            unlockedMilestones: ["account_created"],
            totalXPFromJourney: 0,
            totalMilestonesCompleted: 0,
            journeyStartedAt: new Date(),
            lastProgressAt: new Date(),
          });
        }

        // Check if already completed
        const alreadyCompleted = progress.completedMilestones.some(
          m => m.milestoneId === milestoneId
        );

        if (alreadyCompleted) {
          return NextResponse.json({
            success: false,
            error: "Milestone already completed",
          });
        }

        // Add to completed
        progress.completedMilestones.push({
          milestoneId,
          completedAt: new Date(),
          rewards: {
            xp: milestone.rewards.xp,
            badgeId: milestone.rewards.badgeId,
            title: milestone.rewards.title,
          },
        });

        // Unlock connected milestones
        for (const nextId of milestone.connectedTo) {
          if (!progress.unlockedMilestones.includes(nextId)) {
            progress.unlockedMilestones.push(nextId);
          }
        }

        // Update stats
        progress.totalXPFromJourney += milestone.rewards.xp;
        progress.totalMilestonesCompleted += 1;
        progress.currentMilestone = milestoneId;
        progress.currentZone = milestone.zoneId;
        progress.lastProgressAt = new Date();

        await progress.save();

        return NextResponse.json({
          success: true,
          message: `Milestone "${milestone.name}" completed`,
          progress,
          rewards: milestone.rewards,
        });
      }

      case "reset": {
        // Reset user's journey progress (for testing)
        await UserJourneyProgress.deleteOne({ userId, mapId });
        
        return NextResponse.json({
          success: true,
          message: "Journey progress reset",
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error managing journey progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to manage journey progress" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journey-progress
 * Delete journey progress
 * Query params:
 * - userId: delete specific user's progress
 * - deleteAll=true: delete ALL users' journey progress
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const deleteAll = searchParams.get("deleteAll") === "true";

    // Delete ALL users' journey progress
    if (deleteAll) {
      const result = await UserJourneyProgress.deleteMany({});
      return NextResponse.json({
        success: true,
        message: `Deleted journey progress for ${result.deletedCount} users`,
        deletedCount: result.deletedCount,
      });
    }

    // Delete specific user's progress
    if (userId) {
      const result = await UserJourneyProgress.deleteMany({ userId });
      return NextResponse.json({
        success: true,
        message: `Deleted journey progress for user`,
        deletedCount: result.deletedCount,
      });
    }

    return NextResponse.json(
      { success: false, error: "Either userId or deleteAll=true is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error deleting journey progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete journey progress" },
      { status: 500 }
    );
  }
}
