/**
 * Suggest contests (and only contests) from inferred / declared game interest.
 *
 * X14: inference is not consent. This module never creates a challenge, never
 * notifies a stranger, and never reads willingToBeChallenged as an invitation
 * licence. Matchmaking and challenge create remain separate.
 */
import Competition from "@/database/models/competition.model";
import { listInterestedGameKeys } from "@/lib/services/games/interest-inference.service";

export interface GameSuggestion {
  gameKey: string;
  competitionId: string;
  name: string;
  entryFee: number;
  startTime: Date;
  status: string;
  reason: "played_before" | "declared_interest";
}

export async function suggestOpenContests(
  userId: string,
  limit = 6,
): Promise<GameSuggestion[]> {
  const gameKeys = await listInterestedGameKeys(userId);
  if (gameKeys.length === 0) return [];

  const now = new Date();
  const contests = await Competition.find({
    gameKey: { $in: gameKeys },
    status: { $in: ["upcoming", "active"] },
    // Still accepting entrants: start in the future or registration still open.
    $or: [
      { startTime: { $gt: now } },
      { registrationDeadline: { $gt: now } },
    ],
  })
    .select("name entryFee startTime status gameKey")
    .sort({ startTime: 1 })
    .limit(limit)
    .lean<
      Array<{
        _id: { toString(): string };
        name: string;
        entryFee?: number;
        startTime: Date;
        status: string;
        gameKey: string;
      }>
    >();

  return contests.map((c) => ({
    gameKey: c.gameKey,
    competitionId: c._id.toString(),
    name: c.name,
    entryFee: c.entryFee ?? 0,
    startTime: c.startTime,
    status: c.status,
    reason: "played_before" as const,
  }));
}
