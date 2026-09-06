import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One playable title from a provider's catalogue (X2, chapter 04 section 3.2).
 *
 * This is a CACHE of the provider's `GET /v1/games` response, not a source of truth about
 * what players can play. Chapter 04 section 3.2 makes that distinction load-bearing:
 *
 *   `providerStatus`   what the PROVIDER says about the title
 *   `chartvoltEnabled` what WE say about it
 *
 * They are independent on purpose. A provider marking a game `active` does not make it
 * live here - we enable each title ourselves after testing it. Collapsing these into one
 * flag would hand a third party the ability to put an untested game in front of paying
 * players by changing a value in their own database.
 */
export interface IProviderGame extends Document {
  providerKey: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  description?: string;
  thumbnailUrl?: string;
  category?: string;
  family: "independent" | "head_to_head";
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  supportsPractice: boolean;
  supportsContentSeed: boolean;
  scoreDirection: "higher_is_better" | "lower_is_better";
  scoreType: "integer" | "decimal" | "duration_ms";
  scoreRange?: { min?: number; max?: number };
  typicalDurationSeconds?: number;
  maxDurationSeconds?: number;
  /** JSON Schema from the provider. The admin contest form is generated from this. */
  configSchema?: Record<string, unknown>;
  providerStatus: "active" | "deprecated" | "maintenance";
  chartvoltEnabled: boolean;
  lastSyncedAt?: Date;
  lastSuccessfulRoundAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderGameSchema = new Schema<IProviderGame>(
  {
    providerKey: {
      type: String,
      required: true,
      index: true,
      immutable: true,
      trim: true,
    },
    // Reason: the provider guarantees `gameCode` is stable and permanent (chapter 01
    // section 3). Immutable here so a catalogue sync cannot silently repoint a row at a
    // different title, which would rewrite the meaning of every stat joined to it.
    gameCode: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
    // Reason: `provider:{providerKey}:{gameCode}`, derived ONCE and never recomputed
    // (chapter 02 section 2.1). This is the join key for all historical stats, so it
    // carries the same immutability rule as the contest-level `gameKey`.
    gameKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String },
    thumbnailUrl: { type: String },
    category: { type: String },

    // Capability declarations from the catalogue. These drive what contest formats the
    // admin panel may offer, so they are required rather than defaulted - a title whose
    // family we did not receive is a title we cannot safely schedule.
    family: {
      type: String,
      enum: ["independent", "head_to_head"],
      required: true,
    },
    supportsCompetition: { type: Boolean, default: false },
    supportsOneVsOne: { type: Boolean, default: false },
    supportsPractice: { type: Boolean, default: false },
    // Reason: required for competitions (chapter 01 section 3) - without a content seed
    // every player gets different content and the contest is not a fair comparison.
    supportsContentSeed: { type: Boolean, default: false },

    scoreDirection: {
      type: String,
      enum: ["higher_is_better", "lower_is_better"],
      required: true,
    },
    scoreType: {
      type: String,
      enum: ["integer", "decimal", "duration_ms"],
      required: true,
    },
    // Reason: used to reject impossible scores at ingestion (chapter 07 section 4). Not
    // required, because a provider need not declare bounds - absent means "unbounded",
    // which must read differently from a declared range of zero.
    scoreRange: {
      min: { type: Number },
      max: { type: Number },
    },

    typicalDurationSeconds: { type: Number },
    maxDurationSeconds: { type: Number },

    // Reason: Mixed because this is a JSON Schema supplied by the provider, whose shape we
    // do not control and must not constrain. It is never executed and never trusted - the
    // admin form is generated from it and the resulting config is validated against it.
    configSchema: {
      type: Schema.Types.Mixed,
    },

    providerStatus: {
      type: String,
      enum: ["active", "deprecated", "maintenance"],
      default: "active",
    },
    // Reason: OUR switch, and it defaults to false. See the class comment - a catalogue
    // sync must never be able to put a title in front of paying players by itself.
    chartvoltEnabled: {
      type: Boolean,
      default: false,
    },

    lastSyncedAt: { type: Date },
    lastSuccessfulRoundAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "provider_game",
  },
);

// Chapter 04 section 3.2: one row per title per provider.
ProviderGameSchema.index({ providerKey: 1, gameCode: 1 }, { unique: true });

// Reason: the catalogue picker and the games list both filter on "what can players
// actually see", which is our flag and the provider's status together.
ProviderGameSchema.index({ chartvoltEnabled: 1, providerStatus: 1 });

const ProviderGame: Model<IProviderGame> =
  mongoose.models.ProviderGame ||
  mongoose.model<IProviderGame>("ProviderGame", ProviderGameSchema);

export default ProviderGame;
