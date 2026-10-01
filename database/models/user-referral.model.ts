import { Schema, model, models, Document } from "mongoose";

/**
 * User Referral Model
 * Tracks which users were referred by which Game Master
 */

/**
 * How a player came to be affiliated. Stored permanently and never rewritten
 * (`External game plans/24` s2.1). Add-only enum.
 */
// Reason: `admin_assigned` (task 4, 1 Oct 2026) records a player moved by an audited admin
// reassignment - neither of the two player-driven channels describes how they got here.
export const AFFILIATION_SOURCES = [
  "gm_referral_link",
  "chartvolt_join_gm",
  "admin_assigned",
] as const;
export type AffiliationSource = (typeof AFFILIATION_SOURCES)[number];

export const AFFILIATION_SURFACES = [
  "leaderboard",
  "private_contest",
  "gm_profile",
  "signup",
  "admin",
] as const;
export type AffiliationSurface = (typeof AFFILIATION_SURFACES)[number];

export const AFFILIATION_END_REASONS = [
  "gm_expired",
  "gm_deleted",
  "admin_reassigned",
  // Reason: an admin may end an affiliation without moving the player anywhere (task 4).
  "admin_detached",
] as const;
export type AffiliationEndReason = (typeof AFFILIATION_END_REASONS)[number];

export interface IUserReferral extends Document {
  userId: string; // The user who was referred (Better Auth user ID)
  userEmail: string; // Cached email
  userName?: string; // Cached name

  gameMasterId: string; // The Game Master who referred them
  gameMasterEmail: string; // Cached GM email
  referralCode: string; // The code that was used

  // Attribution
  referredAt: Date; // When they signed up
  signupIP?: string; // IP at signup (for fraud detection)
  signupUserAgent?: string; // Browser info (for fraud detection)

  // Gamemaster Program v2 attribution (s2.1). Optional on the type because rows written
  // before 30 Sep 2026 carry none until `tools/gamemaster/backfill-affiliation-source.ts`.
  source?: AffiliationSource;
  termsAcceptanceId?: string;
  termsSlug?: string;
  termsVersion?: string;
  affiliatedVia?: {
    competitionId?: string;
    surface?: AffiliationSurface;
  };
  endedAt?: Date;
  endedReason?: AffiliationEndReason;

  // Activity tracking
  isActive: boolean; // Is the referred user still active?
  lastActivityAt?: Date; // Last time they participated in competition/challenge
  totalEntryFees: number; // Total entry fees this user has paid
  totalGMEarnings: number; // Total earnings generated for their GM
  competitionsEntered: number; // Number of competitions entered
  challengesEntered: number; // Number of challenges entered

  createdAt: Date;
  updatedAt: Date;
}

const UserReferralSchema = new Schema<IUserReferral>(
  {
    // Reason: NOT `unique` any more (owner decision D4, 30 Sep 2026). A player whose Game
    // Master expired or was deleted may join a new one, which needs a second row once the
    // first is inactive. The one-ACTIVE-row guarantee is the partial unique index below.
    // Deliberately carries no field-level `index` either: that would ask for a plain index
    // named `userId_1`, which on every existing database is already taken by the old UNIQUE
    // index, and Mongoose would fail to build it on startup. The lookup index below has a
    // different key pattern so it can coexist with the old one until the migration drops it.
    userId: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
    },
    gameMasterId: {
      type: String,
      required: true,
      index: true,
    },
    gameMasterEmail: {
      type: String,
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
      index: true,
    },
    referredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    signupIP: String,
    signupUserAgent: String,
    // Reason: NO schema default and not `required`. A default would stamp the same value on
    // every legacy row the moment it is hydrated, making "nobody recorded how" identical to
    // a recorded answer; `required` would make every `save()` of a legacy row fail
    // validation. Every writer sets it explicitly and the backfill fills the past.
    source: {
      type: String,
      enum: AFFILIATION_SOURCES,
    },
    termsAcceptanceId: String,
    termsSlug: String,
    termsVersion: String,
    affiliatedVia: {
      competitionId: String,
      surface: {
        type: String,
        enum: AFFILIATION_SURFACES,
      },
    },
    endedAt: Date,
    endedReason: {
      type: String,
      enum: AFFILIATION_END_REASONS,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    lastActivityAt: Date,
    totalEntryFees: {
      type: Number,
      required: true,
      default: 0,
    },
    totalGMEarnings: {
      type: Number,
      required: true,
      default: 0,
    },
    competitionsEntered: {
      type: Number,
      required: true,
      default: 0,
    },
    challengesEntered: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common queries
UserReferralSchema.index({ gameMasterId: 1, referredAt: -1 }); // GM's referred users sorted by date
UserReferralSchema.index({ gameMasterId: 1, isActive: 1 }); // GM's active referred users
UserReferralSchema.index({ gameMasterId: 1, totalGMEarnings: -1 }); // GM's top earners

/**
 * The double-affiliation guard: at most ONE active row per player (R119).
 *
 * Keyed `{ userId, isActive }` rather than `{ userId }` so its key pattern differs from the
 * old unique `userId_1` and the two can coexist during the migration - the new guard is
 * built first, the old one dropped after (`tools/gamemaster/backfill-affiliation-source.ts`).
 * The partial filter uses `isActive: true` (an equality), which MongoDB permits; `$ne` is
 * forbidden in a `partialFilterExpression`.
 */
export const ACTIVE_REFERRAL_INDEX_NAME = "userId_active_unique";
UserReferralSchema.index(
  { userId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: ACTIVE_REFERRAL_INDEX_NAME,
  },
);
// Lookup by player (and their history, newest first) - replaces the old `userId_1`.
UserReferralSchema.index({ userId: 1, referredAt: -1 });

const UserReferral =
  models?.UserReferral ||
  model<IUserReferral>("UserReferral", UserReferralSchema);

export default UserReferral;
