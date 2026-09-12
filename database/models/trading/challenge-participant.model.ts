import { Schema, model, models, Document } from "mongoose";

// Track participants in 1v1 challenges
export interface IChallengeParticipant extends Document {
  challengeId: string;
  userId: string;
  username: string;
  email: string;
  role: "challenger" | "challenged";

  // Game-agnostic result (X1 foundation)
  // Reason: see the matching block on CompetitionParticipant. `score` is the one number
  // the ranking engine reads whatever the game. It is optional because a value means a
  // result arrived - see the schema path below (R50, challenge half).
  score?: number;
  gameKey: string; // Denormalised from the challenge for cross-game statistics queries

  // Capital & Performance
  startingCapital: number;
  currentCapital: number;
  availableCapital: number;
  usedMargin: number;

  // P&L Metrics
  pnl: number;
  pnlPercentage: number;
  realizedPnl: number;
  unrealizedPnl: number;

  // Trading Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;

  // Position Stats
  currentOpenPositions: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;

  // Status
  status: "active" | "liquidated" | "completed" | "disqualified";
  liquidationReason?: string;
  disqualificationReason?: string;

  // Risk Management
  marginCallWarnings: number;
  lastMarginCallAt?: Date;

  // Result
  isWinner: boolean;
  prizeReceived: number;

  // Timing
  joinedAt: Date;
  lastTradeAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ChallengeParticipantSchema = new Schema<IChallengeParticipant>(
  {
    challengeId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["challenger", "challenged"],
    },
    /*
      NO DEFAULT, AND NOT REQUIRED - AN ABSENT SCORE IS THE FACT "NO RESULT HAS ARRIVED".

      This was `required: true, default: 0` from X1 until 12 September 2026, on the reasoning
      that a default keeps existing rows and every current writer valid - the same reasoning,
      and the same wording, that R50 corrected on `CompetitionParticipant` on 7 September. It
      was true and it laid the identical trap: `providerHasResult` is
      `Number.isFinite(participant.score)`, so a stored nought says "this player attempted the
      game and scored nothing", and Mongoose applied the default at the moment of seating.
      Both players in a provider challenge would therefore have held a finite score before
      either had played, tied at the top, and split the pot.

      A default IS a stored value, which is the same rule that made `entryBlockThreshold` and
      `canEnterChallenges` defects: a stored value and an absent one are different facts, and a
      schema default erases the difference for every row it touches.

      Two things make this HALF of R50 quieter than the competition half, and both were checked
      rather than assumed. Nothing reads the field yet - neither copy of
      `challenge-finalize.actions.ts` mentions `score`, because the winner comes from that
      file's own private copy of the ranking comparator, which switches over the six trading
      metrics only. And `IChallengeParticipant` is imported nowhere, so every consumer of the
      model is untyped and the typecheck cannot protect this change either. The guard is
      therefore a test, not the compiler: see `__tests__/services/game-label-and-score.test.ts`.

      Trading is unaffected either way - its module answers `hasResult` with an unconditional
      `true`, because a flat account is a real result, and it ranks on its own metrics.
    */
    score: {
      type: Number,
      required: false,
    },
    gameKey: {
      type: String,
      required: true,
      default: "trading",
      index: true,
    },
    startingCapital: {
      type: Number,
      required: true,
      min: 0,
    },
    currentCapital: {
      type: Number,
      required: true,
      min: 0,
    },
    availableCapital: {
      type: Number,
      required: true,
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
    status: {
      type: String,
      required: true,
      enum: ["active", "liquidated", "completed", "disqualified"],
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
    isWinner: {
      type: Boolean,
      required: true,
      default: false,
    },
    prizeReceived: {
      type: Number,
      required: true,
      default: 0,
    },
    joinedAt: {
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

// Indexes
ChallengeParticipantSchema.index(
  { challengeId: 1, userId: 1 },
  { unique: true },
);
ChallengeParticipantSchema.index({ userId: 1, status: 1 });
ChallengeParticipantSchema.index({ challengeId: 1, pnl: -1 });
ChallengeParticipantSchema.index({ challengeId: 1, score: -1 }); // Game-agnostic ranking
ChallengeParticipantSchema.index({ userId: 1, gameKey: 1 }); // Cross-game player statistics
// PERFORMANCE: Speeds up early-end-check job's participant lookup
ChallengeParticipantSchema.index({ challengeId: 1, status: 1 });

const ChallengeParticipant =
  models?.ChallengeParticipant ||
  model<IChallengeParticipant>(
    "ChallengeParticipant",
    ChallengeParticipantSchema,
  );

export default ChallengeParticipant;
