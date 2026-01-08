import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ==========================================
// FRIEND REQUEST MODEL
// ==========================================

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface IFriendRequest extends Document {
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  
  toUserId: string;
  toUserName: string;
  toUserAvatar?: string;
  
  status: FriendRequestStatus;
  message?: string; // Optional message with request
  
  respondedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const FriendRequestSchema = new Schema<IFriendRequest>(
  {
    fromUserId: { type: String, required: true, index: true },
    fromUserName: { type: String, required: true },
    fromUserAvatar: { type: String },
    
    toUserId: { type: String, required: true, index: true },
    toUserName: { type: String, required: true },
    toUserAvatar: { type: String },
    
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
      default: 'pending',
      index: true,
    },
    message: { type: String, maxlength: 200 },
    
    respondedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'friend_requests',
  }
);

// Compound indexes
FriendRequestSchema.index({ fromUserId: 1, toUserId: 1, status: 1 });
FriendRequestSchema.index({ toUserId: 1, status: 1, createdAt: -1 });

// Prevent duplicate pending requests
FriendRequestSchema.index(
  { fromUserId: 1, toUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);

// Static methods
FriendRequestSchema.statics.findPendingForUser = function(userId: string) {
  return this.find({
    toUserId: userId,
    status: 'pending',
  }).sort({ createdAt: -1 });
};

FriendRequestSchema.statics.findSentByUser = function(userId: string) {
  return this.find({
    fromUserId: userId,
    status: 'pending',
  }).sort({ createdAt: -1 });
};

FriendRequestSchema.statics.hasPendingRequest = async function(
  fromUserId: string,
  toUserId: string
): Promise<boolean> {
  const request = await this.findOne({
    $or: [
      { fromUserId, toUserId, status: 'pending' },
      { fromUserId: toUserId, toUserId: fromUserId, status: 'pending' },
    ],
  });
  return !!request;
};

interface FriendRequestModel extends Model<IFriendRequest> {
  findPendingForUser(userId: string): Promise<IFriendRequest[]>;
  findSentByUser(userId: string): Promise<IFriendRequest[]>;
  hasPendingRequest(fromUserId: string, toUserId: string): Promise<boolean>;
}

export const FriendRequest = mongoose.models.FriendRequest ||
  mongoose.model<IFriendRequest, FriendRequestModel>('FriendRequest', FriendRequestSchema);

// ==========================================
// FRIENDSHIP MODEL
// ==========================================

export interface IFriendship extends Document {
  users: [string, string]; // Always sorted for consistent lookup
  userDetails: [{
    userId: string;
    userName: string;
    userAvatar?: string;
  }, {
    userId: string;
    userName: string;
    userAvatar?: string;
  }];
  
  // Block status
  blockedBy?: string; // userId who blocked
  blockedAt?: Date;
  
  // Mute status (per user)
  mutedBy: string[]; // userIds who muted this friendship
  
  // Friendship metadata
  startedFromRequestId?: Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    users: {
      type: [String],
      required: true,
      validate: {
        validator: function(v: string[]) {
          return v.length === 2;
        },
        message: 'Friendship must have exactly 2 users',
      },
    },
    userDetails: [{
      userId: { type: String, required: true },
      userName: { type: String, required: true },
      userAvatar: { type: String },
    }],
    
    blockedBy: { type: String },
    blockedAt: { type: Date },
    
    mutedBy: [{ type: String }],
    
    startedFromRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'FriendRequest',
    },
  },
  {
    timestamps: true,
    collection: 'friendships',
  }
);

// Indexes
FriendshipSchema.index({ users: 1 });
FriendshipSchema.index({ 'userDetails.userId': 1 });

// Ensure unique friendship (sorted users)
FriendshipSchema.index({ users: 1 }, { unique: true });

// Pre-save: Sort users array for consistent lookup
FriendshipSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('users')) {
    this.users = this.users.sort() as [string, string];
  }
  next();
});

// Static methods
FriendshipSchema.statics.areFriends = async function(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const sortedUsers = [userId1, userId2].sort();
  const friendship = await this.findOne({
    users: sortedUsers,
    blockedBy: { $exists: false },
  });
  return !!friendship;
};

FriendshipSchema.statics.getFriendship = async function(
  userId1: string,
  userId2: string
): Promise<IFriendship | null> {
  const sortedUsers = [userId1, userId2].sort();
  return this.findOne({ users: sortedUsers });
};

FriendshipSchema.statics.getUserFriends = function(userId: string) {
  return this.find({
    users: userId,
    blockedBy: { $exists: false },
  }).sort({ createdAt: -1 });
};

FriendshipSchema.statics.getBlockedUsers = function(userId: string) {
  return this.find({
    users: userId,
    blockedBy: userId,
  });
};

FriendshipSchema.statics.createFromRequest = async function(
  request: IFriendRequest
): Promise<IFriendship> {
  const sortedUsers = [request.fromUserId, request.toUserId].sort() as [string, string];
  
  return this.create({
    users: sortedUsers,
    userDetails: [
      {
        userId: request.fromUserId,
        userName: request.fromUserName,
        userAvatar: request.fromUserAvatar,
      },
      {
        userId: request.toUserId,
        userName: request.toUserName,
        userAvatar: request.toUserAvatar,
      },
    ],
    startedFromRequestId: request._id,
    mutedBy: [],
  });
};

// Instance methods
FriendshipSchema.methods.block = function(blockedByUserId: string) {
  this.blockedBy = blockedByUserId;
  this.blockedAt = new Date();
  return this.save();
};

FriendshipSchema.methods.unblock = function() {
  this.blockedBy = undefined;
  this.blockedAt = undefined;
  return this.save();
};

FriendshipSchema.methods.mute = function(userId: string) {
  if (!this.mutedBy.includes(userId)) {
    this.mutedBy.push(userId);
  }
  return this.save();
};

FriendshipSchema.methods.unmute = function(userId: string) {
  this.mutedBy = this.mutedBy.filter((id: string) => id !== userId);
  return this.save();
};

FriendshipSchema.methods.getOtherUser = function(userId: string) {
  return this.userDetails.find(
    (u: { userId: string }) => u.userId !== userId
  );
};

interface FriendshipModel extends Model<IFriendship> {
  areFriends(userId1: string, userId2: string): Promise<boolean>;
  getFriendship(userId1: string, userId2: string): Promise<IFriendship | null>;
  getUserFriends(userId: string): Promise<IFriendship[]>;
  getBlockedUsers(userId: string): Promise<IFriendship[]>;
  createFromRequest(request: IFriendRequest): Promise<IFriendship>;
}

export const Friendship = mongoose.models.Friendship ||
  mongoose.model<IFriendship, FriendshipModel>('Friendship', FriendshipSchema);

export default { FriendRequest, Friendship };

