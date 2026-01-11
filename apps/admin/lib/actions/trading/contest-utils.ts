'use server';

import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import Challenge from '@/database/models/trading/challenge.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';

export type ContestType = 'competition' | 'challenge';

export interface ContestData {
  type: ContestType;
  contest: any;
  participant: any;
  // Normalized fields for trading logic
  status: string;
  leverage: {
    enabled: boolean;
    min?: number;
    max: number;
  };
  maxPositionSize: number;
  maxOpenPositions: number;
  allowShortSelling: boolean;
  marginCallThreshold: number;
  riskLimits?: {
    enabled: boolean;
    maxDrawdownPercent?: number;
    dailyLossLimitPercent?: number;
    dailyLossLimitEnabled?: boolean;
  };
  startingCapital: number;
  assetClasses: string[];
}

/**
 * Get contest (competition or challenge) and participant data
 * First tries to find a competition, then falls back to challenge
 */
export async function getContestAndParticipant(
  contestId: string,
  userId: string
): Promise<ContestData | null> {
  await connectToDatabase();

  // Try competition first
  const competition = await Competition.findById(contestId).lean() as any;
  if (competition) {
    const participant = await CompetitionParticipant.findOne({
      competitionId: contestId,
      userId,
    }).lean();

    if (!participant) {
      return null;
    }

    return {
      type: 'competition',
      contest: competition,
      participant,
      status: competition.status,
      leverage: {
        enabled: competition.leverage?.enabled ?? false,
        min: competition.leverage?.min || 1,
        max: competition.leverage?.max || competition.leverageAllowed || 100,
      },
      maxPositionSize: competition.maxPositionSize || 100,
      maxOpenPositions: competition.maxOpenPositions || 10,
      allowShortSelling: competition.allowShortSelling ?? true,
      marginCallThreshold: competition.marginCallThreshold || 50,
      riskLimits: competition.riskLimits,
      startingCapital: competition.startingCapital,
      assetClasses: competition.assetClasses || ['forex'],
    };
  }

  // Try challenge
  const challenge = await Challenge.findById(contestId).lean() as any;
  if (challenge) {
    const participant = await ChallengeParticipant.findOne({
      challengeId: contestId,
      userId,
    }).lean();

    if (!participant) {
      return null;
    }

    return {
      type: 'challenge',
      contest: challenge,
      participant,
      status: challenge.status,
      leverage: {
        enabled: challenge.leverage?.enabled ?? false,
        min: challenge.leverage?.min || 1,
        max: challenge.leverage?.max || 100,
      },
      maxPositionSize: challenge.maxPositionSize || 100,
      maxOpenPositions: challenge.maxOpenPositions || 10,
      allowShortSelling: challenge.allowShortSelling ?? true,
      marginCallThreshold: challenge.marginCallThreshold || 50,
      riskLimits: {
        enabled: false, // Challenges don't have risk limits for now
      },
      startingCapital: challenge.startingCapital,
      assetClasses: challenge.assetClasses || ['forex'],
    };
  }

  return null;
}

/**
 * Update participant stats after a trade
 * Works for both competition and challenge participants
 */
export async function updateParticipantStats(
  contestId: string,
  userId: string,
  updates: Record<string, any>
): Promise<boolean> {
  await connectToDatabase();

  // Try competition participant first
  const competitionParticipant = await CompetitionParticipant.findOneAndUpdate(
    { competitionId: contestId, userId },
    updates,
    { new: true }
  );

  if (competitionParticipant) {
    return true;
  }

  // Try challenge participant
  const challengeParticipant = await ChallengeParticipant.findOneAndUpdate(
    { challengeId: contestId, userId },
    updates,
    { new: true }
  );

  return !!challengeParticipant;
}

/**
 * Get participant for a contest
 */
export async function getParticipant(
  contestId: string,
  userId: string
): Promise<{ type: ContestType; participant: any } | null> {
  await connectToDatabase();

  // Try competition participant first
  const competitionParticipant = await CompetitionParticipant.findOne({
    competitionId: contestId,
    userId,
  }).lean();

  if (competitionParticipant) {
    return { type: 'competition', participant: competitionParticipant };
  }

  // Try challenge participant
  const challengeParticipant = await ChallengeParticipant.findOne({
    challengeId: contestId,
    userId,
  }).lean();

  if (challengeParticipant) {
    return { type: 'challenge', participant: challengeParticipant };
  }

  return null;
}

/**
 * Get the participant model based on contest type
 */
export async function getParticipantModel(type: ContestType) {
  return type === 'competition' ? CompetitionParticipant : ChallengeParticipant;
}

/**
 * Get the ID field name for the participant based on contest type
 */
export async function getContestIdField(type: ContestType): Promise<string> {
  return type === 'competition' ? 'competitionId' : 'challengeId';
}

