"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTieBreakerDescription = exports.getRankingMethodDescription = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CompetitionRulesSchema = new mongoose_1.Schema({
    rankingMethod: {
        type: String,
        enum: ['pnl', 'roi', 'total_capital', 'win_rate', 'total_wins', 'profit_factor'],
        required: true,
        default: 'pnl',
    },
    rankingDescription: {
        type: String,
        default: 'Highest Profit/Loss wins',
    },
    tieBreaker1: {
        type: String,
        enum: ['trades_count', 'win_rate', 'total_capital', 'roi', 'join_time', 'split_prize'],
        required: true,
        default: 'trades_count',
    },
    tieBreaker2: {
        type: String,
        enum: ['trades_count', 'win_rate', 'total_capital', 'roi', 'join_time', 'split_prize'],
    },
    tieBreaker3: {
        type: String,
        enum: ['trades_count', 'win_rate', 'total_capital', 'roi', 'join_time', 'split_prize'],
    },
    minimumTrades: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    minimumWinRate: {
        type: Number,
        min: 0,
        max: 100,
    },
    minimumPnl: {
        type: Number,
    },
    tiePrizeDistribution: {
        type: String,
        enum: ['split_equally', 'split_weighted', 'first_gets_all', 'higher_rank_gets_more'],
        required: true,
        default: 'split_equally',
    },
    disqualifyOnLiquidation: {
        type: Boolean,
        required: true,
        default: true,
    },
    requireAllPositionsClosed: {
        type: Boolean,
        required: true,
        default: false,
    },
}, {
    timestamps: true,
});
const CompetitionRules = mongoose_1.default.models?.CompetitionRules ||
    mongoose_1.default.model('CompetitionRules', CompetitionRulesSchema);
exports.default = CompetitionRules;
// Helper function to get ranking descriptions
const getRankingMethodDescription = (method) => {
    const descriptions = {
        pnl: 'Highest Profit/Loss (P&L) wins',
        roi: 'Highest Return on Investment (ROI %) wins',
        total_capital: 'Highest Total Capital (Balance + P&L) wins',
        win_rate: 'Highest Win Rate % wins',
        total_wins: 'Most Winning Trades wins',
        profit_factor: 'Best Profit Factor (Total Wins / Total Losses) wins',
    };
    return descriptions[method] || 'Custom ranking';
};
exports.getRankingMethodDescription = getRankingMethodDescription;
// Helper function to get tiebreaker descriptions
const getTieBreakerDescription = (tieBreaker) => {
    const descriptions = {
        trades_count: 'Fewer trades (more efficient)',
        win_rate: 'Higher win rate',
        total_capital: 'Higher total capital',
        roi: 'Higher ROI %',
        join_time: 'Who joined first',
        split_prize: 'Split prize equally',
    };
    return descriptions[tieBreaker] || tieBreaker;
};
exports.getTieBreakerDescription = getTieBreakerDescription;
