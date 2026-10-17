import { Schema, model, models, Document } from "mongoose";

export type RestrictionType = "banned" | "suspended";
export type RestrictionReason =
  | "multi_accounting"
  | "fraud"
  | "fraud_detected"
  | "terms_violation"
  | "payment_fraud"
  | "suspicious_activity"
  | "admin_decision"
  | "automated_fraud_detection"
  | "kyc_failed"
  | "kyc_fraud"
  | "other";

export interface IUserRestriction extends Document {
  userId: string;

  // Restriction details
  restrictionType: RestrictionType;
  reason: RestrictionReason;
  customReason?: string; // Admin's custom explanation

  // What actions are blocked
  canTrade: boolean;
  canEnterCompetitions: boolean;
  canEnterChallenges: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;

  // Visibility — when true, user is hidden from leaderboard, matchmaking, etc.
  hideFromPublic: boolean;

  // Time-based restrictions (for suspensions)
  restrictedAt: Date;
  expiresAt?: Date; // Undefined = permanent ban

  // Admin tracking
  restrictedBy: string; // Admin user ID
  relatedFraudAlertId?: string; // Link to fraud alert
  relatedUserIds?: string[]; // Other accounts in same fraud case

  // Status
  isActive: boolean; // False if manually unrestricted
  unrestrictedAt?: Date;
  unrestrictedBy?: string; // Admin who unrestricted

  // Review packet (shown to the user on /account/review)
  // Reason: Gives the restricted user a clear, branded explanation of when
  // the review should complete and what they need to provide, instead of a
  // generic "contact support" toast. All fields are admin-configurable.
  reviewEtaDays?: number; // Default 3 business days when not set.
  documentsRequested?: string[]; // e.g. ["ID document", "Proof of address"]

  // Appeal tracking (populated when the user clicks "Submit an appeal")
  appealSubmittedAt?: Date;
  appealConversationId?: string;

  createdAt: Date;
  updatedAt: Date;
}

const UserRestrictionSchema = new Schema<IUserRestriction>(
  {
    userId: { type: String, required: true, index: true },

    restrictionType: {
      type: String,
      required: true,
      enum: ["banned", "suspended"],
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "multi_accounting",
        "fraud",
        "fraud_detected",
        "terms_violation",
        "payment_fraud",
        "suspicious_activity",
        "admin_decision",
        "automated_fraud_detection",
        "kyc_failed",
        "kyc_fraud",
        "other",
      ],
    },
    customReason: String,

    // What actions are blocked
    canTrade: { type: Boolean, default: false },
    canEnterCompetitions: { type: Boolean, default: false },
    // Reason: default true so pre-existing restrictions (created before this
    // field existed) never accidentally block challenges. Only an explicit
    // `false` blocks — see canUserPerformAction("enterChallenge").
    // Reason: default flipped true → false on 2 Sep 2026. It was the only one of
    // these five flags defaulting to "allowed", and 10 of the 11 writers that
    // create a restriction never set it - so every suspended and banned account
    // could still accept paid 1v1 challenges. A challenge is the easier shape to
    // abuse, being exactly two players with the pot returning to the pair minus
    // the fee, so this was the wrong flag to fail open. `canEnterChallenges` is
    // read as "blocked only on an explicit false", which keeps deliberate
    // configuration working (see `duplicateKYCBlockChallenges`) while making
    // silence mean blocked, as it already does for deposits and withdrawals.
    // NOTE: rows created before this date have `true` stored, not defaulted, so
    // they need the migration in `tools/fraud/fix-entry-blocked-users.ts`.
    canEnterChallenges: { type: Boolean, default: false },
    canDeposit: { type: Boolean, default: false },
    canWithdraw: { type: Boolean, default: false },

    // Visibility — hide user from leaderboard, matchmaking, match cards
    hideFromPublic: { type: Boolean, default: false },

    // Time-based restrictions
    restrictedAt: { type: Date, default: Date.now },
    expiresAt: Date,

    // Admin tracking
    restrictedBy: { type: String, required: true },
    relatedFraudAlertId: String,
    relatedUserIds: [String],

    // Status
    isActive: { type: Boolean, default: true },
    unrestrictedAt: Date,
    unrestrictedBy: String,

    // Review packet — shown on /account/review.
    reviewEtaDays: { type: Number, min: 0, max: 90 },
    documentsRequested: { type: [String], default: undefined },

    // Appeal tracking
    appealSubmittedAt: Date,
    appealConversationId: String,
  },
  {
    timestamps: true,
  },
);

// Indexes for fast queries
UserRestrictionSchema.index({ userId: 1, isActive: 1 });
UserRestrictionSchema.index({ expiresAt: 1, isActive: 1 });
UserRestrictionSchema.index({ restrictedBy: 1 });
UserRestrictionSchema.index({ relatedFraudAlertId: 1 });

const UserRestriction =
  models.UserRestriction ||
  model<IUserRestriction>("UserRestriction", UserRestrictionSchema);

export default UserRestriction;
