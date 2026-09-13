import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

/**
 * POST /api/admin/cleanup-duplicates
 * 
 * Finds and removes duplicate GM earnings created by challenge finalization retries.
 * Also corrects GM wallet balances and totalEarnings stats.
 * 
 * Query params:
 *   ?dryRun=true  (default) - Only report what would be cleaned up
 *   ?dryRun=false            - Actually delete duplicates and correct balances
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") !== "false";

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: "Database not connected" }, { status: 500 });
    }

    // Step 1: Find all duplicate gamemasterearnings groups
    // Group by sourceType + sourceId + gameMasterId + referredUserId
    const duplicateGroups = await db.collection("gamemasterearnings").aggregate([
      {
        $group: {
          _id: {
            sourceType: "$sourceType",
            sourceId: "$sourceId",
            gameMasterId: "$gameMasterId",
            referredUserId: "$referredUserId",
          },
          count: { $sum: 1 },
          ids: { $push: "$_id" },
          amounts: { $push: "$netEarning" },
          sourceName: { $first: "$sourceName" },
          referredUserName: { $first: "$referredUserName" },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray();

    if (duplicateGroups.length === 0) {
      return NextResponse.json({
        message: "No duplicate earnings found!",
        duplicateGroups: 0,
        totalDuplicateRecords: 0,
      });
    }

    const summary = {
      duplicateGroups: duplicateGroups.length,
      totalDuplicateRecords: 0,
      totalOverpayment: 0,
      details: [] as Array<{
        sourceType: string;
        sourceId: string;
        sourceName: string;
        gameMasterId: string;
        referredUserName: string;
        totalRecords: number;
        duplicateCount: number;
        perRecordAmount: number;
        overpaidAmount: number;
        keptId: string;
        deletedIds: string[];
      }>,
      walletCorrections: [] as Array<{
        gmId: string;
        totalOvercredited: number;
        duplicateWalletTxCount: number;
      }>,
    };

    // Process each duplicate group
    for (const group of duplicateGroups) {
      const duplicateCount = group.count - 1; // Keep 1, remove the rest
      const perRecordAmount = group.amounts[0] || 0;
      const overpaidAmount = perRecordAmount * duplicateCount;

      summary.totalDuplicateRecords += duplicateCount;
      summary.totalOverpayment += overpaidAmount;

      const keepId = group.ids[0]; // Keep the oldest
      const deleteIds = group.ids.slice(1); // Delete the rest

      summary.details.push({
        sourceType: group._id.sourceType,
        sourceId: group._id.sourceId,
        sourceName: group.sourceName,
        gameMasterId: group._id.gameMasterId,
        referredUserName: group.referredUserName,
        totalRecords: group.count,
        duplicateCount,
        perRecordAmount,
        overpaidAmount,
        keptId: keepId.toString(),
        deletedIds: deleteIds.map((id: any) => id.toString()),
      });

      if (!dryRun) {
        // Delete duplicate earnings
        await db.collection("gamemasterearnings").deleteMany({
          _id: { $in: deleteIds },
        });
      }
    }

    // Step 2: Find and correct wallet transactions and balances
    // Group wallet corrections by GM
    const gmOverpayments = new Map<string, number>();
    for (const detail of summary.details) {
      const current = gmOverpayments.get(detail.gameMasterId) || 0;
      gmOverpayments.set(detail.gameMasterId, current + detail.overpaidAmount);
    }

    for (const [gmId, totalOvercredited] of gmOverpayments.entries()) {
      // Find duplicate wallet transactions for this GM
      const duplicateWalletTxs = await db.collection("wallettransactions").aggregate([
        {
          $match: {
            userId: gmId,
            transactionType: "gamemaster_earning",
          },
        },
        {
          $group: {
            _id: {
              challengeId: "$metadata.challengeId",
              referredUserId: "$metadata.referredUserId",
            },
            count: { $sum: 1 },
            ids: { $push: "$_id" },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ]).toArray();

      let duplicateWalletTxCount = 0;
      for (const txGroup of duplicateWalletTxs) {
        const deleteIds = txGroup.ids.slice(1);
        duplicateWalletTxCount += deleteIds.length;

        if (!dryRun) {
          await db.collection("wallettransactions").deleteMany({
            _id: { $in: deleteIds },
          });
        }
      }

      summary.walletCorrections.push({
        gmId,
        totalOvercredited,
        duplicateWalletTxCount,
      });

      if (!dryRun && totalOvercredited > 0) {
        // Correct GM wallet balance
        await db.collection("creditwallets").updateOne(
          { userId: gmId },
          { $inc: { creditBalance: -totalOvercredited } },
        );

        // Correct GM subscription totalEarnings
        await db.collection("gamemastersubscriptions").updateOne(
          { userId: gmId },
          { $inc: { totalEarnings: -totalOvercredited } },
        );

        console.log(`🔧 [CLEANUP] Corrected GM ${gmId}: removed ${totalOvercredited.toFixed(2)} overpayment from wallet and totalEarnings`);
      }
    }

    // Step 3: Find and clean up duplicate platform fee records
    const duplicatePlatformFees = await db.collection("platformtransactions").aggregate([
      {
        $match: {
          sourceType: { $in: ["challenge", "competition"] },
          transactionType: { $in: ["challenge_platform_fee", "platform_fee"] },
        },
      },
      {
        $group: {
          _id: { sourceType: "$sourceType", sourceId: "$sourceId", transactionType: "$transactionType" },
          count: { $sum: 1 },
          ids: { $push: "$_id" },
          amounts: { $push: "$amount" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();

    let duplicatePlatformFeeCount = 0;
    for (const group of duplicatePlatformFees) {
      const deleteIds = group.ids.slice(1);
      duplicatePlatformFeeCount += deleteIds.length;

      if (!dryRun) {
        await db.collection("platformtransactions").deleteMany({
          _id: { $in: deleteIds },
        });
      }
    }

    return NextResponse.json({
      mode: dryRun ? "DRY RUN (no changes made)" : "LIVE (changes applied)",
      ...summary,
      duplicatePlatformFees: duplicatePlatformFeeCount,
      message: dryRun
        ? `Found ${summary.totalDuplicateRecords} duplicate records across ${summary.duplicateGroups} groups. Run with ?dryRun=false to clean up.`
        : `Cleaned up ${summary.totalDuplicateRecords} duplicate earnings, ${duplicatePlatformFeeCount} duplicate platform fees, and corrected ${summary.walletCorrections.length} GM wallet balances.`,
    });
  } catch (error) {
    console.error("Error cleaning up duplicates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
