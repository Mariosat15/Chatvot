/**
 * Gamification Balance Evaluator — LOCAL ENGINE
 *
 * Uses the deterministic rule-based engine (no AI calls, no timeouts).
 * Evaluates badges, milestones, and their connections.
 * Generates targeted fixes that can be auto-applied.
 *
 * Actions:
 * - evaluate: Instant, deterministic analysis — no AI, no timeouts
 * - fix: Apply rule-based fixes to rebalance the system
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import { evaluateSystem, generateFixes, type BadgeData, type MilestoneData, type MapData } from "@/lib/gamification-engine";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { action } = body;

    if (action === "evaluate") {
      const [badges, milestones, mapConfigs] = await Promise.all([
        BadgeConfig.find({ isActive: true }).lean(),
        JourneyMilestone.find({ isActive: true }).select(
          "id name mapId nodeType order completeCondition rewards requiredBadgeIds"
        ).lean(),
        JourneyMapConfig.find({}).lean(),
      ]);

      const badgeData: BadgeData[] = (badges as any[]).map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        rarity: b.rarity,
        minLevel: b.minLevel || 0,
        condition: b.condition || {},
      }));

      const milestoneData: MilestoneData[] = (milestones as any[]).map((m) => ({
        id: m.id || m._id?.toString(),
        mapId: m.mapId,
        name: m.name,
        nodeType: m.nodeType,
        order: m.order || 0,
        completeCondition: m.completeCondition || {},
        rewards: m.rewards || { xp: 0 },
        requiredBadgeIds: m.requiredBadgeIds || [],
      }));

      const mapData: MapData[] = (mapConfigs as any[]).map((m) => ({
        mapId: m.mapId,
        name: m.name,
        difficulty: m.difficulty || 1,
        sequenceOrder: m.sequenceOrder || 0,
        totalMilestones: milestoneData.filter(ms => ms.mapId === m.mapId).length,
      }));

      // #region agent log
      const evalStart = Date.now();
      fetch('http://127.0.0.1:7242/ingest/cdeeb214-56c4-42f5-af3d-c63a29f02716',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'evaluate-balance/route.ts:eval',message:'evaluate start (LOCAL)',data:{badges:badgeData.length,milestones:milestoneData.length,maps:mapData.length},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion

      const evaluation = evaluateSystem(badgeData, milestoneData, mapData);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cdeeb214-56c4-42f5-af3d-c63a29f02716',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'evaluate-balance/route.ts:eval',message:'evaluate done (LOCAL)',data:{durationMs:Date.now()-evalStart,overallScore:evaluation.overallScore,issues:evaluation.issues.length},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion

      // Build category distribution for stats
      const categoryDist: Record<string, Record<string, number>> = {};
      for (const b of badgeData) {
        if (!categoryDist[b.category]) categoryDist[b.category] = {};
        categoryDist[b.category][b.rarity] = (categoryDist[b.category][b.rarity] || 0) + 1;
      }
      const levelGating: Record<number, number> = {};
      for (const b of badgeData) {
        levelGating[b.minLevel] = (levelGating[b.minLevel] || 0) + 1;
      }

      return NextResponse.json({
        success: true,
        evaluation,
        systemStats: {
          totalBadges: badges.length,
          totalMilestones: milestones.length,
          totalMaps: mapConfigs.length,
          categoryDistribution: categoryDist,
          levelGatingDistribution: levelGating,
        },
        action: "evaluate",
      });
    }

    if (action === "fix") {
      const [badges, milestones] = await Promise.all([
        BadgeConfig.find({ isActive: true }).lean(),
        JourneyMilestone.find({ isActive: true }).select(
          "id name mapId nodeType order completeCondition rewards requiredBadgeIds"
        ).lean(),
      ]);

      const badgeData: BadgeData[] = (badges as any[]).map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        rarity: b.rarity,
        minLevel: b.minLevel || 0,
        condition: b.condition || {},
      }));

      const milestoneData: MilestoneData[] = (milestones as any[]).map((m) => ({
        id: m.id || m._id?.toString(),
        mapId: m.mapId,
        name: m.name,
        nodeType: m.nodeType,
        order: m.order || 0,
        completeCondition: m.completeCondition || {},
        rewards: m.rewards || { xp: 0 },
        requiredBadgeIds: m.requiredBadgeIds || [],
      }));

      const fixes = generateFixes(badgeData, milestoneData);

      console.log(`[EVAL-FIX] Generated ${fixes.badgeFixes.length} badge fixes, ${fixes.milestoneFixes.length} milestone fixes`);

      // Apply badge fixes using surgical $set
      const results = { applied: 0, skipped: 0, errors: 0, notFound: 0 };

      // Group badge fixes by badge ID
      const fixesByBadge: Record<string, Record<string, any>> = {};
      for (const fix of fixes.badgeFixes) {
        if (!fixesByBadge[fix.id]) fixesByBadge[fix.id] = {};
        const parts = fix.field.split(".");
        if (parts.length === 2) {
          fixesByBadge[fix.id][`${parts[0]}.${parts[1]}`] = fix.newValue;
        } else {
          fixesByBadge[fix.id][fix.field] = fix.newValue;
        }
      }

      for (const [badgeId, updates] of Object.entries(fixesByBadge)) {
        try {
          const result = await BadgeConfig.findOneAndUpdate(
            { id: badgeId },
            { $set: updates },
            { new: true },
          );
          if (result) {
            results.applied++;
          } else {
            results.notFound++;
            console.warn(`[EVAL-FIX] Badge ${badgeId} not found in DB`);
          }
        } catch (err) {
          console.error(`[EVAL-FIX] Error fixing badge ${badgeId}:`, err);
          results.errors++;
        }
      }

      // Verify first badge
      if (Object.keys(fixesByBadge).length > 0) {
        const sampleId = Object.keys(fixesByBadge)[0];
        const verify = await BadgeConfig.findOne({ id: sampleId }).lean();
        console.log(`[EVAL-FIX] VERIFY ${sampleId}: minLevel=${(verify as any)?.minLevel} minTrades=${(verify as any)?.condition?.minTrades}`);
      }
      console.log(`[EVAL-FIX] Badge results: ${results.applied} applied, ${results.notFound} not found, ${results.errors} errors`);

      // Apply milestone fixes
      for (const fix of fixes.milestoneFixes) {
        try {
          const result = await JourneyMilestone.findOneAndUpdate(
            { id: fix.id, mapId: fix.mapId },
            { $set: { [fix.field]: fix.newValue } },
            { new: true },
          );
          if (result) {
            results.applied++;
          } else {
            results.notFound++;
          }
        } catch (err) {
          console.error(`[EVAL-FIX] Error fixing milestone ${fix.id}:`, err);
          results.errors++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Applied ${results.applied} fixes (${results.skipped} skipped, ${results.errors} errors)`,
        results,
        fixes,
        action: "fix",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use: evaluate, fix" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Balance Evaluator error:", error);
    return NextResponse.json(
      { success: false, error: "Balance Evaluator failed" },
      { status: 500 },
    );
  }
}
