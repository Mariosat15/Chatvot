"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const PositionEventSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    competitionId: {
        type: String,
        required: true,
        index: true,
    },
    contestType: {
        type: String,
        required: true,
        enum: ['competition', 'challenge'],
    },
    positionId: {
        type: String,
        required: true,
    },
    symbol: {
        type: String,
        required: true,
    },
    side: {
        type: String,
        required: true,
        enum: ['long', 'short'],
    },
    eventType: {
        type: String,
        required: true,
        enum: ['closed', 'opened', 'modified'],
    },
    closeReason: {
        type: String,
        enum: ['user', 'stop_loss', 'take_profit', 'margin_call', 'competition_end', 'challenge_end'],
    },
    realizedPnl: Number,
    exitPrice: Number,
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60, // TTL: Auto-delete after 60 seconds
    },
    deliveredTo: {
        type: [String],
        default: [],
    },
}, {
    timestamps: false, // We manage createdAt ourselves for TTL
});
// Compound index for efficient queries
PositionEventSchema.index({ userId: 1, competitionId: 1, createdAt: -1 });
// Static method to create a position closed event
PositionEventSchema.statics.createClosedEvent = async function (data) {
    return this.create({
        ...data,
        eventType: 'closed',
        createdAt: new Date(),
    });
};
// Static method to get pending events for a user
PositionEventSchema.statics.getPendingEvents = async function (userId, competitionId, sessionId, limit = 10) {
    // Find events not yet delivered to this session
    const events = await this.find({
        userId,
        competitionId,
        deliveredTo: { $ne: sessionId },
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    // Mark as delivered
    if (events.length > 0) {
        await this.updateMany({ _id: { $in: events.map((e) => e._id) } }, { $addToSet: { deliveredTo: sessionId } });
    }
    return events;
};
const PositionEvent = mongoose_1.models.PositionEvent || (0, mongoose_1.model)('PositionEvent', PositionEventSchema);
exports.default = PositionEvent;
//# sourceMappingURL=position-event.model.js.map