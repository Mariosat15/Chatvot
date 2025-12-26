'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContestAndParticipant = getContestAndParticipant;
exports.updateParticipantStats = updateParticipantStats;
exports.getParticipant = getParticipant;
exports.getParticipantModel = getParticipantModel;
exports.getContestIdField = getContestIdField;
const mongoose_1 = require("@/database/mongoose");
const competition_model_1 = __importDefault(require("@/database/models/trading/competition.model"));
const challenge_model_1 = __importDefault(require("@/database/models/trading/challenge.model"));
const competition_participant_model_1 = __importDefault(require("@/database/models/trading/competition-participant.model"));
const challenge_participant_model_1 = __importDefault(require("@/database/models/trading/challenge-participant.model"));
/**
 * Get contest (competition or challenge) and participant data
 * First tries to find a competition, then falls back to challenge
 */
async function getContestAndParticipant(contestId, userId) {
    await (0, mongoose_1.connectToDatabase)();
    // Try competition first
    const competition = await competition_model_1.default.findById(contestId).lean();
    if (competition) {
        const participant = await competition_participant_model_1.default.findOne({
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
    const challenge = await challenge_model_1.default.findById(contestId).lean();
    if (challenge) {
        const participant = await challenge_participant_model_1.default.findOne({
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
async function updateParticipantStats(contestId, userId, updates) {
    await (0, mongoose_1.connectToDatabase)();
    // Try competition participant first
    const competitionParticipant = await competition_participant_model_1.default.findOneAndUpdate({ competitionId: contestId, userId }, updates, { new: true });
    if (competitionParticipant) {
        return true;
    }
    // Try challenge participant
    const challengeParticipant = await challenge_participant_model_1.default.findOneAndUpdate({ challengeId: contestId, userId }, updates, { new: true });
    return !!challengeParticipant;
}
/**
 * Get participant for a contest
 */
async function getParticipant(contestId, userId) {
    await (0, mongoose_1.connectToDatabase)();
    // Try competition participant first
    const competitionParticipant = await competition_participant_model_1.default.findOne({
        competitionId: contestId,
        userId,
    }).lean();
    if (competitionParticipant) {
        return { type: 'competition', participant: competitionParticipant };
    }
    // Try challenge participant
    const challengeParticipant = await challenge_participant_model_1.default.findOne({
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
async function getParticipantModel(type) {
    return type === 'competition' ? competition_participant_model_1.default : challenge_participant_model_1.default;
}
/**
 * Get the ID field name for the participant based on contest type
 */
async function getContestIdField(type) {
    return type === 'competition' ? 'competitionId' : 'challengeId';
}
