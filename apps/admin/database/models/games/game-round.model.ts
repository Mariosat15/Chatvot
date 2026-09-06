import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * One attempt at a provider game by one player (X3, chapter 04 section 3.3).
 *
 * This is the audit trail that sits under prize money, which is why chapter 04 section 6
 * keeps it INDEFINITELY. A round explains why a player was ranked where they were; deleting
 * it turns a dispute from a lookup into an argument.
 *
 * SEAM 4, AND IT IS A HARD RULE (chapter 11 section 2)
 * ---------------------------------------------------
 * A provider game must NEVER write to `TradingPosition`. Round state lives here and only
 * here. Reason: `TradingPosition` carries entry price, leverage, margin, stop loss and
 * liquidation - a puzzle score has none of those, so a provider round stored there would be
 * a row of nulls that the trading engine's own queries would then pick up and try to value.
 */
export interface IGameRound extends Document {
  /** OUR id, and the idempotency key for creation. Never the provider's. */
  roundId: string;
  providerRoundId?: string;
  providerKey: string;
  gameCode: string;
  gameKey: string;
  userId: string;
  contestType: "competition" | "challenge" | "practice";
  /** Null for practice, which belongs to no contest. */
  contestId?: Types.ObjectId | null;
  participantId?: Types.ObjectId | null;
  /** 1-based. Consumed when the round is CREATED, not when it completes. */
  attemptNumber: number;
  mode: "ranked" | "practice";
  /** The exact settings used, frozen at creation. */
  configSnapshot?: Record<string, unknown>;
  contentSeed?: string;
  status:
    | "pending"
    | "launched"
    | "completed"
    | "abandoned"
    | "expired"
    | "voided"
    | "unresolved";
  rawScore?: number;
  /** Display only. NEVER an input to ranking (chapter 01 section 5.4). */
  scoreBreakdown?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  expiresAt: Date;
  launchUrlExpiresAt?: Date;
  replayUrl?: string;
  integrityFlags?: string[];
  resultReceivedAt?: Date;
  resultSource?: "callback" | "poll" | "manual";
  pollAttempts: number;
  lastPolledAt?: Date;
  /** Set when a second, different score arrives. First valid result still wins. */
  conflictFlaggedAt?: Date;
  /** A result that arrived after the contest settled: recorded, never applied. */
  lateResultRecordedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The statuses a round can hold.
 *
 * The provider only ever reports the four terminal ones (chapter 01 section 5.1);
 * `pending`, `launched` and `unresolved` are ours. Chapter 04 lists the values but no
 * transition table, so the legal moves are declared in `ROUND_TRANSITIONS` below rather
 * than left for each call site to assume.
 */
export const ROUND_STATUSES = [
  "pending",
  "launched",
  "completed",
  "abandoned",
  "expired",
  "voided",
  "unresolved",
] as const;

export type RoundStatus = (typeof ROUND_STATUSES)[number];

/** A round in one of these is still in flight and may still receive a result. */
export const LIVE_ROUND_STATUSES: RoundStatus[] = ["pending", "launched"];

/**
 * Legal transitions, declared because chapter 04 section 3.3 lists the statuses without
 * saying which moves are allowed - a gap that would otherwise be filled differently by each
 * caller.
 *
 * Reason terminal states map to nothing: a round that has reported must not be reopened. A
 * late or conflicting result is recorded on the document (`lateResultRecordedAt`,
 * `conflictFlaggedAt`) rather than by moving the status back, because the score that was
 * ranked has to stay the score that is stored.
 *
 * `unresolved` is the one terminal state that can still move, and only to a real result:
 * stage 2 or 3 of the reconciliation net can pull a score for a round the policy already
 * gave up on, and honouring it is better than keeping a zero we know is wrong. It can never
 * go back to `launched`.
 */
// Reason for a Map rather than a plain object: indexing an object by a variable trips the
// security/detect-object-injection lint rule, and the pre-commit hook allows no warnings.
// A Map is also the honest structure here - this is a lookup table, not a shape.
export const ROUND_TRANSITIONS = new Map<RoundStatus, readonly RoundStatus[]>([
  ["pending", ["launched", "expired", "voided"]],
  ["launched", ["completed", "abandoned", "expired", "voided", "unresolved"]],
  ["unresolved", ["completed", "abandoned", "expired", "voided"]],
  ["completed", []],
  ["abandoned", []],
  ["expired", []],
  ["voided", []],
]);

/** Whether a status change is allowed. Used by the ingestion service's gate 8. */
export function canTransitionRound(from: RoundStatus, to: RoundStatus): boolean {
  return ROUND_TRANSITIONS.get(from)?.includes(to) ?? false;
}

const GameRoundSchema = new Schema<IGameRound>(
  {
    roundId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    providerRoundId: { type: String, trim: true },
    providerKey: { type: String, required: true, immutable: true, trim: true },
    gameCode: { type: String, required: true, immutable: true, trim: true },
    // Reason: immutable, like every other gameKey in the system. This is the join key for
    // all historical stats and cannot be corrected in place once written.
    gameKey: { type: String, required: true, immutable: true, trim: true },
    userId: { type: String, required: true, immutable: true, index: true },
    contestType: {
      type: String,
      enum: ["competition", "challenge", "practice"],
      required: true,
      immutable: true,
    },
    contestId: {
      type: Schema.Types.ObjectId,
      default: null,
      immutable: true,
    },
    participantId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },
    mode: {
      type: String,
      enum: ["ranked", "practice"],
      required: true,
      immutable: true,
    },
    // Reason: frozen at creation and never re-read from the contest or the catalogue.
    // Chapter 04 section 3.3 is explicit: an operator or the provider can change config
    // mid-contest, and a round must be judged by the rules it was actually played under.
    configSnapshot: { type: Schema.Types.Mixed, immutable: true },
    contentSeed: { type: String, immutable: true },
    status: {
      type: String,
      enum: ROUND_STATUSES,
      default: "pending",
      required: true,
    },
    rawScore: { type: Number },
    scoreBreakdown: { type: Schema.Types.Mixed },
    startedAt: { type: Date },
    completedAt: { type: Date },
    durationMs: { type: Number },
    // Reason: always at or before the contest's play window end (chapter 07 section 4).
    // A round that can outlive its contest is a score that arrives after settlement.
    expiresAt: { type: Date, required: true },
    launchUrlExpiresAt: { type: Date },
    replayUrl: { type: String },
    // Provider-side suspicion signals. Advisory: our own fraud layer decides.
    integrityFlags: { type: [String], default: undefined },
    resultReceivedAt: { type: Date },
    resultSource: {
      type: String,
      enum: ["callback", "poll", "manual"],
    },
    pollAttempts: { type: Number, default: 0 },
    lastPolledAt: { type: Date },
    conflictFlaggedAt: { type: Date },
    lateResultRecordedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "game_round",
  },
);

// Chapter 04 section 3.3, index 2: prevents a duplicate attempt.
GameRoundSchema.index(
  { contestId: 1, userId: 1, attemptNumber: 1 },
  { unique: true },
);

// ─────────────────────────────────────────────────────────────────────────────────────────
// "One live round per player per contest", enforced rather than assumed.
//
// Chapter 03 section 1.3 states the rule and chapter 07 section 4 says it is "enforced in
// the database" - but the only index chapter 04 documents is the one above, which prevents
// a duplicate ATTEMPT NUMBER and not two rounds live at once. Attempt 1 launched and
// attempt 2 launched satisfies it perfectly, which is exactly the abandon-and-peek the rule
// exists to stop. So this index is an addition to the plan, recorded in chapter 04.
//
// `contestId: { $type: "objectId" }` scopes it to real contests. Practice rounds carry a
// null contestId, so without that clause every practice round a player started would
// collide with their previous one. Note $ne is NOT permitted in a partialFilterExpression,
// which is why this is a type check rather than a null comparison.
// ─────────────────────────────────────────────────────────────────────────────────────────
GameRoundSchema.index(
  { contestId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      contestId: { $type: "objectId" },
      status: { $in: LIVE_ROUND_STATUSES },
    },
    name: "one_live_round_per_player_per_contest",
  },
);

// Chapter 04 section 3.3, index 3: drives the reconciliation job, which scans every minute
// for rounds that are launched but have not reported.
GameRoundSchema.index({ status: 1, expiresAt: 1 });

// Index 4: player history.
GameRoundSchema.index({ userId: 1, createdAt: -1 });

// Index 5: provider reporting.
GameRoundSchema.index({ providerKey: 1, gameCode: 1, createdAt: -1 });

const GameRound: Model<IGameRound> =
  mongoose.models.GameRound ||
  mongoose.model<IGameRound>("GameRound", GameRoundSchema);

export default GameRound;
