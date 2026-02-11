/**
 * AI Gamification Balance Evaluator
 *
 * Loads all badges, XP config, level progression, and journey milestones,
 * then asks OpenAI to evaluate whether they form a coherent, balanced
 * progression system. Returns scored recommendations and optional auto-fix.
 *
 * Actions:
 * - evaluate: Analyze the full gamification system and return recommendations
 * - fix: Apply AI recommendations to rebalance the system
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import BadgeConfig from "@/database/models/badge-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

interface AIConfig {
  apiKey: string | null;
  model: string;
  enabled: boolean;
}

async function getAIConfig(): Promise<AIConfig> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    if (settings) {
      return {
        apiKey: settings.openaiApiKey || null,
        model: settings.openaiModel || "gpt-4o-mini",
        enabled: settings.openaiEnabled ?? false,
      };
    }
  } catch {
    console.log("AI config not found in database, checking environment");
  }
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: process.env.OPENAI_ENABLED === "true",
  };
}

// Load XP config from DB or use defaults
async function getXPConfig() {
  try {
    const db = (await connectToDatabase()).connection.db;
    if (!db) return null;
    const config = await db.collection("xpconfigs").findOne({});
    return config;
  } catch {
    return null;
  }
}

const EVALUATOR_SYSTEM_PROMPT = `You are a senior game designer evaluating a gamification system for a competitive trading platform.

Your job is to analyze the COMPLETE system (badges, XP, levels, milestones) and determine if they create a coherent, balanced, motivating progression.

EVALUATION CRITERIA (score each 1-10):

1. PROGRESSION FLOW: Do badges, XP, and milestones create a clear path from beginner to expert?
2. DIFFICULTY CURVE: Is each tier harder than the last? Are there difficulty spikes or dead zones?
3. ZERO-BASELINE PROTECTION: Can anyone earn badges without actually doing anything? (higher = better protection)
4. LEVEL GATING: Do minLevel requirements create meaningful gates? Are they too strict or too lenient?
5. CATEGORY BALANCE: Does each category have a good spread of common/rare/epic/legendary?
6. XP ECONOMY: Is XP earned at a rate that matches the level curve? Too fast or too slow?
7. MILESTONE-BADGE CONNECTION: Do milestones reference badges sensibly? Do they form a web of dependencies?
8. ENGAGEMENT HOOKS: Are there short/medium/long-term goals? Daily/weekly/monthly targets?
9. URGENCY: Are there seasonal or time-limited elements that create urgency?
10. FUN FACTOR: Is the system motivating? Would a trader feel excited to unlock things?

For each issue found, provide:
- severity: "critical" | "high" | "medium" | "low"
- area: "badges" | "xp" | "levels" | "milestones" | "connections"
- description: What's wrong
- recommendation: How to fix it
- autoFixable: boolean (can the AI auto-fix this?)
- fix: If autoFixable, the exact change to make (badge ID + new values, etc.)

Return your evaluation as JSON:
{
  "overallScore": 7.5,
  "scores": {
    "progressionFlow": 8,
    "difficultyCurve": 7,
    "zeroBaselineProtection": 6,
    "levelGating": 5,
    "categoryBalance": 8,
    "xpEconomy": 7,
    "milestoneBadgeConnection": 6,
    "engagementHooks": 7,
    "urgency": 4,
    "funFactor": 8
  },
  "issues": [...],
  "strengths": ["list of things done well"],
  "summary": "2-3 sentence overall assessment"
}`;

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const config = await getAIConfig();

    if (!config.enabled || !config.apiKey) {
      return NextResponse.json(
        { success: false, error: "AI is not enabled. Configure OpenAI in settings." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === "evaluate") {
      // Load all gamification data
      const [badges, milestones, mapConfigs, xpConfig] = await Promise.all([
        BadgeConfig.find({ isActive: true }).lean(),
        JourneyMilestone.find({ isActive: true }).select(
          "name mapId zoneId nodeType unlockCondition completeCondition rewards requiredBadgeIds isSeasonal seasonTag order"
        ).lean(),
        JourneyMapConfig.find({}).lean(),
        getXPConfig(),
      ]);

      // Prepare compact summary for AI
      const badgeSummary = badges.map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        rarity: b.rarity,
        minLevel: b.minLevel || 0,
        condition: b.condition,
      }));

      const milestoneSummary = milestones.map((m: any) => ({
        name: m.name,
        mapId: m.mapId,
        nodeType: m.nodeType,
        unlockCondition: m.unlockCondition,
        completeCondition: m.completeCondition,
        rewards: m.rewards,
        requiredBadgeIds: m.requiredBadgeIds,
        isSeasonal: m.isSeasonal,
        seasonTag: m.seasonTag,
        order: m.order,
      }));

      // Category distribution
      const categoryDist: Record<string, Record<string, number>> = {};
      for (const b of badges as any[]) {
        if (!categoryDist[b.category]) categoryDist[b.category] = {};
        categoryDist[b.category][b.rarity] = (categoryDist[b.category][b.rarity] || 0) + 1;
      }

      // Level gating distribution
      const levelGating: Record<number, number> = {};
      for (const b of badges as any[]) {
        const lvl = b.minLevel || 0;
        levelGating[lvl] = (levelGating[lvl] || 0) + 1;
      }

      const userPrompt = `FULL GAMIFICATION SYSTEM DATA:

=== BADGES (${badges.length} total) ===
Category distribution: ${JSON.stringify(categoryDist)}
Level gating distribution: ${JSON.stringify(levelGating)}

Badge details:
${JSON.stringify(badgeSummary, null, 2)}

=== JOURNEY MILESTONES (${milestones.length} total) ===
Maps: ${mapConfigs.length}
${JSON.stringify(milestoneSummary, null, 2)}

=== XP CONFIG ===
Badge XP: common=10, rare=25, epic=50, legendary=100
Activity XP: 2/trade (cap 100/day), 3 bonus/win, 25/comp, 50/35/20 podium, 15/challenge, 30/challenge-win
${xpConfig ? `Custom config: ${JSON.stringify(xpConfig)}` : "Using defaults"}

=== LEVEL PROGRESSION (20 levels) ===
Level 1: 0 XP (Novice Trader)
Level 2: 50 XP (Apprentice)
Level 3: 125 XP (Trainee)
Level 4: 250 XP (Junior Trader)
Level 5: 375 XP (Rising Trader)
Level 6: 500 XP (Skilled Trader)
Level 7: 750 XP (Competent Trader)
Level 8: 1100 XP (Proficient Trader)
Level 9: 1450 XP (Expert Trader)
Level 10: 1800 XP (Senior Trader)
Level 11: 2000 XP (Elite Trader)
Level 12: 2500 XP (Master Trader)
Level 13: 3000 XP (Grand Master)
Level 14: 3500 XP (Trading Virtuoso)
Level 15: 4000 XP (Trading Champion)
Level 16: 5000 XP (Market Legend)
Level 17: 6000 XP (Trading Titan)
Level 18: 7500 XP (Market Overlord)
Level 19: 10000 XP (Trading Immortal)
Level 20: 15000 XP (Trading God)

Evaluate this ENTIRE system. Be specific about which badge IDs have issues.
Return ONLY the JSON evaluation object, no markdown.`;

      const openai = new OpenAI({ apiKey: config.apiKey });
      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      });

      const content = completion.choices[0]?.message?.content || "{}";
      let evaluation;
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        evaluation = JSON.parse(cleaned);
      } catch {
        return NextResponse.json(
          { success: false, error: "AI returned invalid evaluation", raw: content },
          { status: 500 },
        );
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
      // Apply fixes from the evaluation
      const { fixes } = body;
      if (!Array.isArray(fixes) || fixes.length === 0) {
        return NextResponse.json(
          { success: false, error: "No fixes to apply" },
          { status: 400 },
        );
      }

      const results = { applied: 0, skipped: 0, errors: 0 };

      for (const fix of fixes) {
        try {
          if (fix.area === "badges" && fix.badgeId && fix.updates) {
            const updateFields: any = {};
            if (fix.updates.minLevel !== undefined) updateFields.minLevel = fix.updates.minLevel;
            if (fix.updates.condition) updateFields.condition = fix.updates.condition;
            if (fix.updates.rarity) updateFields.rarity = fix.updates.rarity;

            if (Object.keys(updateFields).length > 0) {
              const result = await BadgeConfig.findOneAndUpdate(
                { id: fix.badgeId },
                updateFields,
                { new: true },
              );
              if (result) {
                results.applied++;
              } else {
                results.skipped++;
              }
            } else {
              results.skipped++;
            }
          } else {
            results.skipped++;
          }
        } catch (err) {
          console.error(`Error applying fix:`, err);
          results.errors++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Applied ${results.applied} fixes (${results.skipped} skipped, ${results.errors} errors)`,
        results,
        action: "fix",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use: evaluate, fix" },
      { status: 400 },
    );
  } catch (error) {
    console.error("AI Balance Evaluator error:", error);
    return NextResponse.json(
      { success: false, error: "AI Balance Evaluator failed" },
      { status: 500 },
    );
  }
}
