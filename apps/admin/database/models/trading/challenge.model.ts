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
  /**
   * Add-only. This said "Absent means `reserve_full_round`, matching Competition's own
   * default" until 13 Sep 2026, and that reading made every provider challenge shorter than
   * the title's round ceiling refuse a round for its whole life (R73). Absent now means
   * PERMISSIVE - see `CHALLENGE_ROUND_START_POLICY` in `challenge-round-config.ts`, which is
   * what new challenges store and the one definition of the rule. Only an explicit
   * `reserve_full_round` reserves.
   */
  roundStartPolicy?: "reserve_full_round" | "until_window_closes";

  // Participants
  challengerId: string; // User who created the challenge
  challengerName: string;
  challengerEmail: string;
  /**
   * Was this offered to anybody, rather than to one named player?
   *
   * Explicit rather than inferred from `challengedId` being absent, and the direction of
   * failure is the reason - see `lib/utils/open-challenge.ts` in the main app. Stays true
   * after the seat is claimed, because it is how the challenge was created, not what
   * state it is in.
   */
  openToAnyone?: boolean;
  /**
   * The second player. Absent until somebody claims an open challenge, which is why these
   * three are conditionally required rather than always: an open challenge has no
   * opponent at creation, by definition. Required for a directed challenge, so a writer
   * that forgets them is still refused.
   */
  challengedId?: string; // User who was challenged
  challengedName?: string;
  challengedEmail?: string;

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
  // Reason every metric is optional rather than the schema being wrong: none of them was
  // ever `required: true` below - Mongoose already allowed a missing value on every field -
  // so this interface was asserting a runtime guarantee that never existed. A provider
  // challenge's participants carry no trading capital or trade count at all (see
  // `ChallengeParticipant`'s conditional requirement).
  //
  // CORRECTED 15 September 2026 (R92). This comment used to say "all FIVE metrics" and that
  // "settlement genuinely has nothing to put in these fields for that game type". The count
  // is now six, and the second half was the claim that hid the defect: settlement had the
  // provider score all along and there was no field to put it in, so both admin challenge
  // screens read the absent trading fields and reported `+0.00` over `0 trades`. The
  // sentence is left visible rather than retensed, because it was believed.
  challengerFinalStats?: {
    finalCapital?: number;
    pnl?: number;
    pnlPercentage?: number;
    totalTrades?: number;
    winRate?: number;
    /**
     * What a PROVIDER challenge's participant actually scored. R92.
     *
     * WHY IT WAS MISSING AND WHY THAT MATTERED. Every other field here is a trading metric,
     * and none of them is `required`, so a provider challenge settled with all five absent
     * and this block carrying nothing but `isDisqualified`. Both admin challenge screens
     * then read `pnl` and `totalTrades` off it, got `undefined`, rendered `+0.00` and
     * `0 trades`, and presented that as the outcome of a contest that had ranked correctly
     * on a score they never showed. **This is R46 one game-shape along** - the competition
     * view screen had exactly this defect and was fixed on 7 September 2026, the
     * notification templates were fixed by `challenge-result-line.ts`, and the two admin
     * challenge surfaces were the third writer nobody had counted.
     *
     * NO DEFAULT, DELIBERATELY, and this is the load-bearing half. `default: 0` would write
     * a real zero onto every trading challenge that settles, at which point "this player
     * scored nothing" and "this game has no score" are the same stored fact - and on a
     * lower-is-better title that zero sorts FIRST. Same reasoning as R50, where a
     * `default: 0` on `CompetitionParticipant.score` made every entrant look eligible for a
     * prize. An absent score renders `-`, never `0`.
     *
     * NOT the ranking input. `challenge-settlement.service.ts` ranks on
     * `ChallengeParticipant.score`; this is the settled SNAPSHOT of it, the same
     * relationship `finalCapital` has to the live participant row. Nothing reads this to
     * decide a winner.
     */
    score?: number;
    isDisqualified: boolean;
    disqualificationReason?: string;
  };
  challengedFinalStats?: {
    finalCapital?: number;
    pnl?: number;
    pnlPercentage?: number;
    totalTrades?: number;
    winRate?: number;
    /** The opponent's settled score. See `challengerFinalStats.score` - R92. */
    score?: number;
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
    openToAnyone: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Reason: conditionally required, the same shape as `startingCapital` above. An open
    // challenge genuinely has no opponent until somebody claims it, and `required: true`
    // made that unsaveable. Written as a predicate rather than dropped to `required:
    // false`, because a DIRECTED challenge with no opponent is still a bug and the schema
    // is the only thing that catches it. Both model copies must carry the same predicate:
    // `check:mirrors` compares field paths and enum values, NOT predicate bodies, so a
    // conditional requirement that differs between the apps is a validation rule whose
    // outcome depends on which process saved the document, with the guard staying green.
    challengedId: {
      type: String,
      required: function (this: { openToAnyone?: boolean }) {
        return this.openToAnyone !== true;
      },
      index: true,
    },
    challengedName: {
      type: String,
      required: function (this: { openToAnyone?: boolean }) {
        return this.openToAnyone !== true;
      },
    },
    challengedEmail: {
      type: String,
      required: function (this: { openToAnyone?: boolean }) {
        return this.openToAnyone !== true;
      },
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
      // R92. No `default` - see the interface above. A stored 0 and an absent score are
      // different facts and only one of them is a result.
      score: Number,
      isDisqualified: Boolean,
      disqualificationReason: String,
    },
    challengedFinalStats: {
      finalCapital: Number,
      pnl: Number,
      pnlPercentage: Number,
      totalTrades: Number,
      winRate: Number,
      score: Number,
      isDisqualified: Boolean,
      disqualificationReason: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
ChallengeSchema.index({ status: 1, createdAt: -1 });
ChallengeSchema.index({ challengerId: 1, status: 1 });
ChallengeSchema.index({ challengedId: 1, status: 1 });
ChallengeSchema.index({ status: 1, acceptDeadline: 1 });
ChallengeSchema.index({ status: 1, endTime: 1 });
// Open-challenge discovery: the lobby lists unclaimed open challenges newest first
ChallengeSchema.index({ openToAnyone: 1, status: 1, createdAt: -1 });
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
