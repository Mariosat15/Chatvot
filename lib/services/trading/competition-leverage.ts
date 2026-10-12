/**
 * The one way a trading competition's chosen leverage becomes the stored `leverage` object,
 * and the one way a stored competition is read back. Mirrored into
 * `apps/admin/lib/services/trading/competition-leverage.ts` and pinned byte-identical by a test.
 *
 * Reason: until 12 Oct 2026 the leverage an operator picked never reached the contest. The admin
 * create action stored the platform's risk-settings maximum whatever the wizard sent, the edit
 * route assigned `leverageAllowed`, a field the schema does not declare (so strict mode dropped
 * it), and the Game Master route wrote a bare number where the schema expects
 * `{ enabled, min, max, default }`, so every reader of `leverage.max` saw `undefined` and fell back
 * to 1:100. A contest set up at 1:20 therefore advertised and allowed 1:100.
 *
 * Model-free on purpose: the trading overview copy and both apps' contest readers import it.
 */

export interface LeverageLimits {
  minLeverage?: number;
  maxLeverage?: number;
  defaultLeverage?: number;
}

export interface CompetitionLeverage {
  enabled: true;
  min: number;
  max: number;
  default: number;
}

/** Fallback ceiling when the platform risk settings carry none - the readers' historical default. */
export const FALLBACK_MAX_LEVERAGE = 100;

function positive(value: unknown): number | undefined {
  const n =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Clamp the requested leverage into the platform's risk limits. An absent or unusable request
 * keeps the old behaviour (the platform ceiling) so a caller that sends nothing is unchanged.
 */
export function resolveCompetitionLeverage(
  requested: unknown,
  limits: LeverageLimits,
): CompetitionLeverage {
  const floor = Math.max(1, Math.round(positive(limits.minLeverage) ?? 1));
  const ceiling = Math.max(
    floor,
    Math.round(positive(limits.maxLeverage) ?? FALLBACK_MAX_LEVERAGE),
  );
  const asked = positive(requested);
  const max = Math.min(ceiling, Math.max(floor, Math.round(asked ?? ceiling)));
  const preferred = positive(limits.defaultLeverage) ?? max;
  const fallbackDefault = Math.min(max, Math.max(floor, Math.round(preferred)));
  return {
    enabled: true,
    min: floor,
    max,
    // Reason: a contest the operator capped at 1:20 must not open a trade at the platform's
    // default of 1:30, so the default is never above the chosen ceiling.
    default: fallbackDefault,
  };
}

/**
 * The leverage ceiling a stored competition actually carries, or `undefined` when it declares
 * none. Accepts the bare number Game Master contests were written with before 12 Oct 2026.
 */
export function storedLeverageCeiling(leverage: unknown): number | undefined {
  if (typeof leverage === "number") return positive(leverage);
  if (leverage && typeof leverage === "object") {
    return positive((leverage as { max?: unknown }).max);
  }
  return undefined;
}
