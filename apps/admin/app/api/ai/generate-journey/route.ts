/**
 * AI Journey Generator API
 *
 * Specialized AI agent for generating intelligent trading journey milestones.
 * Supports:
 * - Single map generation with themed milestones
 * - Full 10-map sequence generation
 * - Cross-map validation and XP budget checking
 * 
 * Ensures:
 * - Linear progression (must complete N to unlock N+1)
 * - Progressive difficulty (each milestone harder than previous)
 * - No duplicate conditions across maps
 * - Proper prerequisite chains
 * - XP budget adherence per map
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import {
  validateJourneyProgression,
  suggestNextMilestone,
  calculateDifficultyScore,
} from "@/lib/services/journey-validator.service";
import { 
  MAP_SEQUENCE, 
  XP_ECONOMY, 
  getMapById,
  type MapSequenceConfig 
} from "@/lib/constants/journey-maps-sequence";
import { 
  validateMapSequence, 
  getMapSequence,
  calculateMapXPBudget,
} from "@/lib/services/journey-sequence.service";
import { MapTheme } from "@/database/models/journey-map-config.model";

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

MULTI-MAP SYSTEM: The platform has 10 sequential maps, each with a unique theme:
1. Pirate Cove (Levels 1-3, 150 XP) - Introduction
2. Space Station (Levels 3-5, 200 XP) - Intermediate
3. Medieval Castle (Levels 5-7, 300 XP) - Competitions
4. Cyber City (Levels 7-9, 400 XP) - Advanced Trading
5. Ancient Temple (Levels 9-10, 500 XP) - First Podiums
6. Volcanic Island (Levels 10-12, 700 XP) - First Wins
7. Arctic Fortress (Levels 12-14, 1000 XP) - Multiple Wins
8. Dragon Realm (Levels 14-16, 1500 XP) - Champion Status
9. Celestial Kingdom (Levels 16-18, 2500 XP) - Near Legendary
10. Hall of Legends (Levels 18-20, 5000 XP) - God Status

CRITICAL RULES FOR MILESTONE CREATION:
1. STRICTLY LINEAR PROGRESSION: Each milestone MUST require completing the previous one first
2. PROGRESSIVE DIFFICULTY: Each milestone MUST be harder than the previous (higher requirements)
3. NO DUPLICATES: Never create milestones with the same condition type AND value (even across maps)
4. PROPER PREREQUISITES: Each milestone must have connectedFrom pointing to the previous milestone
5. XP BUDGET: Stay within the allocated XP budget for each map
6. THEME ADHERENCE: Use theme-appropriate names and descriptions

JOURNEY STAGES BY MAP:
- Maps 1-2: Onboarding & Learning (account, deposits, first trades)
- Maps 3-4: Growing & First Competitions (multiple trades, win streaks, first competitions)
- Maps 5-6: Competition Focus (podium finishes, first wins)
- Maps 7-8: Championship Level (multiple wins, high streaks)
- Maps 9-10: Legendary Status (ultimate achievements)

AVAILABLE CONDITION TYPES (in order of difficulty):
- account_created (always true, for Map 1 start only)
- kyc_verified, first_deposit (onboarding)
- total_trades, winning_trades, win_streak (trading)
- competitions_entered, competitions_completed (competition entry)
- podium_finishes, first_place_finishes (winning)
- map_completed (specific map completion, use milestoneId)
- maps_completed_count, total_journey_xp (cross-map progress)
- consecutive_wins_in_map, perfect_day, comeback_trade (special)

NODE TYPES (in order of significance):
- start: Only for the very first milestone of each map
- milestone: Standard progression nodes
- checkpoint: Important progress markers (25/50/100 trades, etc.)
- branch: Choice points (optional paths)
- lesson: Learning milestones
- legendary: Final/epic achievements (end of map)

XP REWARD FORMULA: baseXP = 5 + (mapIndex * 3) + (orderInMap * 2)
- Map 1: 5-20 XP per milestone
- Map 5: 20-50 XP per milestone  
- Map 10: 50-150+ XP per milestone

THEME-SPECIFIC NAMING:
- Pirate: Set Sail, First Treasure, Pirate King, Gold Doubloons
- Space: Launch Sequence, Zero Gravity, Galactic Commander
- Medieval: Knight's Oath, Dragon Slayer, Royal Champion
- Cyber: System Boot, Neural Link, Data Master
- Ancient: Temple Entry, Pharaoh's Blessing, Eye of Ra
- Volcanic: Inferno Landing, Lava Crosser, Volcano God
- Arctic: Frost Trader, Blizzard Survivor, Ice King
- Dragon: Dragon's Gate, Fire Breather, Dragon King
- Celestial: Divine Ascension, Star Collector, Trading Titan
- Legendary: Legend Entry, Immortal Streak, Trading God

RESPONSE FORMAT: Return ONLY valid JSON with this structure:
{
  "milestones": [
    {
      "id": "unique_snake_case_id",
      "name": "Creative themed Name",
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
    "is_linear": true,
    "within_xp_budget": true
  },
  "total_xp": number,
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

      case "generate_single_map": {
        // Generate milestones for a single map with specific theme and difficulty
        const { sequenceOrder = 1, mapIndex, xpBudget, saveToDB = true } = body;
        const mapOrder = mapIndex || sequenceOrder;
        const mapConfig = getMapById(mapId) || MAP_SEQUENCE[mapOrder - 1];
        
        if (!mapConfig) {
          return NextResponse.json(
            { error: "Map configuration not found" },
            { status: 404 }
          );
        }

        // SMART: Fetch milestones from ALL previous maps to ensure progression
        const previousMapsProgress: { type: string; maxValue: number }[] = [];
        let cumulativeMaxValues: Record<string, number> = {};
        
        for (let i = 1; i < mapOrder; i++) {
          const prevMapId = MAP_SEQUENCE[i - 1]?.mapId;
          if (prevMapId) {
            const prevMilestones = await JourneyMilestone.find({ mapId: prevMapId, isActive: true })
              .sort({ order: 1 })
              .lean();
            
            prevMilestones.forEach((m: any) => {
              const condType = m.completeCondition?.type;
              const condValue = m.completeCondition?.value;
              
              if (condType && typeof condValue === 'number') {
                if (!cumulativeMaxValues[condType] || condValue > cumulativeMaxValues[condType]) {
                  cumulativeMaxValues[condType] = condValue;
                }
              }
            });
          }
        }
        
        // Convert to array for the prompt
        Object.entries(cumulativeMaxValues).forEach(([type, maxValue]) => {
          previousMapsProgress.push({ type, maxValue });
        });

        const budget = xpBudget || mapConfig.xpBudget;
        const milestoneCount = mapConfig.milestoneCount;

        // Reduce milestone count to 8 for faster generation
        const reducedMilestoneCount = 8;
        
        // Simplified, shorter prompt for faster AI response
        const singleMapPrompt = `Generate ${reducedMilestoneCount} milestones for "${mapConfig.name}" (${mapConfig.theme} theme, Map ${mapOrder}/10).

${previousMapsProgress.length > 0 ? `Previous max values: ${previousMapsProgress.slice(0, 5).map(p => `${p.type}=${p.maxValue}`).join(', ')}. Use HIGHER values.` : 'This is Map 1, start with low values (1-15).'}

Rules:
- ${mapConfig.theme}-themed names
- Progressive difficulty (each harder than previous)
- XP budget: ${budget}
- Value range: ${mapOrder * 10}-${mapOrder * 30} for trades, proportional for others

Generate exactly ${reducedMilestoneCount} milestones.`;

        const completion = await openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: JOURNEY_AGENT_SYSTEM_PROMPT },
            { role: "user", content: singleMapPrompt },
          ],
          temperature: 0.5,
          max_tokens: 2500, // Reduced for faster response
          response_format: { type: "json_object" },
        });

        const response = completion.choices[0]?.message?.content || "";
        const parsed = JSON.parse(response);

        // Enhance milestones with proper structure
        const enhancedMilestones = parsed.milestones.map(
          (m: any, index: number) => ({
            ...m,
            mapId: mapConfig.mapId,
            order: index + 1,
            connectedFrom: index === 0 ? [] : [parsed.milestones[index - 1].id],
            connectedTo: index === parsed.milestones.length - 1 ? [] : [parsed.milestones[index + 1]?.id],
            position: calculateMilestonePosition(index, mapConfig.milestoneCount, mapConfig.zones),
            color: getColorForNodeType(m.nodeType),
            size: getSizeForNodeType(m.nodeType),
            icon: m.icon || getIconForConditionAndTheme(m.completeCondition?.type, mapConfig.theme),
            isRequired: true,
            isAutoComplete: m.completeCondition?.type === "account_created",
            isActive: true,
            zoneId: getZoneForOrderInMap(index + 1, mapConfig.zones),
            difficulty_score: m.completeCondition
              ? calculateDifficultyScore(m.completeCondition)
              : 0,
          })
        );

        // Optionally save to database
        let savedCount = 0;
        if (saveToDB) {
          for (const milestone of enhancedMilestones) {
            try {
              // Check if milestone exists
              const existing = await JourneyMilestone.findOne({ id: milestone.id });
              if (existing) {
                // Update existing
                await JourneyMilestone.updateOne({ id: milestone.id }, { $set: milestone });
              } else {
                // Create new
                await JourneyMilestone.create(milestone);
              }
              savedCount++;
            } catch (saveError) {
              console.error(`Failed to save milestone ${milestone.id}:`, saveError);
            }
          }
          
          // Update or create map config
          try {
            const existingMap = await JourneyMapConfig.findOne({ mapId: mapConfig.mapId });
            if (existingMap) {
              await JourneyMapConfig.updateOne(
                { mapId: mapConfig.mapId },
                { 
                  $set: { 
                    totalMilestones: enhancedMilestones.length,
                    estimatedXP: parsed.total_xp || budget,
                    sequenceOrder: mapConfig.sequenceOrder,
                    theme: mapConfig.theme,
                    difficulty: mapConfig.difficulty,
                  } 
                }
              );
            } else {
              await JourneyMapConfig.create({
                mapId: mapConfig.mapId,
                name: mapConfig.name,
                description: mapConfig.description,
                zones: mapConfig.zones,
                backgroundColor: mapConfig.backgroundColor,
                backgroundImage: mapConfig.backgroundImage,
                sequenceOrder: mapConfig.sequenceOrder,
                theme: mapConfig.theme,
                difficulty: mapConfig.difficulty,
                estimatedXP: parsed.total_xp || budget,
                totalMilestones: enhancedMilestones.length,
                isActive: true,
              });
            }
          } catch (mapError) {
            console.error(`Failed to save map config ${mapConfig.mapId}:`, mapError);
          }
        }

        return NextResponse.json({
          success: true,
          map: {
            mapId: mapConfig.mapId,
            name: mapConfig.name,
            theme: mapConfig.theme,
            sequenceOrder: mapConfig.sequenceOrder,
            difficulty: mapConfig.difficulty,
            xpBudget: budget,
          },
          milestones: enhancedMilestones,
          savedCount,
          validation: parsed.validation,
          total_xp: parsed.total_xp,
          summary: parsed.summary,
        });
      }

      case "generate_map_sequence": {
        // Generate all 10 maps at once
        const { startFromMap = 1, endAtMap = 10 } = body;
        
        const allMaps: any[] = [];
        let usedConditions = new Set<string>();
        let cumulativeTradesRequired = 0;
        let cumulativeWinsRequired = 0;
        
        for (let mapIndex = startFromMap; mapIndex <= endAtMap; mapIndex++) {
          const mapConfig = MAP_SEQUENCE[mapIndex - 1];
          if (!mapConfig) continue;

          // Generate this map's milestones
          const sequencePrompt = `Generate milestones for Map ${mapIndex}: "${mapConfig.name}"

THEME: ${mapConfig.theme}
DIFFICULTY: ${mapConfig.difficulty}/10
XP BUDGET: ${mapConfig.xpBudget} XP
MILESTONES: ${mapConfig.milestoneCount}

CUMULATIVE PROGRESS SO FAR:
- Total trades required by end of previous map: ${cumulativeTradesRequired}
- Total wins required by end of previous map: ${cumulativeWinsRequired}
- Conditions already used: ${Array.from(usedConditions).slice(-10).join(', ')}

${mapIndex > 1 ? `PREREQUISITE: First milestone must require { type: "map_completed", milestoneId: "${MAP_SEQUENCE[mapIndex - 2]?.mapId}" }` : 'FIRST MAP: Start with account_created'}

Create ${mapConfig.milestoneCount} ${mapConfig.theme}-themed milestones.
- Avoid duplicate conditions: ${Array.from(usedConditions).slice(-20).join(', ')}
- Continue progression from ${cumulativeTradesRequired} trades, ${cumulativeWinsRequired} wins
- Stay within ${mapConfig.xpBudget} XP budget`;

          const completion = await openai.chat.completions.create({
            model: config.model,
            messages: [
              { role: "system", content: JOURNEY_AGENT_SYSTEM_PROMPT },
              { role: "user", content: sequencePrompt },
            ],
            temperature: 0.7,
            max_tokens: 6000,
            response_format: { type: "json_object" },
          });

          const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");

          // Track conditions and cumulative progress
          parsed.milestones?.forEach((m: any) => {
            const condKey = `${m.completeCondition?.type}:${m.completeCondition?.value || 0}`;
            usedConditions.add(condKey);
            
            if (m.completeCondition?.type === "total_trades" && m.completeCondition?.value) {
              cumulativeTradesRequired = Math.max(cumulativeTradesRequired, m.completeCondition.value);
            }
            if (m.completeCondition?.type === "winning_trades" && m.completeCondition?.value) {
              cumulativeWinsRequired = Math.max(cumulativeWinsRequired, m.completeCondition.value);
            }
          });

          // Enhance milestones
          const enhancedMilestones = parsed.milestones?.map(
            (m: any, index: number) => ({
              ...m,
              mapId: mapConfig.mapId,
              order: index + 1,
              connectedFrom: index === 0 ? [] : [parsed.milestones[index - 1].id],
              connectedTo: index === parsed.milestones.length - 1 ? [] : [parsed.milestones[index + 1]?.id],
              position: calculateMilestonePosition(index, mapConfig.milestoneCount, mapConfig.zones),
              color: getColorForNodeType(m.nodeType),
              size: getSizeForNodeType(m.nodeType),
              icon: m.icon || getIconForConditionAndTheme(m.completeCondition?.type, mapConfig.theme),
              isRequired: true,
              isAutoComplete: m.completeCondition?.type === "account_created",
              isActive: true,
              zoneId: getZoneForOrderInMap(index + 1, mapConfig.zones),
            })
          ) || [];

          allMaps.push({
            mapConfig: {
              mapId: mapConfig.mapId,
              name: mapConfig.name,
              theme: mapConfig.theme,
              sequenceOrder: mapConfig.sequenceOrder,
              difficulty: mapConfig.difficulty,
              xpBudget: mapConfig.xpBudget,
              zones: mapConfig.zones,
            },
            milestones: enhancedMilestones,
            total_xp: parsed.total_xp,
            summary: parsed.summary,
          });
        }

        return NextResponse.json({
          success: true,
          totalMaps: allMaps.length,
          maps: allMaps,
          summary: `Generated ${allMaps.length} maps with ${allMaps.reduce((sum, m) => sum + m.milestones.length, 0)} total milestones`,
        });
      }

      case "validate_sequence": {
        // Validate the entire 10-map sequence
        const sequenceValidation = await validateMapSequence();
        
        // Also validate individual maps
        const mapValidations: any[] = [];
        for (const mapConfig of MAP_SEQUENCE) {
          const validation = await validateJourneyProgression(mapConfig.mapId);
          mapValidations.push({
            mapId: mapConfig.mapId,
            name: mapConfig.name,
            ...validation,
          });
        }

        return NextResponse.json({
          success: true,
          sequenceValidation,
          mapValidations,
          overallValid: sequenceValidation.isValid && mapValidations.every(v => v.isValid),
        });
      }

      case "connect_maps": {
        // Ensure proper connections between maps
        const maps = await getMapSequence();
        const connections: any[] = [];

        for (let i = 0; i < maps.length; i++) {
          const currentMap = maps[i];
          const previousMap = i > 0 ? maps[i - 1] : null;
          const nextMap = i < maps.length - 1 ? maps[i + 1] : null;

          // Update map config with connections
          await JourneyMapConfig.findOneAndUpdate(
            { mapId: currentMap.mapId },
            {
              previousMapId: previousMap?.mapId || null,
              nextMapId: nextMap?.mapId || null,
              sequenceOrder: i + 1,
            }
          );

          // If there's a previous map, get its last milestone and connect to this map's first
          if (previousMap) {
            const lastMilestone = await JourneyMilestone.findOne({
              mapId: previousMap.mapId,
              isActive: true,
            }).sort({ order: -1 });

            const firstMilestone = await JourneyMilestone.findOne({
              mapId: currentMap.mapId,
              isActive: true,
            }).sort({ order: 1 });

            if (lastMilestone && firstMilestone) {
              // Update first milestone to require completing previous map
              await JourneyMilestone.findByIdAndUpdate(firstMilestone._id, {
                unlockCondition: {
                  type: "map_completed",
                  milestoneId: previousMap.mapId,
                },
              });

              connections.push({
                from: { map: previousMap.name, milestone: lastMilestone.name },
                to: { map: currentMap.name, milestone: firstMilestone.name },
              });
            }
          }
        }

        return NextResponse.json({
          success: true,
          mapsConnected: maps.length,
          connections,
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

// Calculate milestone position based on index and total count
function calculateMilestonePosition(
  index: number,
  totalMilestones: number,
  zones: any[]
): { x: number; y: number } {
  // Spread milestones across the map
  const progress = index / Math.max(totalMilestones - 1, 1);
  const x = 100 + progress * 700;
  const y = 600 - progress * 400;
  return { x: Math.round(x), y: Math.round(y) };
}

// Get zone for a milestone based on its order within the map
function getZoneForOrderInMap(order: number, zones: any[]): string {
  if (!zones || zones.length === 0) return "zone_1";
  const zoneIndex = Math.min(
    Math.floor((order - 1) / 4),
    zones.length - 1
  );
  return zones[zoneIndex]?.id || "zone_1";
}

// Theme-specific icons for conditions
function getIconForConditionAndTheme(conditionType: string, theme: MapTheme): string {
  const themeIcons: Record<MapTheme, Record<string, string>> = {
    pirate: {
      account_created: "pirateShip",
      first_deposit: "pirateCoins",
      total_trades: "compass",
      winning_trades: "treasure",
      win_streak: "parrot",
      competitions_entered: "pirateSword",
      podium_finishes: "pirateFlag",
      first_place_finishes: "skull",
      map_completed: "chest",
    },
    space: {
      account_created: "rocket",
      first_deposit: "satellite",
      total_trades: "planet",
      winning_trades: "star",
      win_streak: "comet",
      competitions_entered: "astronaut",
      podium_finishes: "galaxy",
      first_place_finishes: "blackHole",
      map_completed: "starship",
    },
    medieval: {
      account_created: "castle",
      first_deposit: "gold",
      total_trades: "sword",
      winning_trades: "shield",
      win_streak: "horse",
      competitions_entered: "arena",
      podium_finishes: "banner",
      first_place_finishes: "crown",
      map_completed: "throne",
    },
    cyber: {
      account_created: "computer",
      first_deposit: "chip",
      total_trades: "code",
      winning_trades: "binary",
      win_streak: "virus",
      competitions_entered: "firewall",
      podium_finishes: "matrix",
      first_place_finishes: "cyborg",
      map_completed: "ai",
    },
    ancient: {
      account_created: "temple",
      first_deposit: "gold",
      total_trades: "scroll",
      winning_trades: "scarab",
      win_streak: "sphinx",
      competitions_entered: "pyramid",
      podium_finishes: "pharaoh",
      first_place_finishes: "eye",
      map_completed: "ankh",
    },
    volcanic: {
      account_created: "fire",
      first_deposit: "magma",
      total_trades: "flames",
      winning_trades: "lava",
      win_streak: "volcano",
      competitions_entered: "eruption",
      podium_finishes: "phoenix",
      first_place_finishes: "inferno",
      map_completed: "volcanoGod",
    },
    arctic: {
      account_created: "snowflake",
      first_deposit: "iceberg",
      total_trades: "frost",
      winning_trades: "blizzard",
      win_streak: "avalanche",
      competitions_entered: "polarBear",
      podium_finishes: "aurora",
      first_place_finishes: "iceKing",
      map_completed: "fortress",
    },
    dragon: {
      account_created: "dragonEgg",
      first_deposit: "treasure",
      total_trades: "dragonFire",
      winning_trades: "dragonScale",
      win_streak: "dragonWing",
      competitions_entered: "cave",
      podium_finishes: "dragonSlayer",
      first_place_finishes: "dragonKing",
      map_completed: "dragonThrone",
    },
    celestial: {
      account_created: "angel",
      first_deposit: "halo",
      total_trades: "cloud",
      winning_trades: "star",
      win_streak: "constellation",
      competitions_entered: "seraph",
      podium_finishes: "archangel",
      first_place_finishes: "divineThrone",
      map_completed: "titan",
    },
    legendary: {
      account_created: "legend",
      first_deposit: "goldStack",
      total_trades: "infinity",
      winning_trades: "crown",
      win_streak: "immortal",
      competitions_entered: "colosseum",
      podium_finishes: "grandChampion",
      first_place_finishes: "godThrone",
      map_completed: "tradingGod",
    },
  };

  return themeIcons[theme]?.[conditionType] || getIconForCondition(conditionType);
}
