import GamificationDefaultsState from "@/database/models/gamification-defaults-state.model";

/**
 * The one row. A fixed key rather than a naked `findOne()` so a stray second
 * document cannot decide the answer by insertion order.
 */
export const DEFAULTS_STATE_KEY = "gamification";

export interface DefaultsSuppression {
  badgeDefaultsSuppressed: boolean;
  xpDefaultsSuppressed: boolean;
}

const NOT_SUPPRESSED: DefaultsSuppression = {
  badgeDefaultsSuppressed: false,
  xpDefaultsSuppressed: false,
};

/**
 * Reads the flags.
 *
 * Reason: this fails OPEN — a read error or a missing row answers "not
 * suppressed", which is today's behaviour. The opposite direction would let one
 * timed-out query leave a fresh install with no badges and no ladder at all,
 * with nothing on screen to explain it.
 */
export async function getDefaultsSuppression(): Promise<DefaultsSuppression> {
  try {
    const state = await GamificationDefaultsState.findOne({
      key: DEFAULTS_STATE_KEY,
    }).lean();
    if (!state) return NOT_SUPPRESSED;
    return {
      badgeDefaultsSuppressed: state.badgeDefaultsSuppressed === true,
      xpDefaultsSuppressed: state.xpDefaultsSuppressed === true,
    };
  } catch (error) {
    console.warn(
      "⚠️ Could not read gamification defaults state, assuming not suppressed:",
      error,
    );
    return NOT_SUPPRESSED;
  }
}

/**
 * Sets one or both flags. Only the keys passed are written, so suppressing
 * badges cannot silently un-suppress the ladder.
 */
export async function setDefaultsSuppression(
  patch: Partial<DefaultsSuppression>,
  actor?: string,
): Promise<DefaultsSuppression> {
  const update: Record<string, unknown> = { key: DEFAULTS_STATE_KEY };
  if (typeof patch.badgeDefaultsSuppressed === "boolean") {
    update.badgeDefaultsSuppressed = patch.badgeDefaultsSuppressed;
  }
  if (typeof patch.xpDefaultsSuppressed === "boolean") {
    update.xpDefaultsSuppressed = patch.xpDefaultsSuppressed;
  }
  const suppressing =
    update.badgeDefaultsSuppressed === true || update.xpDefaultsSuppressed === true;
  if (suppressing) {
    update.suppressedAt = new Date();
    if (actor) update.suppressedBy = actor;
  }

  const state = await GamificationDefaultsState.findOneAndUpdate(
    { key: DEFAULTS_STATE_KEY },
    { $set: update },
    { upsert: true, new: true },
  ).lean();

  return {
    badgeDefaultsSuppressed: state?.badgeDefaultsSuppressed === true,
    xpDefaultsSuppressed: state?.xpDefaultsSuppressed === true,
  };
}

/**
 * Lets the shipped defaults seed again.
 *
 * Reason: "restore defaults" must clear the flags in the same operation that
 * re-seeds, or the restore writes rows the next read is still forbidden to
 * top up — a half-restored system that reports success.
 */
export async function clearDefaultsSuppression(): Promise<void> {
  await GamificationDefaultsState.findOneAndUpdate(
    { key: DEFAULTS_STATE_KEY },
    {
      $set: {
        key: DEFAULTS_STATE_KEY,
        badgeDefaultsSuppressed: false,
        xpDefaultsSuppressed: false,
      },
      $unset: { suppressedAt: "", suppressedBy: "" },
    },
    { upsert: true },
  );
}
