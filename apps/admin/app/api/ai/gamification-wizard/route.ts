/**
 * Unified Gamification Wizard API
 *
 * Specialized agents that can READ, ANALYZE, and FIX the gamification system.
 * Each action is a specialized agent with DB tools.
 *
 * OPTIMIZED: Compact prompts, return-only-changes pattern, per-map milestone processing.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import BadgeConfig from "@/database/models/badge-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

// Allow up to 2 minutes for AI agents
export const maxDuration = 120;

// ─── AI CONFIG ─────────────────────────────────────────────────────────────────
interface AIConfig { apiKey: string | null; model: string; enabled: boolean }

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
  } catch { /* fallback to env */ }
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: process.env.OPENAI_ENABLED === "true",
  };
}

// ─── DB TOOLS ──────────────────────────────────────────────────────────────────
const dbTools = {
  async readAllBadges() {
    return BadgeConfig.find({ isActive: true }).lean();
  },
  async readAllMilestones() {
    return JourneyMilestone.find({ isActive: true }).lean();
  },
  async readMilestonesByMap(mapId: string) {
    return JourneyMilestone.find({ mapId, isActive: true }).sort({ order: 1 }).lean();
  },
  async readAllMaps() {
    return JourneyMapConfig.find({}).sort({ sequenceOrder: 1 }).lean();
  },
  async writeBadgesBatch(badges: any[]) {
    const results = { created: 0, updated: 0, errors: 0, skipped: 0 };
    const validRarities = ["common", "rare", "epic", "legendary"];
    const validCategories = ["Competition", "Trading", "Profit", "Risk", "Speed", "Consistency", "Strategy", "Social", "Legendary"];

    for (const badge of badges) {
      try {
        const { _changes, _isNew, _id, __v, createdAt, updatedAt, ...clean } = badge;

        // ── Validation: skip badges with invalid or missing required fields ──
        if (!clean.id || typeof clean.id !== "string") {
          console.warn(`[Wizard] Skipping badge with missing/invalid id`);
          results.skipped++;
          continue;
        }
        if (!clean.condition?.type) {
          console.warn(`[Wizard] Skipping badge ${clean.id}: missing condition.type`);
          results.skipped++;
          continue;
        }
        if (clean.rarity && !validRarities.includes(clean.rarity)) {
          console.warn(`[Wizard] Skipping badge ${clean.id}: invalid rarity "${clean.rarity}"`);
          results.skipped++;
          continue;
        }
        if (clean.category && !validCategories.includes(clean.category)) {
          console.warn(`[Wizard] Skipping badge ${clean.id}: invalid category "${clean.category}"`);
          results.skipped++;
          continue;
        }

        // ── Sanitize numeric fields ──
        const minLevel = Math.max(0, Math.min(20, Number(clean.minLevel) || 0));
        if (clean.condition) {
          if (clean.condition.minTrades !== undefined) {
            clean.condition.minTrades = Math.max(0, Number(clean.condition.minTrades) || 0);
          }
          if (clean.condition.minCompletedCompetitions !== undefined) {
            clean.condition.minCompletedCompetitions = Math.max(0, Number(clean.condition.minCompletedCompetitions) || 0);
          }
          if (clean.condition.value !== undefined) {
            clean.condition.value = Number(clean.condition.value) || 0;
          }
        }

        const existing = await BadgeConfig.findOne({ id: clean.id });

        // #region agent log
        console.log(`[DEBUG-WIZARD] writeBadge id=${clean.id} minLevel=${minLevel} condMinTrades=${clean.condition?.minTrades} existing=${!!existing} existingMinLevel=${existing?.minLevel} existingCondMinTrades=${(existing as any)?.condition?.minTrades}`);
        // #endregion

        if (existing) {
          // ── Surgical update: use $set to only update provided fields ──
          // Preserve fields the AI didn't provide by merging with existing
          const updateDoc: any = {
            minLevel,
          };
          // Only update fields that are explicitly provided in clean
          if (clean.name) updateDoc.name = clean.name;
          if (clean.description) updateDoc.description = clean.description;
          if (clean.category) updateDoc.category = clean.category;
          if (clean.icon) updateDoc.icon = clean.icon;
          if (clean.rarity) updateDoc.rarity = clean.rarity;
          if (clean.condition) {
            // Merge with existing condition to preserve fields AI didn't mention
            updateDoc.condition = {
              ...((existing as any).condition?.toObject?.() || (existing as any).condition || {}),
              ...clean.condition,
            };
          }

          await BadgeConfig.findOneAndUpdate(
            { id: clean.id },
            { $set: updateDoc },
          );

          // #region agent log
          const afterWrite = await BadgeConfig.findOne({ id: clean.id }).lean();
          console.log(`[DEBUG-WIZARD] afterWrite id=${clean.id} minLevel=${(afterWrite as any)?.minLevel} condMinTrades=${(afterWrite as any)?.condition?.minTrades} condMinComps=${(afterWrite as any)?.condition?.minCompletedCompetitions} preserved=${(afterWrite as any)?.minLevel===minLevel}`);
          // #endregion

          results.updated++;
        } else {
          // New badge — require all critical fields
          if (!clean.name || !clean.description || !clean.category || !clean.rarity) {
            console.warn(`[Wizard] Skipping new badge ${clean.id}: missing name/description/category/rarity`);
            results.skipped++;
            continue;
          }
          await BadgeConfig.create({
            ...clean,
            minLevel,
            isActive: true,
            icon: clean.icon || "🏆",
          });
          results.created++;
        }
      } catch (err) {
        console.error(`[Wizard] Badge write error for ${badge.id}:`, err);
        results.errors++;
      }
    }
    return results;
  },
  async writeMilestonesBatch(milestones: any[]) {
    const results = { created: 0, updated: 0, errors: 0 };
    for (const ms of milestones) {
      try {
        const { _changes, _isNew, _id, __v, createdAt, updatedAt, ...clean } = ms;
        const existing = await JourneyMilestone.findOne({ id: clean.id, mapId: clean.mapId });
        if (existing) {
          await JourneyMilestone.findOneAndUpdate({ id: clean.id, mapId: clean.mapId }, clean);
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
  async readXPConfig() {
    try {
      const db = (await connectToDatabase()).connection.db;
      if (!db) return null;
      const badgeXP = await db.collection("xpconfigs").findOne({ type: "badge_xp" });
      const levels = await db.collection("xpconfigs").findOne({ type: "level_progression" });
      return { badgeXP: badgeXP?.data, levels: levels?.data };
    } catch { return null; }
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

// ─── COMPACT FORMAT HELPERS ─────────────────────────────────────────────────────
// Instead of pretty JSON, use compact CSV-like format to cut prompt size by ~70%

function badgesToCompact(badges: any[]): string {
  // One line per badge: id|name|category|rarity|minLevel|condType|condValue|condComp|minTrades|minComps
  const header = "id|name|cat|rarity|minLvl|condType|condVal|comp|minTrades|minComps";
  const lines = (badges as any[]).map((b) => {
    const c = b.condition || {};
    return `${b.id}|${b.name}|${b.category}|${b.rarity}|${b.minLevel || 0}|${c.type || "manual"}|${c.value ?? ""}|${c.comparison || "gte"}|${c.minTrades || 0}|${c.minCompletedCompetitions || 0}`;
  });
  return [header, ...lines].join("\n");
}

function milestonesToCompact(milestones: any[]): string {
  // One line per milestone: id|mapId|name|nodeType|order|condType|condValue|xpReward|badgeGates
  const header = "id|mapId|name|nodeType|order|condType|condVal|xpReward|requiredBadgeIds";
  const lines = (milestones as any[]).map((m) => {
    const c = m.completeCondition || {};
    const gates = (m.requiredBadgeIds || []).join(",");
    return `${m.id}|${m.mapId}|${m.name}|${m.nodeType || "milestone"}|${m.order || 0}|${c.type || ""}|${c.value ?? ""}|${m.rewards?.xp || 0}|${gates}`;
  });
  return [header, ...lines].join("\n");
}

// ─── SYSTEM PROMPTS (compact) ──────────────────────────────────────────────────

const BADGE_AGENT_PROMPT = `You are a BADGE AGENT for a forex trading competition platform.
20 levels, XP: common=10, rare=25, epic=50, legendary=100.
Categories: Competition, Trading, Profit, Risk, Speed, Consistency, Strategy, Social, Legendary.

RULES:
1. No zero-baseline badges. minTrades>0 for trading, minComps>0 for competition badges.
2. minLevel gates: common=0-1, rare=2-4, epic=5-10, legendary=8-15.
3. Rarity matches difficulty: common=easy(week), rare=moderate(month), epic=hard(2-3mo), legendary=extreme(6mo+).
4. Common:5-25trades, Rare:25-100trades, Epic:100-500trades, Legendary:500+trades.

Return ONLY valid JSON. No markdown, no explanation.`;

const MILESTONE_AGENT_PROMPT = `You are a MILESTONE AGENT for a forex trading platform.
10 journey maps with progressive difficulty.
Maps 1-2: beginner (5-50 trades). Maps 3-4: early (50-150). Maps 5-6: mid (150-300). Maps 7-8: advanced (300-600). Maps 9-10: expert (600-1000+).

RULES:
1. Values must increase within each map and across maps.
2. Use requiredBadgeIds at strategic checkpoints (every 3-5 milestones).
3. XP rewards match difficulty: easy=10-15, medium=20-30, hard=40-60.
4. Return ONLY badges that need changes, not unchanged ones.

Return ONLY valid JSON. No markdown.`;

const EVALUATOR_PROMPT = `You are a GAMIFICATION EVALUATOR for a forex trading platform.
Score 10 criteria (1-10): progressionFlow, difficultyCurve, zeroBaselineProtection, levelGating, categoryBalance, xpEconomy, milestoneBadgeConnection, engagementHooks, urgency, funFactor.

You are a REPORT-ONLY agent. You DO NOT fix anything. You score, identify issues, and recommend what the Badge Agent or Milestone Agent should fix.

Return JSON: { "overallScore": N, "scores": {...}, "issues": [{severity,area,description,recommendation,targetAgent}], "strengths": [...], "summary": "..." }
targetAgent is "badge_agent" or "milestone_agent" — indicates which agent should fix this issue.
Return ONLY valid JSON. No markdown.`;

// ─── JSON PARSER (with repair) ──────────────────────────────────────────────────
function parseAIJSON(content: string): any {
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Repair truncated JSON
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > 0) {
      try {
        let sub = cleaned.substring(0, lastBrace + 1);
        // Try wrapping in array if needed
        if (!sub.trimStart().startsWith("{") && !sub.trimStart().startsWith("[")) return null;
        return JSON.parse(sub);
      } catch {
        try {
          return JSON.parse(cleaned.substring(0, lastBrace + 1) + "]");
        } catch { return null; }
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
    // get_status — Load full system state (no AI, fast)
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "get_status") {
      const [badges, milestones, maps, xpConfig] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMilestones(),
        dbTools.readAllMaps(),
        dbTools.readXPConfig(),
      ]);

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
        const mt = b.condition?.minTrades || 0;
        const mc = b.condition?.minCompletedCompetitions || 0;
        if (mt === 0 && mc === 0 && rar !== "common") badgesZeroBaseline.push(b.id);
      }

      const milestonesByMap: Record<string, number> = {};
      let milestonesWithBadgeGate = 0;
      for (const m of milestones as any[]) {
        milestonesByMap[m.mapId || "unknown"] = (milestonesByMap[m.mapId || "unknown"] || 0) + 1;
        if (m.requiredBadgeIds?.length > 0) milestonesWithBadgeGate++;
      }

      return NextResponse.json({
        success: true,
        status: {
          badges: { total: badges.length, byCategory: badgesByCategory, byRarity: badgesByRarity, levelGating: badgesWithMinLevel, zeroBaselineRisks: badgesZeroBaseline },
          milestones: { total: milestones.length, byMap: milestonesByMap, withBadgeGate: milestonesWithBadgeGate },
          maps: { total: maps.length, list: (maps as any[]).map((m) => ({ mapId: m.mapId, name: m.name, theme: m.theme, difficulty: m.difficulty, sequenceOrder: m.sequenceOrder, totalMilestones: m.totalMilestones })) },
          xp: { configured: !!xpConfig?.badgeXP, badgeXP: xpConfig?.badgeXP || { common: 10, rare: 25, epic: 50, legendary: 100 } },
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // setup_levels — Apply level/XP preset (no AI, fast)
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "setup_levels") {
      const { preset, badgeXP, levels } = body;
      const presets: Record<string, { badgeXP: any; description: string }> = {
        conservative: { badgeXP: { common: 5, rare: 15, epic: 35, legendary: 75 }, description: "Slower progression." },
        balanced: { badgeXP: { common: 10, rare: 25, epic: 50, legendary: 100 }, description: "Default balanced." },
        aggressive: { badgeXP: { common: 15, rare: 35, epic: 75, legendary: 150 }, description: "Faster progression." },
      };
      if (preset && presets[preset]) {
        await dbTools.writeXPConfig("badge_xp", presets[preset].badgeXP);
        return NextResponse.json({ success: true, message: `Applied "${preset}": ${presets[preset].description}`, badgeXP: presets[preset].badgeXP });
      }
      if (badgeXP) await dbTools.writeXPConfig("badge_xp", badgeXP);
      if (levels) await dbTools.writeXPConfig("level_progression", levels);
      return NextResponse.json({ success: true, message: "XP configuration updated" });
    }

    // ─── AI actions require OpenAI ──────────────────────────────────────────
    const config = await getAIConfig();
    if (!config.enabled || !config.apiKey) {
      return NextResponse.json({ success: false, error: "AI is not enabled. Configure OpenAI in admin settings." }, { status: 400 });
    }
    const openai = new OpenAI({ apiKey: config.apiKey });

    // ═══════════════════════════════════════════════════════════════════════════
    // agent_badges — OPTIMIZED: compact format, return ONLY changed badges
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_badges") {
      const { generateCount = 0, autoApply = false } = body;
      const badges = await dbTools.readAllBadges();

      // Compact format: ~70% smaller than pretty JSON
      const compactBadges = badgesToCompact(badges);

      // Find which badges milestones reference (protect these)
      const milestones = await dbTools.readAllMilestones();
      const referencedIds = new Set<string>();
      for (const m of milestones as any[]) {
        if (m.requiredBadgeIds) for (const bid of m.requiredBadgeIds) referencedIds.add(bid);
        if (m.rewards?.badgeId) referencedIds.add(m.rewards.badgeId);
      }

      const prompt = `AUDIT ${badges.length} badges. Return ONLY badges that need fixes (not unchanged ones).${generateCount > 0 ? ` Also generate ${generateCount} new badges.` : ""}

BADGES (pipe-separated):
${compactBadges}

Protected IDs (used by milestones): [${[...referencedIds].join(",")}]

For EACH badge with issues, return the FULL fixed badge object.
For NEW badges, include "_isNew": true.
For FIXED badges, include "_changes": "what changed".
Do NOT include unchanged badges.

Return JSON:
{"badges":[<only changed + new badges>],"summary":"brief","fixedCount":N,"newCount":N}`;

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: BADGE_AGENT_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 6000,
      });

      const parsed = parseAIJSON(completion.choices[0]?.message?.content || "{}");
      if (!parsed || !parsed.badges) {
        return NextResponse.json({
          success: false,
          error: "Badge agent returned invalid response",
          raw: completion.choices[0]?.message?.content?.substring(0, 500),
        }, { status: 500 });
      }

      let writeResults = null;
      if (autoApply && Array.isArray(parsed.badges) && parsed.badges.length > 0) {
        writeResults = await dbTools.writeBadgesBatch(parsed.badges);
      }

      return NextResponse.json({
        success: true,
        action: "agent_badges",
        badges: parsed.badges,
        summary: parsed.summary || "",
        fixedCount: parsed.fixedCount || parsed.badges.filter((b: any) => b._changes).length,
        newCount: parsed.newCount || parsed.badges.filter((b: any) => b._isNew).length,
        totalBadges: badges.length,
        applied: autoApply,
        writeResults,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // agent_milestones — OPTIMIZED: compact format, per-map processing
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_milestones") {
      const { mapId, autoApply = false } = body;

      const [badges, maps] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMaps(),
      ]);

      // If no mapId, process the FIRST map that has milestones (not all at once)
      let targetMapId = mapId;
      if (!targetMapId && (maps as any[]).length > 0) {
        targetMapId = (maps as any[])[0].mapId;
      }

      const milestones = targetMapId
        ? await dbTools.readMilestonesByMap(targetMapId)
        : await dbTools.readAllMilestones();

      if (milestones.length === 0) {
        return NextResponse.json({
          success: true,
          action: "agent_milestones",
          milestones: [],
          summary: "No milestones found for this map",
          fixedCount: 0,
          badgeGatesAdded: 0,
          totalMilestones: 0,
          applied: false,
          writeResults: null,
        });
      }

      // Compact badge list for context (just IDs and condition types)
      const badgeContext = (badges as any[]).map((b) =>
        `${b.id}(${b.rarity},Lv${b.minLevel || 0},${b.condition?.type || "manual"})`
      ).join(", ");

      const compactMilestones = milestonesToCompact(milestones);
      const mapInfo = (maps as any[]).find((m) => m.mapId === targetMapId);

      const prompt = `AUDIT milestones for map "${targetMapId}" (${mapInfo?.name || "unknown"}, difficulty ${mapInfo?.difficulty || "?"}).
Return ONLY milestones that need fixes (not unchanged ones).

AVAILABLE BADGES: ${badgeContext}

MILESTONES (${milestones.length}, pipe-separated):
${compactMilestones}

Check:
1. Condition values increase progressively
2. Add requiredBadgeIds at checkpoints (every 3-5 milestones)
3. XP rewards match difficulty
4. No duplicate conditions

Return JSON:
{"milestones":[<only changed milestones with full data>],"summary":"brief","fixedCount":N,"badgeGatesAdded":N}`;

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: MILESTONE_AGENT_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 6000,
      });

      const parsed = parseAIJSON(completion.choices[0]?.message?.content || "{}");
      if (!parsed || !parsed.milestones) {
        return NextResponse.json({
          success: false,
          error: "Milestone agent returned invalid response",
          raw: completion.choices[0]?.message?.content?.substring(0, 500),
        }, { status: 500 });
      }

      let writeResults = null;
      if (autoApply && Array.isArray(parsed.milestones) && parsed.milestones.length > 0) {
        writeResults = await dbTools.writeMilestonesBatch(parsed.milestones);
      }

      return NextResponse.json({
        success: true,
        action: "agent_milestones",
        milestones: parsed.milestones,
        summary: parsed.summary || "",
        fixedCount: parsed.fixedCount || parsed.milestones.length,
        badgeGatesAdded: parsed.badgeGatesAdded || 0,
        totalMilestones: milestones.length,
        mapId: targetMapId,
        applied: autoApply,
        writeResults,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // agent_evaluate — REPORT-ONLY: scores the system, recommends fixes,
    // but NEVER writes to the database. Use Badge/Milestone agents to fix.
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_evaluate") {
      const [badges, milestones, maps] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMilestones(),
        dbTools.readAllMaps(),
      ]);

      // Category + level distribution (compact)
      const catDist: Record<string, string> = {};
      for (const b of badges as any[]) {
        const cat = b.category || "?";
        if (!catDist[cat]) catDist[cat] = "";
        catDist[cat] += (b.rarity || "c")[0];
      }
      const catSummary = Object.entries(catDist).map(([cat, rarities]) => {
        const c = (rarities.match(/c/g) || []).length;
        const r = (rarities.match(/r/g) || []).length;
        const e = (rarities.match(/e/g) || []).length;
        const l = (rarities.match(/l/g) || []).length;
        return `${cat}: ${c}c/${r}r/${e}e/${l}l`;
      }).join(", ");

      const lvlDist: Record<number, number> = {};
      for (const b of badges as any[]) {
        const lvl = b.minLevel || 0;
        lvlDist[lvl] = (lvlDist[lvl] || 0) + 1;
      }

      const compactBadges = badgesToCompact(badges);

      const msByMap: Record<string, { count: number; gated: number; totalXP: number }> = {};
      for (const m of milestones as any[]) {
        const mid = m.mapId || "?";
        if (!msByMap[mid]) msByMap[mid] = { count: 0, gated: 0, totalXP: 0 };
        msByMap[mid].count++;
        if (m.requiredBadgeIds?.length > 0) msByMap[mid].gated++;
        msByMap[mid].totalXP += m.rewards?.xp || 0;
      }
      const msSummary = Object.entries(msByMap).map(([mapId, s]) =>
        `${mapId}: ${s.count} milestones, ${s.gated} badge-gated, ${s.totalXP} XP total`
      ).join("\n");

      const prompt = `EVALUATE the gamification system. Score all 10 criteria. List top 5-10 issues with recommendations.
Do NOT return fix payloads. Only describe what needs fixing and which agent should handle it.

BADGES (${badges.length}):
Categories: ${catSummary}
Level gating: ${JSON.stringify(lvlDist)}
${compactBadges}

MILESTONES (${milestones.length} across ${maps.length} maps):
${msSummary}

XP: common=10, rare=25, epic=50, legendary=100. Activity: 2/trade(cap100/day), 25/comp, 50/35/20 podium.
LEVELS: L1:0 L2:50 L3:125 L4:250 L5:375 L6:500 L7:750 L8:1100 L9:1450 L10:1800 L11:2000 L12:2500 L13:3000 L14:3500 L15:4000 L16:5000 L17:6000 L18:7500 L19:10000 L20:15000`;

      // #region agent log
      console.log(`[DEBUG-WIZARD] evaluate start badges=${badges.length} milestones=${milestones.length} maps=${maps.length} promptLen=${prompt.length}`);
      // #endregion

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: EVALUATOR_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      });

      const evaluation = parseAIJSON(completion.choices[0]?.message?.content || "{}");
      if (!evaluation) {
        return NextResponse.json({ success: false, error: "Evaluation agent returned invalid response" }, { status: 500 });
      }

      // #region agent log
      console.log(`[DEBUG-WIZARD] evaluate done score=${evaluation.overallScore} issues=${evaluation.issues?.length||0} strengths=${evaluation.strengths?.length||0}`);
      // #endregion

      return NextResponse.json({
        success: true,
        action: "agent_evaluate",
        evaluation,
        applied: false, // Always false — evaluation is report-only
        fixResults: null,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // apply_changes — Manual apply for preview workflow (no AI, fast)
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
      return NextResponse.json({ success: true, action: "apply_changes", results });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use: get_status, setup_levels, agent_badges, agent_milestones, agent_evaluate, apply_changes" },
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
