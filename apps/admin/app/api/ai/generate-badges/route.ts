/**
 * AI Badge Generator API (R96b — game-scoped conditions).
 *
 * Actions: generate | rebalance | apply
 * Condition lists and categories come from badge-condition-registry.
 * Apply refuses condition/gameTypes mismatches and invented gameKeys.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import BadgeConfig from "@/database/models/badge-config.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import {
  buildBadgeSystemPrompt,
  knownGameKeys,
  loadCatalogueGameRefs,
  sanitizeBadgeForWrite,
} from "@/lib/admin/ai-badge-prompt";

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

function parseBadgeArray(content: string): unknown[] {
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [];
}

export async function POST(request: NextRequest) {
  // Guarded 8 September 2026 with the other four under `app/api/ai/`.
  const guard = await guardSection("badges");
  if (!guard.ok) return guard.response;

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

    const currentBadges =
      existingBadges || (await BadgeConfig.find({ isActive: true }).lean());

    const catalogue = await loadCatalogueGameRefs();
    const knownKeys = knownGameKeys(catalogue);
    const systemPrompt = buildBadgeSystemPrompt(catalogue);

    const openai = new OpenAI({ apiKey: config.apiKey });

    if (action === "generate") {
      const badgeSummary = currentBadges.map((b: Record<string, unknown>) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        category: b.category,
        rarity: b.rarity,
        minLevel: b.minLevel || 0,
        gameTypes: b.gameTypes,
        condition: b.condition,
      }));

      const auditPrompt = `AUDIT AND FIX ALL EXISTING BADGES.

CURRENT BADGES (${currentBadges.length} total):
${JSON.stringify(badgeSummary, null, 2)}

YOUR TASK: Return the COMPLETE array of ALL existing badges with fixes applied.

FOR EACH BADGE, check and fix:
1. minLevel by rarity (common 0-1, rare 2-4, epic 5-10, legendary 8-15)
2. condition.minTrades — ONLY for trading-scoped conditions; others must be 0
3. condition.value — match rarity difficulty
4. gameTypes — must be platform ([]), ["trading"], or a catalogue gameKey
5. rarity — adjust if difficulty mismatches

RULES:
- DO NOT change: id, name, description, category, icon, condition.type
- You CAN change: minLevel, condition.value, condition.minTrades, condition.minCompletedCompetitions, condition.comparison, rarity, gameTypes (only to a valid catalogue key)
- Add "_changes" on modified badges

Return the COMPLETE JSON array with ALL ${currentBadges.length} badges.`;

      const auditCompletion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: auditPrompt },
        ],
        temperature: 0.2,
        max_tokens: 16000,
      });

      let fixedBadges: Record<string, unknown>[] = [];
      try {
        fixedBadges = parseBadgeArray(
          auditCompletion.choices[0]?.message?.content || "[]",
        ) as Record<string, unknown>[];
      } catch {
        console.error("Badge audit JSON parse failed, skipping audit step");
      }

      const auditedCount = fixedBadges.filter((b) => b._changes).length;

      let newBadges: Record<string, unknown>[] = [];
      if (count > 0) {
        const categoryFilter =
          category && category !== "all"
            ? `Generate ${count} NEW badges specifically for the "${category}" category.`
            : `Generate ${count} NEW badges across categories (include Games/provider scopes when catalogue keys exist).`;

        const contextBadges: Record<string, unknown>[] =
          fixedBadges.length > 0
            ? fixedBadges
            : (badgeSummary as Record<string, unknown>[]);
        const existingIds = contextBadges.map((b) => b.id);
        const existingConditions = contextBadges.map(
          (b) =>
            `${(b.condition as { type?: string })?.type}:${(b.condition as { value?: number })?.value}:${JSON.stringify(b.gameTypes ?? [])}`,
        );

        const genPrompt = `${categoryFilter}

EXISTING BADGE IDS (do NOT reuse): ${existingIds.join(", ")}
EXISTING CONDITIONS (do NOT duplicate type+value+gameTypes): ${existingConditions.join(", ")}

Requirements:
- Proper minLevel (not 0 for rare/epic/legendary)
- Trading-scoped conditions: minTrades > 0; platform/both/game: minTrades 0
- Unique snake_case IDs
- gameTypes must be catalogue keys or [] / ["trading"]

Return ONLY a JSON array of the NEW badge objects.`;

        const genCompletion = await openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: genPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        });

        try {
          newBadges = parseBadgeArray(
            genCompletion.choices[0]?.message?.content || "[]",
          ) as Record<string, unknown>[];
        } catch {
          console.error("New badge generation JSON parse failed");
        }
      }

      return NextResponse.json({
        success: true,
        fixedBadges,
        fixedCount: auditedCount,
        totalExisting: fixedBadges.length,
        newBadges,
        newCount: newBadges.length,
        catalogueGames: catalogue,
        action: "generate",
      });
    }

    if (action === "rebalance") {
      const badgeDetails = currentBadges.map((b: Record<string, unknown>) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        rarity: b.rarity,
        minLevel: b.minLevel || 0,
        gameTypes: b.gameTypes,
        condition: b.condition,
      }));

      const userPrompt = `CURRENT BADGE SYSTEM (${currentBadges.length} badges):
${JSON.stringify(badgeDetails, null, 2)}

TASK: Return a REBALANCED version of ALL badges.

You may adjust: condition.value, condition.minTrades (trading scope only),
condition.minCompletedCompetitions, minLevel, rarity, gameTypes (valid keys only).
Do NOT change: id, name, description, category, icon, condition.type

Include "_changes" on modified badges.
Return the COMPLETE badge array.`;

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 16000,
      });

      const content = completion.choices[0]?.message?.content || "[]";
      let badges: Record<string, unknown>[];
      try {
        badges = parseBadgeArray(content) as Record<string, unknown>[];
      } catch {
        return NextResponse.json(
          { success: false, error: "AI returned invalid JSON", raw: content },
          { status: 500 },
        );
      }

      const changed = badges.filter((b) => b._changes);
      return NextResponse.json({
        success: true,
        badges,
        changed: changed.length,
        unchanged: badges.length - changed.length,
        total: badges.length,
        action: "rebalance",
      });
    }

    if (action === "apply") {
      const { badges: badgesToApply, mode = "upsert" } = body;
      if (!Array.isArray(badgesToApply) || badgesToApply.length === 0) {
        return NextResponse.json(
          { success: false, error: "No badges to apply" },
          { status: 400 },
        );
      }

      // Reason: default upsert keeps historical generate-badges behaviour;
      // wizard callers pass mode "add-only" / "replace" explicitly.
      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        refused: 0,
        errors: 0,
        refusals: [] as string[],
      };

      for (const badge of badgesToApply) {
        try {
          const sanitized = sanitizeBadgeForWrite(
            badge as Record<string, unknown>,
            knownKeys,
          );
          if (!sanitized.ok || !sanitized.badge) {
            results.refused++;
            results.refusals.push(
              `${(badge as { id?: string }).id || "?"}: ${sanitized.reason}`,
            );
            continue;
          }

          const badgeData = sanitized.badge;
          const id = String(badgeData.id || "");
          if (!id) {
            results.skipped++;
            continue;
          }

          const existing = await BadgeConfig.findOne({ id });
          if (existing) {
            if (mode === "add-only") {
              results.skipped++;
              continue;
            }
            await BadgeConfig.findOneAndUpdate(
              { id },
              {
                name: badgeData.name,
                description: badgeData.description,
                category: badgeData.category,
                icon: badgeData.icon || existing.icon,
                rarity: badgeData.rarity,
                condition: badgeData.condition,
                minLevel: (badgeData.minLevel as number) ?? 0,
                ...(Array.isArray(badgeData.gameTypes)
                  ? { gameTypes: badgeData.gameTypes }
                  : {}),
              },
            );
            results.updated++;
          } else {
            await BadgeConfig.create({
              ...badgeData,
              minLevel: (badgeData.minLevel as number) ?? 0,
              isActive: true,
            });
            results.created++;
          }
        } catch (err) {
          console.error(`Error applying badge ${(badge as { id?: string }).id}: ${err}`);
          results.errors++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Applied ${results.created + results.updated} badges (${results.created} new, ${results.updated} updated, ${results.skipped} skipped, ${results.refused} refused, ${results.errors} errors)`,
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
