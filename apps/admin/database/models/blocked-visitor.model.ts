import mongoose, { Document, Schema } from "mongoose";

// ─── Interface ──────────────────────────────────────────────────────────────
export interface IBlockedVisitor extends Document {
  type: "ip" | "ip_range" | "user_agent" | "user" | "country";
  value: string;
  reason: string;
  blockedBy: string;
  blockedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  hitCount: number;
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

BlockedVisitorSchema.index({ type: 1, value: 1, isActive: 1 });
BlockedVisitorSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $ne: null } } },
);

const BlockedVisitor =
  (mongoose.models.BlockedVisitor as mongoose.Model<IBlockedVisitor>) ||
  mongoose.model<IBlockedVisitor>("BlockedVisitor", BlockedVisitorSchema);

export default BlockedVisitor;
