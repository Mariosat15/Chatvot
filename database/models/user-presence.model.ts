import { Schema, model, models, Document } from 'mongoose';

// User online/offline presence tracking
export interface IUserPresence extends Document {
  userId: string;
  username: string;
  
  // Status
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  lastHeartbeat: Date;
  
  // Activity
  currentPage?: string; // Current page/route
  isInCompetition: boolean;
  activeCompetitionId?: string;
  isInChallenge: boolean;
  activeChallengeId?: string;
  
  // Challenge availability
  acceptingChallenges: boolean; // User toggle to accept/decline challenges
  
  // Stats
  totalOnlineTime: number; // Total time online in minutes
  sessionsToday: number;
  
  // Connection info
  socketId?: string;
  userAgent?: string;
  ipAddress?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const UserPresenceSchema = new Schema<IUserPresence>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['online', 'away', 'offline'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastHeartbeat: {
      type: Date,
      required: true,
      default: Date.now,
    },
    currentPage: {
      type: String,
    },
    isInCompetition: {
      type: Boolean,
      required: true,
      default: false,
    },
    activeCompetitionId: {
      type: String,
    },
    isInChallenge: {
      type: Boolean,
      required: true,
      default: false,
    },
    activeChallengeId: {
      type: String,
    },
    acceptingChallenges: {
      type: Boolean,
      required: true,
      default: true,
    },
    totalOnlineTime: {
      type: Number,
      required: true,
      default: 0,
    },
    sessionsToday: {
      type: Number,
      required: true,
      default: 0,
    },
    socketId: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserPresenceSchema.index({ status: 1 });
UserPresenceSchema.index({ lastHeartbeat: 1 });
UserPresenceSchema.index({ status: 1, acceptingChallenges: 1 });

// Static method to update heartbeat and check for stale sessions
UserPresenceSchema.statics.updateHeartbeat = async function (
  userId: string,
  data?: Partial<IUserPresence>
) {
  const now = new Date();
  return this.findOneAndUpdate(
    { userId },
    {
      $set: {
        lastHeartbeat: now,
        lastSeen: now,
        status: 'online',
        ...data,
      },
    },
    { upsert: true, new: true }
  );
};

// Static method to mark stale sessions as offline
UserPresenceSchema.statics.markStaleAsOffline = async function (
  staleThresholdMinutes: number = 2
) {
  const threshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
  return this.updateMany(
    {
      status: { $ne: 'offline' },
      lastHeartbeat: { $lt: threshold },
    },
    {
      $set: { status: 'offline' },
    }
  );
};

// Static method to get online users who accept challenges
UserPresenceSchema.statics.getChallengeable = async function () {
  const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes
  return this.find({
    status: 'online',
    acceptingChallenges: true,
    lastHeartbeat: { $gte: threshold },
  }).lean();
};

const UserPresence =
  models?.UserPresence || model<IUserPresence>('UserPresence', UserPresenceSchema);

export default UserPresence;

