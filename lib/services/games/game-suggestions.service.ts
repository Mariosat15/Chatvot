/**
 * Suggest contests (and only contests) from inferred / declared game interest.
 *
 * X14: inference is not consent. This module never creates a challenge, never
 * notifies a stranger, and never reads willingToBeChallenged as an invitation
 * licence. Matchmaking and challenge create remain separate.
 */
import Competition from "@/database/models/trading/competition.model";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import { listInterestedGameKeys } from "@/lib/services/games/interest-inference.service";
import {
  listBrowsableGames,
  type BrowsableGame,
} from "@/lib/services/games/player-catalogue.service";
import { resolvePlayArt } from "@/lib/services/games/overview-standing.service";
import { resolveContestViewer } from "@/lib/services/gamemaster/contest-viewer.service";
import { withEnterableContests } from "@/lib/services/gamemaster/visible-contests";

export interface GameSuggestion {
  gameKey: string;
  competitionId: string;
  name: string;
  entryFee: number;
  startTime: Date;
  status: string;
  reason: "played_before" | "declared_interest";
  /** Catalogue display name of the game, so the card can say what it is. */
  gameLabel: string;
  /** Same artwork the "Play by game" strip uses for this title. */
  artSrc: string;
  prizePool: number;
  currentParticipants: number;
  maxParticipants: number | null;
  /** Short blurb under the contest name — catalogue tagline, then description. */
  blurb: string;
  visibility: "public" | "gm_private";
  fundingMode: "player_paid" | "gm_funded";
}

export async function suggestOpenContests(
  userId: string,
  limit = 6,
): Promise<GameSuggestion[]> {
  const gameKeys = await listInterestedGameKeys(userId);
  if (gameKeys.length === 0) return [];

  const now = new Date();
  // Reason: a suggestion is an invitation, not a listing - a private Game Master contest is
  // suggested only to that GM's affiliates, even though the lists now show it to everyone
  // (owner decision 30 Sep 2026). Suggesting a contest the player can never enter, e.g. one
  // run by a Game Master other than theirs (D1), is noise. `$and`, never a spread: this query
  // has its own `$or`, which a spread would silently overwrite.
  const viewer = await resolveContestViewer(userId);
  const [contests, catalogue] = await Promise.all([
    Competition.find(
      withEnterableContests(
        {
          gameKey: { $in: gameKeys },
          status: { $in: ["upcoming", "active"] },
          // Still accepting entrants: start in the future or registration still open.
          $or: [
            { startTime: { $gt: now } },
            { registrationDeadline: { $gt: now } },
          ],
        },
        viewer,
      ),
    )
      .select(
        "name description entryFee startTime status gameKey prizePool currentParticipants maxParticipants visibility fundingMode",
      )
      .sort({ startTime: 1 })
      .limit(limit)
      .lean<
        Array<{
          _id: { toString(): string };
          name: string;
          description?: string;
          entryFee?: number;
          startTime: Date;
          status: string;
          gameKey: string;
          prizePool?: number;
          currentParticipants?: number;
          maxParticipants?: number;
          visibility?: "public" | "gm_private";
          fundingMode?: "player_paid" | "gm_funded";
        }>
      >(),
    // Reason: artwork is decoration - a catalogue failure must not hide the suggestions.
    listBrowsableGames().catch(() => [] as BrowsableGame[]),
  ]);

  const byKey = new Map(catalogue.map((g) => [g.gameKey, g]));

  return contests.map((c) => {
    const cat = byKey.get(c.gameKey);
    const isTrading = c.gameKey === TRADING_GAME_TYPE;
    const blurb =
      (cat?.tagline && cat.tagline.trim()) ||
      (c.description && c.description.trim()) ||
      (cat?.description && cat.description.trim()) ||
      "";
    return {
      gameKey: c.gameKey,
      competitionId: c._id.toString(),
      name: c.name,
      entryFee: c.entryFee ?? 0,
      startTime: c.startTime,
      status: c.status,
      reason: "played_before" as const,
      gameLabel: cat?.displayName ?? (isTrading ? "Trading" : "Game"),
      artSrc: resolvePlayArt(cat, isTrading),
      prizePool: c.prizePool ?? 0,
      currentParticipants: c.currentParticipants ?? 0,
      maxParticipants:
        typeof c.maxParticipants === "number" && c.maxParticipants > 0
          ? c.maxParticipants
          : null,
      blurb: blurb.length > 120 ? `${blurb.slice(0, 117).trimEnd()}…` : blurb,
      // Reason: absent visibility / fundingMode resolve like the rest of the platform
      // (invariant 5 / player-paid default) — never invent gm_private or gm_funded.
      visibility: c.visibility === "gm_private" ? "gm_private" : "public",
      fundingMode: c.fundingMode === "gm_funded" ? "gm_funded" : "player_paid",
    };
  });
}
