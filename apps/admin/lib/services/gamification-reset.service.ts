import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import XPConfig from "@/database/models/xp-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import UserBadge from "@/database/models/user-badge.model";
import UserLevel from "@/database/models/user-level.model";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import { setDefaultsSuppression } from "@/lib/services/gamification-defaults-state.service";
import {
  ALL_GAMIFICATION_RESET_SCOPES,
  GAMIFICATION_RESET_CONFIRMATION,
  type GamificationResetScope,
} from "../admin/gamification-reset-copy";

/**
 * Wipe the gamification DESIGN so an operator can build it from scratch.
 *
 * This is the destructive half of the wizard's two modes. "Add" is the normal
 * one; this exists because a platform whose games are not trading inherits a
 * ladder titled "Novice Trader" and ~130 trading badges that nobody can
 * usefully edit their way out of.
 *
 * Three rules it must keep:
 *
 *  1. It sets the defaults-suppression flags. Without them `seedBadgeConfigs`
 *     and `seedXPConfigs` reseed the shipped catalogue on the very next read,
 *     so the wipe is undone within seconds while reporting success.
 *  2. Player progress is NOT deleted unless asked. Earned badges, levels and
 *     journey progress are things players did; deleting the design does not
 *     make them untrue. They are reported as orphaned instead.
 *  3. It refuses without the exact confirmation phrase, because there is no
 *     undo and the shipped defaults are not necessarily what was there.
 */

// Reason: the phrase and the scope ids come from the model-free copy module so
// the panel and the server cannot disagree about either. Re-exported here so
// existing importers only ever need the one path.
export {
  ALL_GAMIFICATION_RESET_SCOPES,
  GAMIFICATION_RESET_CONFIRMATION,
  type GamificationResetScope,
} from "../admin/gamification-reset-copy";

// Reason: a request-supplied scope is looked up in a Set, never in an object —
// an object lookup walks the prototype chain, so "constructor" is truthy and
// survives a `!allowed` test.
const VALID_SCOPES = new Set<string>(ALL_GAMIFICATION_RESET_SCOPES);

export interface GamificationResetInput {
  scopes: readonly string[];
  confirmation: string;
  /** Default false: earned progress is kept and merely reported. */
  includePlayerProgress?: boolean;
  actor?: string;
}

export interface GamificationResetResult {
  success: boolean;
  error?: string;
  scopes?: GamificationResetScope[];
  /** Rows removed, by collection. */
  deleted?: Record<string, number>;
  /** Earned rows left in place because includePlayerProgress was false. */
  orphanedPlayerProgress?: Record<string, number>;
  suppression?: { badgeDefaultsSuppressed: boolean; xpDefaultsSuppressed: boolean };
}

export async function resetGamification(
  input: GamificationResetInput,
): Promise<GamificationResetResult> {
  const { confirmation, includePlayerProgress = false, actor } = input;

  if (confirmation !== GAMIFICATION_RESET_CONFIRMATION) {
    return {
      success: false,
      error: `Reset refused: type "${GAMIFICATION_RESET_CONFIRMATION}" to confirm. Nothing was deleted.`,
    };
  }

  const scopes = Array.from(
    new Set((input.scopes || []).filter((s) => VALID_SCOPES.has(s))),
  ) as GamificationResetScope[];

  if (scopes.length === 0) {
    return {
      success: false,
      error:
        "Reset refused: choose at least one of badges, milestones or levels. Nothing was deleted.",
    };
  }

  try {
    await connectToDatabase();

    const deleted: Record<string, number> = {};
    const orphanedPlayerProgress: Record<string, number> = {};

    if (scopes.includes("badges")) {
      deleted.badgeConfigs = (await BadgeConfig.deleteMany({})).deletedCount ?? 0;
      if (includePlayerProgress) {
        deleted.userBadges = (await UserBadge.deleteMany({})).deletedCount ?? 0;
      } else {
        orphanedPlayerProgress.userBadges = await UserBadge.countDocuments();
      }
    }

    if (scopes.includes("milestones")) {
      deleted.journeyMilestones =
        (await JourneyMilestone.deleteMany({})).deletedCount ?? 0;
      deleted.journeyMaps = (await JourneyMapConfig.deleteMany({})).deletedCount ?? 0;
      if (includePlayerProgress) {
        deleted.userJourneyProgress =
          (await UserJourneyProgress.deleteMany({})).deletedCount ?? 0;
      } else {
        orphanedPlayerProgress.userJourneyProgress =
          await UserJourneyProgress.countDocuments();
      }
    }

    if (scopes.includes("levels")) {
      // Reason: an unfiltered delete, deliberately. Legacy rows written by the
      // wizard before R102 carry `type` rather than `configType`, so a filtered
      // delete leaves them behind to be read by nothing and re-collide later.
      deleted.xpConfigs = (await XPConfig.deleteMany({})).deletedCount ?? 0;
      if (includePlayerProgress) {
        deleted.userLevels = (await UserLevel.deleteMany({})).deletedCount ?? 0;
      } else {
        orphanedPlayerProgress.userLevels = await UserLevel.countDocuments();
      }
    }

    // Reason: set AFTER the deletes. Set first, a delete that throws leaves the
    // defaults suppressed over a catalogue that still exists — no reseed, no
    // wipe, and nothing on screen to say so.
    const suppression = await setDefaultsSuppression(
      {
        ...(scopes.includes("badges") ? { badgeDefaultsSuppressed: true } : {}),
        ...(scopes.includes("levels") ? { xpDefaultsSuppressed: true } : {}),
      },
      actor,
    );

    console.log(
      `🧹 Gamification reset (${scopes.join(", ")}) by ${actor || "unknown"}:`,
      deleted,
    );

    return {
      success: true,
      scopes,
      deleted,
      orphanedPlayerProgress,
      suppression,
    };
  } catch (error) {
    console.error("❌ Gamification reset failed:", error);
    return {
      success: false,
      error:
        "Something went wrong. Please contact support. The reset may be partially applied — check the badge, milestone and level screens before retrying.",
    };
  }
}
