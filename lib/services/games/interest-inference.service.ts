/**
 * Infer game interest from what a player has actually played (X11.5 / chapter `20` s3).
 *
 * Counts only - not a recommendation model (s3.3 / R24). Prefer `UserGameStats` over
 * scanning participant rows. Practice does not create stats rows, so free practice never
 * becomes interest.
 *
 * RULES THAT KEEP IT HONEST (s3.2):
 * - A declaration always wins: never overwrite interestLevel "declared".
 * - willingToBeChallenged is NEVER set from inference - paying to enter is not consent
 *   to receive 1v1 invitations (X14).
 * - Absent willingness still means willing (challenge-willingness.ts).
 */
import { connectToDatabase } from "@/database/mongoose";
import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import UserGamePreference from "@/database/models/games/user-game-preference.model";

export type InterestLevel = "declared" | "inferred";

export interface InferredInterest {
  gameKey: string;
  contestsCompleted: number;
  rating: number;
  lastPlayedAt: Date | null;
  interestLevel: InterestLevel;
}

/**
 * Minimum completed contests before we treat play as interest.
 * One abandoned entry must not become a suggestion.
 */
export const MIN_COMPLETED_FOR_INFERENCE = 1;

export async function listPlaySignals(
  userId: string,
): Promise<
  Array<{
    gameKey: string;
    contestsCompleted: number;
    rating: number;
    lastPlayedAt: Date | null;
  }>
> {
  await connectToDatabase();
  const rows = await UserGameStats.find({
    userId,
    gameKey: { $ne: OVERALL_GAME_KEY },
    contestsCompleted: { $gte: MIN_COMPLETED_FOR_INFERENCE },
  })
    .select("gameKey contestsCompleted rating lastPlayedAt")
    .lean<
      Array<{
        gameKey: string;
        contestsCompleted?: number;
        rating?: number;
        lastPlayedAt?: Date;
      }>
    >();

  return rows.map((r) => ({
    gameKey: r.gameKey,
    contestsCompleted: r.contestsCompleted ?? 0,
    rating: typeof r.rating === "number" ? r.rating : 1200,
    lastPlayedAt: r.lastPlayedAt ?? null,
  }));
}

/**
 * Upsert inferred interest rows. Returns the set of gameKeys that are now
 * considered interests (declared or freshly inferred).
 */
export async function refreshInferredInterests(
  userId: string,
): Promise<InferredInterest[]> {
  await connectToDatabase();
  const signals = await listPlaySignals(userId);
  const results: InferredInterest[] = [];

  for (const signal of signals) {
    const existing = await UserGamePreference.findOne({
      userId,
      gameKey: signal.gameKey,
    }).lean<{
      interestLevel?: InterestLevel;
      willingToBeChallenged?: boolean;
    } | null>();

    if (existing?.interestLevel === "declared") {
      // Declaration wins - refresh only the cached skill figure for matchmaking.
      await UserGamePreference.updateOne(
        { userId, gameKey: signal.gameKey },
        { $set: { skillBand: signal.rating } },
      );
      results.push({
        ...signal,
        interestLevel: "declared",
      });
      continue;
    }

    await UserGamePreference.findOneAndUpdate(
      { userId, gameKey: signal.gameKey },
      {
        $set: {
          interestLevel: "inferred",
          inferredAt: new Date(),
          skillBand: signal.rating,
          // Do NOT touch willingToBeChallenged - X14.
        },
        $setOnInsert: {
          userId,
          gameKey: signal.gameKey,
          willingToBeChallenged: true,
          declaredAt: new Date(),
        },
      },
      { upsert: true },
    );

    results.push({
      ...signal,
      interestLevel: "inferred",
    });
  }

  return results.sort(
    (a, b) =>
      (b.lastPlayedAt?.getTime() ?? 0) - (a.lastPlayedAt?.getTime() ?? 0) ||
      b.contestsCompleted - a.contestsCompleted,
  );
}

/**
 * Games this player is interested in, for suggestions. Includes declared and inferred.
 * Does NOT imply they want challenge invitations.
 */
export async function listInterestedGameKeys(
  userId: string,
): Promise<string[]> {
  await connectToDatabase();
  // Refresh first so a returning player gets signals from recent settlement without a
  // separate cron. Cheap: one stats query + a handful of upserts.
  const refreshed = await refreshInferredInterests(userId);
  if (refreshed.length > 0) {
    return refreshed.map((r) => r.gameKey);
  }

  // Declared interests with no stats yet (player opted in during onboarding).
  const declared = await UserGamePreference.find({
    userId,
    interestLevel: "declared",
  })
    .select("gameKey")
    .lean<Array<{ gameKey: string }>>();
  return declared.map((d) => d.gameKey);
}
