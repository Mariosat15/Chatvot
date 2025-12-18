import { Schema, model, models, Document } from 'mongoose';

/**
 * Position Event Model
 * 
 * Stores real-time position events (TP/SL triggers, manual closes, etc.)
 * Used by SSE endpoint to push instant updates to clients
 * 
 * TTL: Events auto-delete after 60 seconds (they're ephemeral notifications)
 */

export interface IPositionEvent extends Document {
  // Target user for this event
  userId: string;
  
  // Context (competition or challenge)
  competitionId: string; // Can be competition ID or challenge ID
  contestType: 'competition' | 'challenge';
  
  // Position details
  positionId: string;
  symbol: string;
  side: 'long' | 'short';
  
  // Event details
  eventType: 'closed' | 'opened' | 'modified';
  closeReason?: 'user' | 'stop_loss' | 'take_profit' | 'margin_call' | 'competition_end' | 'challenge_end';
  
  // P&L info (for closed positions)
  realizedPnl?: number;
  exitPrice?: number;
  
  // Timing
  createdAt: Date;
  
  // For SSE: track which clients have received this event
  deliveredTo: string[]; // Array of session IDs that have received this
}

const PositionEventSchema = new Schema<IPositionEvent>(
  {
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
  },
  {
    timestamps: false, // We manage createdAt ourselves for TTL
  }
);

// Compound index for efficient queries
PositionEventSchema.index({ userId: 1, competitionId: 1, createdAt: -1 });

// Static method to create a position closed event
PositionEventSchema.statics.createClosedEvent = async function(data: {
  userId: string;
  competitionId: string;
  contestType: 'competition' | 'challenge';
  positionId: string;
  symbol: string;
  side: 'long' | 'short';
  closeReason: string;
  realizedPnl?: number;
  exitPrice?: number;
}) {
  return this.create({
    ...data,
    eventType: 'closed',
    createdAt: new Date(),
  });
};

// Static method to get pending events for a user
PositionEventSchema.statics.getPendingEvents = async function(
  userId: string,
  competitionId: string,
  sessionId: string,
  limit: number = 10
) {
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
    await this.updateMany(
      { _id: { $in: events.map((e: IPositionEvent) => e._id) } },
      { $addToSet: { deliveredTo: sessionId } }
    );
  }

  return events;
};

const PositionEvent = models.PositionEvent || model<IPositionEvent>('PositionEvent', PositionEventSchema);

export default PositionEvent;

