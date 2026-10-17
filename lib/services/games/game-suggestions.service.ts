/**
 * Suggest contests (and only contests) from inferred / declared game interest.
 *
 * X14: inference is not consent. This module never creates a challenge, never
 * notifies a stranger, and never reads willingToBeChallenged as an invitation
 * licence. Matchmaking and challenge create remain separate.
 */
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
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
  /**
   * The contest's own image, then its game's catalogue banner / thumbnail, then
   * the curated plate. Reason: each card must show the artwork that represents
   * that competition and game - a curated plate per game code replaced them once
   * (3 Oct 2026) and the owner reverted it, so the plate is only the last resort.
   */
  artSrc: string;
  /** The competition's own pool, the figure its lobby shows. */
  prizePool: number;
  /**
   * The most that pool can reach: entry fee x seats, same basis as `prizePool`.
   * Reason: the pool grows by one fee per entrant (contest-entry.service), so a
   * contest nobody has joined yet reads 0 and the card said nothing (owner,
   * 3 Oct 2026). Null when the contest is free or has no seat limit, because
   * neither has a ceiling to quote.
   */
  prizePoolMax: number | null;
  currentParticipants: number;
  maxParticipants: number | null;
  /**
   * Short blurb under the contest name — the competition's own description,
   * then the catalogue tagline, then the catalogue description.
   */
  blurb: string;
  visibility: "public" | "gm_private";
  fundingMode: "player_paid" | "gm_funded";
  /** The player already holds a (non-refunded) seat, so the card says "Already In". */
  alreadyIn: boolean;
}

/** Competition ids among `ids` where the player holds a seat that was not refunded. */
async function findJoinedCompetitionIds(userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  // Reason: participant.competitionId is declared String while Competition._id is an
  // ObjectId, so the ids are matched as strings; a refunded seat is no longer "in".
  const seats = await CompetitionParticipant.find({
    userId,
    competitionId: { $in: ids },
    status: { $ne: "refunded" },
  })
    .select("competitionId")
    .lean<Array<{ competitionId: string }>>();
  return new Set(seats.map((s) => String(s.competitionId)));
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
        "name description imageUrl entryFee startTime status gameKey prizePool currentParticipants maxParticipants visibility fundingMode",
      )
      .sort({ startTime: 1 })
      .limit(limit)
      .lean<
        Array<{
          _id: { toString(): string };
          name: string;
          description?: string;
          imageUrl?: string;
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
  // Reason: the badge is decoration - a failed seat lookup must not hide the suggestions.
  const joined = await findJoinedCompetitionIds(
    userId,
    contests.map((c) => c._id.toString()),
  ).catch(() => new Set<string>());

  return contests.map((c) => {
    const cat = byKey.get(c.gameKey);
    const isTrading = c.gameKey === TRADING_GAME_TYPE;
    // Reason: owner, 3 Oct 2026 - the card must read like the competition it
    // opens, so the operator's own wording leads and the game's copy is only
    // the fallback for a contest written without one.
    const blurb =
      (c.description && c.description.trim()) ||
      (cat?.tagline && cat.tagline.trim()) ||
      (cat?.description && cat.description.trim()) ||
      "";
    const prizePool = c.prizePool || 0;
    const entryFee = c.entryFee || 0;
    const seats =
      typeof c.maxParticipants === "number" && c.maxParticipants > 0
        ? c.maxParticipants
        : null;
    const prizePoolMax = entryFee > 0 && seats !== null ? entryFee * seats : null;
    return {
      gameKey: c.gameKey,
      competitionId: c._id.toString(),
      name: c.name,
      entryFee,
      startTime: c.startTime,
      status: c.status,
      reason: "played_before" as const,
      gameLabel: cat?.displayName ?? (isTrading ? "Trading" : "Game"),
      artSrc: c.imageUrl?.trim() || resolvePlayArt(cat, isTrading),
      prizePool,
      prizePoolMax,
      currentParticipants: c.currentParticipants ?? 0,
      maxParticipants: seats,
      blurb: blurb.length > 120 ? `${blurb.slice(0, 117).trimEnd()}…` : blurb,
      // Reason: absent visibility / fundingMode resolve like the rest of the platform
      // (invariant 5 / player-paid default) — never invent gm_private or gm_funded.
      visibility: c.visibility === "gm_private" ? "gm_private" : "public",
      fundingMode: c.fundingMode === "gm_funded" ? "gm_funded" : "player_paid",
      alreadyIn: joined.has(c._id.toString()),
    };
  });
}
