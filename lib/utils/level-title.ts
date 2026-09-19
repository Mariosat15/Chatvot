import type { GameIconName } from "@/lib/constants/game-icons";
import {
  TITLE_LEVELS,
  TitleLevel,
  levelEntryForXP,
} from "@/lib/constants/levels";

/*
  R88 - the one answer to "what is this player's level called".

  Two functions share the name `getTitleByXP`: an async one in `xp-config.service.ts`
  reading the operator's ladder out of `XPConfig`, and a synchronous one in
  `lib/constants/levels.ts` reading a hard-coded twenty-entry array. The XP award path
  used the database one and stored its answer on `UserLevel.currentTitle`; five read
  sites used the constant. So renaming the ladder in admin changed the profile while
  every leaderboard row kept saying "Novice Trader", with nothing thrown and nothing
  logged.

  The rule this module fixes in place:

  - The OPERATOR'S LADDER is authoritative for the title. `UserLevel.currentTitle` is a
    cache written at award time and is therefore stale from the instant the ladder is
    renamed until the player next earns XP. It is a fallback here, never the answer.

  - The LEVEL is derived from XP against that same ladder, not from the stored
    `currentLevel`, for exactly the same reason: an operator who moves the XP thresholds
    leaves every stored level number wrong until the next award.

  - The ICON AND COLOUR come from the CODE ladder, matched by level number, never from
    the database entry. `GameIconName` is a union of committed SVG assets and the colour
    is a Tailwind class that has to exist in the compiled stylesheet, so an
    operator-typed string for either draws nothing while reviewing as perfectly correct.
    Renaming is content; the artwork needs code support.
*/

/**
 * The subset of a `UserLevel` document this module reads. Model-free by requirement (R58).
 *
 * Deliberately `unknown`-valued rather than typed to the schema. Every caller hands this a
 * `.lean()` row, which skips hydration and is typed `FlattenMaps<any>` - so a declared
 * `currentXP: number` would be a claim the compiler cannot check, which is exactly where
 * the missing `participant.score` read hid for a day (R32/R33). The values are coerced
 * below instead, which also survives a field stored as a string.
 *
 * The index signature is load-bearing, not decoration: with only optional members this is
 * a WEAK TYPE, and TypeScript rejects any argument sharing none of its property names -
 * which is every `.lean()` row, because `FlattenMaps<any>` declares no named members at
 * all. Without it the call sites do not compile.
 */
export interface StoredUserLevel {
  currentXP?: unknown;
  currentLevel?: unknown;
  currentTitle?: unknown;
  [key: string]: unknown;
}

export interface LevelTitleDisplay {
  level: number;
  title: string;
  icon: GameIconName;
  color: string;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A finite number or nothing. A `NaN` XP total would place the player arbitrarily. */
function numeric(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Name a level by its NUMBER - for "this contest requires <name>" style copy, where
 * there is no player and so no XP total to scan.
 *
 * Matched on the entry's own `level` field rather than by array position. Reason:
 * `TITLE_LEVELS[minLevel - 1]` is the position form and it both throws on a ladder an
 * operator has shortened and names the wrong level on one they have reordered.
 */
export function resolveLevelName(
  level: number,
  ladder: TitleLevel[] = TITLE_LEVELS,
): string {
  const configured = trimmed(ladder.find((e) => e.level === level)?.title);
  if (configured) return configured;

  const fallback = trimmed(TITLE_LEVELS.find((e) => e.level === level)?.title);
  if (fallback) return fallback;

  return `Level ${level}`;
}

/**
 * Resolve the title, level, icon and colour to show for a player.
 *
 * `stored` may be absent - a player who has never earned XP has no `UserLevel`
 * document, and every leaderboard has to render them rather than omit the row.
 */
export function resolveLevelTitle(
  stored: StoredUserLevel | null | undefined,
  ladder: TitleLevel[] = TITLE_LEVELS,
): LevelTitleDisplay {
  const entry = levelEntryForXP(numeric(stored?.currentXP) ?? 0, ladder);

  // `stored.currentLevel` is deliberately NOT read, and the absence is the point rather
  // than an omission: it is the same award-time cache as `currentTitle` one field along,
  // so an operator who moves a threshold leaves it wrong on every row until the player
  // next earns XP. `levelEntryForXP` always returns an entry - it falls back to the code
  // ladder and then to its first rung - so there is nothing here to fall back FROM, and
  // an `entry?.level ?? stored.currentLevel` written for safety would be unreachable
  // code that reads as though the cache still has a vote.
  const level = entry.level;

  // The stored title only answers when the ladder has no NAME for this level, which is a
  // rung an operator saved with a blank title - a half-filled row in the level editor.
  // An empty ladder does not reach here: the scan above has already fallen back to the
  // code ladder, which names every rung.
  const title =
    trimmed(entry.title) ||
    trimmed(stored?.currentTitle) ||
    resolveLevelName(level, ladder);

  const art = TITLE_LEVELS.find((e) => e.level === level) ?? TITLE_LEVELS[0];

  return { level, title, icon: art.icon, color: art.color };
}
