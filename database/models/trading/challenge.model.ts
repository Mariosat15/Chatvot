import { Schema, model, models, Document } from "mongoose";

// 1v1 Challenge Structure
export interface IChallenge extends Document {
  // Challenge ID for URL
  slug: string;

  // Game identity (X1 foundation)
  // Reason: a challenge is a contest kind, not a game. Which game the two players
  // compete in is data, so the same 1v1 shell works for trading and provider games.
  gameType: string; // "trading" | "provider" - selects the game MODULE
  gameKey: string; // e.g. "trading" or "provider:acme:trivia-blitz" - IMMUTABLE once written

  // Provider round settings, mirroring Competition's own block (X5). ALL OPTIONAL, and for
  // the same reason as Competition's: a trading challenge has no play window and no
  // attempts policy, and `gameConfig` being absent IS the statement "this is not a provider
  // challenge".
  //
  // UNLIKE Competition, there is deliberately no stored `playWindowStart`/`playWindowEnd`
  // here. A challenge's play window is [startTime, endTime], both already stored and both
  // set once, at acceptance - so deriving the round window from them (in
  // `challenge-round-config.ts`) keeps exactly one source of truth for "when may this
  // challenge be played", rather than two pairs of dates a future edit could let disagree.
  gameConfig?: {
    providerKey: string;
    gameCode: string;
    /** Operator/challenger answers, already validated against the title's `configSchema`. */
    settings?: Record<string, unknown>;
  };
  /** Generated once at acceptance and shared by both players, so they face the same content. */
  contentSeed?: string;
  attemptsPolicy?: "single" | "best_of_n" | "sum_of_n";
  attemptsAllowed?: number;
  /** Add-only. Absent means `reserve_full_round`, matching Competition's own default. */
  roundStartPolicy?: "reserve_full_round" | "until_window_closes";

  // Participants
  challengerId: string; // User who created the challenge
  challengerName: string;
  challengerEmail: string;
  challengedId: string; // User who was challenged
  challengedName: string;
  challengedEmail: string;

  // Entry & Capital
  entryFee: number; // Credits each player pays
  startingCapital: number; // Trading points (virtual capital)
  prizePool: number; // Total pool (entryFee * 2)
  platformFeePercentage: number; // % taken by platform
  platformFeeAmount: number; // Actual fee amount
  winnerPrize: number; // What winner receives (prizePool - platformFee)

  // Timing
  createdAt: Date;
  acceptDeadline: Date; // Time limit to accept challenge
  startTime?: Date; // When challenge starts (after acceptance)
  endTime?: Date; // When challenge ends
  duration: number; // Duration in minutes

  // Status
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "expired"
    | "active"
    | "finalizing"
    | "completed"
    | "cancelled";
  acceptedAt?: Date;
  declinedAt?: Date;

  // Trading Rules
  assetClasses: ("stocks" | "forex" | "crypto" | "indices")[];
  allowedSymbols: string[];
  blockedSymbols: string[];
  leverage: {
    enabled: boolean;
    min: number;
    max: number;
  };

  // Challenge Rules (same as competitions)
  rules: {
    rankingMethod:
      | "pnl"
      | "roi"
      | "total_capital"
      | "win_rate"
      | "total_wins"
      | "profit_factor";
    tieBreaker1:
      | "trades_count"
      | "win_rate"
      | "total_capital"
      | "roi"
      | "join_time"
      | "split_prize";
    tieBreaker2?:
      | "trades_count"
      | "win_rate"
      | "total_capital"
      | "roi"
      | "join_time"
      | "split_prize";
    minimumTrades: number; // Default: 1
    disqualifyOnLiquidation: boolean;
  };

  // Risk Limits
  maxPositionSize: number;
  maxOpenPositions: number;
  allowShortSelling: boolean;
  marginCallThreshold: number;

  // Margin Settings (copied from trading risk settings at creation time)
  marginSettings?: {
    liquidation: number; // Stopout level %
    call: number; // Margin call level %
    warning: number; // Warning level %
    safe: number; // Safe level %
  };

  // Results
  winnerId?: string;
  winnerName?: string;
  winnerPnL?: number;
  loserId?: string;
  loserName?: string;
  loserPnL?: number;
  isTie?: boolean;
  noWinner?: boolean;
  earlyEndReason?: string;

  // Final Stats
  // Reason all five metrics are optional rather than the schema being wrong: none of them
  // was ever `required: true` below - Mongoose already allowed a missing value on every
  // field - so this interface was asserting a runtime guarantee that never existed. A
  // provider challenge's participants carry no trading capital or trade count at all (see
  // `ChallengeParticipant`'s conditional requirement), so settlement genuinely has nothing
  // to put in these fields for that game type, and the corrected type says so honestly.
  challengerFinalStats?: {
    finalCapital?: number;
    pnl?: number;
    pnlPercentage?: number;
    totalTrades?: number;
    winRate?: number;
    isDisqualified: boolean;
    disqualificationReason?: string;
  };
  challengedFinalStats?: {
    finalCapital?: number;
    pnl?: number;
    pnlPercentage?: number;
    totalTrades?: number;
    winRate?: number;
    isDisqualified: boolean;
    disqualificationReason?: string;
  };

  updatedAt: Date;
}

const ChallengeSchema = new Schema<IChallenge>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Reason: default rather than required - see the matching note on Competition.
    // An unlabelled contest must never reach settlement without a known game.
    gameType: {
      type: String,
      required: true,
      default: "trading",
      index: true,
    },
    gameKey: {
      type: String,
      required: true,
      default: "trading",
      index: true,
    },
    // Provider round settings - see the interface for why every one is optional, and why
    // there is no playWindowStart/playWindowEnd here.
    gameConfig: {
      type: {
        providerKey: { type: String, required: true },
        gameCode: { type: String, required: true },
        settings: { type: Schema.Types.Mixed },
      },
      required: false,
      default: undefined,
      _id: false,
    },
    contentSeed: { type: String },
    attemptsPolicy: {
      type: String,
      enum: ["single", "best_of_n", "sum_of_n"],
      default: undefined,
    },
    attemptsAllowed: { type: Number, min: 1, default: undefined },
    // Add-only. Default preserves the pre-existing gate for every stored challenge, matching
    // Competition's own default.
    roundStartPolicy: {
      type: String,
      enum: ["reserve_full_round", "until_window_closes"],
      default: "reserve_full_round",
    },
    challengerId: {
      type: String,
      required: true,
      index: true,
    },
    challengerName: {
      type: String,
      required: true,
    },
    challengerEmail: {
      type: String,
      required: true,
    },
    challengedId: {
      type: String,
      required: true,
      index: true,
    },
    challengedName: {
      type: String,
      required: true,
    },
    challengedEmail: {
      type: String,
      required: true,
    },
    entryFee: {
      type: Number,
      required: true,
      min: 1,
    },
    // Reason: mirrors `Competition.startingCapital` exactly. A provider challenge has no
    // virtual trading capital, so an unconditional requirement made it unsaveable. Trading
    // is unaffected - the predicate is true for every existing document, because `gameType`
    // defaults to "trading".
    startingCapital: {
      type: Number,
      required: function (this: { gameType?: string }) {
        return (this.gameType ?? "trading") === "trading";
      },
      min: 100,
    },
    prizePool: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFeePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },
    platformFeeAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    winnerPrize: {
      type: Number,
      required: true,
      default: 0,
    },
    acceptDeadline: {
      type: Date,
      required: true,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number,
      required: true,
      min: 1, // Minimum 1 minute
      max: 10080, // Maximum 7 days (in minutes)
    },
    status: {
      type: String,
      required: true,
      enum: [
        "pending",
        "accepted",
        "declined",
        "expired",
        "active",
        "finalizing",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    acceptedAt: {
      type: Date,
    },
    declinedAt: {
      type: Date,
    },
    assetClasses: [
      {
        type: String,
        enum: ["stocks", "forex", "crypto", "indices"],
      },
    ],
    allowedSymbols: [String],
    blockedSymbols: [String],
    leverage: {
      enabled: { type: Boolean, default: false },
      min: { type: Number, default: 1, min: 1 },
      max: { type: Number, default: 10, min: 1, max: 500 }, // Same as competitions
    },
    rules: {
      rankingMethod: {
        type: String,
        enum: [
          "pnl",
          "roi",
          "total_capital",
          "win_rate",
          "total_wins",
          "profit_factor",
        ],
        required: true,
        default: "pnl",
      },
      tieBreaker1: {
        type: String,
        enum: [
          "trades_count",
          "win_rate",
          "total_capital",
          "roi",
          "join_time",
          "split_prize",
        ],
        required: true,
        default: "trades_count",
      },
      tieBreaker2: {
        type: String,
        enum: [
          "trades_count",
          "win_rate",
          "total_capital",
          "roi",
          "join_time",
          "split_prize",
        ],
      },
      minimumTrades: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
      },
      disqualifyOnLiquidation: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    maxPositionSize: {
      type: Number,
      required: true,
      default: 50,
      min: 1,
      max: 100,
    },
    maxOpenPositions: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
      max: 50,
    },
    allowShortSelling: {
      type: Boolean,
      required: true,
      default: false,
    },
    marginCallThreshold: {
      type: Number,
      required: true,
      default: 100, // Margin call level from risk settings (can be 100%+)
      min: 10,
      max: 1000, // Allow high margin call levels
    },
    marginSettings: {
      type: {
        liquidation: { type: Number, default: 50 },
        call: { type: Number, default: 100 },
        warning: { type: Number, default: 150 },
        safe: { type: Number, default: 200 },
      },
      required: false,
    },
    winnerId: String,
    winnerName: String,
    winnerPnL: Number,
    loserId: String,
    loserName: String,
    loserPnL: Number,
    isTie: Boolean,
    noWinner: Boolean,
    earlyEndReason: String,
    challengerFinalStats: {
      finalCapital: Number,
      pnl: Number,
      pnlPercentage: Number,
      totalTrades: Number,
      winRate: Number,
      isDisqualified: Boolean,
      disqualificationReason: String,
    },
    challengedFinalStats: {
      finalCapital: Number,
      pnl: Number,
      pnlPercentage: Number,
      totalTrades: Number,
      winRate: Number,
      isDisqualified: Boolean,
      disqualificationReason: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes - Optimized for common queries
ChallengeSchema.index({ status: 1, createdAt: -1 });
ChallengeSchema.index({ challengerId: 1, status: 1 });
ChallengeSchema.index({ challengedId: 1, status: 1 });
ChallengeSchema.index({ status: 1, acceptDeadline: 1 });
ChallengeSchema.index({ status: 1, endTime: 1 });
// Compound index for cooldown check query (challengerId + challengedId + createdAt)
ChallengeSchema.index({ challengerId: 1, challengedId: 1, createdAt: -1 });
// Combined $or query optimization for active challenges count
ChallengeSchema.index({ challengerId: 1, challengedId: 1, status: 1 });
// Game-scoped queries: challenge lists filtered by game, and the finalization sweeps
ChallengeSchema.index({ gameType: 1, status: 1 });
ChallengeSchema.index({ gameKey: 1, status: 1 });

const Challenge =
  models?.Challenge || model<IChallenge>("Challenge", ChallengeSchema);

// Drop stale index on model load (challengeCode_1 was removed from schema)
// This runs once when the model is first imported
(async () => {
  try {
    if (Challenge.collection) {
      const indexes = await Challenge.collection.indexes();
      const hasStaleIndex = indexes.some(
        (idx: { name?: string }) => idx.name === "challengeCode_1",
      );
      if (hasStaleIndex) {
        await Challenge.collection.dropIndex("challengeCode_1");
        console.log("Dropped stale challengeCode_1 index");
      }
    }
  } catch {
    // Index might not exist or connection might not be ready - that's OK
  }
})();

export default Challenge;
