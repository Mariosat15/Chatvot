import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * BlockedUser model - for blocking users who are not friends
 * Friendships have their own block functionality in the Friendship model
 */
export interface IBlockedUser extends Document {
  blockerUserId: string;  // The user who blocked
  blockerUserName: string;
  blockedUserId: string;  // The user who is blocked
  blockedUserName: string;
  reason?: string;        // Optional reason for blocking
  createdAt: Date;
  updatedAt: Date;
}

const BlockedUserSchema = new Schema<IBlockedUser>(
  {
    blockerUserId: { type: String, required: true, index: true },
    blockerUserName: { type: String, required: true },
    blockedUserId: { type: String, required: true, index: true },
    blockedUserName: { type: String, required: true },
    reason: { type: String, maxlength: 200 },
  },
  {
    timestamps: true,
    collection: 'blocked_users',
  }
);

// Compound index for efficient lookups
BlockedUserSchema.index({ blockerUserId: 1, blockedUserId: 1 }, { unique: true });

// Static methods
BlockedUserSchema.statics.isBlocked = async function(
  blockerUserId: string,
  blockedUserId: string
): Promise<boolean> {
  const block = await this.findOne({ blockerUserId, blockedUserId });
  return !!block;
};

BlockedUserSchema.statics.isBlockedByEither = async function(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const block = await this.findOne({
    $or: [
      { blockerUserId: userId1, blockedUserId: userId2 },
      { blockerUserId: userId2, blockedUserId: userId1 },
    ],
  });
  return !!block;
};

BlockedUserSchema.statics.getBlockedByUser = function(userId: string) {
  return this.find({ blockerUserId: userId }).sort({ createdAt: -1 });
};

BlockedUserSchema.statics.getBlockersOfUser = function(userId: string) {
  return this.find({ blockedUserId: userId }).sort({ createdAt: -1 });
};

interface BlockedUserModel extends Model<IBlockedUser> {
  isBlocked(blockerUserId: string, blockedUserId: string): Promise<boolean>;
  isBlockedByEither(userId1: string, userId2: string): Promise<boolean>;
  getBlockedByUser(userId: string): Promise<IBlockedUser[]>;
  getBlockersOfUser(userId: string): Promise<IBlockedUser[]>;
}

export const BlockedUser = mongoose.models.BlockedUser ||
  mongoose.model<IBlockedUser, BlockedUserModel>('BlockedUser', BlockedUserSchema);

export default BlockedUser;
