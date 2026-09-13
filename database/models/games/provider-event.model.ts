import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Every inbound provider callback, stored BEFORE it is processed (X3, chapter 04 section
 * 3.4 and chapter 06 section 2).
 *
 * STORE FIRST, PROCESS SECOND - AND THE ORDER IS THE WHOLE POINT
 * -------------------------------------------------------------
 * The row is written before the signature is checked, before the round is looked up, before
 * anything is scored. Two things follow, and both are the reason the rule exists:
 *
 *   1. If processing throws, the evidence survives and the event can be REPLAYED. Code that
 *      verifies first and stores second loses the payload precisely when it most needs it -
 *      the case where something went wrong.
 *   2. A dispute becomes a lookup against signed raw bytes rather than an argument. The
 *      audit chain is provider_event -> game_round -> participant.score -> wallet
 *      (chapter 06 section 9), and this is its first link.
 *
 * A REJECTED EVENT IS STILL STORED. `signatureValid: false` rows are the record of an
 * attack or a misconfiguration, and deleting them would erase the only trace.
 *
 * Retention: at least 90 days (chapter 04 section 3.4, chapter 18 section 1), ideally as
 * long as the provider keeps replays. Unlike `game_round` this is not kept forever - it is
 * raw transport, and the settled facts live on the round.
 */
export interface IProviderEvent extends Document {
  /** The PROVIDER's event id. The deduplication key - see the unique index below. */
  eventId: string;
  providerKey: string;
  eventType?: string;
  /** The exact bytes received, unparsed. What the signature was computed over. */
  rawBody: string;
  /** Signature and timestamp headers, kept for dispute evidence. */
  headers?: Record<string, string>;
  signatureValid?: boolean;
  processedAt?: Date;
  processingResult?: string;
  processingError?: string;
  /** Filled once the event is matched to a round. Absent means unmatched. */
  roundId?: string;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The outcomes of processing an event.
 *
 * Reason for a named list rather than free text: these are what an operator filters the
 * admin round inspector by (chapter 12), and what an alert rule keys off. Free-text
 * outcomes drift into near-synonyms and the filter silently stops matching some of them.
 */
export const EVENT_PROCESSING_RESULTS = [
  "scored",
  "duplicate_ignored",
  "signature_invalid",
  "timestamp_rejected",
  "provider_unknown",
  "round_not_found",
  "round_not_acceptable",
  "score_out_of_range",
  "conflict_flagged",
  "late_recorded_not_applied",
  "unparseable",
  "error",
] as const;

export type EventProcessingResult = (typeof EVENT_PROCESSING_RESULTS)[number];

const ProviderEventSchema = new Schema<IProviderEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    providerKey: { type: String, required: true, immutable: true, trim: true },
    eventType: { type: String, trim: true },
    // Reason: immutable, because this is the evidence. A row whose raw body could be
    // rewritten later proves nothing about what was actually sent.
    rawBody: { type: String, required: true, immutable: true },
    headers: { type: Schema.Types.Mixed, immutable: true },
    signatureValid: { type: Boolean },
    processedAt: { type: Date },
    processingResult: {
      type: String,
      enum: EVENT_PROCESSING_RESULTS,
    },
    processingError: { type: String },
    roundId: { type: String, trim: true },
    receivedAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  {
    timestamps: true,
    collection: "provider_event",
  },
);

// Chapter 04 section 3.4: the unique index IS the deduplication mechanism. A provider
// retrying a delivery hits a duplicate-key error, which the ingestion service treats as
// idempotent success - the same rule Stage 0 settled for competition entry: a retried
// request has done nothing wrong and must not be answered with an error.
// (The `unique: true` on the field above declares it; named here for the reader.)

// Reason: the admin round inspector opens from a round, so events must be findable by the
// round they resolved to - and unmatched events (roundId absent) are exactly what an
// operator hunts for after a provider changes an id format.
ProviderEventSchema.index({ roundId: 1, receivedAt: -1 });

// Reason: drives the retention trim and the per-provider event feed.
ProviderEventSchema.index({ providerKey: 1, receivedAt: -1 });

const ProviderEvent: Model<IProviderEvent> =
  mongoose.models.ProviderEvent ||
  mongoose.model<IProviderEvent>("ProviderEvent", ProviderEventSchema);

export default ProviderEvent;
