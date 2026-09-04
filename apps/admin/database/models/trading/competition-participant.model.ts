import { Schema, model, models, Document } from "mongoose";

// Track participants in each competition
export interface ICompetitionParticipant extends Document {
  competitionId: string;
  userId: string; // Reference to Better Auth user
  username: string; // For leaderboard display
  email: string; // For notifications

  // Game-agnostic result (X1 foundation)
  // Reason: every field below this block is trading-shaped. `score` is the ONE number
  // the ranking engine reads whatever the game - for trading it is derived from the
  // configured ranking metric, for a provider game it is the reported round score.
  // Invariant 4 in "External game plans/11": every participant gets a score.
  score: number;
  gameKey: string; // Denormalised from the contest for cross-game statistics queries

  // Capital & Performance
  startingCapital?: number; // Absent on a provider participant
  currentCapital?: number; // Absent on a provider participant
  availableCapital?: number; // Absent on a provider participant
  usedMargin: number; // Capital tied in open positions

  // P&L Metrics
  pnl: number; // Total profit/loss
  pnlPercentage: number; // ROI percentage
  realizedPnl: number; // From closed positions
  unrealizedPnl: number; // From open positions

  // Trading Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // Percentage
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;

  // Position Stats
  currentOpenPositions: number;
  maxDrawdown: number; // Worst decline from peak
  maxDrawdownPercentage: number;

  // Ranking
  currentRank: number;
  highestRank: number; // Best rank achieved

  // Status
  status: "active" | "liquidated" | "completed" | "disqualified" | "refunded";
  liquidationReason?: string;
  disqualificationReason?: string;

  // Risk Management
  marginCallWarnings: number; // How many times warned
  lastMarginCallAt?: Date;

  // Timing
  enteredAt: Date;
  lastTradeAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const CompetitionParticipantSchema = new Schema<ICompetitionParticipant>(
  {
    competitionId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    // Reason: defaults to 0 so existing rows and every current writer stay valid.
    // Trading's score is populated at settlement from the ranking metric; nothing
    // reads it until the ranking seam is switched over.
    score: {
      type: Number,
      required: true,
      default: 0,
    },
    gameKey: {
      type: String,
      required: true,
      default: "trading",
      index: true,
    },
    // The three virtual-capital fields, required only for a trading participant.
    //
    // Reason: a provider-game player has no starting capital - `Competition.startingCapital`
    // is not even set on a provider contest - so an unconditional requirement made a
    // provider participant unsaveable. It failed as a Mongoose validation error naming a
    // concept the player was never shown.
    //
    // The `|| "trading"` is load-bearing, exactly as on `Competition.startingCapital`:
    // `gameKey` defaults to "trading", but a row written before that default existed has
    // none, and such a row IS a trading participant. Written as `this.gameKey === "trading"`
    // an unlabelled trading participant would save with no capital and every downstream
    // calculation would divide by it.
    //
    // Narrowing this is a change to TRADING's contract, not only an allowance for provider
    // games - the guarantee moved out of the schema and into a predicate, and the predicate
    // is now the only thing standing between a trading participant and a missing balance.
    //
    // MUST MATCH THE MAIN APP EXACTLY. `check:mirrors` compares field paths and enum values,
    // NOT predicate bodies - so a difference here is a validation rule whose outcome depends
    // on which process saved the document, and the guard would stay green.
    startingCapital: {
      type: Number,
      required: function (this: { gameKey?: string }) {
        return (this.gameKey || "trading") === "trading";
      },
      min: 0,
    },
    currentCapital: {
      type: Number,
      required: function (this: { gameKey?: string }) {
        return (this.gameKey || "trading") === "trading";
      },
      min: 0,
    },
    availableCapital: {
      type: Number,
      required: function (this: { gameKey?: string }) {
        return (this.gameKey || "trading") === "trading";
      },
      min: 0,
    },
    usedMargin: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    pnl: {
      type: Number,
      required: true,
      default: 0,
    },
    pnlPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    realizedPnl: {
      type: Number,
      required: true,
      default: 0,
    },
    unrealizedPnl: {
      type: Number,
      required: true,
      default: 0,
    },
    totalTrades: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    winningTrades: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    losingTrades: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    winRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    averageWin: {
      type: Number,
      required: true,
      default: 0,
    },
    averageLoss: {
      type: Number,
      required: true,
      default: 0,
    },
    largestWin: {
      type: Number,
      required: true,
      default: 0,
    },
    largestLoss: {
      type: Number,
      required: true,
      default: 0,
    },
    currentOpenPositions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    maxDrawdown: {
      type: Number,
      required: true,
      default: 0,
    },
    maxDrawdownPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    currentRank: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    highestRank: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "liquidated", "completed", "disqualified", "refunded"],
      default: "active",
    },
    liquidationReason: {
      type: String,
    },
    disqualificationReason: {
      type: String,
    },
    marginCallWarnings: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastMarginCallAt: {
      type: Date,
    },
    enteredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastTradeAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for fast queries
CompetitionParticipantSchema.index(
  { competitionId: 1, userId: 1 },
  { unique: true },
);
CompetitionParticipantSchema.index({ competitionId: 1, currentRank: 1 });
CompetitionParticipantSchema.index({ competitionId: 1, pnl: -1 }); // For leaderboard
CompetitionParticipantSchema.index({ competitionId: 1, score: -1 }); // Game-agnostic leaderboard
CompetitionParticipantSchema.index({ userId: 1, gameKey: 1 }); // Cross-game player statistics
CompetitionParticipantSchema.index({ userId: 1, status: 1 });

// Virtual for profit factor (average win / average loss)
CompetitionParticipantSchema.virtual("profitFactor").get(function () {
  if (this.averageLoss === 0) return 0;
  return Math.abs(this.averageWin / this.averageLoss);
});

// Virtual for is at risk (close to margin call)
CompetitionParticipantSchema.virtual("isAtRisk").get(function () {
  // Reason: a provider-game participant has no capital, so the division below would be
  // `undefined / undefined` = NaN, and `NaN < 60` is false.
  //
  // BE HONEST ABOUT WHAT THIS GUARD IS: today it changes no answer, because the accidental
  // NaN result is the same `false` this returns deliberately. It is clarity and future
  // safety, not a bug fix - a probe that removed it could not turn any test red, which is
  // how that was established rather than assumed. It earns its place because the accident
  // only holds for `<`: flip this to `>` for an "is healthy" check and NaN silently answers
  // false to that too, which would then be wrong.
  if (!this.startingCapital || this.currentCapital === undefined) return false;

  const capitalPercentage = (this.currentCapital / this.startingCapital) * 100;
  return capitalPercentage < 60; // Below 60% of starting capital
});

const CompetitionParticipant =
  models?.CompetitionParticipant ||
  model<ICompetitionParticipant>(
    "CompetitionParticipant",
    CompetitionParticipantSchema,
  );

export default CompetitionParticipant;
