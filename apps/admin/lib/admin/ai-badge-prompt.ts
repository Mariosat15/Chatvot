/**
 * Shared AI badge prompt + write guards (R96b).
 *
 * Reason: generate-badges and gamification-wizard both invent forex-only condition
 * lists. One module keeps the prompt and the apply-time refusals aligned with the
 * registry so a third list cannot drift in.
 */

import {
  categoryIdsForPrompt,
  conditionAllowedOnBadge,
  conditionScope,
  conditionTypesForPrompt,
  noTradeFloorTypes,
} from "@/lib/services/games/badge-condition-registry";

export interface CatalogueGameRef {
  gameKey: string;
  displayName: string;
  category?: string;
}

/**
 * Trading is always offerable; provider keys come from the live catalogue.
 * Relative dynamic import — vitest aliases `@` to the repo root, so a static
 * `@/lib/services/game-providers/...` import would miss the admin copy (R58).
 */
export async function loadCatalogueGameRefs(): Promise<CatalogueGameRef[]> {
  try {
    const { listContestableTitles } = await import(
      "../services/game-providers/provider-contest.service"
    );
    const titles = await listContestableTitles();
    return titles.map((t) => ({
      gameKey: t.gameKey,
      displayName: t.displayName,
      category: t.category,
    }));
  } catch (err) {
    console.warn("[ai-badge-prompt] catalogue load failed:", err);
    return [];
  }
}

export function knownGameKeys(refs: CatalogueGameRef[]): Set<string> {
  return new Set(["trading", ...refs.map((r) => r.gameKey)]);
}

function catalogueBlock(refs: CatalogueGameRef[]): string {
  if (refs.length === 0) {
    return `CATALOGUE GAME KEYS:
- trading — Forex trading (always available)
(No provider titles are enabled yet. Do NOT invent provider gameKeys.)`;
  }
  const lines = refs.map(
    (r) =>
      `- ${r.gameKey} — ${r.displayName}${r.category ? ` (${r.category})` : ""}`,
  );
  return `CATALOGUE GAME KEYS (use ONLY these; refuse inventing others):
- trading — Forex trading
${lines.join("\n")}`;
}

/**
 * System prompt for badge AI agents. Built from the registry so a new condition
 * type appears here the moment it is registered.
 */
export function buildBadgeSystemPrompt(refs: CatalogueGameRef[]): string {
  const noFloor = [...noTradeFloorTypes()].sort().join(", ");

  return `You are a game design AI specialized in balanced badge/achievement systems for ChartVolt.

PLATFORM CONTEXT:
- The platform has TRADING (forex competitions & 1v1 challenges) AND skill-based GAMES from providers.
- There are ~20 levels with XP progression.
- Badges give XP: common=10, rare=25, epic=50, legendary=100.
- Badges can be level-gated (minLevel 0-20, 0=no requirement).
- Categories: ${categoryIdsForPrompt()}
- The "Games" category is for provider-game achievements.

gameTypes SCOPING (required on every badge):
- omit or [] = platform-wide (account / cross-game; not trading-only)
- ["trading"] = trading-only
- ["provider:…:…"] or other catalogue gameKeys = that game only
- Never invent a gameKey that is not listed in the catalogue below.

${catalogueBlock(refs)}

BADGE STRUCTURE (exact JSON per badge):
{
  "id": "snake_case_unique_id",
  "name": "Human Readable Name",
  "description": "2-5 word description",
  "category": "Category",
  "icon": "gameIconName",
  "rarity": "common|rare|epic|legendary",
  "minLevel": 0,
  "gameTypes": [],
  "condition": {
    "type": "condition_type_string",
    "value": 10,
    "comparison": "gte",
    "minTrades": 0,
    "minCompletedCompetitions": 0
  }
}

AVAILABLE CONDITION TYPES (scope tag in brackets):
${conditionTypesForPrompt()}
- manual [platform] — admin-awarded

minTrades RULES:
- ONLY trading-scoped conditions may set minTrades > 0.
- For scopes platform | both | game: set minTrades to 0 or omit it.
- No-trade-floor types (do NOT set minTrades): ${noFloor}
- Competition badges may still use minCompletedCompetitions when appropriate.

CRITICAL GAME DESIGN RULES:
1. NEVER create zero-baseline trading badges (minTrades>0 for trading-scoped conditions).
2. Rarity must match difficulty: common=easy, rare=moderate, epic=hard, legendary=extreme.
3. minLevel gates: common=0-1, rare=2-4, epic=5-10, legendary=8-15.
4. Match condition.type scope to gameTypes (use conditionAllowedOnBadge mentally).
5. No duplicate condition.type + value + gameTypes across badges.
6. Descriptions motivating and concise (2-5 words).

BALANCE GUIDELINES (trading-scoped only):
- Common: 5-25 trades, Rare: 25-100, Epic: 100-500, Legendary: 500+

Return ONLY valid JSON. No markdown, no explanation.`;
}

export interface BadgeWriteSanitizeResult {
  ok: boolean;
  reason?: string;
  badge?: Record<string, unknown>;
}

/**
 * Refuse mismatched condition/gameTypes and invented gameKeys before any write.
 * Also clears minTrades on non-trading scopes so the balance engine cannot
 * reintroduce floors the registry forbids.
 */
export function sanitizeBadgeForWrite(
  raw: Record<string, unknown>,
  knownKeys: Set<string>,
): BadgeWriteSanitizeResult {
  const {
    _changes,
    _isNew,
    _id,
    __v,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...rest
  } = raw as Record<
    string,
    unknown
  > & { condition?: Record<string, unknown> };

  const condition =
    rest.condition && typeof rest.condition === "object"
      ? { ...(rest.condition as Record<string, unknown>) }
      : undefined;
  const conditionType =
    condition && typeof condition.type === "string" ? condition.type : "";

  let gameTypes: string[] | undefined;
  if (Array.isArray(rest.gameTypes)) {
    gameTypes = (rest.gameTypes as unknown[])
      .map((t) => String(t).trim())
      .filter(Boolean);
    const invented = gameTypes.filter((k) => !knownKeys.has(k));
    if (invented.length > 0) {
      return {
        ok: false,
        reason: `unknown gameTypes: ${invented.join(", ")}`,
      };
    }
  }

  if (conditionType && conditionType !== "manual") {
    if (!conditionAllowedOnBadge(conditionType, gameTypes)) {
      return {
        ok: false,
        reason: `condition "${conditionType}" not allowed for gameTypes ${JSON.stringify(gameTypes ?? [])}`,
      };
    }
    // Reason: platform/both/game must not carry trade floors — clearing here
    // stops a model that ignored the prompt from poisoning the store.
    if (conditionScope(conditionType) !== "trading" && condition) {
      condition.minTrades = 0;
    }
  }

  return {
    ok: true,
    badge: {
      ...rest,
      ...(gameTypes !== undefined ? { gameTypes } : {}),
      ...(condition ? { condition } : {}),
    },
  };
}

/** Plan preview: group proposed badges by gameTypes scope. */
export function planBadgesByScope(
  badges: Array<{ id?: string; gameTypes?: string[]; name?: string }>,
  existingIds: Set<string>,
): {
  wouldCreate: Array<{ id: string; name?: string; scope: string }>;
  wouldSkipExisting: string[];
  byScope: Record<string, number>;
} {
  const wouldCreate: Array<{ id: string; name?: string; scope: string }> = [];
  const wouldSkipExisting: string[] = [];
  // Reason: the key is a joined gameTypes list from model output, so it is
  // counted in a Map — an object lookup walks the prototype chain and
  // "constructor" would arrive as a truthy count.
  const byScope = new Map<string, number>();

  for (const b of badges) {
    if (!b.id) continue;
    const scopeLabel =
      !b.gameTypes || b.gameTypes.length === 0
        ? "platform"
        : b.gameTypes.join(",");
    if (existingIds.has(b.id)) {
      wouldSkipExisting.push(b.id);
      continue;
    }
    wouldCreate.push({ id: b.id, name: b.name, scope: scopeLabel });
    byScope.set(scopeLabel, (byScope.get(scopeLabel) ?? 0) + 1);
  }

  return {
    wouldCreate,
    wouldSkipExisting,
    byScope: Object.fromEntries(byScope),
  };
}
