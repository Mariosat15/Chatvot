/**
 * Validating and applying the Game Master competition defaults.
 *
 * One validator answers "is this a correct value for this option" for BOTH the admin saving a
 * default and a Game Master submitting a competition - two copies of a bound is how an admin
 * saves a default the create route then refuses. Model-free (R58); see
 * `competition-defaults.ts` for the option list.
 */
import {
  COMPETITION_DEFAULT_OPTIONS,
  findCompetitionDefaultOption,
  optionsForGame,
  type CompetitionDefaultOption,
  type DefaultsGame,
  type PrizeShare,
  type ResolvedCompetitionDefault,
} from "./competition-defaults";

export type OptionCheck =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

const PRIZE_TOTAL_TOLERANCE = 0.01;
const MAX_PRIZE_PLACES = 100;

function asFiniteNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * The trading form has historically sent markets as `{ forex: true, crypto: false }` while
 * the option stores a list. `forex !== false` matches the create route's own reading, where an
 * absent forex key has always meant forex.
 */
function marketsFromObject(raw: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (raw.forex !== false) out.push("forex");
  if (raw.crypto === true) out.push("crypto");
  if (raw.stocks === true) out.push("stocks");
  return out;
}

function checkPrizes(raw: unknown, label: string): OptionCheck {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PRIZE_PLACES) {
    return { ok: false, error: `${label}: add at least one paid place.` };
  }
  const shares: PrizeShare[] = [];
  for (const entry of raw) {
    const rank = asFiniteNumber((entry as PrizeShare | null)?.rank);
    const percentage = asFiniteNumber((entry as PrizeShare | null)?.percentage);
    if (rank === null || percentage === null || percentage <= 0 || percentage > 100) {
      return { ok: false, error: `${label}: every place needs a share above 0%.` };
    }
    shares.push({ rank, percentage });
  }
  shares.sort((a, b) => a.rank - b.rank);
  // Reason: ranks must be 1, 2, 3... with no gap - a split paying 1st and 3rd has nobody to
  // pay 2nd, and settlement would redistribute that share in a way nobody chose.
  if (shares.some((share, index) => share.rank !== index + 1)) {
    return { ok: false, error: `${label}: places must run 1, 2, 3... with no gaps.` };
  }
  const total = shares.reduce((sum, share) => sum + share.percentage, 0);
  if (Math.abs(total - 100) > PRIZE_TOTAL_TOLERANCE) {
    return {
      ok: false,
      error: `${label}: the shares add up to ${Math.round(total * 100) / 100}%, they must total 100%.`,
    };
  }
  return { ok: true, value: shares };
}

/** Is `raw` a correct value for `option`? Returns the normalised value when it is. */
export function checkOptionValue(
  option: CompetitionDefaultOption,
  raw: unknown,
): OptionCheck {
  switch (option.kind) {
    case "number": {
      const value = asFiniteNumber(raw);
      if (value === null) {
        return { ok: false, error: `${option.label} must be a number.` };
      }
      if (option.integer && !Number.isInteger(value)) {
        return { ok: false, error: `${option.label} must be a whole number.` };
      }
      if (value < option.min || value > option.max) {
        return {
          ok: false,
          error: `${option.label} must be between ${option.min} and ${option.max}.`,
        };
      }
      return { ok: true, value };
    }
    case "boolean":
      return typeof raw === "boolean"
        ? { ok: true, value: raw }
        : { ok: false, error: `${option.label} must be on or off.` };
    case "choice": {
      const allowed = new Set(option.choices.map((choice) => choice.value));
      return typeof raw === "string" && allowed.has(raw)
        ? { ok: true, value: raw }
        : { ok: false, error: `${option.label}: choose one of the listed options.` };
    }
    case "multi": {
      const list =
        Array.isArray(raw)
          ? raw
          : raw && typeof raw === "object"
            ? marketsFromObject(raw as Record<string, unknown>)
            : null;
      const allowed = new Set(option.choices.map((choice) => choice.value));
      if (
        !list ||
        list.length === 0 ||
        !list.every((value) => typeof value === "string" && allowed.has(value))
      ) {
        return { ok: false, error: `${option.label}: choose at least one.` };
      }
      return { ok: true, value: [...new Set(list as string[])] };
    }
    case "prizes":
      return checkPrizes(raw, option.label);
  }
}

/**
 * The admin's configuration, with anything missing or no longer valid replaced by the
 * shipped default. A stored key the list no longer has is ignored rather than refused: the
 * option was retired, and refusing would lock every Game Master out of creating.
 */
export function resolveCompetitionDefaults(
  stored: unknown,
): ResolvedCompetitionDefault[] {
  const byKey = new Map<string, { value?: unknown; gmMayChange?: unknown }>();
  if (Array.isArray(stored)) {
    for (const entry of stored) {
      if (entry && typeof entry === "object" && typeof entry.key === "string") {
        byKey.set(entry.key, entry);
      }
    }
  }
  return COMPETITION_DEFAULT_OPTIONS.map((option) => {
    const saved = byKey.get(option.key);
    const check =
      saved && saved.value !== undefined
        ? checkOptionValue(option, saved.value)
        : null;
    return {
      key: option.key,
      value: check?.ok ? check.value : option.defaultValue,
      // Reason: an option nobody has configured stays open to the Game Master, which is
      // exactly what they could do before this screen existed.
      gmMayChange: saved?.gmMayChange === false ? false : true,
    };
  });
}

/** Validate an admin save. Every entry must name a known option and carry a correct value. */
export function validateCompetitionDefaultsInput(
  raw: unknown,
):
  | { ok: true; entries: ResolvedCompetitionDefault[] }
  | { ok: false; errors: string[] } {
  if (!Array.isArray(raw)) {
    return { ok: false, errors: ["Send the list of options."] };
  }
  const errors: string[] = [];
  const seen = new Map<string, ResolvedCompetitionDefault>();
  for (const entry of raw) {
    const option = findCompetitionDefaultOption(entry?.key);
    if (!option) {
      errors.push(`Unknown option: ${String(entry?.key)}`);
      continue;
    }
    if (typeof entry.gmMayChange !== "boolean") {
      errors.push(`${option.label}: say whether the Game Master may change it.`);
      continue;
    }
    const check = checkOptionValue(option, entry.value);
    if (!check.ok) {
      errors.push(check.error);
      continue;
    }
    seen.set(option.key, {
      key: option.key,
      value: check.value,
      gmMayChange: entry.gmMayChange,
    });
  }
  const resolvedMin = seen.get("minParticipants")?.value;
  const resolvedMax = seen.get("maxParticipants")?.value;
  if (
    typeof resolvedMin === "number" &&
    typeof resolvedMax === "number" &&
    resolvedMin > resolvedMax
  ) {
    errors.push("Minimum players cannot be more than maximum players.");
  }
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, entries: [...seen.values()] };
}

function readPath(body: Record<string, unknown>, path: readonly string[]): unknown {
  let cursor: unknown = body;
  for (const segment of path) {
    if (!cursor || typeof cursor !== "object") return undefined;
    // eslint-disable-next-line security/detect-object-injection -- path segments come from the fixed registry, never from the request
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function writePath(
  body: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): void {
  let cursor = body;
  for (const segment of path.slice(0, -1)) {
    // eslint-disable-next-line security/detect-object-injection -- path segments come from the fixed registry, never from the request
    const next = cursor[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      // eslint-disable-next-line security/detect-object-injection -- path segments come from the fixed registry, never from the request
      cursor[segment] = {};
    }
    // eslint-disable-next-line security/detect-object-injection -- path segments come from the fixed registry, never from the request
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

function isAbsent(raw: unknown): boolean {
  return raw === undefined || raw === null || raw === "";
}

/**
 * Apply the admin's defaults to a Game Master's create request.
 *
 * - LOCKED option: the admin's value is written whatever the request said. Silently, because
 *   the Game Master's form never showed the option, so there is nothing for them to correct.
 * - OPEN option, no value sent: the admin's value is filled in.
 * - OPEN option, value sent: it must pass the same check an admin's does, or the request is
 *   refused naming the option. Never clamped - a value quietly changed is a competition
 *   different from the one the Game Master reviewed.
 *
 * The body is copied, never edited in place.
 */
export function applyGameMasterCompetitionDefaults(
  body: unknown,
  defaults: readonly ResolvedCompetitionDefault[],
  game: DefaultsGame,
):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; errors: string[] } {
  const copy: Record<string, unknown> =
    body && typeof body === "object" && !Array.isArray(body)
      ? structuredClone(body as Record<string, unknown>)
      : {};
  const byKey = new Map(defaults.map((entry) => [entry.key, entry]));
  const errors: string[] = [];

  for (const option of optionsForGame(game)) {
    const configured = byKey.get(option.key);
    const adminValue = configured ? configured.value : option.defaultValue;
    const mayChange = configured ? configured.gmMayChange : true;
    const sent = readPath(copy, option.path);

    if (!mayChange || isAbsent(sent)) {
      writePath(copy, option.path, structuredClone(adminValue));
      continue;
    }
    const check = checkOptionValue(option, sent);
    if (!check.ok) {
      errors.push(check.error);
      continue;
    }
    writePath(copy, option.path, check.value);
  }

  const min = copy.minParticipants;
  const max = copy.maxParticipants;
  if (typeof min === "number" && typeof max === "number" && min > max) {
    errors.push("Minimum players cannot be more than maximum players.");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, body: copy };
}

/** What the Game Master's form needs: the options for one game, with the admin's values. */
export function gameMasterDefaultsView(
  defaults: readonly ResolvedCompetitionDefault[],
  game: DefaultsGame,
): ResolvedCompetitionDefault[] {
  const keys = new Set(optionsForGame(game).map((option) => option.key));
  return defaults.filter((entry) => keys.has(entry.key));
}
