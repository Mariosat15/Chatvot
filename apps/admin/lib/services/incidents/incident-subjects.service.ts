/**
 * The one producer for the live-operations board.
 *
 * Trading contests, game contests, challenges and rounds that still need a decision
 * are read here and nowhere else the hub renders. The act route re-reads the stored
 * document before it will do anything, so this list is a view, not a permission.
 */

import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";
import { listRoundsNeedingAttention } from "@/lib/services/games/round-resolution.service";

export interface IncidentSubjectRow {
  kind: "competition" | "challenge" | "round";
  id: string;
  name: string;
  status: string;
  badge: string;
  problem: string;
  gameKey?: string;
  isPaused: boolean;
  isProviderGame: boolean;
  contestId?: string;
}

const BOARD_LIMIT = 40;

export async function listIncidentSubjects(): Promise<IncidentSubjectRow[]> {
  await connectToDatabase();

  const contests = await Competition.find({
    status: { $in: ["active", "upcoming"] },
  })
    .select("name status gameType gameKey isPaused")
    .sort({ startTime: 1 })
    .limit(BOARD_LIMIT)
    .lean<
      Array<{
        _id: unknown;
        name?: string;
        status?: string;
        gameType?: string;
        gameKey?: string;
        isPaused?: boolean;
      }>
    >();

  const providerKeys = contests
    .filter((row) => hasProviderGameLabel(row))
    .map((row) => row.gameKey)
    .filter((key): key is string => Boolean(key));

  const titles = providerKeys.length
    ? await ProviderGame.find({ gameKey: { $in: providerKeys } })
        .select("gameKey displayName")
        .lean<Array<{ gameKey: string; displayName?: string }>>()
    : [];
  const titleByKey = new Map(
    titles.map((title) => [title.gameKey, title.displayName || title.gameKey]),
  );

  const contestRows: IncidentSubjectRow[] = contests.map((row) => {
    const isProviderGame = hasProviderGameLabel(row);
    const gameName = row.gameKey ? titleByKey.get(row.gameKey) : undefined;
    const paused = row.isPaused === true;
    const status = row.status ?? "";
    let problem = status === "upcoming" ? "Has not started." : "Live.";
    if (paused) {
      problem = isProviderGame
        ? "Paused. New rounds cannot be started until it is resumed."
        : "Paused. New orders cannot be placed until it is resumed.";
    }
    return {
      kind: "competition",
      id: String(row._id),
      name: row.name || "Untitled contest",
      status,
      badge: isProviderGame
        ? `Game contest · ${gameName || row.gameKey || "provider"}`
        : "Trading contest",
      problem,
      gameKey: row.gameKey,
      isPaused: paused,
      isProviderGame,
    };
  });

  const challenges = await Challenge.find({
    status: { $in: ["pending", "accepted", "active"] },
  })
    .select("status challengerName challengedName openToAnyone gameType gameKey")
    .sort({ createdAt: -1 })
    .limit(BOARD_LIMIT)
    .lean<
      Array<{
        _id: unknown;
        status?: string;
        challengerName?: string;
        challengedName?: string;
        openToAnyone?: boolean;
        gameType?: string;
        gameKey?: string;
      }>
    >();

  const challengeRows: IncidentSubjectRow[] = challenges.map((row) => {
    const opponent = row.openToAnyone && !row.challengedName
      ? "anyone"
      : row.challengedName || "opponent";
    const status = row.status ?? "";
    const problem =
      status === "pending"
        ? "Waiting to be accepted."
        : "In progress.";
    const isProviderGame = hasProviderGameLabel(row);
    return {
      kind: "challenge",
      id: String(row._id),
      name: `${row.challengerName || "Player"} vs ${opponent}`,
      status,
      badge: isProviderGame ? "Game challenge" : "Challenge",
      problem,
      gameKey: row.gameKey,
      isPaused: false,
      isProviderGame,
    };
  });

  const rounds = await listRoundsNeedingAttention(BOARD_LIMIT);
  const roundRows: IncidentSubjectRow[] = rounds.map((row) => ({
    kind: "round",
    id: row.roundId,
    name: row.contestName
      ? `${row.contestName} · ${row.roundId}`
      : row.roundId,
    status: row.status,
    badge: "Round",
    problem:
      row.status === "unresolved"
        ? row.holdingSettlement
          ? "Unresolved, and it is holding settlement."
          : "Unresolved. It needs a decision before it can be ignored."
        : "Still open past its expiry.",
    gameKey: row.gameKey,
    isPaused: false,
    isProviderGame: true,
    contestId: row.contestId,
  }));

  return [...contestRows, ...challengeRows, ...roundRows];
}
