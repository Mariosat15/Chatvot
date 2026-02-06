/**
 * AI Journey Generator API
 *
 * Specialized AI agent for generating intelligent trading journey milestones.
 * Ensures:
 * - Linear progression (must complete N to unlock N+1)
 * - Progressive difficulty (each milestone harder than previous)
 * - No duplicate conditions
 * - Proper prerequisite chains
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import {
  validateJourneyProgression,
  suggestNextMilestone,
  calculateDifficultyScore,
} from "@/lib/services/journey-validator.service";

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
  } catch (error) {
    console.log("ℹ️ AI config not found in database, checking environment");
  }

  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: process.env.OPENAI_ENABLED === "true",
  };
}

// The Journey AI Agent System Prompt - Specialized for trading journey creation
const JOURNEY_AGENT_SYSTEM_PROMPT = `You are a specialized AI agent for creating trading platform journey milestones.

YOUR ROLE: Design engaging, progressively challenging trader journey milestones for a gamified trading competition platform.

CRITICAL RULES FOR MILESTONE CREATION:
1. STRICTLY LINEAR PROGRESSION: Each milestone MUST require completing the previous one first
2. PROGRESSIVE DIFFICULTY: Each milestone MUST be harder than the previous (higher requirements)
3. NO DUPLICATES: Never create milestones with the same condition type AND value
4. PROPER PREREQUISITES: Each milestone must have connectedFrom pointing to the previous milestone
5. JOURNEY STAGES: Follow this natural trader progression:
   - Stage 1 (Onboarding): Account creation, KYC, first deposit
   - Stage 2 (Learning): First trades, basic wins, understanding markets
   - Stage 3 (Growing): Multiple trades, win streaks, consistent activity
   - Stage 4 (Competing): Enter competitions, complete competitions
   - Stage 5 (Winning): Podium finishes, competition wins
   - Stage 6 (Mastery): Multiple wins, legendary achievements

AVAILABLE CONDITION TYPES (in order of difficulty):
- account_created (always true, for start node only)
- kyc_verified (completed KYC verification)
- first_deposit (made first deposit)
- total_trades (value: number of trades, use comparison: "gte")
- winning_trades (value: number of winning trades, use comparison: "gte")
- win_streak (value: consecutive wins, use comparison: "gte")
- total_pnl (value: profit amount, use comparison: "gte")
- profit_factor (value: ratio, use comparison: "gte")
- competitions_entered (value: number, use comparison: "gte")
- competitions_completed (value: number, use comparison: "gte")
- podium_finishes (value: top 3 finishes, use comparison: "gte")
- first_place_finishes (value: 1st place wins, use comparison: "gte")

NODE TYPES (in order of significance):
- start: Only for the very first milestone
- milestone: Standard progression nodes
- checkpoint: Important progress markers
- branch: Choice points (optional paths)
- lesson: Learning milestones
- legendary: Final/epic achievements

XP REWARD GUIDELINES:
- Onboarding (1-3): 5-30 XP
- Learning (4-7): 10-40 XP  
- Growing (8-12): 25-50 XP
- Competing (13-16): 40-75 XP
- Winning (17-20): 50-100 XP
- Mastery (21+): 75-150 XP

RESPONSE FORMAT: Return ONLY valid JSON with this structure:
{
  "milestones": [
    {
      "id": "unique_snake_case_id",
      "name": "Creative Pirate-themed Name",
      "description": "Engaging description (max 100 chars)",
      "shortDescription": "Brief (max 30 chars)",
      "nodeType": "milestone|checkpoint|legendary|etc",
      "completeCondition": {
        "type": "condition_type",
        "value": number_if_needed,
        "comparison": "gte|lte|eq"
      },
      "rewards": { "xp": number },
      "order": sequential_number,
      "difficulty_score": calculated_difficulty
    }
  ],
  "validation": {
    "is_progressive": true,
    "has_no_duplicates": true,
    "is_linear": true
  },
  "summary": "Brief description of the journey path"
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      theme = "pirate",
      existingMilestones = [],
      mapId = "traders_journey",
      count = 5,
      startOrder = 1,
    } = body;

    const config = await getAIConfig();

    if (!config.enabled) {
      return NextResponse.json(
        {
          error: "AI features are disabled. Enable them in Environment Variables.",
        },
        { status: 400 }
      );
    }

    if (!config.apiKey) {
      return NextResponse.json(
        {
          error: "OpenAI API key is not configured. Add it in Environment Variables.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const openai = new OpenAI({ apiKey: config.apiKey });

    // Handle different actions
    switch (action) {
      case "generate_full_journey": {
        // Generate a complete journey from scratch
        const userPrompt = `Generate a COMPLETE trading journey with ${count} milestones.

THEME: ${theme} (use ${theme}-themed names and descriptions)
STARTING ORDER: ${startOrder}

Requirements:
1. Start with the easiest achievement (account_created if order=1)
2. End with an epic/legendary achievement
3. Each milestone MUST be progressively harder
4. Include a good mix of trading, competition, and profit milestones
5. Use creative ${theme}-themed names (e.g., "Set Sail", "First Treasure", "Pirate King")

Generate EXACTLY ${count} milestones in strictly increasing difficulty order.`;

        const completion = await openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: JOURNEY_AGENT_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: "json_object" },
        });

        const response = completion.choices[0]?.message?.content || "";
        const parsed = JSON.parse(response);

        // Enhance milestones with calculated difficulty and proper structure
        const enhancedMilestones = parsed.milestones.map(
          (m: any, index: number) => ({
            ...m,
            mapId,
            order: startOrder + index,
            connectedFrom: index === 0 ? [] : [parsed.milestones[index - 1].id],
            connectedTo: index === parsed.milestones.length - 1 ? [] : [parsed.milestones[index + 1]?.id],
            position: { x: 100 + index * 150, y: 400 }, // Default positions
            color: getColorForNodeType(m.nodeType),
            size: getSizeForNodeType(m.nodeType),
            icon: getIconForCondition(m.completeCondition?.type),
            isRequired: true,
            isAutoComplete: m.completeCondition?.type === "account_created",
            isActive: true,
            zoneId: getZoneForOrder(startOrder + index),
            difficulty_score: m.completeCondition
              ? calculateDifficultyScore(m.completeCondition)
              : 0,
          })
        );

        return NextResponse.json({
          success: true,
          milestones: enhancedMilestones,
          validation: parsed.validation,
          summary: parsed.summary,
        });
      }

      case "suggest_next": {
        // Suggest the next milestone based on existing ones
        const dbMilestones = await JourneyMilestone.find({
          mapId,
          isActive: true,
        })
          .sort({ order: 1 })
          .lean();

        const allMilestones = [...existingMilestones, ...dbMilestones];
        const suggestion = suggestNextMilestone(allMilestones as any);

        // Use AI to enhance the suggestion with creative naming
        const enhancePrompt = `Given this milestone condition:
Type: ${suggestion.suggestedCondition.type}
Value: ${suggestion.suggestedCondition.value || "N/A"}
Order: ${suggestion.suggestedOrder}

Create a creative ${theme}-themed name and description for this milestone.
The previous milestone was: ${allMilestones[allMilestones.length - 1]?.name || "None"}

Return JSON:
{
  "name": "Creative themed name",
  "description": "Engaging description (max 100 chars)",
  "shortDescription": "Brief (max 30 chars)",
  "nodeType": "appropriate_node_type",
  "icon": "suggested_icon_name"
}`;

        const completion = await openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: JOURNEY_AGENT_SYSTEM_PROMPT },
            { role: "user", content: enhancePrompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: "json_object" },
        });

        const aiEnhancement = JSON.parse(
          completion.choices[0]?.message?.content || "{}"
        );

        return NextResponse.json({
          success: true,
          suggestion: {
            ...suggestion,
            ...aiEnhancement,
            mapId,
            id: generateMilestoneId(aiEnhancement.name || "milestone"),
            connectedFrom:
              allMilestones.length > 0
                ? [allMilestones[allMilestones.length - 1].id]
                : [],
            connectedTo: [],
            position: { x: 100, y: 400 },
            color: getColorForNodeType(aiEnhancement.nodeType || "milestone"),
            size: getSizeForNodeType(aiEnhancement.nodeType || "milestone"),
            rewards: { xp: suggestion.suggestedXP },
            isRequired: true,
            isAutoComplete:
              suggestion.suggestedCondition.type === "account_created",
            isActive: true,
            zoneId: getZoneForOrder(suggestion.suggestedOrder),
            completeCondition: suggestion.suggestedCondition,
            order: suggestion.suggestedOrder,
          },
        });
      }

      case "validate": {
        // Validate current journey progression
        const validation = await validateJourneyProgression(mapId);
        return NextResponse.json({
          success: true,
          validation,
        });
      }

      case "optimize": {
        // AI analyzes and suggests optimizations for existing journey
        const dbMilestones = await JourneyMilestone.find({
          mapId,
          isActive: true,
        })
          .sort({ order: 1 })
          .lean();

        const validation = await validateJourneyProgression(mapId);

        const optimizePrompt = `Analyze this trading journey and suggest improvements:

Current Milestones:
${JSON.stringify(
  dbMilestones.map((m: any) => ({
    name: m.name,
    order: m.order,
    condition: m.completeCondition,
    xp: m.rewards?.xp,
  })),
  null,
  2
)}

Current Issues:
- Errors: ${validation.errors.length}
- Warnings: ${validation.warnings.length}

Analyze and return JSON with:
{
  "analysis": "Brief analysis of the journey",
  "issues": ["list of issues found"],
  "suggestions": ["specific suggestions to improve"],
  "difficulty_curve": "description of difficulty progression",
  "recommended_changes": [
    {
      "milestoneId": "id",
      "field": "field to change",
      "currentValue": "current",
      "suggestedValue": "suggested",
      "reason": "why"
    }
  ]
}`;

        const completion = await openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: JOURNEY_AGENT_SYSTEM_PROMPT },
            { role: "user", content: optimizePrompt },
          ],
          temperature: 0.5,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        });

        const optimization = JSON.parse(
          completion.choices[0]?.message?.content || "{}"
        );

        return NextResponse.json({
          success: true,
          optimization,
          validation,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("AI Journey Generator error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI generation failed",
      },
      { status: 500 }
    );
  }
}

// Helper functions
function generateMilestoneId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 30);
}

function getColorForNodeType(nodeType: string): string {
  const colors: Record<string, string> = {
    start: "#22C55E",
    milestone: "#3B82F6",
    checkpoint: "#F59E0B",
    branch: "#8B5CF6",
    legendary: "#EF4444",
    lesson: "#F59E0B",
    optional: "#6B7280",
  };
  return colors[nodeType] || "#3B82F6";
}

function getSizeForNodeType(nodeType: string): string {
  const sizes: Record<string, string> = {
    start: "large",
    legendary: "large",
    checkpoint: "medium",
    milestone: "medium",
    branch: "medium",
    lesson: "small",
    optional: "small",
  };
  return sizes[nodeType] || "medium";
}

function getIconForCondition(conditionType: string): string {
  const icons: Record<string, string> = {
    account_created: "pirateShip",
    kyc_verified: "shield1",
    first_deposit: "pirateCoins",
    total_trades: "compass",
    winning_trades: "treasure",
    win_streak: "fireSpell",
    total_pnl: "gems",
    profit_factor: "starBadge",
    competitions_entered: "pirateSword",
    competitions_completed: "pirateFlag",
    podium_finishes: "trophy",
    first_place_finishes: "crown",
  };
  return icons[conditionType] || "target";
}

function getZoneForOrder(order: number): string {
  if (order <= 3) return "starting_dock";
  if (order <= 9) return "calm_waters";
  if (order <= 16) return "trading_paths";
  if (order <= 19) return "competition_arena";
  return "mastery_islands";
}
