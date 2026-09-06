import { Schema, model, models, type Model, type HydratedDocument } from "mongoose";

/**
 * A round, as this provider records it.
 *
 * TERMINAL STATES ARE THE WHOLE SCHEMA
 * ------------------------------------
 * Section 13 of the specification is blunt: every round must reach one of four terminal states,
 * "there is no fifth option, and there is no silence". A round that stops reporting freezes a
 * contest with real prize money inside it.
 *
 * So the fields here are shaped around answering, at any moment and for any round, both "what
 * state is this in" and "have we told the platform yet". The second question is why delivery
 * lives on the round rather than in a separate queue: a queue that loses a row loses a score,
 * whereas a round that has not been delivered is still visibly a round awaiting delivery, and
 * the sweeper can find it by asking the only question that matters.
 */

export type RoundStatus =
  /** Created, launch URL issued, player has not started. */
  | "created"
  /** The player loaded the game and the clock is running. */
  | "in_progress"
  /* ---- the four terminal states of section 13 ---- */
  | "completed"
  | "abandoned"
  | "expired"
  | "voided";

/**
 * The four states of section 13, as a type rather than a comment.
 *
 * Worth naming separately from `RoundStatus`, because two things in this service accept "a status
 * to finish in" - the lifecycle transition and the sandbox override - and neither can accept
 * `created` or `in_progress`. With one wide type the compiler is happy to let a control finish a
 * round into a non-terminal state, which would mark it reported while leaving it playable, and the
 * sweeper would then never look at it again. The narrower type turns that into a build error.
 */
export type TerminalStatus = Extract<
  RoundStatus,
  "completed" | "abandoned" | "expired" | "voided"
>;

export const TERMINAL_STATUSES: TerminalStatus[] = [
  "completed",
  "abandoned",
  "expired",
  "voided",
];

export function isTerminal(status: RoundStatus): status is TerminalStatus {
  return (TERMINAL_STATUSES as RoundStatus[]).includes(status);
}

/** One board issued to the player, and what became of it. */
export interface RoundBoard {
  index: number;
  issuedAt: Date;
  solvedAt?: Date;
  /** How many submissions this board received. Reported in the breakdown, never scored on. */
  attempts: number;
}

export interface RoundSandbox {
  /**
   * Overrides the computed score.
   *
   * The specification asks for this as "strongly wanted", so that the platform can test
   * ranking, tie-breaks and payouts without playing games by hand. It is honoured only when the
   * service is running with `GAMES_SANDBOX=true`.
   */
  forceScore?: number;
  /** Forces a terminal state, so every failure path can be rehearsed before real money. */
  forceStatus?: TerminalStatus;
  /**
   * Suppresses the result callback entirely.
   *
   * This exists so the platform can prove its own recovery path - the poll of
   * `GET /v1/rounds/{roundId}` and the reconciliation net behind it - actually works when a
   * message never arrives. Note it suppresses the DELIVERY, not the RESULT: the round still
   * reaches a terminal state and the fetch endpoint still reports it, which is exactly the
   * situation a lost webhook produces.
   */
  suppressCallback?: boolean;
}

export interface RoundDelivery {
  /**
   * The `eventId` for this round's terminal report.
   *
   * Generated once, when the round first reaches a terminal state, and reused on every retry.
   * The specification's idempotency table turns on this: "unique per message and stable across
   * your retries. This is how we avoid counting one score twice". Regenerating it per attempt
   * would make every retry a new score to the platform.
   */
  eventId?: string;
  attempts: number;
  firstAttemptAt?: Date;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  acknowledgedAt?: Date;
  lastError?: string;
  /** Set once the platform has replied 2xx, or once we give up after the 24-hour window. */
  gaveUpAt?: Date;
}

export interface RoundDoc {
  /* ---- identity ---- */
  /** The platform's identifier. We generate nothing here and echo it everywhere. */
  roundId: string;
  /** Ours, for support conversations. */
  providerRoundId: string;
  gameCode: string;
  mode: "ranked" | "practice";

  /* ---- who ---- */
  playerId: string;
  displayName?: string;
  locale?: string;
  country?: string;

  /* ---- what ---- */
  /** The config as we resolved it, after defaults and clamping. */
  config: Record<string, unknown>;
  /** Exactly what the platform sent, kept so a disagreement can be diagnosed later. */
  requestedConfig: Record<string, unknown>;
  /** Settings we had to correct because they failed our own schema. */
  configCorrections: string[];
  /**
   * The contest's content seed.
   *
   * Absent for practice rounds. Never sent to the client, never echoed in any response, and
   * there is deliberately no endpoint that turns a seed into content - all three are explicit
   * requirements of section 12.
   */
  contentSeed?: string;
  /**
   * Decides which of the eight symmetries this player sees.
   *
   * Separate from `contentSeed` so presentation can vary per player while the content cannot.
   * Section 12 permits exactly this, and asks for it.
   */
  presentationSeed: string;

  /* ---- idempotency ---- */
  /**
   * A hash of the parameters that decide what the player faces.
   *
   * The specification requires a `409` for "same roundId, different parameters", which means
   * something has to define "parameters". This covers game, mode, player, seed and resolved
   * config - the things that change the content or the scoring - and deliberately excludes
   * `expiresAt`, `returnUrl` and `resultCallbackUrl`, because a retry that regenerated a
   * timestamp would otherwise be refused as an identifier collision. Recorded as an ambiguity.
   */
  fingerprint: string;

  /* ---- timing ---- */
  /** After this moment the round is unplayable and must report `expired` (section 7). */
  expiresAt: Date;
  launchToken: string;
  launchUrlExpiresAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  /* ---- where results go ---- */
  resultCallbackUrl: string;
  returnUrl?: string;

  /* ---- play ---- */
  status: RoundStatus;
  boards: RoundBoard[];
  /** Set when a terminal state is reached, and never recomputed afterwards. */
  score?: number;
  durationMs?: number;
  scoreBreakdown?: Record<string, unknown>;
  /** Why the round was voided, for the support conversation that follows one. */
  voidReason?: string;

  sandbox: RoundSandbox;
  delivery: RoundDelivery;

  createdAt: Date;
  updatedAt: Date;
}

const BoardSchema = new Schema<RoundBoard>(
  {
    index: { type: Number, required: true },
    issuedAt: { type: Date, required: true },
    solvedAt: { type: Date },
    attempts: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const SandboxSchema = new Schema<RoundSandbox>(
  {
    forceScore: { type: Number },
    forceStatus: { type: String },
    suppressCallback: { type: Boolean },
  },
  { _id: false },
);

const DeliverySchema = new Schema<RoundDelivery>(
  {
    eventId: { type: String },
    attempts: { type: Number, required: true, default: 0 },
    firstAttemptAt: { type: Date },
    lastAttemptAt: { type: Date },
    nextAttemptAt: { type: Date },
    acknowledgedAt: { type: Date },
    lastError: { type: String },
    gaveUpAt: { type: Date },
  },
  { _id: false },
);

const RoundSchema = new Schema<RoundDoc>(
  {
    roundId: { type: String, required: true, unique: true },
    providerRoundId: { type: String, required: true, unique: true },
    gameCode: { type: String, required: true },
    mode: { type: String, required: true, enum: ["ranked", "practice"] },

    playerId: { type: String, required: true },
    displayName: { type: String },
    locale: { type: String },
    country: { type: String },

    config: { type: Schema.Types.Mixed, required: true },
    requestedConfig: { type: Schema.Types.Mixed, required: true },
    configCorrections: { type: [String], default: [] },
    contentSeed: { type: String },
    presentationSeed: { type: String, required: true },

    fingerprint: { type: String, required: true },

    expiresAt: { type: Date, required: true },
    launchToken: { type: String, required: true },
    launchUrlExpiresAt: { type: Date, required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },

    resultCallbackUrl: { type: String, required: true },
    returnUrl: { type: String },

    status: {
      type: String,
      required: true,
      enum: ["created", "in_progress", "completed", "abandoned", "expired", "voided"],
      default: "created",
    },
    boards: { type: [BoardSchema], default: [] },
    score: { type: Number },
    durationMs: { type: Number },
    scoreBreakdown: { type: Schema.Types.Mixed },
    voidReason: { type: String },

    sandbox: { type: SandboxSchema, required: true, default: () => ({}) },
    delivery: { type: DeliverySchema, required: true, default: () => ({ attempts: 0 }) },
  },
  { timestamps: true, collection: "rounds" },
);

/**
 * The sweeper's index.
 *
 * Two queries run on a timer and both are covered here: rounds that have passed `expiresAt`
 * without reaching a terminal state, and rounds in a terminal state whose result the platform
 * has not acknowledged yet.
 */
RoundSchema.index({ status: 1, expiresAt: 1 });
RoundSchema.index({ "delivery.acknowledgedAt": 1, "delivery.nextAttemptAt": 1 });

/** Used to find a player's live round, which is how a resumed session finds its way back. */
RoundSchema.index({ playerId: 1, status: 1 });

export type RoundDocument = HydratedDocument<RoundDoc>;

export const Round: Model<RoundDoc> =
  (models.Round as Model<RoundDoc>) || model<RoundDoc>("Round", RoundSchema);
