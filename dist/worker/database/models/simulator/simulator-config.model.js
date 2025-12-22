"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const SimulatorConfigSchema = new mongoose_1.Schema({
    name: { type: String, required: true, default: 'Default Configuration' },
    description: String,
    scale: {
        type: String,
        enum: ['small', 'medium', 'large', 'custom'],
        default: 'small'
    },
    virtualUsers: { type: Number, default: 100 },
    userRegistrationRate: { type: Number, default: 10 },
    competitions: { type: Number, default: 5 },
    competitionTypes: {
        type: [String],
        default: ['standard', 'knockout', 'tournament', 'league']
    },
    tradersPerCompetition: { type: Number, default: 20 },
    challenges: { type: Number, default: 50 },
    challengeStakes: { type: [Number], default: [10, 25, 50, 100] },
    tradesPerUser: { type: Number, default: 10 },
    tradingDuration: { type: Number, default: 30 },
    tpSlPercentage: { type: Number, default: 70 },
    simulateAdminActions: { type: Boolean, default: true },
    paymentApprovalDelay: { type: Number, default: 5 },
    simulateFraud: { type: Boolean, default: true },
    fraudPercentage: { type: Number, default: 5 },
    useTestDatabase: { type: Boolean, default: false },
    testDatabaseUri: String,
    enableHardwareStress: { type: Boolean, default: false },
    cpuStressLevel: { type: Number, default: 5, min: 1, max: 10 },
    memoryStressLevel: { type: Number, default: 5, min: 1, max: 10 },
    useAIPatterns: { type: Boolean, default: true },
    useAIAnalysis: { type: Boolean, default: true },
    presets: {
        type: Object,
        default: {
            small: { users: 100, competitions: 5, challenges: 50, trades: 1000 },
            medium: { users: 1000, competitions: 20, challenges: 500, trades: 50000 },
            large: { users: 10000, competitions: 100, challenges: 5000, trades: 1000000 },
        }
    },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});
const SimulatorConfig = (mongoose_1.models.SimulatorConfig || (0, mongoose_1.model)('SimulatorConfig', SimulatorConfigSchema));
exports.default = SimulatorConfig;
