import { connectToDatabase } from "@/database/mongoose";
import XPConfig from "@/database/models/xp-config.model";
import {
  DEFAULT_GLOBAL_WEIGHTS,
  GlobalScoreWeights,
  normaliseGlobalWeights,
} from "./global-score";

/**
 * The operator's global-rank weights, or the shipped defaults.
 *
 * Reason: the stored document is the operator's raw typing and the arithmetic
 * needs a set that sums to 100, so the rescale happens HERE rather than at each
 * caller — two callers rescaling differently is how a published percentage
 * stops describing the ranking it claims to describe.
 */
export async function getLeaderboardWeights(): Promise<GlobalScoreWeights> {
  try {
    await connectToDatabase();
    const config = await XPConfig.findOne({
      configType: "leaderboard_weights",
      isActive: true,
    }).lean();

    const stored = config?.data?.weights;
    if (!stored || typeof stored !== "object") {
      return { ...DEFAULT_GLOBAL_WEIGHTS };
    }
    return normaliseGlobalWeights(stored as Record<string, unknown>);
  } catch (error) {
    // Reason: the leaderboard must still render if settings are unreachable.
    // Failing to the published defaults is visible and correct; failing to an
    // empty weight set would silently unrank everybody.
    console.error("⚠️ Leaderboard weights unavailable, using defaults:", error);
    return { ...DEFAULT_GLOBAL_WEIGHTS };
  }
}
