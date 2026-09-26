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
import { evaluateSystem, generateFixes, type BadgeData, type MilestoneData, type MapData } from "@/lib/gamification-engine";
import { isValidGameIconName } from "@/lib/constants/game-icons";
import { guardSection } from "@/lib/admin/section-route-guard";
import { normaliseMilestoneIdLists, toIdList } from "@/lib/admin/milestone-id-lists";
import { conditionScope } from "@/lib/services/games/badge-condition-registry";
import {
  buildBadgeSystemPrompt,
  knownGameKeys,
  loadCatalogueGameRefs,
  planBadgesByScope,
  sanitizeBadgeForWrite,
  type CatalogueGameRef,
} from "@/lib/admin/ai-badge-prompt";
import {
  analyseBadgeCoverage,
  analyseGamesOnlyParity,
  analyseMilestoneCoverage,
  DEFAULT_BADGE_XP,
  type BadgeXpByRarity,
  type CoverageBadge,
  type CoverageGameRef,
  type CoverageMilestone,
} from "@/lib/services/games/gamification-coverage";
import {
  auditLadder,
  proposeNeutralLadder,
} from "@/lib/admin/neutral-level-ladder";
import { gameConditionTypesForPrompt } from "@/lib/services/games/badge-condition-registry";
import {
  ALL_GAMIFICATION_RESET_SCOPES,
  resetGamification,
} from "@/lib/services/gamification-reset.service";
import {
  DEFAULT_TARGET_BADGE_TOTAL,
  earnableXpFromBadges,
  planBadgeQuota,
  proposeBadgeXp,
  auditEconomy,
} from "@/lib/services/games/gamification-economy";
import { buildBadgeBlueprint } from "@/lib/services/games/badge-blueprint";
import { buildJourneyBlueprint } from "@/lib/services/games/journey-blueprint";

// Allow up to 2 minutes for AI agents
export const maxDuration = 120;

// ─── DRAFT SHAPES ──────────────────────────────────────────────────────────────
// Reason: everything on this route arrives either from a language model or from
// a `.lean()` read, so nothing here is a validated document. The drafts below
// say exactly that: the fields this file reads are optional and everything else
// is `unknown`, which is what `sanitizeBadgeForWrite` and the validation in
// `writeBadgesBatch` narrow before anything is written.

interface BadgeConditionDraft {
  type?: string;
  value?: unknown;
  comparison?: string;
  minTrades?: number;
  minCompletedCompetitions?: number;
  [key: string]: unknown;
}

interface BadgeDraft {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  rarity?: string;
  icon?: string;
  minLevel?: number;
  gameTypes?: string[];
  condition?: BadgeConditionDraft;
  /** Written by the badge agent to mark a proposal as new or amended. */
  _isNew?: boolean;
  _changes?: string;
  [key: string]: unknown;
}

interface MilestoneDraft {
  id?: string;
  mapId?: string;
  name?: string;
  nodeType?: string;
  order?: number;
  completeCondition?: { type?: string; value?: unknown; [key: string]: unknown };
  requiredBadgeIds?: string[];
  rewards?: { xp?: number; badgeId?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** XP awarded per badge rarity, as stored under the `badge_xp` XP config. */
interface BadgeXPTable {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

interface MapDraft {
  mapId?: string;
  name?: string;
  theme?: string;
  difficulty?: string | number;
  sequenceOrder?: number;
  totalMilestones?: number;
  [key: string]: unknown;
}

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

/**
 * What is actually in the journey collections, counted after a write.
 *
 * Reason: every earlier report was derived from the blueprint's intent or from
 * one run's own created/updated counters, which cannot distinguish a rejected
 * write from an add-only pass over a design that is already complete. Both read
 * as zero, and only one of them is broken. Scoped to the maps this run planned,
 * so an unrelated legacy map cannot inflate the figure.
 */
async function journeyState(mapIds: Set<string>) {
  const ids = [...mapIds];
  if (ids.length === 0) return { maps: 0, milestones: 0, zones: 0 };

  const maps = await JourneyMapConfig.find({ mapId: { $in: ids } })
    .select("mapId zones")
    .lean<{ mapId: string; zones?: unknown[] }[]>();

  return {
    maps: maps.length,
    milestones: await JourneyMilestone.countDocuments({ mapId: { $in: ids } }),
    zones: maps.reduce((sum, m) => sum + (m.zones?.length ?? 0), 0),
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
  async writeBadgesBatch(
    badges: unknown[],
    options: {
      /** Default add-only: never overwrite existing ids. Pass "replace" to upsert. */
      mode?: "add-only" | "replace";
      knownKeys?: Set<string>;
    } = {},
  ) {
    // Reason: R96b — plan-then-apply must INSERT missing badges only. Overwriting
    // existing ids wiped operator edits and reintroduced trading floors on game badges.
    const mode = options.mode ?? "add-only";
    const knownKeys =
      options.knownKeys ??
      knownGameKeys(await loadCatalogueGameRefs());

    const results = {
      created: 0,
      updated: 0,
      errors: 0,
      skipped: 0,
      refused: 0,
      refusals: [] as string[],
    };
    const validRarities = ["common", "rare", "epic", "legendary"];
    const validCategories = [
      "Competition",
      "Trading",
      "Games",
      "Profit",
      "Risk",
      "Speed",
      "Consistency",
      "Strategy",
      "Social",
      "Legendary",
    ];

    for (const row of badges) {
      const badge = row as BadgeDraft;
      try {
        const sanitized = sanitizeBadgeForWrite(
          badge as Record<string, unknown>,
          knownKeys,
        );
        if (!sanitized.ok || !sanitized.badge) {
          results.refused++;
          results.refusals.push(
            `${badge?.id || "?"}: ${sanitized.reason || "refused"}`,
          );
          continue;
        }

        const clean = sanitized.badge as BadgeDraft;

        // Reason: `gameTypes` is `[String]` here too, and the same defect lands
        // one model along — a badge stored as `["trading,provider:x:y"]` scopes
        // to a game key nothing carries, so it is displayed and evaluated for
        // nobody. The update branch below silently DROPS a non-array, which
        // hides it further; read it as a list instead.
        if ("gameTypes" in clean && clean.gameTypes !== undefined) {
          clean.gameTypes = toIdList(clean.gameTypes);
        }

        // ── Validation ──
        if (!clean.id || typeof clean.id !== "string") {
          console.warn(`[Wizard] Skipping badge with missing/invalid id`);
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
        // ── Validate / fix icon ──
        if (clean.icon && !isValidGameIconName(clean.icon)) {
          const CATEGORY_ICON_FALLBACK: Record<string, string> = {
            Competition: "trophy",
            Trading: "trade",
            Games: "joystick1",
            Profit: "profit",
            Risk: "shield1",
            Speed: "lightningSpell",
            Consistency: "target",
            Strategy: "portfolio",
            Social: "heart",
            Legendary: "crown",
          };
          const fallback = CATEGORY_ICON_FALLBACK[clean.category || ""] || "starBadge";
          console.log(`[Wizard] Badge ${clean.id}: invalid icon "${clean.icon}" → fallback "${fallback}"`);
          clean.icon = fallback;
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

        // For NEW badges: if condition.type is missing, infer from category
        if (!existing && !clean.condition?.type) {
          const CATEGORY_DEFAULT_TYPE: Record<string, string> = {
            Competition: "competitions_entered",
            Trading: "total_trades",
            Games: "game_contests_completed",
            Profit: "total_pnl",
            Risk: "no_liquidations",
            Speed: "quick_scalps",
            Consistency: "consecutive_trading_days",
            Strategy: "unique_pairs_traded",
            Social: "referrals_made",
            Legendary: "level_reached",
          };
          const inferredType = CATEGORY_DEFAULT_TYPE[clean.category || ""] || "total_trades";
          if (!clean.condition) clean.condition = {};
          clean.condition.type = inferredType;
          console.log(`[Wizard] Inferred condition.type='${inferredType}' for NEW badge ${clean.id} (category=${clean.category})`);
        }

        if (existing) {
          if (mode === "add-only") {
            results.skipped++;
            continue;
          }
          // ── Surgical update (replace mode only) ──
          const updateDoc: Record<string, unknown> = {
            minLevel,
          };
          if (clean.name) updateDoc.name = clean.name;
          if (clean.description) updateDoc.description = clean.description;
          if (clean.category) updateDoc.category = clean.category;
          if (clean.icon) updateDoc.icon = clean.icon;
          if (clean.rarity) updateDoc.rarity = clean.rarity;
          if (Array.isArray(clean.gameTypes)) updateDoc.gameTypes = clean.gameTypes;
          if (clean.condition) {
            // Reason: a hydrated subdocument has to be flattened before it can
            // be spread, or the stored condition's own keys are lost.
            const stored = existing.condition as
              | { toObject?: () => Record<string, unknown> }
              | undefined;
            updateDoc.condition = {
              ...(stored?.toObject?.() ?? stored ?? {}),
              ...clean.condition,
            };
          }

          await BadgeConfig.findOneAndUpdate(
            { id: clean.id },
            { $set: updateDoc },
          );

          results.updated++;
        } else {
          // New badge — require all critical fields
          if (!clean.name || !clean.description || !clean.category || !clean.rarity) {
            console.warn(`[Wizard] Skipping new badge ${clean.id}: missing name/description/category/rarity`);
            results.skipped++;
            continue;
          }
          const CATEGORY_ICON_DEFAULT: Record<string, string> = {
            Competition: "trophy",
            Trading: "trade",
            Games: "joystick1",
            Profit: "profit",
            Risk: "shield1",
            Speed: "lightningSpell",
            Consistency: "target",
            Strategy: "portfolio",
            Social: "heart",
            Legendary: "crown",
          };
          const defaultIcon = CATEGORY_ICON_DEFAULT[clean.category || ""] || "starBadge";
          await BadgeConfig.create({
            ...clean,
            minLevel,
            isActive: true,
            icon: clean.icon || defaultIcon,
          });
          results.created++;
        }
      } catch (err) {
        console.error(`[Wizard] Badge write error for ${badge.id}: ${err}`);
        results.errors++;
      }
    }
    return results;
  },
  // Reason: the milestone agent iterates the maps that already exist, so after a
  // "start from scratch" there were none and it silently produced nothing — an
  // operator saw a wizard report success and a journey screen with no maps at
  // all. Add-only: a map an operator has renamed or re-themed is never rewritten.
  async writeMapsBatch(maps: unknown[]) {
    // Reason: `firstError` exists because the counter alone made a rejected
    // write indistinguishable from a skip — an operator read "milestones
    // written" beside an empty journey screen with the cause only in the server
    // log. The message is the whole diagnosis, so it travels to the UI.
    const results = {
      created: 0,
      skipped: 0,
      errors: 0,
      firstError: null as string | null,
    };
    const note = (message: string) => {
      results.errors++;
      if (!results.firstError) results.firstError = message;
    };
    for (const row of maps) {
      const map = row as { mapId?: string };
      try {
        if (!map.mapId || typeof map.mapId !== "string") {
          note("a generated map had no mapId");
          continue;
        }
        const existing = await JourneyMapConfig.findOne({ mapId: map.mapId });
        if (existing) {
          results.skipped++;
          continue;
        }
        await JourneyMapConfig.create(map);
        results.created++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Wizard] Map write error for ${map?.mapId}: ${err}`);
        note(`${map?.mapId ?? "map"}: ${message}`);
      }
    }
    return results;
  },
  async writeMilestonesBatch(
    milestones: unknown[],
    options: { mode?: "add-only" | "replace" } = {},
  ) {
    const mode = options.mode ?? "replace";
    // Reason: same as writeMapsBatch — a validation rejection and a deliberate
    // skip both incremented a counter nobody surfaced, so the operator saw
    // success beside an empty editor.
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      firstError: null as string | null,
    };
    for (const row of milestones) {
      const ms = row as MilestoneDraft;
      try {
        const {
          _changes: _c,
          _isNew: _n,
          _id: _i,
          __v: _v,
          createdAt: _created,
          updatedAt: _updated,
          ...rest
        } = ms;
        // Reason: this is the only writer of `JourneyMilestone` in the route
        // (five call sites, including `apply_changes`, which takes its list
        // straight from a request body), so the four `[String]` paths are read
        // as lists here rather than at each caller. Mongoose wraps a bare
        // string into a one-element array and validates it, which turns a
        // comma-joined gate into a badge nobody holds and locks the milestone
        // for ever — see `milestone-id-lists.ts`.
        const clean = normaliseMilestoneIdLists(rest);
        const existing = await JourneyMilestone.findOne({ id: clean.id, mapId: clean.mapId });
        if (existing) {
          if (mode === "add-only") {
            results.skipped++;
            continue;
          }
          await JourneyMilestone.findOneAndUpdate({ id: clean.id, mapId: clean.mapId }, clean);
          results.updated++;
        } else {
          await JourneyMilestone.create(clean);
          results.created++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Wizard] Milestone write error for ${ms.id}: ${err}`);
        results.errors++;
        if (!results.firstError) {
          results.firstError = `${ms.id ?? "milestone"}: ${message}`;
        }
      }
    }
    return results;
  },
  // Reason (R102): the discriminator is `configType`, not `type`, and a level
  // ladder is stored as `data.levels` — that is what `XPConfig`,
  // `xp-config.service.ts` and `/api/badges-xp/manage` all read. Written the
  // other way the wizard's ladder and XP values are invisible to the rest of
  // the platform, the ladder audit always reports "no ladder", and every write
  // reports success.
  async readXPConfig() {
    try {
      const db = (await connectToDatabase()).connection.db;
      if (!db) return null;
      const badgeXP = await db
        .collection("xpconfigs")
        .findOne({ configType: "badge_xp" });
      const levels = await db
        .collection("xpconfigs")
        .findOne({ configType: "level_progression" });
      return { badgeXP: badgeXP?.data, levels: levels?.data?.levels };
    } catch { return null; }
  },
  async writeXPConfig(configType: string, data: unknown) {
    try {
      const db = (await connectToDatabase()).connection.db;
      if (!db) return null;
      // Reason: callers hand over a bare levels array; the stored shape nests it
      // under `data.levels`, so wrapping happens here rather than at three call
      // sites that could each forget.
      const payload =
        configType === "level_progression" && Array.isArray(data)
          ? { levels: data }
          : data;
      return db.collection("xpconfigs").findOneAndUpdate(
        { configType },
        {
          $set: { configType, data: payload, updatedAt: new Date() },
          $setOnInsert: { isActive: true, createdAt: new Date() },
        },
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

function badgesToCompact(badges: unknown[]): string {
  // One line per badge: id|name|category|rarity|minLevel|icon|condType|condValue|condComp|minTrades|minComps
  const header = "id|name|cat|rarity|minLvl|icon|condType|condVal|comp|minTrades|minComps";
  const lines = (badges as BadgeDraft[]).map((b) => {
    const c = b.condition || {};
    return `${b.id}|${b.name}|${b.category}|${b.rarity}|${b.minLevel || 0}|${b.icon || ""}|${c.type || "manual"}|${c.value ?? ""}|${c.comparison || "gte"}|${c.minTrades || 0}|${c.minCompletedCompetitions || 0}`;
  });
  return [header, ...lines].join("\n");
}

function milestonesToCompact(milestones: unknown[]): string {
  // One line per milestone: id|mapId|name|nodeType|order|condType|condValue|xpReward|badgeGates
  const header = "id|mapId|name|nodeType|order|condType|condVal|xpReward|requiredBadgeIds";
  const lines = (milestones as MilestoneDraft[]).map((m) => {
    const c = m.completeCondition || {};
    const gates = (m.requiredBadgeIds || []).join(",");
    return `${m.id}|${m.mapId}|${m.name}|${m.nodeType || "milestone"}|${m.order || 0}|${c.type || ""}|${c.value ?? ""}|${m.rewards?.xp || 0}|${gates}`;
  });
  return [header, ...lines].join("\n");
}

// ─── SYSTEM PROMPTS (compact) ──────────────────────────────────────────────────

// BADGE_AGENT_PROMPT is built per-request via buildBadgeSystemPrompt(catalogue)
// so condition/category lists stay registry-driven (R96b).

const MILESTONE_AGENT_PROMPT = `You are a MILESTONE AGENT for a skill-based competition platform (trading + games).
10 journey maps with progressive difficulty.
Maps 1-2: beginner. Maps 3-4: early. Maps 5-6: mid. Maps 7-8: advanced. Maps 9-10: expert.

RULES:
1. Values must increase within each map and across maps.
2. Use requiredBadgeIds at strategic checkpoints (every 3-5 milestones).
3. XP rewards match difficulty: easy=10-15, medium=20-30, hard=40-60.
4. Return ONLY milestones that need changes, not unchanged ones.
5. Prefer additive changes — do not delete and recreate milestones wholesale.

Return ONLY valid JSON. No markdown.`;

// EVALUATOR_PROMPT removed — evaluation is now handled by the local engine
// (gamification-engine.ts) — instant, deterministic, no AI, no timeouts.

// ─── JSON PARSER (with repair) ──────────────────────────────────────────────────
/**
 * Narrow a parsed model reply to a plain object.
 *
 * Reason: `parseAIJSON` can return an array, a primitive or `null`, and every
 * caller then reads named fields off it. Doing the check once here is what lets
 * the callers stay free of `any`.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseAIJSON(content: string): unknown {
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

// ─── COVERAGE / GAP ANALYSIS (no AI) ───────────────────────────────────────────

/** Catalogue refs plus trading, which is a game for coverage purposes. */
function coverageGames(catalogue: CatalogueGameRef[]): CoverageGameRef[] {
  return [
    { gameKey: "trading", displayName: "Trading", category: "trading" },
    ...catalogue.map((c) => ({
      gameKey: c.gameKey,
      displayName: c.displayName,
      category: c.category,
    })),
  ];
}

async function resolveBadgeXp(): Promise<BadgeXpByRarity> {
  const xp = await dbTools.readXPConfig();
  const configured = xp?.badgeXP;
  if (!configured || typeof configured !== "object") return DEFAULT_BADGE_XP;
  return {
    common: Number(configured.common) || DEFAULT_BADGE_XP.common,
    rare: Number(configured.rare) || DEFAULT_BADGE_XP.rare,
    epic: Number(configured.epic) || DEFAULT_BADGE_XP.epic,
    legendary: Number(configured.legendary) || DEFAULT_BADGE_XP.legendary,
  };
}

async function computeCoverage() {
  const [badges, milestones, catalogue, badgeXp, xpConfig] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMilestones(),
    loadCatalogueGameRefs(),
    resolveBadgeXp(),
        dbTools.readXPConfig(),
      ]);

  const games = coverageGames(catalogue);
  const coverageBadges = badges as CoverageBadge[];
  const badgeCoverage = analyseBadgeCoverage(coverageBadges, games);
  const milestoneCoverage = analyseMilestoneCoverage(
    milestones as CoverageMilestone[],
    games,
  );
  const parity = analyseGamesOnlyParity(coverageBadges, games, badgeXp);

  const storedLevels = Array.isArray(xpConfig?.levels) ? xpConfig.levels : [];
  const ladder = {
    configured: storedLevels.length > 0,
    ...auditLadder(storedLevels),
  };

  return {
    catalogueGames: games,
    badgeCoverage,
    milestoneCoverage,
    parity,
    ladder,
    badgeXp,
    xpConfigured: !!xpConfig?.badgeXP,
  };
}

type CoverageReport = Awaited<ReturnType<typeof computeCoverage>>;

/**
 * Turn the badge gap into an instruction naming games and rarities.
 *
 * Reason: "generate 10 badges" is what produced ten more trading badges. Naming
 * the deficit per gameKey is what makes a later run add only the new game.
 */
function buildGapBrief(coverage: CoverageReport): {
  brief: string;
  totalMissing: number;
} {
  const lines: string[] = [];
  for (const row of coverage.badgeCoverage.games) {
    if (row.missingTotal === 0) continue;
    const parts = Object.entries(row.missing)
      .filter(([, n]) => n > 0)
      .map(([rarity, n]) => `${n} ${rarity}`);
    const scope =
      row.gameKey === "trading" ? `["trading"]` : `["${row.gameKey}"]`;
    lines.push(
      `- ${row.displayName} (gameTypes ${scope}): needs ${parts.join(", ")}`,
    );
  }
  const platformMissing = coverage.badgeCoverage.platform.missing;
  const platformParts = Object.entries(platformMissing)
    .filter(([, n]) => n > 0)
    .map(([rarity, n]) => `${n} ${rarity}`);
  if (platformParts.length > 0) {
    lines.push(
      `- Platform-wide (gameTypes []): needs ${platformParts.join(", ")}`,
    );
  }

  if (lines.length === 0) {
    return { brief: "", totalMissing: 0 };
  }

  return {
    brief: `COVERAGE GAPS — generate exactly these and nothing else:
${lines.join("\n")}

Parity: ${coverage.parity.verdict} (trader XP ${coverage.parity.traderXp}, games-only ${coverage.parity.gamesOnlyXp}).
Do NOT propose badges for scopes not listed above — they are already covered.`,
    totalMissing: coverage.badgeCoverage.missingTotal,
  };
}

/**
 * Runs the badge audit / gap-fill agent.
 *
 * Reason (R96b): extracted from the `agent_badges` action so the `run_full`
 * orchestrator can drive the same code path. A second copy would let the two
 * entry points disagree about the add-only rule and the measured gap, which is
 * the "one rule, two copies" shape this programme keeps finding.
 */
async function runBadgeAgent(
  openai: OpenAI,
  config: AIConfig,
  opts: { autoApply: boolean; mode: string; cap: number },
) {
  {
      const { autoApply, mode } = opts;
      // Reason (R96b): the count comes from the measured gap, never from the
      // caller. `generateCount` is honoured only as a CAP, so an operator can
      // take a large first run in smaller bites without being able to ask for
      // badges the catalogue already has.
      const requestedCap = opts.cap;

      // ── Pre-pass: fix all badges with invalid icons (emojis, missing, etc.) ──
      const CATEGORY_ICON_MAP: Record<string, string> = {
        Competition: "trophy", Trading: "trade", Games: "joystick1", Profit: "profit",
        Risk: "shield1", Speed: "lightningSpell", Consistency: "target",
        Strategy: "portfolio", Social: "heart", Legendary: "crown",
      };
      const allBadgesRaw = await BadgeConfig.find({ isActive: true }).lean();
      let iconFixCount = 0;
      for (const b of allBadgesRaw as (BadgeDraft & { _id: unknown })[]) {
        const icon = typeof b.icon === "string" ? b.icon : "";
        if (!icon || !isValidGameIconName(icon)) {
          const fallback = CATEGORY_ICON_MAP[b.category || ""] || "starBadge";
          await BadgeConfig.updateOne({ _id: b._id }, { $set: { icon: fallback } });
          iconFixCount++;
        }
      }
      if (iconFixCount > 0) {
        console.log(`[Wizard] Pre-pass: fixed ${iconFixCount} badges with invalid/emoji icons`);
      }

      const badges = await dbTools.readAllBadges();
      const catalogue: CatalogueGameRef[] = await loadCatalogueGameRefs();
      const knownKeys = knownGameKeys(catalogue);
      const badgeAgentPrompt = `${buildBadgeSystemPrompt(catalogue)}

ICON RULE: icon MUST be a valid GameIconName string (e.g. "trophy", "shield1", "joystick1"). NEVER use emoji characters.
Prefer ADDITIVE fixes — return only badges that need changes or are new. Do not delete-and-recreate the badge set.`;

      // Compact format: ~70% smaller than pretty JSON
      const compactBadges = badgesToCompact(badges);

      // Find which badges milestones reference (protect these)
      const milestones = await dbTools.readAllMilestones();
      const referencedIds = new Set<string>();
      for (const m of milestones as MilestoneDraft[]) {
        if (m.requiredBadgeIds) for (const bid of m.requiredBadgeIds) referencedIds.add(bid);
        if (m.rewards?.badgeId) referencedIds.add(m.rewards.badgeId);
      }

      const coverage = await computeCoverage();
      const gap = buildGapBrief(coverage);
      const generateCount = Math.min(gap.totalMissing, requestedCap);

      const prompt = `AUDIT ${badges.length} badges. Return ONLY badges that need fixes (not unchanged ones).${
        generateCount > 0
          ? ` Also generate up to ${generateCount} NEW badges, chosen strictly from the coverage gaps below.

${gap.brief}`
          : " The catalogue is fully covered — generate NO new badges."
      }

BADGES (pipe-separated):
${compactBadges}

Protected IDs (used by milestones): [${[...referencedIds].join(",")}]

For EACH badge with issues, return the FULL fixed badge object.
For NEW badges, include "_isNew": true and a valid gameTypes array.
For FIXED badges, include "_changes": "what changed".
Do NOT include unchanged badges.
Do NOT delete existing badges — additive changes only.

Return JSON:
{"badges":[<only changed + new badges>],"summary":"brief","fixedCount":N,"newCount":N}`;

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: badgeAgentPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 6000,
      });

      const parsed = asRecord(
        parseAIJSON(completion.choices[0]?.message?.content || "{}"),
      );
      const proposed = Array.isArray(parsed?.badges)
        ? (parsed.badges as BadgeDraft[])
        : null;
      if (!proposed) {
        return {
          ok: false as const,
          error: "Badge agent returned invalid response",
          raw: completion.choices[0]?.message?.content?.substring(0, 500),
        };
      }

      let writeResults = null;
      if (autoApply && proposed.length > 0) {
        writeResults = await dbTools.writeBadgesBatch(proposed, {
          mode: mode === "replace" ? "replace" : "add-only",
          knownKeys,
        });
      }

      const existingIds = new Set(
        (badges as BadgeDraft[]).map((b) => b.id).filter(Boolean) as string[],
      );
      const plan = planBadgesByScope(proposed, existingIds);

      return {
        ok: true as const,
        action: "agent_badges",
        badges: proposed,
        summary: parsed?.summary || "",
        fixedCount:
          parsed?.fixedCount || proposed.filter((b) => b._changes).length,
        newCount: parsed?.newCount || proposed.filter((b) => b._isNew).length,
        totalBadges: badges.length,
        applied: autoApply,
        writeResults,
        plan,
        catalogueGames: catalogue,
        coverage: {
          badgeCoverage: coverage.badgeCoverage,
          parity: coverage.parity,
          generateCount,
        },
      };
  }
}

/**
 * Runs the milestone audit agent for one journey map.
 *
 * Reason (R96b): extracted so `run_full` drives the same code path as the
 * standalone action, rather than a second copy of the add-only rule.
 */
async function runMilestoneAgent(
  openai: OpenAI,
  config: AIConfig,
  opts: { mapId?: string; autoApply: boolean },
) {
  {
      const { mapId, autoApply } = opts;

      const [badges, maps] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMaps(),
      ]);

      // If no mapId, process the FIRST map that has milestones (not all at once)
      let targetMapId = mapId;
      const mapRows = maps as MapDraft[];
      if (!targetMapId && mapRows.length > 0) {
        targetMapId = mapRows[0]?.mapId;
      }

      const milestones = targetMapId
        ? await dbTools.readMilestonesByMap(targetMapId)
        : await dbTools.readAllMilestones();

      if (milestones.length === 0) {
        return {
          ok: true as const,
          action: "agent_milestones",
          milestones: [],
          summary: "No milestones found for this map",
          fixedCount: 0,
          badgeGatesAdded: 0,
          totalMilestones: 0,
          applied: false,
          writeResults: null,
        };
      }

      // Compact badge list for context (IDs, names, and condition types for smarter gating)
      const badgeContext = (badges as BadgeDraft[]).map((b) =>
        `${b.id}("${b.name}",${b.rarity},Lv${b.minLevel || 0},${b.condition?.type || "manual"})`
      ).join(", ");

      const compactMilestones = milestonesToCompact(milestones);
      const mapInfo = mapRows.find((m) => m.mapId === targetMapId);

      // Reason (R96b): the milestone prompt named trading metrics only, so every
      // milestone it proposed asked a puzzle player for trades. The catalogue and
      // the game-legal condition list come from the same registry the badge agent
      // reads, so a new condition type reaches both at once.
      const msCatalogue = await loadCatalogueGameRefs();
      const msCoverage = await computeCoverage();
      const catalogueBlock =
        msCatalogue.length > 0
          ? msCatalogue
              .map((g) => `- ${g.gameKey} — ${g.displayName}`)
              .join("\n")
          : "(no provider titles enabled — trading only)";
      const milestoneGaps = msCoverage.milestoneCoverage.games
        .filter((g) => g.missing > 0)
        .map((g) => `- ${g.displayName} (${g.gameKey}): needs ${g.missing} more`)
        .join("\n");

      const prompt = `AUDIT milestones for map "${targetMapId}" (${mapInfo?.name || "unknown"}, difficulty ${mapInfo?.difficulty || "?"}).
Return ONLY milestones that need fixes (not unchanged ones).

CATALOGUE GAMES (a milestone must never ask a game player for trades):
${catalogueBlock}

GAME-LEGAL CONDITION TYPES:
${gameConditionTypesForPrompt()}
${milestoneGaps ? `\nGAME MILESTONE GAPS:\n${milestoneGaps}` : ""}

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

      const parsed = asRecord(parseAIJSON(completion.choices[0]?.message?.content || "{}"));
      // Reason: `Array.isArray` on the outer list was the only shape check, and
      // the cast then asserted `string[]` on fields the model returns as
      // comma-joined strings because that is the format the pipe table gave it.
      // Normalising here, rather than only in the writer, is what makes the
      // proposal an operator reviews the same object that later gets stored.
      const proposed = Array.isArray(parsed?.milestones)
        ? (parsed.milestones as MilestoneDraft[]).map((m) =>
            normaliseMilestoneIdLists(m as Record<string, unknown>) as MilestoneDraft,
          )
        : null;
      if (!proposed) {
        return {
          ok: false as const,
          error: "Milestone agent returned invalid response",
          raw: completion.choices[0]?.message?.content?.substring(0, 500),
        };
      }

      let writeResults = null;
      if (autoApply && proposed.length > 0) {
        writeResults = await dbTools.writeMilestonesBatch(proposed);
      }

      return {
        ok: true as const,
        action: "agent_milestones",
        milestones: proposed,
        summary: parsed?.summary || "",
        fixedCount: parsed?.fixedCount || proposed.length,
        badgeGatesAdded: parsed?.badgeGatesAdded || 0,
        totalMilestones: milestones.length,
        mapId: targetMapId,
        applied: autoApply,
        writeResults,
      };
  }
}

/**
 * Scores the gamification system against the live catalogue (no AI, no writes).
 */
async function runEvaluation() {
  {
      const [badges, milestones, maps, catalogue, badgeXp] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMilestones(),
        dbTools.readAllMaps(),
        loadCatalogueGameRefs(),
        resolveBadgeXp(),
      ]);

      // Reason (R96b): without the catalogue the engine scores the badge set
      // against itself, so a catalogue where every rare is trading-scoped reads
      // as perfectly balanced while a games-only player is stuck at level 1.
      const games = coverageGames(catalogue);

      const evaluation = evaluateSystem(
        badges as unknown as BadgeData[],
        milestones as unknown as MilestoneData[],
        maps as unknown as MapData[],
        games,
        badgeXp,
      );

      return {
        action: "agent_evaluate",
        evaluation,
        catalogueGames: games,
        applied: false,
        fixResults: null,
      };
  }
}

/**
 * Applies the deterministic engine fixes (no AI).
 */
async function applyAutoFixes() {
  {
      const [badges, milestones] = await Promise.all([
        dbTools.readAllBadges(),
        dbTools.readAllMilestones(),
      ]);

      const fixes = generateFixes(
        badges as unknown as BadgeData[],
        milestones as unknown as MilestoneData[],
      );

      // Apply badge fixes
      let badgeWriteResults = null;

      if (fixes.badgeFixes.length > 0) {
        // Group fixes by badge ID.
        // Reason: the keys are badge ids and field names taken from the engine's
        // own output, so they are indexed in a Map rather than an object — an
        // object lookup walks the prototype chain and `"constructor"` returns
        // something truthy that survives a `!target` test.
        const fixesByBadge = new Map<string, Map<string, unknown>>();
        for (const fix of fixes.badgeFixes) {
          let target = fixesByBadge.get(fix.id);
          if (!target) {
            target = new Map<string, unknown>();
            fixesByBadge.set(fix.id, target);
          }
          // Handle nested fields like "condition.minTrades"
          const parts = fix.field.split(".");
          if (parts.length === 2) {
            const head = parts[0] as string;
            const tail = parts[1] as string;
            let nested = target.get(head);
            if (!(nested instanceof Map)) {
              nested = new Map<string, unknown>();
              target.set(head, nested);
            }
            (nested as Map<string, unknown>).set(tail, fix.newValue);
          } else {
            target.set(fix.field, fix.newValue);
          }
        }

        // Apply with $set for surgical updates
        let applied = 0;
        let errors = 0;
        let notFound = 0;
        for (const [badgeId, updates] of fixesByBadge) {
          try {
            // For condition sub-fields, merge with existing
            const setDoc = new Map<string, unknown>();
            for (const [key, val] of updates) {
              if (key === "condition" && val instanceof Map) {
                for (const [subKey, subVal] of val) {
                  setDoc.set(`condition.${subKey}`, subVal);
                }
              } else {
                setDoc.set(key, val);
              }
            }
            const result = await BadgeConfig.findOneAndUpdate(
              { id: badgeId },
              { $set: Object.fromEntries(setDoc) },
              { new: true },
            );
            if (result) {
              applied++;
            } else {
              notFound++;
            }
          } catch (err) {
            console.error(`[Wizard] auto_fix badge error for ${badgeId}: ${err}`);
            errors++;
          }
        }
        badgeWriteResults = { applied, errors, notFound, total: fixesByBadge.size };
      }

      // Apply milestone fixes
      let milestoneWriteResults = null;
      if (fixes.milestoneFixes.length > 0) {
        let applied = 0;
        let errors = 0;
        let notFound = 0;
        for (const fix of fixes.milestoneFixes) {
          try {
            const result = await JourneyMilestone.findOneAndUpdate(
              { id: fix.id, mapId: fix.mapId },
              { $set: { [fix.field]: fix.newValue } },
              { new: true },
            );
            if (result) {
              applied++;
            } else {
              notFound++;
            }
          } catch (err) {
            console.error(`[Wizard] auto_fix milestone error for ${fix.id}: ${err}`);
            errors++;
          }
        }
        milestoneWriteResults = { applied, errors, notFound, total: fixes.milestoneFixes.length };
      }

      return {
        action: "auto_fix",
        fixes,
        badgeWriteResults,
        milestoneWriteResults,
      };
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Guarded 8 September 2026 with the other four under `app/api/ai/`. See the note in
  // `generate-competition/route.ts`. Like `evaluate-balance` this one writes - it creates and
  // rebalances badges and milestones - so the folder name is the least reliable guide to what
  // it does. `gamification-wizard` became a section id in the same commit.
  const guard = await guardSection("gamification-wizard");
  if (!guard.ok) return guard.response;

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

      // Reason: category and rarity names arrive from stored documents, so the
      // tallies are held in a Map rather than an object. An object lookup walks
      // the prototype chain, where `"constructor"` returns something truthy that
      // survives the `!counts` test below.
      const emptyRarityCounts = () =>
        new Map<string, number>([
          ["common", 0],
          ["rare", 0],
          ["epic", 0],
          ["legendary", 0],
        ]);
      const badgesByCategory = new Map<string, Map<string, number>>();
      const badgesByRarity = emptyRarityCounts();
      const badgesWithMinLevel = { withGate: 0, withoutGate: 0 };
      const badgesZeroBaseline: string[] = [];

      for (const b of badges as BadgeDraft[]) {
        const cat = b.category || "Unknown";
        const rar = b.rarity || "common";
        let catCounts = badgesByCategory.get(cat);
        if (!catCounts) {
          catCounts = emptyRarityCounts();
          badgesByCategory.set(cat, catCounts);
        }
        catCounts.set(rar, (catCounts.get(rar) ?? 0) + 1);
        badgesByRarity.set(rar, (badgesByRarity.get(rar) ?? 0) + 1);
        if ((b.minLevel || 0) > 0) badgesWithMinLevel.withGate++;
        else badgesWithMinLevel.withoutGate++;
        const mt = b.condition?.minTrades || 0;
        const mc = b.condition?.minCompletedCompetitions || 0;
        // Reason: only trading-scoped conditions need a trade floor for this risk list.
        const tradingScoped =
          conditionScope(b.condition?.type || "") === "trading" &&
          (b.category || "") !== "Games";
        if (tradingScoped && mt === 0 && rar !== "common") {
          badgesZeroBaseline.push(b.id ?? "unknown");
        } else if (
          (b.category || "") === "Competition" &&
          mc === 0 &&
          rar !== "common"
        ) {
          badgesZeroBaseline.push(b.id ?? "unknown");
        }
      }

      const milestonesByMap = new Map<string, number>();
      let milestonesWithBadgeGate = 0;
      for (const m of milestones as MilestoneDraft[]) {
        const mapId = m.mapId || "unknown";
        milestonesByMap.set(mapId, (milestonesByMap.get(mapId) ?? 0) + 1);
        if ((m.requiredBadgeIds?.length ?? 0) > 0) milestonesWithBadgeGate++;
      }

      return NextResponse.json({
        success: true,
        status: {
          badges: {
            total: badges.length,
            byCategory: Object.fromEntries(
              [...badgesByCategory].map(([cat, counts]) => [cat, Object.fromEntries(counts)]),
            ),
            byRarity: Object.fromEntries(badgesByRarity),
            levelGating: badgesWithMinLevel,
            zeroBaselineRisks: badgesZeroBaseline,
          },
          milestones: { total: milestones.length, byMap: Object.fromEntries(milestonesByMap), withBadgeGate: milestonesWithBadgeGate },
          maps: { total: maps.length, list: (maps as MapDraft[]).map((m) => ({ mapId: m.mapId, name: m.name, theme: m.theme, difficulty: m.difficulty, sequenceOrder: m.sequenceOrder, totalMilestones: m.totalMilestones })) },
          xp: { configured: !!xpConfig?.badgeXP, badgeXP: xpConfig?.badgeXP || { common: 10, rare: 25, epic: 50, legendary: 100 } },
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // setup_levels — Apply level/XP preset (no AI, fast)
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "setup_levels") {
      const { preset, badgeXP, levels } = body;
      // Reason: `preset` is caller-supplied, so it is resolved through a Map. An
      // object lookup walks the prototype chain and `presets["constructor"]`
      // returns something truthy that would survive the `presets[preset]` test.
      const presets = new Map<string, { badgeXP: BadgeXPTable; description: string }>([
        ["conservative", { badgeXP: { common: 5, rare: 15, epic: 35, legendary: 75 }, description: "Slower progression." }],
        ["balanced", { badgeXP: { common: 10, rare: 25, epic: 50, legendary: 100 }, description: "Default balanced." }],
        ["aggressive", { badgeXP: { common: 15, rare: 35, epic: 75, legendary: 150 }, description: "Faster progression." }],
      ]);
      const chosen = typeof preset === "string" ? presets.get(preset) : undefined;
      if (chosen) {
        await dbTools.writeXPConfig("badge_xp", chosen.badgeXP);
        return NextResponse.json({ success: true, message: `Applied "${preset}": ${chosen.description}`, badgeXP: chosen.badgeXP });
      }
      if (badgeXP) await dbTools.writeXPConfig("badge_xp", badgeXP);
      if (levels) await dbTools.writeXPConfig("level_progression", levels);
      return NextResponse.json({ success: true, message: "XP configuration updated" });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // coverage — Deterministic gap report per game (no AI, no writes)
    //
    // Reason (R96b): generation used to take a caller-supplied count and let the
    // model choose what to write, so a second run re-proposed badges the catalogue
    // already had and a newly added game got nothing. The gap is computed here.
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "coverage") {
      const coverage = await computeCoverage();
      return NextResponse.json({
        success: true,
        action: "coverage",
        ...coverage,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // plan_badges — Report what would be added per gameTypes scope (no writes)
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "plan_badges") {
      const { badges: proposed } = body;
      if (!Array.isArray(proposed)) {
        return NextResponse.json(
          { success: false, error: "badges array required" },
          { status: 400 },
        );
      }
      const existing = await dbTools.readAllBadges();
      const existingIds = new Set(
        (existing as BadgeDraft[]).map((b) => b.id).filter((id): id is string => !!id),
      );
      const catalogue = await loadCatalogueGameRefs();
      const knownKeys = knownGameKeys(catalogue);

      const refusals: string[] = [];
      const accepted: typeof proposed = [];
      for (const b of proposed) {
        const sanitized = sanitizeBadgeForWrite(
          b as Record<string, unknown>,
          knownKeys,
        );
        if (!sanitized.ok) {
          refusals.push(`${b?.id || "?"}: ${sanitized.reason}`);
          continue;
        }
        accepted.push(sanitized.badge);
      }

      const plan = planBadgesByScope(accepted, existingIds);
      return NextResponse.json({
        success: true,
        action: "plan_badges",
        plan,
        refusals,
        catalogueGames: catalogue,
        message:
          "Add-only by default: existing badge ids are skipped. Pass mode:\"replace\" on apply_changes to overwrite.",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // apply_changes — Manual apply (no AI). Default add-only for badges.
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "apply_changes") {
      const {
        badges: badgesToApply,
        milestones: milestonesToApply,
        mode = "add-only",
      } = body;
      const results: Record<string, unknown> = {};
      if (Array.isArray(badgesToApply) && badgesToApply.length > 0) {
        results.badges = await dbTools.writeBadgesBatch(badgesToApply, {
          mode: mode === "replace" ? "replace" : "add-only",
        });
      }
      if (Array.isArray(milestonesToApply) && milestonesToApply.length > 0) {
        results.milestones = await dbTools.writeMilestonesBatch(milestonesToApply);
      }
      return NextResponse.json({ success: true, action: "apply_changes", results });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // run_full — one pass over the whole gamification system.
    //
    // Reason (R96b): the operator's question is "make the system complete and
    // balanced for every game we run", which used to need five separate button
    // presses in the right order. Every step is ADD-ONLY and gap-driven, so the
    // first run builds the system and a later run — after a new title is
    // enabled — writes only that title's missing pieces and leaves operator
    // edits alone.
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "run_full") {
      const {
        includeMilestones = true,
        // Reason: 0 means every map the blueprint produces. It used to default
        // to 3 because each map cost an AI call; the blueprint costs none, and a
        // cap of 3 silently drops the journey of every game past the second.
        maxMaps = 0,
        proposeLadder = true,
        mode = "add",
        confirmation,
        includePlayerProgress = false,
      } = body;
      const steps: Record<string, unknown> = {};

      // ── 0. Rebuild from scratch, if asked ─────────────────────────────────
      // Reason: the wipe runs INSIDE run_full rather than beside it, so the
      // rebuild and the build that replaces it are one operator action. Run as
      // two presses, a wipe that is not followed by a build leaves the platform
      // with no badges and no ladder, and the flags mean the shipped defaults
      // will not cover for it.
      if (mode === "rebuild") {
        const reset = await resetGamification({
          scopes: Array.isArray(body.resetScopes) && body.resetScopes.length > 0
            ? body.resetScopes
            : ALL_GAMIFICATION_RESET_SCOPES,
          confirmation,
          includePlayerProgress,
          actor: guard.admin.email,
        });
        if (!reset.success) {
          // Reason: refuse the WHOLE run. Falling through to the add-only build
          // after a refused wipe is the one outcome an operator who typed the
          // phrase wrongly would not expect, and it reads as success.
    return NextResponse.json(
            { success: false, action: "run_full", error: reset.error },
            { status: 400 },
          );
        }
        steps.reset = reset;
      } else {
        steps.reset = "skipped (add-only)";
      }

      // ── 1. Badge XP table ─────────────────────────────────────────────────
      // Reason: the XP each rarity pays has to be settled BEFORE the ladder is
      // derived, because the ladder is a function of what the catalogue can
      // actually pay. The ladder itself is step 4.
      //
      // ALWAYS rewrite on every run_full. Leaving an existing 10/25/50/100 row
      // (the install default) made the XP Values screen look unchanged after the
      // wizard "succeeded", which reads as "the wizard does not calculate XP".
      // An operator who wants a hand-tuned table edits Badges & XP directly; the
      // wizard's job is to propose the scale that matches the catalogue size.
      const targetTotal =
        typeof body.generateCount === "number" && body.generateCount > 0
          ? Math.floor(body.generateCount)
          : DEFAULT_TARGET_BADGE_TOTAL;
      const proposedXp = proposeBadgeXp(targetTotal);
      const priorXp = await dbTools.readXPConfig();
      await dbTools.writeXPConfig("badge_xp", proposedXp);
      steps.badgeXp = {
        action: priorXp?.badgeXP ? "recalculated" : "created",
        badgeXP: proposedXp,
        previous: priorXp?.badgeXP ?? null,
      };
      const badgeXp = await resolveBadgeXp();

      // ── 2. Badges — deterministic blueprint, add-only ─────────────────────
      // Reason (R103): this used to be a single AI call asked to cover the whole
      // catalogue inside a 6,000-token reply. It returned a handful of trading
      // badges, reported success, and an operator who had just wiped the system
      // was left with five. The quota, the rarity pyramid and the thresholds are
      // arithmetic now; the model is a rewording pass over what this produced.
      const catalogue = await loadCatalogueGameRefs();
      const knownKeys = knownGameKeys(catalogue);
      const quotaPlan = planBadgeQuota(
        catalogue.map((c) => ({ gameKey: c.gameKey, name: c.displayName })),
        targetTotal,
      );
      const blueprint = buildBadgeBlueprint(quotaPlan);
      const badgeWrite = await dbTools.writeBadgesBatch(blueprint.badges, {
        mode: "add-only",
        knownKeys,
      });
      steps.badges = {
        action: "blueprint",
        target: quotaPlan.target,
        planned: quotaPlan.planned,
        generated: blueprint.badges.length,
        shortfalls: blueprint.shortfalls,
        scopes: quotaPlan.scopes.map((s) => ({
          scope: s.scope,
          label: s.label,
          total: s.total,
        })),
        writeResults: badgeWrite,
      };

      // ── 3. Journey maps and milestones — deterministic ────────────────────
      // Reason: the milestone agent iterates maps that already exist, so after a
      // wipe there were none and it produced nothing at all — a wizard reporting
      // success beside an empty journey screen. The maps are built here from the
      // same quota plan the badges are, which is what guarantees a game cannot
      // have badges and no journey.
      //
      // On rebuild we REPLACE: add-only leaves Getting Started / Pirate Cove /
      // blank percent-layout rows beside the new maps, and the player carousel
      // then offers a journey with nothing on it.
      if (includeMilestones) {
        const journey = buildJourneyBlueprint(quotaPlan, {
          earnableBadgeXp: earnableXpFromBadges(blueprint.badges, badgeXp),
        });
        const mapsToWrite = journey.maps.slice(
          0,
          Math.max(0, maxMaps === 0 ? journey.maps.length : maxMaps),
        );
        const writtenMapIds = new Set(mapsToWrite.map((m) => m.mapId));
        if (mode === "rebuild") {
          await JourneyMilestone.deleteMany({});
          await JourneyMapConfig.deleteMany({});
        }
        const mapWrite = await dbTools.writeMapsBatch(mapsToWrite);
        const milestoneWrite = await dbTools.writeMilestonesBatch(
          journey.milestones.filter((m) => writtenMapIds.has(m.mapId)),
          { mode: mode === "rebuild" ? "replace" : "add-only" },
        );
        // Reason: the figures are counted out of the COLLECTIONS after the
        // writes, never from the blueprint's intent and never from this run's
        // own created/updated counters. Two different failures read identically
        // otherwise: a rejected write, and an add-only pass over a design that
        // is already complete. The first is broken and the second is fine, and
        // both used to report zero. What an operator is asking is "are there
        // milestones", so that is the number on the screen.
        const state = await journeyState(writtenMapIds);
        steps.milestones = {
          action: mode === "rebuild" ? "blueprint-replaced" : "blueprint",
          maps: mapWrite,
          milestones: milestoneWrite,
          mapsStored: state.maps,
          milestonesStored: state.milestones,
          zonesStored: state.zones,
          createdMilestones: milestoneWrite.created + milestoneWrite.updated,
          plannedMilestones: journey.milestones.filter((m) =>
            writtenMapIds.has(m.mapId),
          ).length,
          error: mapWrite.firstError ?? milestoneWrite.firstError ?? null,
          mapIds: mapsToWrite.map((m) => m.mapId),
          mapNames: mapsToWrite.map((m) => m.name),
        };
      } else {
        steps.milestones = "skipped";
      }

      // ── 4. Levels — derived from what the catalogue can now pay ───────────
      // Reason: a ladder an operator has tuned is never overwritten on add-only,
      // and a ladder written BEFORE the badges exists is derived from zero
      // earnable XP — which is exactly the "level 20 needs 426,000 XP while a
      // badge pays 25" mismatch an operator sees as no balance at all.
      //
      // On rebuild we ALWAYS rewrite: an add-only "kept" after a wipe that
      // somehow left the row (or a wipe that omitted the levels scope) is how
      // the 426,400 curve survived beside the new catalogue.
      const freshXpConfig = await dbTools.readXPConfig();
      const existingLevels = Array.isArray(freshXpConfig?.levels)
        ? freshXpConfig.levels
        : [];
      const allBadges = await dbTools.readAllBadges();
      const earnable = earnableXpFromBadges(
        allBadges as Array<{ rarity?: string | null }>,
        badgeXp,
      );
      const economy = auditEconomy(
        allBadges as Array<{ rarity?: string | null }>,
        existingLevels as Array<{ minXP?: number | null }>,
        badgeXp,
      );
      const shouldRewriteLadder =
        proposeLadder &&
        (mode === "rebuild" ||
          existingLevels.length === 0 ||
          !economy.reachable);

      if (shouldRewriteLadder) {
        const proposed = proposeNeutralLadder(undefined, earnable);
        await dbTools.writeXPConfig("level_progression", proposed);
        steps.levels = {
          action: mode === "rebuild" ? "rebuilt" : "created",
          levelCount: proposed.length,
          earnableXp: earnable,
          topLevelMinXP: proposed.at(-1)?.minXP,
          reason: !economy.reachable && existingLevels.length > 0
            ? "replaced unreachable ladder"
            : undefined,
        };
      } else {
        steps.levels = {
          action: "kept",
          levelCount: existingLevels.length,
          audit: auditLadder(existingLevels as never[]),
          economy,
        };
      }

      // ── 5. Deterministic fixes, then score the result ─────────────────────
      steps.autoFix = await applyAutoFixes();
      const evaluation = await runEvaluation();
      steps.evaluation = evaluation;

      // Reason: the report is the post-run gap, so an operator can see at a
      // glance whether a second pass has anything left to do.
      const finalCoverage = await computeCoverage();

      return NextResponse.json({
        success: true,
        action: "run_full",
        steps,
        coverage: finalCoverage,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // reset_gamification — wipe the authored content so the wizard can rebuild.
    //
    // Exposed on its own as well as inside `run_full` because an operator may
    // legitimately want the platform empty and hand-author from there. It
    // refuses without the confirmation phrase, and it leaves player-earned rows
    // alone unless asked, reporting how many it orphaned.
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "reset_gamification") {
      const result = await resetGamification({
        scopes:
          Array.isArray(body.scopes) && body.scopes.length > 0
            ? body.scopes
            : ALL_GAMIFICATION_RESET_SCOPES,
        confirmation: body.confirmation,
        includePlayerProgress: body.includePlayerProgress === true,
        actor: guard.admin.email,
      });
      return NextResponse.json(
        { action: "reset_gamification", ...result },
        { status: result.success ? 200 : 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // agent_evaluate — LOCAL ENGINE: instant, deterministic, NO AI calls.
    // Scores 10 criteria via rules, generates specific fix recommendations.
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_evaluate") {
      const payload = await runEvaluation();
      return NextResponse.json({ success: true, ...payload });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // auto_fix — LOCAL ENGINE: applies deterministic fixes based on rules.
    // Fixes zero-baseline, level gating, invalid badge refs. NO AI.
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "auto_fix") {
      const payload = await applyAutoFixes();
      return NextResponse.json({ success: true, ...payload });
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
      const { autoApply = false, mode = "add-only" } = body;
      const cap =
        typeof body.generateCount === "number" && body.generateCount > 0
          ? body.generateCount
          : Number.POSITIVE_INFINITY;
      const result = await runBadgeAgent(openai, config, { autoApply, mode, cap });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error, raw: result.raw },
          { status: 500 },
        );
      }
      const { ok: _ok, ...payload } = result;
      return NextResponse.json({ success: true, ...payload });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // agent_milestones — OPTIMIZED: compact format, per-map processing
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "agent_milestones") {
      const { mapId, autoApply = false } = body;
      const result = await runMilestoneAgent(openai, config, { mapId, autoApply });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error, raw: result.raw },
          { status: 500 },
        );
      }
      const { ok: _ok, ...payload } = result;
      return NextResponse.json({ success: true, ...payload });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // build_journeys — deterministic maps + milestones for every game (no AI).
    //
    // Reason: Journey Map → "Generate Full Sequence" used to call the trading
    // AI agent ten times (`generate_single_map`), so every map was Pirate Cove /
    // total_trades regardless of the catalogue. The blueprint already walks
    // every scope; this action is the button's public surface onto it.
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "build_journeys") {
      const replaceExisting = body.replaceExisting === true;
      const catalogue = await loadCatalogueGameRefs();
      const badgeXp = await resolveBadgeXp();
      const existingBadges = await dbTools.readAllBadges();
      const targetTotal =
        typeof body.generateCount === "number" && body.generateCount > 0
          ? Math.floor(body.generateCount)
          : Math.max(DEFAULT_TARGET_BADGE_TOTAL, existingBadges.length);
      const quotaPlan = planBadgeQuota(
        catalogue.map((c) => ({ gameKey: c.gameKey, name: c.displayName })),
        targetTotal,
      );
      const journey = buildJourneyBlueprint(quotaPlan, {
        earnableBadgeXp: earnableXpFromBadges(
          existingBadges as Array<{ rarity?: string | null }>,
          badgeXp,
        ),
      });

      if (replaceExisting) {
        // Reason: add-only cannot retire Getting Started / Pirate Cove rows the
        // trading generator left behind, so a replace pass deletes the design
        // first — the same wipe the wizard's milestones scope does — then
        // writes the blueprint. Player progress is kept.
        await JourneyMilestone.deleteMany({});
        await JourneyMapConfig.deleteMany({});
      }

      const mapWrite = await dbTools.writeMapsBatch(journey.maps);
      const milestoneWrite = await dbTools.writeMilestonesBatch(
        journey.milestones,
        { mode: replaceExisting ? "replace" : "add-only" },
      );

      // Reason: `totalMilestones` used to be the BLUEPRINT's length, so the
      // button reported "Generated 24 milestones" whatever the database did
      // with them — the operator read success and opened an empty editor. It is
      // now counted out of the collections, so it answers the question the
      // operator is actually asking; an empty result is a refusal rather than a
      // success with a cheerful number on it.
      const state = await journeyState(
        new Set(journey.maps.map((m) => m.mapId)),
      );
      const storedMilestones = state.milestones;
      if (storedMilestones === 0) {
        return NextResponse.json(
          {
            success: false,
            action: "build_journeys",
            maps: mapWrite,
            milestones: milestoneWrite,
            plannedMilestones: journey.milestones.length,
            error:
              milestoneWrite.firstError ??
              (milestoneWrite.skipped > 0
                ? `All ${milestoneWrite.skipped} milestone(s) already exist — tick "replace existing" to rebuild the sequence.`
                : "The blueprint produced no milestones to store."),
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        action: "build_journeys",
        maps: mapWrite,
        milestones: milestoneWrite,
        mapIds: journey.maps.map((m) => m.mapId),
        mapNames: journey.maps.map((m) => m.name),
        totalMilestones: storedMilestones,
        totalMaps: state.maps,
        totalZones: state.zones,
        plannedMilestones: journey.milestones.length,
        scopes: quotaPlan.scopes
          .filter((s) => s.scope !== "platform" && s.total > 0)
          .map((s) => ({ scope: s.scope, label: s.label, total: s.total })),
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid action. Use: get_status, coverage, setup_levels, plan_badges, run_full, build_journeys, agent_badges, agent_milestones, agent_evaluate, auto_fix, apply_changes",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("[Gamification Wizard] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Gamification Wizard failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 },
    );
  }
}

