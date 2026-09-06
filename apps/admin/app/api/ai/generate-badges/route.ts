/**
 * AI Badge Generator API
 *
 * Analyzes the current badge set and generates balanced, gamified badges
 * using OpenAI. Follows the same pattern as the journey AI generator.
 *
 * Actions:
 * - generate: Generate new badges for a category or fill gaps
 * - rebalance: Analyze existing badges and suggest rebalanced conditions
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import BadgeConfig from "@/database/models/badge-config.model";

// Allow up to 2 minutes for AI operations
export const maxDuration = 120;

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

const BADGE_SYSTEM_PROMPT = `You are a game design AI specialized in creating balanced badge/achievement systems for a competitive trading platform.

PLATFORM CONTEXT:
- Users trade forex in simulated competitions (1v1 challenges and multi-player competitions)
- There are 20 levels with XP progression
- Badges give XP: common=10, rare=25, epic=50, legendary=100
- Badges can be level-gated (minLevel 0-20, 0=no requirement)
- Categories: Competition, Trading, Profit, Risk, Speed, Consistency, Strategy, Social, Legendary

BADGE STRUCTURE (you must return this exact JSON format per badge):
{
  "id": "snake_case_unique_id",
  "name": "Human Readable Name",
  "description": "2-5 word description",
  "category": "Category",
  "icon": "gameIconName",
  "rarity": "common|rare|epic|legendary",
  "minLevel": 0,
  "condition": {
    "type": "condition_type_string",
    "value": 10,
    "comparison": "gte",
    "minTrades": 10,
    "minCompletedCompetitions": 0
  }
}

AVAILABLE ICONS: trophy, trophyStar, goldMedal, silverMedal, bronzeMedal, crown, helmet1, helmet2, sword, shield, bow, axe, mace, staff, dagger, wand, crossbow, halberd, flail, morningstar, spear, hammer, chest1, chest2, pouch1, pouch2, coins, gem, ring, amulet, scroll, book, map, compass, flag, banner, skull, dragon, phoenix, unicorn, griffin, wolf, eagle, lion, snake, spider, bat, rat, goblin, orc, troll, wizard, knight, archer, rogue, mage, warrior, healer, tank, champion, victory, defeat, levelUp, questComplete, headset, guideBook

AVAILABLE CONDITION TYPES:
- competitions_entered, competitions_won, competitions_completed, podium_finishes
- challenges_won, challenges_completed
- total_trades, winning_trades, losing_trades
- win_rate, profit_factor, max_drawdown_pct
- win_streak, loss_recovery_streak
- unique_pairs_traded, trades_in_single_session
- avg_trade_duration_minutes, fastest_profitable_trade
- total_profit, largest_single_profit, best_competition_return
- always_uses_sl, always_uses_tp, no_liquidations
- consecutive_profitable_days, total_deposits, total_withdrawals
- account_age_days, kyc_verified, has_deposit, referral_count
- manual (for admin-awarded badges)

CRITICAL GAME DESIGN RULES:
1. NEVER create zero-baseline badges (rewarding absence of bad behavior without proving good behavior)
2. Every badge must require ACTIVE proof of skill (minTrades > 0 for trading badges)
3. Rarity must match difficulty: common=easy, rare=moderate, epic=hard, legendary=extremely hard
4. minLevel should create a progression gate: common=0, rare=0-3, epic=5-10, legendary=8-15
5. Higher rarity badges should have higher minTrades and minCompletedCompetitions requirements
6. Each category should have a clear progression ladder (common -> rare -> epic -> legendary)
7. No duplicate condition types with the same value across badges
8. Descriptions should be motivating and concise (2-5 words)

BALANCE GUIDELINES:
- Common: 5-25 trades required, 0-3 competitions, achievable in first week
- Rare: 25-100 trades, 3-10 competitions, achievable in first month
- Epic: 100-500 trades, 10-25 competitions, achievable in 2-3 months
- Legendary: 500+ trades, 25+ competitions, achievable in 6+ months

Return ONLY valid JSON array of badge objects. No markdown, no explanation.`;

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
    const { action, category, count = 5, existingBadges } = body;

    // Load current badges from DB
    const currentBadges = existingBadges || await BadgeConfig.find({ isActive: true }).lean();

    const openai = new OpenAI({ apiKey: config.apiKey });

    if (action === "generate") {
      // STEP 1: Audit & Fix ALL existing badges (minLevel, conditions, balance)
      // STEP 2: Generate new badges if requested

      const badgeSummary = currentBadges.map((b: any) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        category: b.category,
        rarity: b.rarity,
        minLevel: b.minLevel || 0,
        condition: b.condition,
      }));

      // --- STEP 1: Audit & fix existing badges ---
      const auditPrompt = `AUDIT AND FIX ALL EXISTING BADGES.

CURRENT BADGES (${currentBadges.length} total):
${JSON.stringify(badgeSummary, null, 2)}

YOUR TASK: Return the COMPLETE array of ALL existing badges with fixes applied.

FOR EACH BADGE, check and fix:

1. minLevel — MUST be set properly based on difficulty, NOT left at 0:
   - Common badges: minLevel 0-1 (accessible early)
   - Rare badges: minLevel 2-4 (need some progression)
   - Epic badges: minLevel 5-10 (mid-game players)
   - Legendary badges: minLevel 8-15 (advanced players only)
   - Harder badges within same rarity should have higher minLevel

2. condition.minTrades — MUST prevent zero-baseline awards:
   - Common: at least 5-10
   - Rare: at least 25-50
   - Epic: at least 50-100
   - Legendary: at least 100-500
   - Competition badges need minCompletedCompetitions > 0 too

3. condition.value — Should match rarity difficulty:
   - If a legendary badge only requires 3 wins, increase it
   - If a common badge requires 500 trades, that's too hard for common

4. rarity — If the difficulty doesn't match the rarity, adjust the rarity

RULES:
- DO NOT change: id, name, description, category, icon, condition.type
- You CAN change: minLevel, condition.value, condition.minTrades, condition.minCompletedCompetitions, condition.comparison, rarity
- Add "_changes" field (string) on each badge you modified, explaining what changed
- Badges with no changes needed: include them as-is WITHOUT "_changes" field

Return the COMPLETE JSON array with ALL ${currentBadges.length} badges.`;

      const auditCompletion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: BADGE_SYSTEM_PROMPT },
          { role: "user", content: auditPrompt },
        ],
        temperature: 0.2,
        max_tokens: 16000,
      });

      const auditContent = auditCompletion.choices[0]?.message?.content || "[]";
      let fixedBadges: any[] = [];
      try {
        const cleaned = auditContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        fixedBadges = JSON.parse(cleaned);
        if (!Array.isArray(fixedBadges)) fixedBadges = [];
      } catch {
        // If audit fails, continue with generation only
        console.error("Badge audit JSON parse failed, skipping audit step");
      }

      const auditedCount = fixedBadges.filter((b: any) => b._changes).length;

      // --- STEP 2: Generate new badges (if requested) ---
      let newBadges: any[] = [];
      if (count > 0) {
        const categoryFilter = category && category !== "all"
          ? `Generate ${count} NEW badges specifically for the "${category}" category.`
          : `Generate ${count} NEW badges spread across categories that fill gaps in the current system.`;

        // Use the fixed badges as context so new badges don't conflict
        const contextBadges = fixedBadges.length > 0 ? fixedBadges : badgeSummary;
        const existingIds = contextBadges.map((b: any) => b.id);
        const existingConditions = contextBadges.map((b: any) => `${b.condition?.type}:${b.condition?.value}`);

        const genPrompt = `${categoryFilter}

EXISTING BADGE IDS (do NOT reuse): ${existingIds.join(', ')}
EXISTING CONDITIONS (do NOT duplicate): ${existingConditions.join(', ')}

Requirements:
- Each new badge must have proper minLevel (not 0 for rare/epic/legendary)
- Each new badge must have minTrades and/or minCompletedCompetitions > 0
- All IDs must be unique snake_case strings not in the existing list
- Mix of rarities if generating for "all" categories

Return ONLY a JSON array of the NEW badge objects (not existing ones).`;

        const genCompletion = await openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: BADGE_SYSTEM_PROMPT },
            { role: "user", content: genPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        });

        const genContent = genCompletion.choices[0]?.message?.content || "[]";
        try {
          const cleaned = genContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          newBadges = JSON.parse(cleaned);
          if (!Array.isArray(newBadges)) newBadges = [];
        } catch {
          console.error("New badge generation JSON parse failed");
        }
      }

      return NextResponse.json({
        success: true,
        // Fixed existing badges (with _changes on modified ones)
        fixedBadges,
        fixedCount: auditedCount,
        totalExisting: fixedBadges.length,
        // New badges generated
        newBadges,
        newCount: newBadges.length,
        action: "generate",
      });
    }

    if (action === "rebalance") {
      // Analyze existing badges and suggest rebalanced conditions
      const badgeDetails = currentBadges.map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        rarity: b.rarity,
        minLevel: b.minLevel || 0,
        condition: b.condition,
      }));

      const userPrompt = `CURRENT BADGE SYSTEM (${currentBadges.length} badges):
${JSON.stringify(badgeDetails, null, 2)}

TASK: Analyze this badge system and return a REBALANCED version of ALL badges.

For each badge, you may adjust:
- condition.value (make harder/easier based on rarity)
- condition.minTrades (ensure anti-zero-baseline)
- condition.minCompletedCompetitions (ensure engagement proof)
- minLevel (ensure proper level gating)
- rarity (if current rarity doesn't match difficulty)

Do NOT change: id, name, description, category, icon, condition.type

Return the COMPLETE badge array with all badges (modified or unchanged).
Include a "_changes" field on badges you modified, describing what changed and why.`;

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: BADGE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 16000,
      });

      const content = completion.choices[0]?.message?.content || "[]";
      let badges;
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        badges = JSON.parse(cleaned);
      } catch {
        return NextResponse.json(
          { success: false, error: "AI returned invalid JSON", raw: content },
          { status: 500 },
        );
      }

      // Separate changed and unchanged
      const changed = badges.filter((b: any) => b._changes);
      const unchanged = badges.filter((b: any) => !b._changes);

      return NextResponse.json({
        success: true,
        badges,
        changed: changed.length,
        unchanged: unchanged.length,
        total: badges.length,
        action: "rebalance",
      });
    }

    if (action === "apply") {
      // Apply AI-generated/rebalanced badges to the database
      const { badges: badgesToApply } = body;
      if (!Array.isArray(badgesToApply) || badgesToApply.length === 0) {
        return NextResponse.json(
          { success: false, error: "No badges to apply" },
          { status: 400 },
        );
      }

      const results = { created: 0, updated: 0, errors: 0 };

      for (const badge of badgesToApply) {
        try {
          // Remove AI metadata fields
          const { _changes, ...badgeData } = badge;

          const existing = await BadgeConfig.findOne({ id: badgeData.id });
          if (existing) {
            await BadgeConfig.findOneAndUpdate(
              { id: badgeData.id },
              {
                name: badgeData.name,
                description: badgeData.description,
                category: badgeData.category,
                icon: badgeData.icon || existing.icon,
                rarity: badgeData.rarity,
                condition: badgeData.condition,
                minLevel: badgeData.minLevel ?? 0,
              },
            );
            results.updated++;
          } else {
            await BadgeConfig.create({
              ...badgeData,
              minLevel: badgeData.minLevel ?? 0,
              isActive: true,
            });
            results.created++;
          }
        } catch (err) {
          console.error(`Error applying badge ${badge.id}: ${err}`);
          results.errors++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Applied ${results.created + results.updated} badges (${results.created} new, ${results.updated} updated, ${results.errors} errors)`,
        results,
        action: "apply",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use: generate, rebalance, apply" },
      { status: 400 },
    );
  } catch (error) {
    console.error("AI Badge Generator error:", error);
    return NextResponse.json(
      { success: false, error: "AI Badge Generator failed" },
      { status: 500 },
    );
  }
}
