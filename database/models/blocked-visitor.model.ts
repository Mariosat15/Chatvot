import mongoose, { Document, Schema } from "mongoose";

// ─── Interface ──────────────────────────────────────────────────────────────
export interface IBlockedVisitor extends Document {
  /** What is being blocked: ip, user-agent pattern, user ID */
  type: "ip" | "ip_range" | "user_agent" | "user" | "country";
  /** The blocked value (IP address, UA pattern, user ID, or country code) */
  value: string;
  /** Human-readable reason for blocking */
  reason: string;
  /** Who blocked this entity */
  blockedBy: string;
  /** When the block was created */
  blockedAt: Date;
  /** Optional expiry — null means permanent */
  expiresAt?: Date;
  /** Whether this block is currently active */
  isActive: boolean;
  /** How many times this block has been triggered */
  hitCount: number;
  /** Last time this block was triggered */
  lastHitAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ─────────────────────────────────────────────────────────────────
const BlockedVisitorSchema = new Schema<IBlockedVisitor>(
  {
    type: {
      type: String,
      enum: ["ip", "ip_range", "user_agent", "user", "country"],
      required: true,
      index: true,
    },
    value: { type: String, required: true, index: true },
    reason: { type: String, default: "" },
    blockedBy: { type: String, default: "system" },
    blockedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    hitCount: { type: Number, default: 0 },
    lastHitAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Reason: Compound index for fast block lookups during page tracking
BlockedVisitorSchema.index({ type: 1, value: 1, isActive: 1 });

// Reason: TTL index for auto-expiring temporary blocks
BlockedVisitorSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $ne: null } } },
);

const BlockedVisitor =
  (mongoose.models.BlockedVisitor as mongoose.Model<IBlockedVisitor>) ||
  mongoose.model<IBlockedVisitor>("BlockedVisitor", BlockedVisitorSchema);

export default BlockedVisitor;
