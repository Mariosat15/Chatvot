/**
 * Unified Gamification Wizard API
 *
 * Specialized agents that can READ, ANALYZE, and FIX the gamification system.
 * Each action is a specialized agent with DB tools.
 *
 * Actions:
 * - get_status:        Load full system state (badges, levels, milestones)
 * - setup_levels:      Apply level/XP preset configurations
 * - agent_badges:      AI agent that audits + fixes + generates badges → saves to DB
 * - agent_milestones:  AI agent that audits + fixes + generates milestones → saves to DB
 * - agent_evaluate:    AI agent that evaluates entire system coherence → returns score + auto-fixes
 * - agent_full_setup:  Run all agents in sequence (levels → badges → milestones → evaluate)
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import BadgeConfig from "@/database/models/badge-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

// ─── AI CONFIG ─────────────────────────────────────────────────────────────────
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
    console.log("[Wizard] AI config not found in database, checking env");
  }
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: process.env.OPENAI_ENABLED === "true",
  };
}

// ─── DB TOOLS (what makes agents "specialized") ────────────────────────────────
// These are the tools the AI agents use to interact with the database.

const dbTools = {
  // === BADGE TOOLS ===
  async readAllBadges() {
    return BadgeConfig.find({ isActive: true }).lean();
  },

  async writeBadge(badgeData: any) {
    const { _changes, _isNew, _id, __v, createdAt, updatedAt, ...clean } = badgeData;
    const existing = await BadgeConfig.findOne({ id: clean.id });
    if (existing) {
      return BadgeConfig.findOneAndUpdate(
        { id: clean.id },
        { ...clean, minLevel: clean.minLevel ?? 0 },
        { new: true },
      );
    } else {
      return BadgeConfig.create({ ...clean, minLevel: clean.minLevel ?? 0, isActive: true });
    }
  },

  async writeBadgesBatch(badges: any[]) {
    const results = { created: 0, updated: 0, errors: 0 };
    for (const badge of badges) {
      try {
        const { _changes, _isNew, _id, __v, createdAt, updatedAt, ...clean } = badge;
        const existing = await BadgeConfig.findOne({ id: clean.id });
        if (existing) {
          await BadgeConfig.findOneAndUpdate(
            { id: clean.id },
            { ...clean, minLevel: clean.minLevel ?? 0 },
          );
          results.updated++;
        } else {
          await BadgeConfig.create({ ...clean, minLevel: clean.minLevel ?? 0, isActive: true });
          results.created++;
        }
      } catch (err) {
        console.error(`[Wizard] Badge write error for ${badge.id}:`, err);
        results.errors++;
      }
    }
    return results;
  },

  // === MILESTONE TOOLS ===
  async readAllMilestones() {
    return JourneyMilestone.find({ isActive: true }).lean();
  },

  async readMilestonesByMap(mapId: string) {
    return JourneyMilestone.find({ mapId, isActive: true }).sort({ order: 1 }).lean();
  },

  async readAllMaps() {
    return JourneyMapConfig.find({}).sort({ sequenceOrder: 1 }).lean();
  },

  async writeMilestone(data: any) {
    const { _changes, _isNew, _id, __v, createdAt, updatedAt, ...clean } = data;
    const existing = await JourneyMilestone.findOne({ id: clean.id, mapId: clean.mapId });
    if (existing) {
      return JourneyMilestone.findOneAndUpdate(
        { id: clean.id, mapId: clean.mapId },
        clean,
        { new: true },
      );
    } else {
      return JourneyMilestone.create(clean);
    }
  },

  async writeMilestonesBatch(milestones: any[]) {
    const results = { created: 0, updated: 0, errors: 0 };
    for (const ms of milestones) {
      try {
        const { _changes, _isNew, _id, __v, createdAt, updatedAt, ...clean } = ms;
        const existing = await JourneyMilestone.findOne({ id: clean.id, mapId: clean.mapId });
        if (existing) {
          await JourneyMilestone.findOneAndUpdate(
            { id: clean.id, mapId: clean.mapId },
            clean,
          );
          results.updated++;
        } else {
          await JourneyMilestone.create(clean);
          results.created++;
        }
      } catch (err) {
        console.error(`[Wizard] Milestone write error for ${ms.id}:`, err);
        results.errors++;
      }
    }
    return results;
  },

  // === XP CONFIG TOOLS ===
  async readXPConfig() {
    try {
      const db = (await connectToDatabase()).connection.db;
      if (!db) return null;
      const badgeXP = await db.collection("xpconfigs").findOne({ type: "badge_xp" });
      const levels = await db.collection("xpconfigs").findOne({ type: "level_progression" });
      return { badgeXP: badgeXP?.data, levels: levels?.data };
    } catch {
      return null;
    }
  },

  async writeXPConfig(type: string, data: any) {
    try {
      const db = (await connectToDatabase()).connection.db;
      if (!db) return null;
      return db.collection("xpconfigs").findOneAndUpdate(
        { type },
        { $set: { type, data, updatedAt: new Date() } },
        { upsert: true },
      );
    } catch (err) {
      console.error(`[Wizard] XP config write error:`, err);
      return null;
    }
  },
};

// ─── SYSTEM PROMPTS (one per agent domain) ──────────────────────────────────────

const BADGE_AGENT_PROMPT = `You are a specialized BADGE AGENT for a competitive forex trading platform.

You have DIRECT DATABASE ACCESS. Your job is to analyze badges and return the EXACT data to write to the database.

PLATFORM CONTEXT:
- Users trade forex in competitions (multi-player) and challenges (1v1)
- 20 levels with XP: common=10XP, rare=25XP, epic=50XP, legendary=100XP
- Activity XP: 2/trade, 3 bonus/win, 25/comp completed, 50/35/20 podium, 15/challenge, 30/challenge-win
- Categories: Competition, Trading, Profit, Risk, Speed, Consistency, Strategy, Social, Legendary

BADGE JSON FORMAT:
{
  "id": "snake_case_id",
  "name": "Human Name",
  "description": "2-5 word description",
  "category": "Category",
  "icon": "gameIconName",
  "rarity": "common|rare|epic|legendary",
  "minLevel": 0,
  "condition": { "type": "condition_type", "value": 10, "comparison": "gte", "minTrades": 10, "minCompletedCompetitions": 0 }
}

AVAILABLE ICONS: trophy, trophyStar, goldMedal, silverMedal, bronzeMedal, crown, helmet1, helmet2, sword, shield, bow, axe, mace, staff, dagger, wand, crossbow, halberd, flail, morningstar, spear, hammer, chest1, chest2, pouch1, pouch2, coins, gem, ring, amulet, scroll, book, map, compass, flag, banner, skull, dragon, phoenix, unicorn, griffin, wolf, eagle, lion, snake, spider, bat, knight, archer, rogue, mage, warrior, champion, victory, levelUp, questComplete, headset, guideBook, starBadge, starAward, star1, fireSpell, blueFireSpell

CONDITION TYPES:
competitions_entered, competitions_won, competitions_completed, podium_finishes,
challenges_won, challenges_completed,
total_trades, winning_trades, losing_trades,
win_rate, profit_factor, max_drawdown_pct,
win_streak, loss_recovery_streak,
unique_pairs_traded, trades_in_single_session,
avg_trade_duration_minutes, fastest_profitable_trade,
total_profit, largest_single_profit, best_competition_return,
always_uses_sl, always_uses_tp, no_liquidations,
consecutive_profitable_days, total_deposits, total_withdrawals,
account_age_days, kyc_verified, has_deposit, referral_count, manual

CRITICAL RULES:
1. NEVER create zero-baseline badges (absence ≠ skill)
2. Every badge MUST require active proof: minTrades > 0 for trading, minCompletedCompetitions > 0 for competition
3. Rarity ↔ difficulty: common=easy, rare=moderate, epic=hard, legendary=extremely hard
4. minLevel gates: common=0-1, rare=2-4, epic=5-10, legendary=8-15
5. Each category needs a clear ladder: common → rare → epic → legendary
6. No duplicate condition types with the same value

BALANCE GUIDELINES:
- Common: 5-25 trades, 0-3 comps, achievable in first week
- Rare: 25-100 trades, 3-10 comps, achievable in first month
- Epic: 100-500 trades, 10-25 comps, achievable in 2-3 months
- Legendary: 500+ trades, 25+ comps, achievable in 6+ months

Return ONLY valid JSON. No markdown.`;

const MILESTONE_AGENT_PROMPT = `You are a specialized MILESTONE AGENT for a competitive forex trading platform.

You have DIRECT DATABASE ACCESS. Your job is to audit milestone progression and generate connected milestones.

MILESTONE STRUCTURE:
{
  "id": "snake_case_id",
  "mapId": "map_1",
  "name": "Milestone Name",
  "description": "What the user needs to do",
  "shortDescription": "Brief text",
  "nodeType": "start|milestone|checkpoint|branch|legendary",
  "icon": "gameIconName",
  "color": "#hex",
  "completeCondition": { "type": "condition_type", "value": 10, "comparison": "gte" },
  "rewards": { "xp": 25 },
  "requiredBadgeIds": [],
  "isSeasonal": false,
  "order": 1,
  "isRequired": true,
  "isActive": true
}

MAP PROGRESSION (10 maps, progressive difficulty):
- Maps 1-2: Beginner (5-50 trades, 0-2 comps, XP budget ~150)
- Maps 3-4: Early game (50-150 trades, 2-5 comps, XP budget ~200)
- Maps 5-6: Mid game (150-300 trades, 5-10 comps, XP budget ~300)
- Maps 7-8: Advanced (300-600 trades, 10-20 comps, XP budget ~400)
- Maps 9-10: Expert (600-1000+ trades, 20+ comps, XP budget ~500)

KEY RULES:
1. Milestones within a map MUST have progressively increasing condition values
2. Later maps MUST require higher values than earlier maps (no regression)
3. Use requiredBadgeIds to create badge-gated checkpoints at strategic points
4. Each map should have 15-30 milestones
5. First milestone of each map should be a "start" node
6. Last milestone should be a "legendary" or "checkpoint" node
7. Condition types should vary (don't repeat the same type consecutively)
8. XP rewards should match difficulty: easy=10-15, medium=20-30, hard=40-60, legendary=80-100

Return ONLY valid JSON. No markdown.`;

const EVALUATOR_AGENT_PROMPT = `You are a specialized EVALUATION AGENT for a competitive forex trading platform's gamification system.

You evaluate the ENTIRE system (badges + XP levels + milestones) for coherence, balance, and fun.

SCORING CRITERIA (1-10 each):
1. PROGRESSION_FLOW: Clear path from beginner to expert?
2. DIFFICULTY_CURVE: Each tier harder than the last? No spikes or dead zones?
3. ZERO_BASELINE: Can users earn badges without doing anything? (10 = perfect protection)
4. LEVEL_GATING: Do minLevel gates create meaningful progression? Not too strict/lenient?
5. CATEGORY_BALANCE: Good spread of common/rare/epic/legendary per category?
6. XP_ECONOMY: XP earning rate matches level curve? Not too fast/slow?
7. MILESTONE_BADGE_CONNECTION: Do milestones reference badges? Form dependency web?
8. ENGAGEMENT_HOOKS: Short/medium/long-term goals? Daily/weekly/monthly targets?
9. URGENCY: Seasonal or time-limited elements creating urgency?
10. FUN_FACTOR: Is the system motivating? Would traders be excited?

OUTPUT FORMAT:
{
  "overallScore": 7.5,
  "scores": { "progressionFlow": 8, ... },
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "area": "badges|xp|levels|milestones|connections",
      "description": "What's wrong",
      "recommendation": "How to fix",
      "autoFixable": true,
      "fix": { "type": "update_badge", "badgeId": "xxx", "changes": { "minLevel": 5 } }
    }
  ],
  "strengths": ["list of things done well"],
  "summary": "2-3 sentence overall assessment"
}

Fix types for autoFixable issues:
- { "type": "update_badge", "badgeId": "xxx", "changes": { minLevel, condition, rarity } }
- { "type": "update_milestone", "milestoneId": "xxx", "mapId": "yyy", "changes": { ... } }

Be specific. Reference badge/milestone IDs. Return ONLY valid JSON.`;

// ─── HELPER: Parse AI JSON (with repair) ────────────────────────────────────────
function parseAIJSON(content: string): any {
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to repair truncated JSON
    const lastBracket = cleaned.lastIndexOf("]");
    const lastBrace = cleaned.lastIndexOf("}");
    const lastValid = Math.max(lastBracket, lastBrace);
    if (lastValid > 0) {
      try {
        let repaired = cleaned.substring(0, lastValid + 1);
        // If it's an array, ensure it closes properly
        if (repaired.trimStart().startsWith("[") && !repaired.trimEnd().endsWith("]")) {
          repaired += "]";
        }
        return JSON.parse(repaired);
      } catch {
        // Final attempt: find the last complete object in an array
        const lastObj = cleaned.lastIndexOf("}");
        if (lastObj > 0) {
          try {
            return JSON.parse(cleaned.substring(0, lastObj + 1) + "]");
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { action } = body;

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: get_status — Load full system state
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "get_status") {
      const [badges, milestones, maps, xpConfig] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMilestones(),
        dbTools.readAllMaps(),
        dbTools.readXPConfig(),
      ]);

      // Badge stats
      const badgesByCategory: Record<string, Record<string, number>> = {};
      const badgesByRarity: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
      const badgesWithMinLevel = { withGate: 0, withoutGate: 0 };
      const badgesZeroBaseline: string[] = [];

      for (const b of badges as any[]) {
        const cat = b.category || "Unknown";
        const rar = b.rarity || "common";
        if (!badgesByCategory[cat]) badgesByCategory[cat] = { common: 0, rare: 0, epic: 0, legendary: 0 };
        badgesByCategory[cat][rar] = (badgesByCategory[cat][rar] || 0) + 1;
        badgesByRarity[rar] = (badgesByRarity[rar] || 0) + 1;

        if ((b.minLevel || 0) > 0) badgesWithMinLevel.withGate++;
        else badgesWithMinLevel.withoutGate++;

        // Check zero-baseline
        const mt = b.condition?.minTrades || 0;
        const mc = b.condition?.minCompletedCompetitions || 0;
        if (mt === 0 && mc === 0 && rar !== "common") {
          badgesZeroBaseline.push(b.id);
        }
      }

      // Milestone stats
      const milestonesByMap: Record<string, number> = {};
      const milestonesWithBadgeGate: string[] = [];
      for (const m of milestones as any[]) {
        const mapId = m.mapId || "unknown";
        milestonesByMap[mapId] = (milestonesByMap[mapId] || 0) + 1;
        if (m.requiredBadgeIds && m.requiredBadgeIds.length > 0) {
          milestonesWithBadgeGate.push(m.id);
        }
      }

      return NextResponse.json({
        success: true,
        status: {
          badges: {
            total: badges.length,
            byCategory: badgesByCategory,
            byRarity: badgesByRarity,
            levelGating: badgesWithMinLevel,
            zeroBaselineRisks: badgesZeroBaseline,
          },
          milestones: {
            total: milestones.length,
            byMap: milestonesByMap,
            withBadgeGate: milestonesWithBadgeGate.length,
          },
          maps: {
            total: maps.length,
            list: (maps as any[]).map((m) => ({
              mapId: m.mapId,
              name: m.name,
              theme: m.theme,
              difficulty: m.difficulty,
              sequenceOrder: m.sequenceOrder,
              totalMilestones: m.totalMilestones,
            })),
          },
          xp: {
            configured: !!xpConfig?.badgeXP,
            badgeXP: xpConfig?.badgeXP || { common: 10, rare: 25, epic: 50, legendary: 100 },
          },
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: setup_levels — Apply level/XP preset
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "setup_levels") {
      const { preset, badgeXP, levels } = body;

      const presets: Record<string, { badgeXP: any; description: string }> = {
        conservative: {
          badgeXP: { common: 5, rare: 15, epic: 35, legendary: 75 },
          description: "Slower progression. Players need more badges to level up.",
        },
        balanced: {
          badgeXP: { common: 10, rare: 25, epic: 50, legendary: 100 },
          description: "Default balanced progression.",
        },
        aggressive: {
          badgeXP: { common: 15, rare: 35, epic: 75, legendary: 150 },
          description: "Faster progression. Good for smaller user bases.",
        },
      };

      if (preset && presets[preset]) {
        const p = presets[preset];
        await dbTools.writeXPConfig("badge_xp", p.badgeXP);
        return NextResponse.json({
          success: true,
          message: `Applied "${preset}" preset: ${p.description}`,
          badgeXP: p.badgeXP,
        });
      }

      if (badgeXP) {
        await dbTools.writeXPConfig("badge_xp", badgeXP);
      }
      if (levels) {
        await dbTools.writeXPConfig("level_progression", levels);
      }

      return NextResponse.json({
        success: true,
        message: "XP configuration updated",
        badgeXP: badgeXP || null,
        levels: levels || null,
      });
    }

    // ─── AI-powered actions below require OpenAI ──────────────────────────────
    const config = await getAIConfig();
    if (!config.enabled || !config.apiKey) {
      return NextResponse.json(
        { success: false, error: "AI is not enabled. Configure OpenAI in admin settings." },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey: config.apiKey });

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: agent_badges — Specialized Badge Agent
    // Reads all badges → AI audits + fixes + generates → writes to DB
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_badges") {
      const { generateCount = 0, autoApply = false } = body;

      // TOOL: Read current state
      const badges = await dbTools.readAllBadges();
      const maps = await dbTools.readAllMaps();
      const milestones = await dbTools.readAllMilestones();

      const badgeSummary = (badges as any[]).map((b) => ({
        id: b.id, name: b.name, description: b.description,
        category: b.category, rarity: b.rarity,
        minLevel: b.minLevel || 0, condition: b.condition, icon: b.icon,
      }));

      // Cross-system context: which badges are referenced by milestones
      const referencedBadgeIds = new Set<string>();
      for (const m of milestones as any[]) {
        if (m.requiredBadgeIds) {
          for (const bid of m.requiredBadgeIds) referencedBadgeIds.add(bid);
        }
        if (m.rewards?.badgeId) referencedBadgeIds.add(m.rewards.badgeId);
      }

      // Build prompt with full cross-system context
      const prompt = `BADGE AGENT TASK: Audit ALL existing badges and ${generateCount > 0 ? `generate ${generateCount} new ones` : "report"}.

CURRENT BADGES (${badges.length} total):
${JSON.stringify(badgeSummary, null, 2)}

CROSS-SYSTEM CONTEXT:
- Journey maps: ${maps.length} maps
- Milestones: ${milestones.length} total
- Badges referenced by milestones: [${[...referencedBadgeIds].join(", ")}]
- Level progression: 20 levels (0 to 15000 XP)

YOUR TASKS:
1. AUDIT every existing badge:
   - Fix minLevel (must NOT be 0 for rare/epic/legendary)
   - Fix condition.minTrades (must prevent zero-baseline)
   - Fix condition.value (must match rarity difficulty)
   - Fix rarity if difficulty doesn't match
   - Mark fixed badges with "_changes": "description of changes"

2. ${generateCount > 0 ? `GENERATE ${generateCount} NEW badges:
   - Fill gaps in categories that have fewer badges
   - Ensure new badges don't duplicate existing condition+value combos
   - Mark new badges with "_isNew": true
   - Ensure new badges connect to the progression (appropriate minLevel)` : "Do NOT generate new badges."}

3. PROTECT milestone connections:
   - Badges in [${[...referencedBadgeIds].join(", ")}] are used by milestones
   - Do NOT change their ID or condition.type
   - You CAN adjust their minLevel, minTrades, value

Return a JSON object:
{
  "badges": [<ALL existing badges (fixed) + any new badges>],
  "summary": "Brief summary of changes",
  "fixedCount": <number of badges that were changed>,
  "newCount": <number of new badges generated>
}`;

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: BADGE_AGENT_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 16000,
      });

      const parsed = parseAIJSON(completion.choices[0]?.message?.content || "{}");
      if (!parsed || !parsed.badges) {
        return NextResponse.json(
          { success: false, error: "Badge agent returned invalid response", raw: completion.choices[0]?.message?.content?.substring(0, 500) },
          { status: 500 },
        );
      }

      // If autoApply, write directly to DB
      let writeResults = null;
      if (autoApply && Array.isArray(parsed.badges)) {
        writeResults = await dbTools.writeBadgesBatch(parsed.badges);
      }

      return NextResponse.json({
        success: true,
        action: "agent_badges",
        badges: parsed.badges,
        summary: parsed.summary || "",
        fixedCount: parsed.fixedCount || 0,
        newCount: parsed.newCount || 0,
        totalBadges: parsed.badges.length,
        applied: autoApply,
        writeResults,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: agent_milestones — Specialized Milestone Agent
    // Reads all milestones + badges → AI audits + fixes → writes to DB
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_milestones") {
      const { mapId, autoApply = false } = body;

      // TOOL: Read current state
      const [badges, milestones, maps] = await Promise.all([
        dbTools.readAllBadges(),
        mapId ? dbTools.readMilestonesByMap(mapId) : dbTools.readAllMilestones(),
        dbTools.readAllMaps(),
      ]);

      const badgeSummary = (badges as any[]).map((b) => ({
        id: b.id, name: b.name, category: b.category,
        rarity: b.rarity, minLevel: b.minLevel || 0,
        conditionType: b.condition?.type,
      }));

      const milestoneSummary = (milestones as any[]).map((m) => ({
        id: m.id, mapId: m.mapId, name: m.name,
        nodeType: m.nodeType, order: m.order,
        completeCondition: m.completeCondition,
        rewards: m.rewards,
        requiredBadgeIds: m.requiredBadgeIds || [],
        isSeasonal: m.isSeasonal || false,
      }));

      const mapSummary = (maps as any[]).map((m) => ({
        mapId: m.mapId, name: m.name, sequenceOrder: m.sequenceOrder,
        theme: m.theme, difficulty: m.difficulty,
      }));

      const prompt = `MILESTONE AGENT TASK: Audit ${mapId ? `map "${mapId}"` : "ALL"} milestones for progression and badge connections.

AVAILABLE BADGES (${badges.length} total — use these IDs for requiredBadgeIds):
${JSON.stringify(badgeSummary, null, 2)}

MAPS:
${JSON.stringify(mapSummary, null, 2)}

CURRENT MILESTONES (${milestones.length}):
${JSON.stringify(milestoneSummary, null, 2)}

YOUR TASKS:
1. AUDIT milestone progression:
   - Condition values MUST increase within each map
   - Later maps MUST have higher values than earlier maps
   - No duplicate conditions with same value in same map
   - Each map's first milestone should be easy, last should be hard
   
2. FIX badge-gating:
   - Add requiredBadgeIds to strategic checkpoints (every 3-5 milestones)
   - Badge requirements should be achievable by that point in progression
   - Do NOT gate every milestone — only strategic ones
   
3. FIX rewards:
   - XP rewards should match difficulty: easy=10-15, medium=20-30, hard=40-60
   - Each map's total XP should be proportional to its difficulty

4. Mark fixed milestones with "_changes": "description"

Return a JSON object:
{
  "milestones": [<ALL milestones with fixes applied>],
  "summary": "Brief summary of changes",
  "fixedCount": <number changed>,
  "badgeGatesAdded": <number of new badge-gates added>
}`;

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: MILESTONE_AGENT_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 16000,
      });

      const parsed = parseAIJSON(completion.choices[0]?.message?.content || "{}");
      if (!parsed || !parsed.milestones) {
        return NextResponse.json(
          { success: false, error: "Milestone agent returned invalid response", raw: completion.choices[0]?.message?.content?.substring(0, 500) },
          { status: 500 },
        );
      }

      let writeResults = null;
      if (autoApply && Array.isArray(parsed.milestones)) {
        writeResults = await dbTools.writeMilestonesBatch(parsed.milestones);
      }

      return NextResponse.json({
        success: true,
        action: "agent_milestones",
        milestones: parsed.milestones,
        summary: parsed.summary || "",
        fixedCount: parsed.fixedCount || 0,
        badgeGatesAdded: parsed.badgeGatesAdded || 0,
        totalMilestones: parsed.milestones.length,
        applied: autoApply,
        writeResults,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: agent_evaluate — Full System Evaluation Agent
    // Reads everything → AI scores coherence → returns fixes
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_evaluate") {
      const { autoApply = false } = body;

      const [badges, milestones, maps] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMilestones(),
        dbTools.readAllMaps(),
      ]);

      const badgeSummary = (badges as any[]).map((b) => ({
        id: b.id, name: b.name, category: b.category,
        rarity: b.rarity, minLevel: b.minLevel || 0,
        condition: b.condition,
      }));

      // Category distribution
      const categoryDist: Record<string, Record<string, number>> = {};
      for (const b of badges as any[]) {
        if (!categoryDist[b.category]) categoryDist[b.category] = {};
        categoryDist[b.category][b.rarity] = (categoryDist[b.category][b.rarity] || 0) + 1;
      }

      // Level gating distribution
      const levelDist: Record<number, number> = {};
      for (const b of badges as any[]) {
        const lvl = b.minLevel || 0;
        levelDist[lvl] = (levelDist[lvl] || 0) + 1;
      }

      const milestoneSummary = (milestones as any[]).map((m) => ({
        id: m.id, mapId: m.mapId, name: m.name, nodeType: m.nodeType,
        completeCondition: m.completeCondition,
        rewards: m.rewards, requiredBadgeIds: m.requiredBadgeIds || [],
        order: m.order,
      }));

      const prompt = `EVALUATE the entire gamification system.

=== BADGES (${badges.length}) ===
Category distribution: ${JSON.stringify(categoryDist)}
Level gating distribution: ${JSON.stringify(levelDist)}
Badge details: ${JSON.stringify(badgeSummary, null, 2)}

=== MILESTONES (${milestones.length}) ===
Maps: ${maps.length}
${JSON.stringify(milestoneSummary, null, 2)}

=== XP ECONOMY ===
Badge XP: common=10, rare=25, epic=50, legendary=100
Activity XP: 2/trade (cap 100/day), 3 bonus/win, 25/comp, 50/35/20 podium, 15/challenge, 30/challenge-win

=== LEVELS (20) ===
L1:0 L2:50 L3:125 L4:250 L5:375 L6:500 L7:750 L8:1100 L9:1450 L10:1800
L11:2000 L12:2500 L13:3000 L14:3500 L15:4000 L16:5000 L17:6000 L18:7500 L19:10000 L20:15000

Evaluate against ALL 10 criteria. Be specific about which badge/milestone IDs have issues.
For autoFixable issues, provide the exact fix payload.`;

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: EVALUATOR_AGENT_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      });

      const evaluation = parseAIJSON(completion.choices[0]?.message?.content || "{}");
      if (!evaluation) {
        return NextResponse.json(
          { success: false, error: "Evaluation agent returned invalid response" },
          { status: 500 },
        );
      }

      // Auto-apply fixable issues if requested
      let fixResults = null;
      if (autoApply && evaluation.issues) {
        const fixable = evaluation.issues.filter((i: any) => i.autoFixable && i.fix);
        const badgeFixes: any[] = [];
        const milestoneFixes: any[] = [];

        for (const issue of fixable) {
          if (issue.fix.type === "update_badge" && issue.fix.badgeId) {
            const badge = (badges as any[]).find((b) => b.id === issue.fix.badgeId);
            if (badge) {
              badgeFixes.push({
                ...badge,
                ...(issue.fix.changes || {}),
                condition: issue.fix.changes?.condition
                  ? { ...badge.condition, ...issue.fix.changes.condition }
                  : badge.condition,
              });
            }
          }
          if (issue.fix.type === "update_milestone" && issue.fix.milestoneId) {
            const ms = (milestones as any[]).find((m: any) => m.id === issue.fix.milestoneId);
            if (ms) {
              milestoneFixes.push({
                ...ms,
                ...(issue.fix.changes || {}),
              });
            }
          }
        }

        const badgeResults = badgeFixes.length > 0 ? await dbTools.writeBadgesBatch(badgeFixes) : null;
        const msResults = milestoneFixes.length > 0 ? await dbTools.writeMilestonesBatch(milestoneFixes) : null;

        fixResults = {
          totalFixable: fixable.length,
          badgeFixes: badgeResults,
          milestoneFixes: msResults,
        };
      }

      return NextResponse.json({
        success: true,
        action: "agent_evaluate",
        evaluation,
        applied: autoApply,
        fixResults,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: agent_full_setup — Run all agents in sequence
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_full_setup") {
      const { generateBadgeCount = 5, autoApply = true } = body;

      const steps: any[] = [];

      // Step 1: Badge Agent
      const badgesReq = new Request(request.url, {
        method: "POST",
        body: JSON.stringify({ action: "agent_badges", generateCount: generateBadgeCount, autoApply }),
        headers: { "Content-Type": "application/json" },
      });
      const badgesRes = await POST(new NextRequest(badgesReq));
      const badgesData = await badgesRes.json();
      steps.push({
        step: "badges",
        success: badgesData.success,
        summary: badgesData.summary,
        fixedCount: badgesData.fixedCount,
        newCount: badgesData.newCount,
        applied: badgesData.applied,
      });

      // Step 2: Milestone Agent (audit all)
      const msReq = new Request(request.url, {
        method: "POST",
        body: JSON.stringify({ action: "agent_milestones", autoApply }),
        headers: { "Content-Type": "application/json" },
      });
      const msRes = await POST(new NextRequest(msReq));
      const msData = await msRes.json();
      steps.push({
        step: "milestones",
        success: msData.success,
        summary: msData.summary,
        fixedCount: msData.fixedCount,
        badgeGatesAdded: msData.badgeGatesAdded,
        applied: msData.applied,
      });

      // Step 3: Evaluate
      const evalReq = new Request(request.url, {
        method: "POST",
        body: JSON.stringify({ action: "agent_evaluate", autoApply }),
        headers: { "Content-Type": "application/json" },
      });
      const evalRes = await POST(new NextRequest(evalReq));
      const evalData = await evalRes.json();
      steps.push({
        step: "evaluate",
        success: evalData.success,
        overallScore: evalData.evaluation?.overallScore,
        issueCount: evalData.evaluation?.issues?.length || 0,
        applied: evalData.applied,
      });

      return NextResponse.json({
        success: true,
        action: "agent_full_setup",
        steps,
        evaluation: evalData.evaluation,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: apply_changes — Apply a specific set of badge/milestone changes
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "apply_changes") {
      const { badges: badgesToApply, milestones: milestonesToApply } = body;
      const results: any = {};

      if (Array.isArray(badgesToApply) && badgesToApply.length > 0) {
        results.badges = await dbTools.writeBadgesBatch(badgesToApply);
      }

      if (Array.isArray(milestonesToApply) && milestonesToApply.length > 0) {
        results.milestones = await dbTools.writeMilestonesBatch(milestonesToApply);
      }

      return NextResponse.json({
        success: true,
        action: "apply_changes",
        results,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use: get_status, setup_levels, agent_badges, agent_milestones, agent_evaluate, agent_full_setup, apply_changes" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[Gamification Wizard] Error:", error);
    return NextResponse.json(
      { success: false, error: "Gamification Wizard failed: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 },
    );
  }
}
