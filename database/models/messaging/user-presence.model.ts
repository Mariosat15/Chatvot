import mongoose, { Schema, Document, Model } from 'mongoose';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface IUserPresence extends Document {
  // Can be userId (for users) or adminId (for employees)
  participantId: string;
  participantType: 'user' | 'employee';
  
  status: PresenceStatus;
  lastSeen: Date;
  
  // Typing indicators
  currentlyTypingIn?: string; // conversationId
  typingStartedAt?: Date;
  
  // Device info
  deviceInfo?: {
    platform?: string;
    browser?: string;
    lastIp?: string;
  };
  
  // Custom status message
  customStatus?: string;
  
  // Do not disturb
  doNotDisturb: boolean;
  doNotDisturbUntil?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const UserPresenceSchema = new Schema<IUserPresence>(
  {
    participantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participantType: {
      type: String,
      enum: ['user', 'employee'],
      required: true,
    },
    
    status: {
      type: String,
      enum: ['online', 'away', 'busy', 'offline'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    
    currentlyTypingIn: { type: String },
    typingStartedAt: { type: Date },
    
    deviceInfo: {
      platform: { type: String },
      browser: { type: String },
      lastIp: { type: String },
    },
    
    customStatus: { type: String, maxlength: 100 },
    
    doNotDisturb: { type: Boolean, default: false },
    doNotDisturbUntil: { type: Date },
  },
  {
    timestamps: true,
    collection: 'user_presence',
  }
);

// Auto-expire typing indicator after 5 seconds
UserPresenceSchema.index(
  { typingStartedAt: 1 },
  { expireAfterSeconds: 5, partialFilterExpression: { typingStartedAt: { $exists: true } } }
);

// Static methods
UserPresenceSchema.statics.setOnline = async function(
  participantId: string,
  participantType: 'user' | 'employee',
  deviceInfo?: { platform?: string; browser?: string; lastIp?: string }
) {
  return this.findOneAndUpdate(
    { participantId },
    {
      $set: {
        participantType,
        status: 'online',
        lastSeen: new Date(),
        deviceInfo,
      },
    },
    { upsert: true, new: true }
  );
};

UserPresenceSchema.statics.setOffline = async function(participantId: string) {
  return this.findOneAndUpdate(
    { participantId },
    {
      $set: {
        status: 'offline',
        lastSeen: new Date(),
        currentlyTypingIn: null,
        typingStartedAt: null,
      },
    },
    { new: true }
  );
};

UserPresenceSchema.statics.setTyping = async function(
  participantId: string,
  conversationId: string
) {
  return this.findOneAndUpdate(
    { participantId },
    {
      $set: {
        currentlyTypingIn: conversationId,
        typingStartedAt: new Date(),
        lastSeen: new Date(),
      },
    },
    { new: true }
  );
};

UserPresenceSchema.statics.stopTyping = async function(participantId: string) {
  return this.findOneAndUpdate(
    { participantId },
    {
      $set: {
        currentlyTypingIn: null,
        typingStartedAt: null,
        lastSeen: new Date(),
      },
    },
    { new: true }
  );
};

UserPresenceSchema.statics.getOnlineParticipants = function(participantIds: string[]) {
  return this.find({
    participantId: { $in: participantIds },
    status: { $ne: 'offline' },
  });
};

UserPresenceSchema.statics.getTypingInConversation = function(conversationId: string) {
  const fiveSecondsAgo = new Date(Date.now() - 5000);
  return this.find({
    currentlyTypingIn: conversationId,
    typingStartedAt: { $gte: fiveSecondsAgo },
  });
};

// Heartbeat - call this periodically to maintain online status
UserPresenceSchema.statics.heartbeat = async function(participantId: string) {
  const presence = await this.findOne({ participantId });
  if (presence) {
    presence.lastSeen = new Date();
    if (presence.status === 'offline') {
      presence.status = 'online';
    }
    return presence.save();
  }
  return null;
};

// Mark users as offline if no heartbeat for 2 minutes
UserPresenceSchema.statics.cleanupStalePresences = async function() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  return this.updateMany(
    {
      status: { $ne: 'offline' },
      lastSeen: { $lt: twoMinutesAgo },
    },
    {
      $set: {
        status: 'offline',
        currentlyTypingIn: null,
        typingStartedAt: null,
      },
    }
  );
};

interface UserPresenceModel extends Model<IUserPresence> {
  setOnline(
    participantId: string,
    participantType: 'user' | 'employee',
    deviceInfo?: { platform?: string; browser?: string; lastIp?: string }
  ): Promise<IUserPresence>;
  setOffline(participantId: string): Promise<IUserPresence | null>;
  setTyping(participantId: string, conversationId: string): Promise<IUserPresence | null>;
  stopTyping(participantId: string): Promise<IUserPresence | null>;
  getOnlineParticipants(participantIds: string[]): Promise<IUserPresence[]>;
  getTypingInConversation(conversationId: string): Promise<IUserPresence[]>;
  heartbeat(participantId: string): Promise<IUserPresence | null>;
  cleanupStalePresences(): Promise<any>;
}

export const UserPresence = mongoose.models.UserPresence ||
  mongoose.model<IUserPresence, UserPresenceModel>('UserPresence', UserPresenceSchema);

export default UserPresence;

