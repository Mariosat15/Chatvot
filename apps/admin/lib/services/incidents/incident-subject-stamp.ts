/**
 * Decide what an incident is about from the ids that were stored, not from a label
 * the caller would rather it had.
 *
 * A round may also name its contest. A contest and a challenge together are two
 * subjects, and that is refused rather than letting one win.
 */

import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import GameRound from "@/database/models/games/game-round.model";
import type { IncidentSubjectKind } from "@/lib/admin/incident-actions";

export interface StampedIncidentSubject {
  subjectType: IncidentSubjectKind;
  competitionId?: string;
  challengeId?: string;
  roundId?: string;
  gameKey?: string;
}

function asId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function stampIncidentSubject(input: {
  competitionId?: unknown;
  challengeId?: unknown;
  roundId?: unknown;
  subjectType?: unknown;
  gameKey?: unknown;
}): Promise<
  { ok: true; subject: StampedIncidentSubject } | { ok: false; error: string }
> {
  await connectToDatabase();
  const competitionId = asId(input.competitionId);
  const challengeId = asId(input.challengeId);
  const roundId = asId(input.roundId);
  const requestedType = asId(input.subjectType);
  const requestedKey = asId(input.gameKey);

  if (competitionId && challengeId) {
    return {
      ok: false,
      error: "An incident can name a contest or a challenge, not both.",
    };
  }

  let subject: StampedIncidentSubject;

  if (roundId) {
    const round = await GameRound.findOne({ roundId })
      .select("gameKey contestId")
      .lean<{ gameKey?: string; contestId?: unknown } | null>();
    if (!round) {
      return { ok: false, error: "No round with that id." };
    }
    const contestOnRound = round.contestId ? String(round.contestId) : undefined;
    if (competitionId && contestOnRound && competitionId !== contestOnRound) {
      return {
        ok: false,
        error: "That round does not belong to the contest named on the incident.",
      };
    }
    subject = {
      subjectType: "round",
      roundId,
      competitionId: competitionId || contestOnRound,
      gameKey: round.gameKey,
    };
  } else if (challengeId) {
    const challenge = await Challenge.findById(challengeId)
      .select("gameKey")
      .lean<{ gameKey?: string } | null>();
    if (!challenge) {
      return { ok: false, error: "No challenge with that id." };
    }
    subject = { subjectType: "challenge", challengeId, gameKey: challenge.gameKey };
  } else if (competitionId) {
    const contest = await Competition.findById(competitionId)
      .select("gameKey")
      .lean<{ gameKey?: string } | null>();
    if (!contest) {
      return { ok: false, error: "No contest with that id." };
    }
    subject = {
      subjectType: "competition",
      competitionId,
      gameKey: contest.gameKey,
    };
  } else {
    subject = { subjectType: "system" };
  }

  if (requestedType && requestedType !== subject.subjectType) {
    return {
      ok: false,
      error: `This incident is a ${subject.subjectType}, not a ${requestedType}.`,
    };
  }
  if (requestedKey && subject.gameKey && requestedKey !== subject.gameKey) {
    return {
      ok: false,
      error: "The game key does not match the subject.",
    };
  }

  return { ok: true, subject };
}
